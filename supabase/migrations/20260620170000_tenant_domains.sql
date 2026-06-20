-- Verified customer domains used by the central SaaS deployment.
-- Domain authorization is security-sensitive: tenant admins can inspect their
-- installation, but only a superadmin can create, verify, or change one.
create table if not exists public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hostname text not null,
  path_prefix text not null default '/catalogo',
  status text not null default 'pending'
    check (status in ('pending', 'active', 'disabled')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_domains_hostname_format check (
    hostname = lower(hostname)
    and hostname ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
  ),
  constraint tenant_domains_path_format check (
    path_prefix ~ '^/[a-z0-9][a-z0-9/_-]*$'
    and right(path_prefix, 1) <> '/'
  ),
  unique (hostname, path_prefix)
);
create index if not exists tenant_domains_tenant_id_idx
  on public.tenant_domains (tenant_id);
alter table public.tenant_domains enable row level security;
drop policy if exists "tenant admins read own domains" on public.tenant_domains;
create policy "tenant admins read own domains" on public.tenant_domains
for select to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);
drop policy if exists "superadmins manage tenant domains" on public.tenant_domains;
create policy "superadmins manage tenant domains" on public.tenant_domains
for all to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());
drop trigger if exists set_tenant_domains_updated_at on public.tenant_domains;
create trigger set_tenant_domains_updated_at
before update on public.tenant_domains
for each row execute function public.set_updated_at();
-- Paco's requested installation. This is idempotent and only activates the
-- row when the Estuches Chavez tenant already exists.
insert into public.tenant_domains (
  tenant_id,
  hostname,
  path_prefix,
  status,
  verified_at
)
select id, 'www.estucheschavez.com.mx', '/catalogo', 'active', now()
from public.tenants
where slug = 'estuches-chavez'
on conflict (hostname, path_prefix) do update
set status = excluded.status,
    verified_at = coalesce(public.tenant_domains.verified_at, excluded.verified_at),
    updated_at = now()
where public.tenant_domains.tenant_id = excluded.tenant_id;
notify pgrst, 'reload schema';
