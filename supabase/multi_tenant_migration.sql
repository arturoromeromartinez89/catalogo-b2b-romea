-- Migracion de soporte SaaS multiempresa.
-- Ejecutar en Supabase SQL Editor.
-- Objetivo:
-- 1. Mantener superadmin sin tenant operativo.
-- 2. Asignar el admin operativo a ROMEA.
-- 3. Asegurar que productos sean unicos por empresa, no globalmente.
-- 4. Asegurar lectura/administracion de tenants y profiles por superadmin.

create extension if not exists "pgcrypto";

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

insert into public.tenants (id, name, slug, status)
values ('77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb', 'ROMEA', 'romea', 'active')
on conflict (slug) do update
set name = excluded.name,
    status = excluded.status,
    updated_at = now();

update public.profiles
set role = 'superadmin',
    tenant_id = null
where lower(email) = lower('arturo.romero.martinez89@gmail.com');

update public.profiles
set role = 'tenant_admin',
    tenant_id = '77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb'
where lower(email) = lower('arturo.romero@vanguardiajoyera.com');

-- Si existian datos sin empresa, quedan asignados a ROMEA para evitar que se mezclen con futuros tenants.
update public.clients
set tenant_id = '77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb'
where tenant_id is null;

update public.products
set tenant_id = '77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb'
where tenant_id is null;

update public.catalogs
set tenant_id = '77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb'
where tenant_id is null;

update public.price_lists
set tenant_id = '77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb'
where tenant_id is null;

update public.product_lines
set tenant_id = '77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb'
where tenant_id is null;

update public.metal_prices
set tenant_id = '77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb'
where tenant_id is null;

update public.company_settings
set tenant_id = '77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb'
where tenant_id is null;

update public.preorders
set tenant_id = '77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb'
where tenant_id is null;

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

alter table public.tenants enable row level security;

drop policy if exists "tenants admin read" on public.tenants;
drop policy if exists "superadmins manage tenants" on public.tenants;

create policy "tenants admin read" on public.tenants
for select using (public.is_superadmin() or id = public.current_tenant_id());

create policy "superadmins manage tenants" on public.tenants
for all using (public.is_superadmin())
with check (public.is_superadmin());

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

-- SKU unico por empresa.
alter table public.products drop constraint if exists products_codigo_key;
drop index if exists products_tenant_codigo_key;
create unique index products_tenant_codigo_key
on public.products (tenant_id, codigo);
