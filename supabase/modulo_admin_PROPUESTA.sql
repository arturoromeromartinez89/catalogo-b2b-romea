-- ============================================================
-- PROPUESTA SQL: Módulo Administrativo ROMEA
-- Archivo : supabase/modulo_admin_PROPUESTA.sql
-- Estado  : PROPUESTA — pendiente de revisión y aprobación de Codex
--           NO ejecutar en producción sin validar
-- Fecha   : 2026-06-08
-- ============================================================
--
-- Operación real de ROMEA:
--   - Ventas exportación USA en USD (labor + plata fina en USD)
--   - Ventas México: labor en MXN + plata en GRAMOS (dos deudas separadas)
--   - Un cliente puede pagar:
--       · Labor con efectivo MXN/USD
--       · Labor con plata física (genera ganancia/pérdida cambiaria)
--       · Plata con efectivo MXN/USD (convierte al Kitco del día)
--       · Plata con plata física (gramos directos)
--   - Plata comprada en .999, convertida a .925 (factor 1.075)
--   - Compra de plata el mismo día del cobro (mínimo riesgo)
--   - Cajas: Efectivo MXN, Banco MXN, Mercado Pago, Caja Plata (gramos)
--   - Costos directos: destajo $2.70/g + vaciado $1.00/g + insumos $1.00/g
--   - Gastos fijos mensuales recurrentes automáticos
--   - Remisiones: desde preorden, captura manual, o Excel
--   - La preorden cotiza siempre como: labor/g + plata_fina/g
--
-- Tablas nuevas (NO modifica ninguna existente):
--   tenant_features, centros_costo, categorias_gasto,
--   cuentas_caja_banco, movimientos_caja_banco,
--   compras_plata, produccion_semanal,
--   remisiones, remision_items, cobros,
--   gastos_recurrentes, gastos, pagos
-- ============================================================


-- ============================================================
-- 1. FEATURE FLAGS POR TENANT
-- ============================================================

create table if not exists public.tenant_features (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  modulo_admin        boolean not null default false,
  modulo_configurable boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint tenant_features_tenant_key unique (tenant_id)
);

alter table public.tenant_features enable row level security;

drop policy if exists "features read by tenant" on public.tenant_features;
create policy "features read by tenant"
on public.tenant_features for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

drop policy if exists "features write by superadmin" on public.tenant_features;
create policy "features write by superadmin"
on public.tenant_features for all
using (public.is_superadmin())
with check (public.is_superadmin());

-- Activar ROMEA (ejecutar una vez con el UUID real):
-- insert into public.tenant_features (tenant_id, modulo_admin, modulo_configurable)
-- values ('<UUID_ROMEA>', true, true)
-- on conflict (tenant_id) do update set modulo_admin = true, modulo_configurable = true;


-- ============================================================
-- 2. CENTROS DE COSTO
-- ============================================================

create table if not exists public.centros_costo (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  nombre      text not null,
  descripcion text,
  activo      boolean not null default true,
  orden       integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint centros_costo_tenant_nombre_key unique (tenant_id, nombre)
);

alter table public.centros_costo enable row level security;

drop policy if exists "centros read by tenant" on public.centros_costo;
create policy "centros read by tenant"
on public.centros_costo for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

drop policy if exists "centros write by admin" on public.centros_costo;
create policy "centros write by admin"
on public.centros_costo for all
using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

-- Sugeridos para ROMEA: Producción, Ventas, Administración, Personal, Envíos


-- ============================================================
-- 3. CATEGORÍAS DE GASTO
-- ============================================================

create table if not exists public.categorias_gasto (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  nombre      text not null,
  descripcion text,
  activo      boolean not null default true,
  orden       integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint categorias_gasto_tenant_nombre_key unique (tenant_id, nombre)
);

alter table public.categorias_gasto enable row level security;

drop policy if exists "categorias read by tenant" on public.categorias_gasto;
create policy "categorias read by tenant"
on public.categorias_gasto for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

drop policy if exists "categorias write by admin" on public.categorias_gasto;
create policy "categorias write by admin"
on public.categorias_gasto for all
using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

-- Sugeridas: Renta, Internet, Sueldo fijo, Destajo, Vaciado,
--            Insumos, Empaque y envío, Contador, Compra de plata, Otros


