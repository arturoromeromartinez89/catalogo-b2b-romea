-- ============================================================================
-- GASTOS 2.0 — columnas de vencimiento y documento (aditivo, mínimo)
-- Archivo: supabase/gastos-vencimientos.sql
--
-- PARA CODEX: integrar a la migración versionada y aplicar PRIMERO en staging.
-- NO correr suelto en producción.
--
-- Verificado contra el esquema real (13-jun-2026): `gastos` YA tiene
-- centro_costo_id, monto_pagado_mxn, saldo_mxn, estado, updated_at. Solo faltan
-- estas tres columnas. Beneficiario sigue como texto en este bloque (proveedores
-- estructurados son fase posterior).
-- ============================================================================

alter table public.gastos add column if not exists fecha_vencimiento date;
alter table public.gastos add column if not exists numero_documento  text;
alter table public.gastos add column if not exists moneda            text not null default 'MXN';

-- Mientras todos los importes sean monto_mxn, restringir moneda a MXN (Codex).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'gastos_moneda_mxn_chk'
  ) then
    alter table public.gastos add constraint gastos_moneda_mxn_chk check (moneda = 'MXN');
  end if;
end $$;

-- Índices por tenant para las vistas de "Por pagar / vencidos / próximos".
create index if not exists idx_gastos_tenant_venc   on public.gastos(tenant_id, fecha_vencimiento);
create index if not exists idx_gastos_tenant_estado on public.gastos(tenant_id, estado);

-- Verificación: deben aparecer las tres columnas nuevas.
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'gastos'
  and column_name in ('fecha_vencimiento', 'numero_documento', 'moneda')
order by column_name;
