-- ============================================================
-- PROPUESTA SQL: Componentes configurables para ROMEA
-- Archivo: supabase/product_components_PROPUESTA.sql
-- Estado: PROPUESTA. No ejecutar en produccion sin revision final.
-- Fecha: 2026-06-08
-- ============================================================
--
-- Contexto:
-- ROMEA requiere configurar piezas armadas por partes:
-- tejido, tipo de pieza, broche, ancho, largo, terminado, etc.
--
-- Esta propuesta NO modifica la tabla products. La nueva tabla convive
-- con products para alimentar un configurador comercial en preorden.
--
-- Reglas de seguridad:
-- - Toda fila pertenece a un tenant.
-- - Lectura: usuarios autenticados del mismo tenant o superadmin.
-- - Escritura: solo superadmin o admin/tenant_admin del mismo tenant.
--
-- IMPORTANTE:
-- Este archivo es una propuesta para revisar. No se ejecuta todavia.
-- ============================================================


-- ============================================================
-- Tabla principal: product_components
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

  -- Peso o valor fisico del componente. Para la primera fase se usara
  -- principalmente peso en gramos, pero se permite mm/cm/pza para catalogar
  -- componentes de medida.
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


-- ============================================================
-- Tabla fase 2: configurable_product_rules
-- ============================================================
--
-- Objetivo:
-- Definir combinaciones validas entre componentes.
--
-- Ejemplo:
-- tejido CHI + tipo_pieza => BRC, CHN, IDB, IDL
--
-- En fase 1 puede no ser necesaria. Se deja propuesta para revision.
-- ============================================================

create table if not exists public.configurable_product_rules (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete cascade,

  tejido_codigo text not null,
  tipo_componente text not null,
  opciones_codigos text[] not null default '{}',

  requerido boolean not null default true,
  orden integer not null default 0,
  activo boolean not null default true,

  created_at timestamptz not null default now(),

  constraint configurable_product_rules_key
    unique (tenant_id, tejido_codigo, tipo_componente)
);

alter table public.configurable_product_rules enable row level security;

drop policy if exists "rules read by tenant" on public.configurable_product_rules;
drop policy if exists "rules write by tenant admin" on public.configurable_product_rules;

create policy "rules read by tenant"
on public.configurable_product_rules
for select
using (
  public.is_superadmin()
  or tenant_id = public.current_tenant_id()
);

create policy "rules write by tenant admin"
on public.configurable_product_rules
for all
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

create index if not exists idx_configurable_rules_tenant
  on public.configurable_product_rules(tenant_id);

create index if not exists idx_configurable_rules_tejido
  on public.configurable_product_rules(tenant_id, tejido_codigo);


-- ============================================================
-- Formato sugerido de Excel para cargar componentes
-- ============================================================
--
-- codigo
-- nombre
-- tipo
-- descripcion
-- peso
-- unidad
-- foto_url
-- visible_web
-- estatus
-- orden
-- tags_busqueda
-- metadata
--
-- Ejemplos:
-- CHI, Chino, tejido, Tejido chino, 0, g, https://..., true, activo, 10, chino tejido, {}
-- BRC, Pulso, tipo_pieza, Pulso configurado, 0, pza, https://..., true, activo, 20, pulso bracelet, {}
-- 10MM, 10MM, ancho_cadena, Ancho de cadena 10MM, 0, mm, https://..., true, activo, 30, cadena 10mm, {}
--
-- ============================================================
-- Notas de implementacion
-- ============================================================
--
-- 1. products sigue siendo la base de SKUs reales.
-- 2. product_components alimenta el configurador visual.
-- 3. Una preorden configurada puede guardar:
--    - producto base
--    - componentes seleccionados
--    - descripcion final
--    - peso estimado
--    - comentarios
-- 4. La relacion inicial puede ser por convencion de codigo:
--    productos tipo 001-CHI-BRC-10MM usan tejido CHI y ancho 10MM.
-- 5. Si se requiere historico completo de configuraciones, se deberia
--    agregar una columna JSONB en preorder_items o una tabla hija para
--    configuraciones. Eso se debe revisar en una fase separada.
-- ============================================================
