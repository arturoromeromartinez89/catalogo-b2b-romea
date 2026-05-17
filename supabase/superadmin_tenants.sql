-- Activacion de superadmin y administracion de empresas.
-- Ejecutar en Supabase SQL Editor despues de tenant_romea_migration.sql.

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

-- Permite que distintas empresas usen el mismo SKU sin chocar entre si.
alter table public.products drop constraint if exists products_codigo_key;
create unique index if not exists products_tenant_codigo_key
on public.products (tenant_id, codigo);

insert into public.tenants (name, slug, status)
values ('ROMEA', 'romea', 'active')
on conflict (slug) do update
set name = excluded.name,
    status = excluded.status,
    updated_at = now();

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

-- Cambia este correo por el usuario que sera superadmin global.
-- Para Arturo:
update public.profiles
set role = 'superadmin',
    tenant_id = null
where lower(email) = lower('arturo.romero.martinez89@gmail.com');

-- Asigna cualquier dato historico sin empresa a ROMEA para evitar mezcla accidental.
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
