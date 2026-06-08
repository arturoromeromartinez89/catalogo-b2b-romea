-- ============================================================
-- Componentes configurables para ROMEA / tenants configurables
-- Archivo: supabase/product_components.sql
-- Fecha: 2026-06-08
-- ============================================================
--
-- Objetivo:
-- Crear una base de datos independiente de componentes para armar
-- piezas configurables dentro de preorden:
-- base = tejido + ancho
-- componentes = tipo de pieza, broche, largo, terminado, etc.
--
-- Este SQL NO borra products, clientes, preordenes ni listas de precios.
-- ============================================================

create table if not exists public.product_components (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  codigo text not null,
  nombre text not null,

  tipo text not null check (tipo in (
    'tejido',
    'tipo_pieza',
    'broche',
    'ancho_cadena',
    'ancho_placa',
    'largo',
    'terminado',
    'piedra',
    'accesorio',
    'otro'
  )),

  descripcion text,
  peso numeric(10, 4) default 0,
  unidad text default 'g' check (unidad in ('g', 'mm', 'cm', 'pza')),
  foto_url text,
  visible_web boolean not null default true,
  estatus text not null default 'activo' check (estatus in ('activo', 'inactivo')),
  orden integer not null default 0,
  tags_busqueda text,
  metadata jsonb not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint product_components_tenant_codigo_key unique (tenant_id, codigo)
);

alter table public.product_components enable row level security;

drop policy if exists "components read by tenant" on public.product_components;
drop policy if exists "components write by tenant admin" on public.product_components;

create policy "components read by tenant"
on public.product_components
for select
using (
  public.is_superadmin()
  or tenant_id = public.current_tenant_id()
);

create policy "components write by tenant admin"
on public.product_components
for all
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

create index if not exists idx_product_components_tenant
  on public.product_components(tenant_id);

create index if not exists idx_product_components_tipo
  on public.product_components(tenant_id, tipo);

create index if not exists idx_product_components_estatus
  on public.product_components(tenant_id, estatus);

create index if not exists idx_product_components_orden
  on public.product_components(tenant_id, tipo, orden);

-- Formato recomendado para Excel de componentes:
-- codigo, nombre, tipo, descripcion, peso, unidad, foto_url,
-- visible_web, estatus, orden, tags_busqueda
--
-- Ejemplos:
-- CADENA, Cadena, tipo_pieza, Tipo cadena, 0, pza, , true, activo, 10, cadena
-- ESCLAVA, Esclava, tipo_pieza, Tipo esclava, 0, pza, , true, activo, 20, esclava
-- BROCHE-MILITAR, Broche militar, broche, Broche militar, 0.25, g, , true, activo, 10, broche militar
-- 21CM, 21 cm, largo, Largo 21 cm, 0, cm, , true, activo, 21, largo 21
-- LISO, Liso, terminado, Terminado liso, 0, pza, , true, activo, 10, liso
