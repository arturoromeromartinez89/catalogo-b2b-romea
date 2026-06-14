-- ============================================================================
-- REMISIONES — nuevos estatus: activa / borrador / cancelada
-- Archivo: supabase/remision-estados-activa.sql
-- Correr una vez en Supabase → SQL Editor (proyecto de PRODUCCIÓN, rama main).
--
-- Cambios:
--   1) Reasigna los estatus viejos:  emitida → activa,  entregada → activa.
--   2) Reemplaza la restricción CHECK para permitir solo: borrador/activa/cancelada.
--
-- Es seguro: solo toca la columna estado; no borra remisiones ni items.
-- ============================================================================

-- 1) Migrar datos existentes
update public.remisiones set estado = 'activa'
where estado in ('emitida', 'entregada');

-- 2) Reemplazar la restricción de valores permitidos
do $$
declare
  c text;
begin
  -- Quita cualquier CHECK existente sobre la columna estado
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'remisiones'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%estado%'
  loop
    execute format('alter table public.remisiones drop constraint %I', c);
  end loop;
end $$;

alter table public.remisiones
  add constraint remisiones_estado_check
  check (estado in ('borrador', 'activa', 'cancelada'));

-- 3) Default del estatus al crear
alter table public.remisiones alter column estado set default 'borrador';

notify pgrst, 'reload schema';

-- Verificación: debe listar solo borrador/activa/cancelada
select estado, count(*) from public.remisiones group by estado order by estado;