-- ============================================================
-- 4. CUENTAS DE CAJA Y BANCO
-- ============================================================
-- Maneja cuatro tipos:
--   efectivo   = dinero físico MXN
--   banco      = cuenta bancaria MXN
--   plataforma = Mercado Pago, PayPal, etc.
--   plata      = inventario de plata fina en GRAMOS (.925)

create table if not exists public.cuentas_caja_banco (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  nombre          text not null,
  tipo            text not null check (tipo in ('efectivo', 'banco', 'plataforma', 'plata')),

  -- Cuentas de dinero (efectivo/banco/plataforma)
  moneda          text not null default 'MXN' check (moneda in ('MXN', 'USD', 'GRM')),
  saldo_inicial   numeric(18, 4) not null default 0,
  saldo_actual    numeric(18, 4) not null default 0,

  -- Caja de plata (tipo = 'plata', moneda = 'GRM')
  gramos_iniciales    numeric(14, 4) not null default 0,
  gramos_actuales     numeric(14, 4) not null default 0,
  costo_promedio_mxn  numeric(14, 4) not null default 0,
  -- costo_promedio_mxn = costo promedio ponderado por gramo .925
  -- Se recalcula con cada compra de plata (promedio ponderado)

  activo          boolean not null default true,
  orden           integer not null default 0,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint cuentas_tenant_nombre_key unique (tenant_id, nombre)
);

alter table public.cuentas_caja_banco enable row level security;

drop policy if exists "cuentas read by tenant" on public.cuentas_caja_banco;
create policy "cuentas read by tenant"
on public.cuentas_caja_banco for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

drop policy if exists "cuentas write by admin" on public.cuentas_caja_banco;
create policy "cuentas write by admin"
on public.cuentas_caja_banco for all
using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

create index if not exists idx_cuentas_tenant on public.cuentas_caja_banco(tenant_id);
create index if not exists idx_cuentas_tipo   on public.cuentas_caja_banco(tenant_id, tipo);

-- Cuentas iniciales ROMEA:
--   Efectivo taller  | efectivo   | MXN
--   Banco BBVA       | banco      | MXN
--   Mercado Pago     | plataforma | MXN
--   Caja Plata .925  | plata      | GRM


-- ============================================================
-- 5. MOVIMIENTOS DE CAJA/BANCO
-- ============================================================
-- Registro inmutable. Cada cobro, pago, compra o ajuste genera una línea.

create table if not exists public.movimientos_caja_banco (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  fecha           date not null,
  caja_banco_id   uuid not null references public.cuentas_caja_banco(id),
  tipo            text not null check (tipo in ('entrada', 'salida')),
  origen          text not null check (origen in (
                    'cobro', 'pago_gasto', 'compra_plata',
                    'produccion', 'ajuste', 'apertura'
                  )),
  -- Dinero
  monto           numeric(18, 4) not null default 0,
  moneda          text not null default 'MXN' check (moneda in ('MXN', 'USD', 'GRM')),
  tipo_cambio     numeric(10, 4),
  monto_mxn       numeric(18, 4),
  -- Plata
  gramos          numeric(14, 4),
  costo_gramo_mxn numeric(14, 4),
  -- Saldos resultantes
  saldo_resultante    numeric(18, 4),
  gramos_resultantes  numeric(14, 4),
  -- Referencia
  referencia_id   uuid,
  descripcion     text,
  created_at      timestamptz not null default now()
);

alter table public.movimientos_caja_banco enable row level security;

drop policy if exists "movimientos read by tenant" on public.movimientos_caja_banco;
create policy "movimientos read by tenant"
on public.movimientos_caja_banco for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

drop policy if exists "movimientos write by admin" on public.movimientos_caja_banco;
create policy "movimientos write by admin"
on public.movimientos_caja_banco for all
using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

create index if not exists idx_mov_tenant  on public.movimientos_caja_banco(tenant_id);
create index if not exists idx_mov_fecha   on public.movimientos_caja_banco(tenant_id, fecha);
create index if not exists idx_mov_cuenta  on public.movimientos_caja_banco(caja_banco_id);


-- ============================================================
-- 6. COMPRAS DE PLATA FINA
-- ============================================================
-- Compra de .999 con conversión automática a .925 (factor 1.075).

