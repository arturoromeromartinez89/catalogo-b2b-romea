-- ============================================================================
-- COBROS — permitir anticipos (cobro sin venta asociada)
-- Archivo: supabase/cobros-anticipos.sql
-- Correr una vez en Supabase → SQL Editor. Es seguro e idempotente.
--
-- Un anticipo es un cobro con remision_id NULL (cliente adelanta dinero sin
-- una venta previa → saldo a favor). Esto solo afloja la restricción NOT NULL
-- si existiera; no borra ni cambia datos.
-- ============================================================================

alter table public.cobros alter column remision_id drop not null;

-- Verificación: debe decir 'YES' en is_nullable.
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'cobros' and column_name = 'remision_id';
