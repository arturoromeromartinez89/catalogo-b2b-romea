-- ============================================================================
-- CAPITAL Y ACTIVOS FIJOS — módulo "Mi inversión"
-- Archivo: supabase/capital-activos-setup.sql
-- Correr una sola vez en Supabase → SQL Editor (es aditivo: NO borra nada).
--
-- Responde: ¿cuánto puse de mi bolsa? · ¿cuánto me debe el negocio? ·
--           ¿cuánto vale mi maquinaria hoy?
--
-- Son tablas-documento (como gastos o remisiones): el libro financiero de
-- doble partida de la Fase C las leerá después. No se rehacen.
-- ============================================================================

-- ── 1. Movimientos de capital (aportaciones y retiros del dueño/socios) ──────
create table if not exists public.movimientos_capital (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,

  fecha       date not null default current_date,
  tipo        text not null check (tipo in ('aportacion', 'retiro')),
  monto_mxn   numeric(14, 2) not null check (monto_mxn >= 0),
  concepto    text not null,
  socio       text,                              -- quién aporta/retira (texto simple)
  cuenta_id   uuid references public.cuentas_caja_banco(id) on delete set null,
  metodo      text default 'transferencia',
  notas       text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.movimientos_capital enable row level security;

drop policy if exists "capital read by tenant" on public.movimientos_capital;
drop policy if exists "capital write by tenant admin" on public.movimientos_capital;

create policy "capital read by tenant"
on public.movimientos_capital for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

create policy "capital write by tenant admin"
on public.movimientos_capital for all
using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

create index if not exists idx_movimientos_capital_tenant on public.movimientos_capital(tenant_id, fecha desc);

-- ── 2. Activos fijos (maquinaria, equipo) con depreciación lineal ────────────
create table if not exists public.activos_fijos (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,

  nombre              text not null,
  categoria           text not null default 'maquinaria' check (categoria in (
                        'maquinaria', 'equipo', 'herramienta', 'mobiliario', 'vehiculo', 'otro'
                      )),
  fecha_compra        date not null default current_date,
  costo_mxn           numeric(14, 2) not null check (costo_mxn >= 0),
  valor_residual_mxn  numeric(14, 2) not null default 0,
  vida_util_meses     integer not null default 60 check (vida_util_meses > 0),  -- 60 = 5 años
  proveedor           text,
  notas               text,
  estatus             text not null default 'activo' check (estatus in ('activo', 'baja')),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.activos_fijos enable row level security;

drop policy if exists "activos read by tenant" on public.activos_fijos;
drop policy if exists "activos write by tenant admin" on public.activos_fijos;

create policy "activos read by tenant"
on public.activos_fijos for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

create policy "activos write by tenant admin"
on public.activos_fijos for all
using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

create index if not exists idx_activos_fijos_tenant on public.activos_fijos(tenant_id, fecha_compra desc);

-- ── Verificación ──────────────────────────────────────────────────────────
-- Debe devolver las dos tablas con sus columnas:
select table_name, count(*) as columnas
from information_schema.columns
where table_schema = 'public' and table_name in ('movimientos_capital', 'activos_fijos')
group by table_name;