create table if not exists public.compras_plata (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  fecha           date not null,

  -- Plata comprada en .999
  gramos_999              numeric(14, 4) not null,
  precio_mxn_por_gramo_999 numeric(14, 4) not null,
  costo_total_mxn         numeric(18, 4) not null,

  -- Referencia Kitco
  kitco_usd_oz    numeric(10, 4),
  tipo_cambio     numeric(10, 4),

  -- Conversión a .925
  factor_conversion        numeric(8, 6) not null default 1.075000,
  gramos_925_resultantes   numeric(14, 4) not null,
  -- gramos_925 = gramos_999 × 1.075
  costo_por_gramo_925      numeric(14, 4) not null,
  -- costo/g_925 = costo_total ÷ gramos_925_resultantes

  caja_banco_id   uuid references public.cuentas_caja_banco(id),
  cuenta_plata_id uuid references public.cuentas_caja_banco(id),
  proveedor       text,
  notas           text,
  created_at      timestamptz not null default now()
);

alter table public.compras_plata enable row level security;

drop policy if exists "compras_plata read by tenant" on public.compras_plata;
create policy "compras_plata read by tenant"
on public.compras_plata for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

drop policy if exists "compras_plata write by admin" on public.compras_plata;
create policy "compras_plata write by admin"
on public.compras_plata for all
using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

create index if not exists idx_compras_plata_tenant on public.compras_plata(tenant_id);
create index if not exists idx_compras_plata_fecha  on public.compras_plata(tenant_id, fecha);


-- ============================================================
-- 7. PRODUCCIÓN SEMANAL
-- ============================================================

create table if not exists public.produccion_semanal (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  fecha_inicio    date not null,
  fecha_fin       date not null,

  gramos_producidos       numeric(14, 4) not null,

  -- Costos directos por gramo (MXN)
  costo_mo_gramo          numeric(10, 4) not null default 2.70,
  costo_vaciado_gramo     numeric(10, 4) not null default 0,
  costo_insumos_gramo     numeric(10, 4) not null default 1.00,

  -- Totales calculados
  total_mo_mxn            numeric(18, 4) not null default 0,
  total_vaciado_mxn       numeric(18, 4) not null default 0,
  total_insumos_mxn       numeric(18, 4) not null default 0,
  costo_directo_total_mxn numeric(18, 4) not null default 0,
  costo_directo_por_gramo numeric(10, 4) not null default 0,

  cuenta_plata_id         uuid references public.cuentas_caja_banco(id),
  kitco_referencia        numeric(10, 4),
  notas                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint produccion_periodo_key unique (tenant_id, fecha_inicio, fecha_fin)
);

alter table public.produccion_semanal enable row level security;

drop policy if exists "produccion read by tenant" on public.produccion_semanal;
create policy "produccion read by tenant"
on public.produccion_semanal for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

drop policy if exists "produccion write by admin" on public.produccion_semanal;
create policy "produccion write by admin"
on public.produccion_semanal for all
using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

create index if not exists idx_produccion_tenant on public.produccion_semanal(tenant_id);
create index if not exists idx_produccion_fecha  on public.produccion_semanal(tenant_id, fecha_inicio);


-- ============================================================
-- 8. REMISIONES
-- ============================================================
-- Documento de venta. Puede nacer de preorden, captura manual o Excel.
--
-- La moneda determina el modelo de cobro — no hay campo tipo_cliente:
--
--   moneda = 'USD'  →  cliente exportación USA
--     Cobra labor + plata fina todo junto en USD.
--     Deuda de dinero: saldo_dinero (en USD).
--
--   moneda = 'MXN'  →  cliente México
--     Cobra labor en MXN.
--     Deuda de dinero: saldo_dinero (en MXN).
--
-- En AMBOS casos puede existir adicionalmente saldo_plata_gramos
-- si el cliente adeuda plata física (aplica principalmente México).
--
-- La preorden siempre cotiza: labor/g + plata_fina/g.
-- Al convertir preorden → remisión, el sistema usa la moneda
-- para determinar cómo presentar los montos.
--
-- Nota: el módulo de documentación de exportación (pedimento, etc.)
-- se construirá en una fase posterior — no forma parte de esta tabla.

