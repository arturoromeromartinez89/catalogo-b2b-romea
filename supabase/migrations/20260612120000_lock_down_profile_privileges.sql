-- Prevent tenant administrators from escalating privileges through profiles.
--
-- A tenant admin may read profiles in their tenant and update client accounts
-- in that same tenant. Only a superadmin may create/delete profiles or change
-- administrative profiles, roles, or tenant assignments.

alter table public.profiles
  add column if not exists active boolean not null default true;

-- Repair historical client profiles before restricting tenant_id changes.
update public.profiles p
set client_id = coalesce(p.client_id, c.id),
    tenant_id = coalesce(p.tenant_id, c.tenant_id)
from public.clients c
where lower(p.email) = lower(c.email)
  and p.role = 'client'
  and c.active is true
  and c.created_at <= p.created_at
  and not exists (
    select 1
    from public.clients other_client
    where other_client.id <> c.id
      and other_client.active is true
      and lower(other_client.email) = lower(c.email)
  )
  and (p.client_id is null or p.tenant_id is null);

-- A profile created before its matching client is a pre-registration risk.
-- Keep it unlinked and inactive for explicit superadmin review.
update public.profiles
set active = false
where role = 'client'
  and (client_id is null or tenant_id is null);

-- Fail closed instead of installing policies over inconsistent identities.
do $$
begin
  if exists (
    select 1
    from public.profiles p
    join public.clients c on c.id = p.client_id
    where p.role = 'client'
      and p.tenant_id is distinct from c.tenant_id
  ) then
    raise exception 'profile privilege migration blocked: cross-tenant client profile links exist';
  end if;
end
$$;

alter table public.profiles enable row level security;

drop policy if exists "profiles own or admin" on public.profiles;
drop policy if exists "admins manage profiles" on public.profiles;
drop policy if exists "profiles read authorized" on public.profiles;
drop policy if exists "tenant admins update client profiles" on public.profiles;
drop policy if exists "superadmins insert profiles" on public.profiles;
drop policy if exists "superadmins delete profiles" on public.profiles;

create policy "profiles read authorized"
on public.profiles
for select
using (
  id = auth.uid()
  or public.is_superadmin()
  or (
    public.is_tenant_admin()
    and tenant_id = public.current_tenant_id()
  )
);

create policy "tenant admins update client profiles"
on public.profiles
for update
using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and role = 'client'
    and tenant_id = public.current_tenant_id()
  )
)
with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and role = 'client'
    and tenant_id = public.current_tenant_id()
  )
);

create policy "superadmins insert profiles"
on public.profiles
for insert
with check (public.is_superadmin());

create policy "superadmins delete profiles"
on public.profiles
for delete
using (public.is_superadmin());

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  actor_tenant_id uuid;
begin
  -- SQL migrations and trusted server operations may run without a user JWT.
  -- RLS still prevents anon/authenticated callers without a valid auth.uid().
  if actor_id is null then
    return new;
  end if;

  select p.role, p.tenant_id
  into actor_role, actor_tenant_id
  from public.profiles p
  where p.id = actor_id;

  if actor_role = 'superadmin' then
    return new;
  end if;

  if actor_role not in ('tenant_admin', 'admin')
    or old.role <> 'client'
    or old.tenant_id is distinct from actor_tenant_id then
    raise exception 'profile update is not permitted'
      using errcode = '42501';
  end if;

  if (to_jsonb(new) - array['active', 'client_id'])
    is distinct from
    (to_jsonb(old) - array['active', 'client_id']) then
    raise exception 'privileged profile fields cannot be changed by a tenant administrator'
      using errcode = '42501';
  end if;

  if new.client_id is not null and not exists (
    select 1
    from public.clients c
    where c.id = new.client_id
      and c.tenant_id = actor_tenant_id
  ) then
    raise exception 'client_id must belong to the administrator tenant'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_privileged_fields() from public;

drop trigger if exists protect_profile_privileged_fields on public.profiles;
create trigger protect_profile_privileged_fields
before update on public.profiles
for each row
execute function public.protect_profile_privileged_fields();

-- The Auth trigger that creates client profiles runs as the function owner and
-- is not replaced here. Confirm that public.handle_new_user remains SECURITY
-- DEFINER before applying this migration in an environment.
