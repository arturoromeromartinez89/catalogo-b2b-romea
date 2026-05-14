-- Migracion inicial multiempresa para activar ROMEA como primer tenant.
-- Ejecutar una sola vez en Supabase SQL Editor antes de desplegar el codigo nuevo.

create extension if not exists "pgcrypto";

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.tenants (name, slug, status)
values ('ROMEA', 'romea', 'active')
on conflict (slug) do update
set name = excluded.name,
    status = excluded.status,
    updated_at = now();

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('superadmin', 'tenant_admin', 'admin', 'client'));

alter table public.profiles add column if not exists tenant_id uuid references public.tenants(id) on delete set null;
alter table public.clients add column if not exists tenant_id uuid references public.tenants(id) on delete set null;
alter table public.products add column if not exists tenant_id uuid references public.tenants(id) on delete set null;
alter table public.catalogs add column if not exists tenant_id uuid references public.tenants(id) on delete set null;
alter table public.price_lists add column if not exists tenant_id uuid references public.tenants(id) on delete set null;
alter table public.product_lines add column if not exists tenant_id uuid references public.tenants(id) on delete set null;
alter table public.metal_prices add column if not exists tenant_id uuid references public.tenants(id) on delete set null;
alter table public.company_settings add column if not exists tenant_id uuid references public.tenants(id) on delete set null;
alter table public.preorders add column if not exists tenant_id uuid references public.tenants(id) on delete set null;

update public.profiles
set tenant_id = (select id from public.tenants where slug = 'romea')
where tenant_id is null;

update public.clients
set tenant_id = (select id from public.tenants where slug = 'romea')
where tenant_id is null;

update public.products
set tenant_id = (select id from public.tenants where slug = 'romea')
where tenant_id is null;

update public.catalogs
set tenant_id = (select id from public.tenants where slug = 'romea')
where tenant_id is null;

update public.price_lists
set tenant_id = (select id from public.tenants where slug = 'romea')
where tenant_id is null;

update public.product_lines
set tenant_id = (select id from public.tenants where slug = 'romea')
where tenant_id is null;

update public.metal_prices
set tenant_id = (select id from public.tenants where slug = 'romea')
where tenant_id is null;

update public.company_settings
set tenant_id = (select id from public.tenants where slug = 'romea')
where tenant_id is null;

update public.preorders
set tenant_id = (select id from public.tenants where slug = 'romea')
where tenant_id is null;

update public.profiles
set role = 'tenant_admin',
    tenant_id = (select id from public.tenants where slug = 'romea')
where lower(email) = lower('arturo.romero.martinez89@gmail.com');

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'superadmin');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('superadmin', 'tenant_admin', 'admin')
  );
$$;

create or replace function public.is_tenant_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('tenant_admin', 'admin')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  matched_client uuid;
  matched_tenant uuid;
  default_tenant uuid;
begin
  select id into default_tenant from public.tenants where slug = 'romea' limit 1;

  select id, tenant_id
    into matched_client, matched_tenant
  from public.clients
  where lower(email) = lower(new.email)
  limit 1;

  insert into public.profiles (id, email, role, client_id, tenant_id)
  values (
    new.id,
    new.email,
    'client',
    matched_client,
    coalesce(matched_tenant, default_tenant)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.products enable row level security;
alter table public.company_settings enable row level security;
alter table public.product_lines enable row level security;
alter table public.metal_prices enable row level security;
alter table public.preorders enable row level security;
alter table public.preorder_items enable row level security;

drop policy if exists "tenants admin read" on public.tenants;
create policy "tenants admin read" on public.tenants
for select using (public.is_superadmin() or id = public.current_tenant_id());

drop policy if exists "profiles own or admin" on public.profiles;
create policy "profiles own or admin" on public.profiles
for select using (
  id = auth.uid()
  or public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

drop policy if exists "admins manage clients" on public.clients;
create policy "admins manage clients" on public.clients
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

drop policy if exists "clients read own client" on public.clients;
create policy "clients read own client" on public.clients
for select using (
  id in (select client_id from public.profiles where id = auth.uid())
  and tenant_id = public.current_tenant_id()
);

drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

drop policy if exists "clients read visible products" on public.products;
create policy "clients read visible products" on public.products
for select using (
  visible_web = true
  and tenant_id = public.current_tenant_id()
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'client')
);

drop policy if exists "admins manage company settings" on public.company_settings;
create policy "admins manage company settings" on public.company_settings
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

drop policy if exists "authenticated read company settings" on public.company_settings;
create policy "authenticated read company settings" on public.company_settings
for select using (tenant_id = public.current_tenant_id());

drop policy if exists "admins manage product lines" on public.product_lines;
create policy "admins manage product lines" on public.product_lines
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

drop policy if exists "authenticated read product lines" on public.product_lines;
create policy "authenticated read product lines" on public.product_lines
for select using (tenant_id = public.current_tenant_id());

drop policy if exists "admins manage metal prices" on public.metal_prices;
create policy "admins manage metal prices" on public.metal_prices
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

drop policy if exists "authenticated read metal prices" on public.metal_prices;
create policy "authenticated read metal prices" on public.metal_prices
for select using (tenant_id = public.current_tenant_id());

drop policy if exists "admins manage preorders" on public.preorders;
create policy "admins manage preorders" on public.preorders
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

drop policy if exists "clients manage own preorders" on public.preorders;
create policy "clients manage own preorders" on public.preorders
for all using (
  client_id in (select client_id from public.profiles where id = auth.uid())
  and tenant_id = public.current_tenant_id()
) with check (
  client_id in (select client_id from public.profiles where id = auth.uid())
  and tenant_id = public.current_tenant_id()
);

drop policy if exists "admins manage preorder items" on public.preorder_items;
create policy "admins manage preorder items" on public.preorder_items
for all using (
  public.is_superadmin()
  or exists (
    select 1
    from public.preorders po
    where po.id = preorder_id
      and po.tenant_id = public.current_tenant_id()
      and public.is_tenant_admin()
  )
) with check (
  public.is_superadmin()
  or exists (
    select 1
    from public.preorders po
    where po.id = preorder_id
      and po.tenant_id = public.current_tenant_id()
      and public.is_tenant_admin()
  )
);

drop policy if exists "clients manage own preorder items" on public.preorder_items;
create policy "clients manage own preorder items" on public.preorder_items
for all using (
  preorder_id in (
    select po.id
    from public.preorders po
    join public.profiles p on p.client_id = po.client_id
    where p.id = auth.uid()
      and po.tenant_id = public.current_tenant_id()
  )
) with check (
  preorder_id in (
    select po.id
    from public.preorders po
    join public.profiles p on p.client_id = po.client_id
    where p.id = auth.uid()
      and po.tenant_id = public.current_tenant_id()
  )
);