create table if not exists public.remisiones (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,

  folio           text not null,
  fecha           date not null,
  fecha_entrega   date,

  -- Cliente
  client_id       uuid references public.clients(id),
  cliente_nombre  text,
  cliente_empresa text,
  cliente_email   text,
  cliente_telefono text,

  -- Moneda de la remisión — determina el modelo de cobro
  moneda          text not null default 'USD'
                  check (moneda in ('USD', 'MXN')),

  -- Origen del documento
  origen          text not null default 'manual'
                  check (origen in ('preorden', 'manual', 'excel')),
  preorder_id     uuid references public.preorders(id),

  -- Totales en gramos (siempre, base para reporte de margen)
  total_gramos    numeric(14, 4) not null default 0,

  -- ── Deuda en dinero (moneda según campo moneda) ─────────────────
  -- Si moneda = 'USD': todo en dólares (labor + plata fina juntos)
  -- Si moneda = 'MXN': labor en pesos
  subtotal        numeric(14, 4) not null default 0,
  descuento       numeric(14, 4) not null default 0,
  total           numeric(14, 4) not null default 0,
  monto_cobrado   numeric(14, 4) not null default 0,
  saldo_dinero    numeric(14, 4) not null default 0,
  -- saldo_dinero está expresado en la moneda de la remisión

  -- ── Deuda en plata (gramos) ──────────────────────────────────────
  -- Aplica cuando el cliente adeuda plata física.
  -- Principalmente clientes México, pero el campo existe en ambas monedas
  -- por si en el futuro un cliente USA paga con plata.
  cargo_plata_gramos      numeric(14, 4) not null default 0,
  plata_entregada_gramos  numeric(14, 4) not null default 0,
  saldo_plata_gramos      numeric(14, 4) not null default 0,

  -- Precio de referencia al emitir (para calcular ganancias cambiarias después)
  kitco_emision           numeric(10, 4),
  tipo_cambio_emision     numeric(10, 4),
  valor_ref_plata_mxn     numeric(14, 4),
  -- valor_ref = cargo_plata_gramos × kitco_emision × tipo_cambio_emision
  -- Es solo referencia informativa, NO es deuda en dinero

  -- ── Estado ───────────────────────────────────────────────────────
  estado          text not null default 'borrador'
                  check (estado in ('borrador','emitida','entregada','cancelada')),

  metodo_envio    text,
  tracking        text,
  notas           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.remisiones enable row level security;

drop policy if exists "remisiones read by tenant" on public.remisiones;
create policy "remisiones read by tenant"
on public.remisiones for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

drop policy if exists "remisiones write by admin" on public.remisiones;
create policy "remisiones write by admin"
on public.remisiones for all
using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

create index if not exists idx_remisiones_tenant  on public.remisiones(tenant_id);
create index if not exists idx_remisiones_fecha   on public.remisiones(tenant_id, fecha);
create index if not exists idx_remisiones_estado  on public.remisiones(tenant_id, estado);
create index if not exists idx_remisiones_client  on public.remisiones(tenant_id, client_id);
create index if not exists idx_remisiones_moneda  on public.remisiones(tenant_id, moneda);


-- ============================================================
-- 9. ITEMS DE REMISIÓN
-- ============================================================

create table if not exists public.remision_items (
  id              uuid primary key default gen_random_uuid(),
  remision_id     uuid not null references public.remisiones(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,

  producto_codigo   text,
  producto_foto_url text,

  -- Descripción final armada por el configurador
  -- Ej: "ESCLAVA MILITAR TEJIDO CHINO, CADENA 10MM, PLACA 12MM, 21CM, LISO"
  descripcion       text not null,

  -- Configuración guardada para trazabilidad
  configuracion     jsonb default '{}',

  cantidad          integer not null default 1,
  gramos_por_pieza  numeric(10, 4) not null default 0,
  gramos_total      numeric(14, 4) not null default 0,

  -- Precio desglosado (como viene de la preorden)
  labor_mxn_por_gramo   numeric(10, 4) not null default 0,
  plata_fina_mxn_por_gramo numeric(10, 4) not null default 0,
  precio_total_mxn_por_gramo numeric(10, 4) not null default 0,

  -- Para exportación: precio en USD
  precio_usd_por_gramo  numeric(10, 4),
  subtotal_usd          numeric(14, 4),

  -- Para México: labor en MXN, plata en gramos
  subtotal_labor_mxn    numeric(14, 4),
  subtotal_plata_gramos numeric(14, 4),

  -- Costo real de producción (para margen por línea)
  costo_directo_mxn_por_gramo numeric(10, 4),
  costo_directo_total_mxn     numeric(14, 4),

  sort_order        integer not null default 0,
  notas             text
);

alter table public.remision_items enable row level security;

drop policy if exists "remision_items read by tenant" on public.remision_items;
create policy "remision_items read by tenant"
on public.remision_items for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

drop policy if exists "remision_items write by admin" on public.remision_items;
create policy "remision_items write by admin"
on public.remision_items for all
using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

create index if not exists idx_rem_items_remision on public.remision_items(remision_id);
create index if not exists idx_rem_items_tenant   on public.remision_items(tenant_id);


-- ============================================================
-- 10. COBROS
-- ============================================================
-- Modelo de doble entrada: QUÉ se paga + CON QUÉ se paga.
--
-- tipo_abono define QUÉ deuda se reduce:
--   'labor_mxn'     → reduce saldo_labor_mxn de la remisión (clientes México)
--   'plata_gramos'  → reduce saldo_plata_gramos de la remisión (clientes México)
--   'total_usd'     → reduce saldo_usd de la remisión (clientes exportación)
--
-- medio_pago define CON QUÉ se paga:
--   'efectivo_mxn'      → dinero en efectivo MXN
--   'transferencia_usd' → transferencia bancaria USD
--   'plata_fisica'      → entrega física de plata en gramos
--   'mercado_pago'      → plataforma digital
--   'otro'
--
-- Las ganancias/pérdidas cambiarias nacen cuando:
--   - Se paga labor CON plata: convierte gramos a MXN al Kitco del día
--     Ganancia = valor MXN recibido − labor cobrada originalmente
--   - Se paga plata CON efectivo: convierte MXN a gramos al Kitco del día
--     Ganancia = gramos al costo promedio − gramos que "valen" ese dinero

create table if not exists public.cobros (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  remision_id     uuid not null references public.remisiones(id),
  client_id       uuid references public.clients(id),
  fecha_cobro     date not null,

  -- ── QUÉ deuda se está pagando ────────────────────────────────────
  tipo_abono      text not null check (tipo_abono in (
                    'labor_mxn',    -- paga mano de obra (clientes México)
                    'plata_gramos', -- paga deuda de plata (clientes México)
                    'total_usd'     -- paga todo (clientes exportación)
                  )),

  -- Cuánto abona a cada tipo de deuda
  abono_labor_mxn       numeric(14, 4) not null default 0,
  abono_plata_gramos    numeric(14, 4) not null default 0,
  abono_usd             numeric(14, 4) not null default 0,

  -- ── CON QUÉ se paga ──────────────────────────────────────────────
  medio_pago      text not null check (medio_pago in (
                    'efectivo_mxn', 'transferencia_usd',
                    'plata_fisica', 'mercado_pago', 'otro'
                  )),

  -- Si paga con DINERO (efectivo/transferencia)
  monto_recibido        numeric(14, 4),
  moneda_recibida       text check (moneda_recibida in ('MXN', 'USD')),
  tipo_cambio           numeric(10, 4),
  monto_mxn_equivalente numeric(18, 4),
  -- monto_mxn = monto_recibido (si MXN) o monto_recibido × tipo_cambio (si USD)
  caja_banco_id         uuid references public.cuentas_caja_banco(id),

  -- Si paga con PLATA FÍSICA
  gramos_recibidos      numeric(14, 4),
  kitco_dia             numeric(10, 4),  -- precio Kitco al momento del cobro
  tipo_cambio_kitco     numeric(10, 4),  -- TC para convertir USD/oz a MXN/g
  valor_mxn_plata_recibida numeric(14, 4),
  -- valor_mxn = gramos × (kitco_dia/31.1035) × tipo_cambio_kitco
  cuenta_plata_id       uuid references public.cuentas_caja_banco(id),

  -- ── Ganancia / pérdida cambiaria ─────────────────────────────────
  -- Nace cuando el medio de pago y el tipo de deuda son de naturaleza distinta
  -- (plata paga dinero, o dinero paga plata).
  --
  -- Ejemplos:
  --   Paga labor $270 MXN con plata: recibe gramos valuados en $273 MXN → +$3 ganancia
  --   Paga plata (100g) con $1,850 MXN cuando plata vale $1,900 MXN → -$50 pérdida
  ganancia_cambiaria_mxn  numeric(14, 4) not null default 0,
  -- Positivo = ganancia, Negativo = pérdida

  referencia_bancaria   text,
  notas                 text,
  created_by            uuid references auth.users(id),
  created_at            timestamptz not null default now()
);

alter table public.cobros enable row level security;

drop policy if exists "cobros read by tenant" on public.cobros;
create policy "cobros read by tenant"
on public.cobros for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

drop policy if exists "cobros write by admin" on public.cobros;
create policy "cobros write by admin"
on public.cobros for all
using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

create index if not exists idx_cobros_tenant   on public.cobros(tenant_id);
create index if not exists idx_cobros_remision on public.cobros(remision_id);
create index if not exists idx_cobros_fecha    on public.cobros(tenant_id, fecha_cobro);
create index if not exists idx_cobros_tipo     on public.cobros(tenant_id, tipo_abono);


-- ============================================================
-- 11. GASTOS RECURRENTES (plantillas)
-- ============================================================

create table if not exists public.gastos_recurrentes (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  nombre          text not null,
  descripcion     text,
  categoria_id    uuid references public.categorias_gasto(id),
  centro_costo_id uuid references public.centros_costo(id),
  monto_mxn       numeric(14, 4) not null,
  frecuencia      text not null check (frecuencia in (
                    'semanal','quincenal','mensual','bimestral','anual'
                  )),
  dia_del_mes     integer,
  proxima_fecha   date,
  beneficiario    text,
  activo          boolean not null default true,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.gastos_recurrentes enable row level security;

drop policy if exists "gastos_rec read by tenant" on public.gastos_recurrentes;
create policy "gastos_rec read by tenant"
on public.gastos_recurrentes for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

drop policy if exists "gastos_rec write by admin" on public.gastos_recurrentes;
create policy "gastos_rec write by admin"
on public.gastos_recurrentes for all
using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

create index if not exists idx_gastos_rec_tenant on public.gastos_recurrentes(tenant_id);

-- Plantillas iniciales ROMEA:
--   Renta local    | mensual   | día 1  | $X,XXX MXN
--   Internet       | mensual   | día 5  | $XXX MXN
--   Sueldo (tú)    | quincenal |        | $X,XXX MXN
--   Sueldo (papá)  | quincenal |        | $X,XXX MXN
--   Contador       | mensual   | día 28 | $X,XXX MXN


-- ============================================================
-- 12. GASTOS
-- ============================================================

create table if not exists public.gastos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  fecha           date not null,
  descripcion     text not null,
  categoria_id    uuid references public.categorias_gasto(id),
  centro_costo_id uuid references public.centros_costo(id),
  gasto_recurrente_id uuid references public.gastos_recurrentes(id),
  monto_mxn       numeric(14, 4) not null,
  monto_pagado_mxn numeric(14, 4) not null default 0,
  saldo_mxn       numeric(14, 4) not null default 0,
  estado          text not null default 'pendiente'
                  check (estado in ('pagado','pendiente','parcial','cancelado')),
  tipo_gasto      text not null default 'variable'
                  check (tipo_gasto in ('fijo','variable')),
  beneficiario    text,
  comprobante_url text,
  notas           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.gastos enable row level security;

drop policy if exists "gastos read by tenant" on public.gastos;
create policy "gastos read by tenant"
on public.gastos for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

drop policy if exists "gastos write by admin" on public.gastos;
create policy "gastos write by admin"
on public.gastos for all
using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

create index if not exists idx_gastos_tenant    on public.gastos(tenant_id);
create index if not exists idx_gastos_fecha     on public.gastos(tenant_id, fecha);
create index if not exists idx_gastos_estado    on public.gastos(tenant_id, estado);
create index if not exists idx_gastos_categoria on public.gastos(tenant_id, categoria_id);


-- ============================================================
-- 13. ACTIVOS FIJOS
-- ============================================================
-- Registro de maquinaria y equipo con depreciación automática.
--
-- El sistema calcula en tiempo real (sin registros mensuales manuales):
--
--   meses_transcurridos  = EXTRACT(MONTH FROM AGE(NOW(), fecha_adquisicion))
--   depreciacion_mensual = (valor_adquisicion - valor_residual) / vida_util_meses
--   depreciacion_acumulada = LEAST(depreciacion_mensual × meses_transcurridos,
--                                  valor_adquisicion - valor_residual)
--   valor_libro          = valor_adquisicion - depreciacion_acumulada
--
-- Métodos soportados:
--   lineal      → depreciación igual cada mes (el más común)
--   acelerado   → doble del lineal los primeros años (para equipo que se
--                 devalúa rápido al inicio, como computadoras)
--
-- Para el Balance General:
--   Activo fijo bruto    = SUM(valor_adquisicion)
--   Depreciación acum.   = SUM(depreciacion_acumulada calculada)
--   Activo fijo neto     = SUM(valor_libro)

create table if not exists public.activos_fijos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,

  -- Identificación
  nombre          text not null,
  descripcion     text,
  numero_serie    text,

  -- Categoría del activo
  categoria       text not null default 'maquinaria'
                  check (categoria in (
                    'maquinaria',        -- laminadora, horno, etc.
                    'equipo_produccion', -- herramientas de taller
                    'equipo_oficina',    -- computadora, impresora
                    'mobiliario',        -- mesas, sillas, estantes
                    'transporte',        -- vehículos
                    'otro'
                  )),

  -- Adquisición
  fecha_adquisicion   date not null,
  valor_adquisicion   numeric(14, 4) not null,  -- costo original en MXN
  valor_residual      numeric(14, 4) not null default 0,
  -- valor_residual = valor estimado al final de la vida útil (chatarra)

  -- Depreciación
  vida_util_meses     integer not null,
  -- Ejemplos: laminadora 120 meses (10 años), computadora 36 meses (3 años)

  metodo_depreciacion text not null default 'lineal'
                      check (metodo_depreciacion in ('lineal', 'acelerado')),
  -- lineal:    depreciacion_mensual = (valor - residual) / meses
  -- acelerado: primeros 50% de vida útil deprecia al doble, resto al 0
  --            (simplificación del método de doble saldo decreciente)

  -- Estado del activo
  estatus         text not null default 'activo'
                  check (estatus in (
                    'activo',       -- en uso
                    'depreciado',   -- vida útil cumplida, valor libro = residual
                    'vendido',      -- se vendió
                    'baja'          -- dado de baja sin venta
                  )),

  -- Si se vendió o dio de baja
  fecha_baja          date,
  valor_venta_mxn     numeric(14, 4),
  -- ganancia/pérdida en venta = valor_venta - valor_libro_al_momento_de_venta

  -- Foto o comprobante
  foto_url            text,
  comprobante_url     text,

  notas               text,
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.activos_fijos enable row level security;

drop policy if exists "activos read by tenant" on public.activos_fijos;
create policy "activos read by tenant"
on public.activos_fijos for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

drop policy if exists "activos write by admin" on public.activos_fijos;
create policy "activos write by admin"
on public.activos_fijos for all
using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

create index if not exists idx_activos_tenant    on public.activos_fijos(tenant_id);
create index if not exists idx_activos_categoria on public.activos_fijos(tenant_id, categoria);
create index if not exists idx_activos_estatus   on public.activos_fijos(tenant_id, estatus);

-- ── Vista de cálculo automático (referencia para el servicio JS) ──────────────
-- El servicio JS calculará en tiempo real:
--
-- Para método LINEAL:
--   dep_mensual   = (valor_adquisicion - valor_residual) / vida_util_meses
--   meses_uso     = MIN(meses_desde_adquisicion, vida_util_meses)
--   dep_acumulada = dep_mensual × meses_uso
--   valor_libro   = valor_adquisicion - dep_acumulada
--
-- Para método ACELERADO (doble saldo decreciente simplificado):
--   tasa          = 2 / vida_util_meses
--   valor_libro   = valor_adquisicion × (1 - tasa)^meses_uso
--   (con piso en valor_residual)
--
-- Activos para ROMEA (ejemplos, insertar tras crear el tenant):
--   Laminadora         | maquinaria        | lineal     | 120 meses
--   Horno de fundición | maquinaria        | lineal     | 120 meses
--   Soplete y equipo   | equipo_produccion | lineal     | 60 meses
--   Computadora        | equipo_oficina    | acelerado  | 36 meses


-- ============================================================
-- 14. PAGOS (de gastos)
-- ============================================================

create table if not exists public.pagos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  gasto_id        uuid not null references public.gastos(id),
  fecha_pago      date not null,
  monto_mxn       numeric(14, 4) not null,
  caja_banco_id   uuid not null references public.cuentas_caja_banco(id),
  metodo_pago     text check (metodo_pago in (
                    'transferencia','efectivo','tarjeta','mercado_pago','otro'
                  )),
  referencia      text,
  notas           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);

alter table public.pagos enable row level security;

drop policy if exists "pagos read by tenant" on public.pagos;
create policy "pagos read by tenant"
on public.pagos for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

drop policy if exists "pagos write by admin" on public.pagos;
create policy "pagos write by admin"
on public.pagos for all
using (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
with check (public.is_superadmin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

create index if not exists idx_pagos_tenant on public.pagos(tenant_id);
create index if not exists idx_pagos_gasto  on public.pagos(gasto_id);
create index if not exists idx_pagos_fecha  on public.pagos(tenant_id, fecha_pago);


-- ============================================================
-- RESUMEN E INDICADORES
-- ============================================================
--
-- TABLAS CREADAS (14):
--   tenant_features, centros_costo, categorias_gasto,
--   cuentas_caja_banco, movimientos_caja_banco,
--   compras_plata, produccion_semanal,
--   remisiones, remision_items, cobros,
--   gastos_recurrentes, gastos, pagos,
--   activos_fijos
--
-- TABLAS EXISTENTES LEÍDAS (sin modificar):
--   tenants, profiles, clients, products,
--   preorders, preorder_items, metal_prices
--
-- ── ESTADO DE RESULTADOS ─────────────────────────────────────────────────────
--
--   Ventas del periodo         = SUM(remisiones.total) por moneda + fecha
--   Cobros reales MXN          = SUM(cobros.monto_mxn_equivalente)
--   Costo directo producción   = SUM(produccion_semanal.costo_directo_total_mxn)
--   Gastos fijos del mes       = SUM(gastos.monto_mxn WHERE tipo_gasto = 'fijo')
--   Gastos variables del mes   = SUM(gastos.monto_mxn WHERE tipo_gasto = 'variable')
--   Depreciación del periodo   = SUM(dep_mensual × meses) de activos_fijos activos
--   Ganancias cambiarias       = SUM(cobros.ganancia_cambiaria_mxn)
--   Margen bruto/g             = precio_venta/g − costo_directo/g
--   Margen neto                = Cobros − Costos directos − Gastos − Depreciación
--   Punto de equilibrio (g)    = (Gastos fijos + Depreciación) ÷ margen_bruto/g
--
-- ── BALANCE GENERAL (a fecha de corte) ──────────────────────────────────────
--
--   ACTIVOS CIRCULANTES:
--     Caja y bancos MXN        = SUM(saldo_actual) WHERE tipo IN ('efectivo','banco','plataforma')
--     Cuentas por cobrar USD   = SUM(saldo_dinero) WHERE moneda = 'USD' y saldo_dinero > 0
--     Cuentas por cobrar MXN   = SUM(saldo_dinero) WHERE moneda = 'MXN' y saldo_dinero > 0
--     CxC plata (valuada)      = SUM(saldo_plata_gramos) × kitco_hoy × tipo_cambio
--     Inventario plata fina    = gramos_actuales × (kitco_hoy / 31.1035) × tipo_cambio
--     -- Nota: valuación a precio de mercado del día (Kitco)
--     -- Ajuste por valuación = valor_mercado - costo_promedio_mxn × gramos
--
--   ACTIVOS FIJOS:
--     Maquinaria y equipo (costo) = SUM(valor_adquisicion) WHERE estatus = 'activo'
--     Depreciación acumulada      = SUM(dep_acumulada calculada) WHERE estatus = 'activo'
--     Activo fijo neto            = Costo − Depreciación acumulada
--
--   TOTAL ACTIVOS = Circulantes + Fijo neto
--
--   PASIVOS:
--     Cuentas por pagar MXN    = SUM(gastos.saldo_mxn) WHERE estado != 'pagado'
--
--   CAPITAL (estimado administrativo):
--     Capital = Total Activos − Total Pasivos
--     -- Incluye: aportación inicial + utilidades acumuladas + resultado del ejercicio
--     -- + ajuste por valuación de plata (diferencia costo vs mercado)
--
-- ── POSICIÓN DE PLATA ────────────────────────────────────────────────────────
--
--   Gramos en inventario       = cuentas_caja_banco.gramos_actuales WHERE tipo = 'plata'
--   Costo promedio pagado      = cuentas_caja_banco.costo_promedio_mxn por gramo
--   Valor a Kitco hoy          = gramos × kitco_hoy × tipo_cambio
--   Ganancia no realizada      = Valor mercado − (gramos × costo_promedio)
--   CxC plata pendiente        = SUM(remisiones.saldo_plata_gramos)
--   Gramos totales en sistema  = inventario + CxC plata pendiente
--
-- ── ACTIVOS FIJOS ────────────────────────────────────────────────────────────
--
--   Por activo: nombre, valor adquisición, dep. mensual, dep. acumulada, valor libro
--   Total activo fijo neto     = SUM(valor_libro calculado) WHERE estatus = 'activo'
--   Depreciación del mes       = SUM(dep_mensual) WHERE estatus = 'activo'
--   -- Se suma a gastos del mes en el Estado de Resultados
--
-- ============================================================
