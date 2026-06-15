-- ============================================================================
-- Permitir que el CLIENTE edite SUS preórdenes mientras están en 'revision'
-- Archivo: supabase/client-edit-revision-preorders.sql
-- Correr una vez en Supabase → SQL Editor (proyecto de PRODUCCIÓN).
--
-- Contexto: las preórdenes que crea el cliente nacen en 'revision' (esperando
-- que el taller agregue la plata fina). Hoy la RLS solo deja al cliente editar
-- los renglones cuando status='pendiente', así que no podía modificar/agregar
-- productos a su propia preorden en revisión.
--
-- Este cambio amplía SOLO la capacidad del cliente sobre SUS PROPIAS preórdenes
-- (mismo client_id) a los estados 'pendiente' y 'revision'. Una vez 'confirmada'
-- o 'cancelada' queda bloqueada. No afecta el aislamiento entre empresas.
-- ============================================================================

-- 1) Editar renglones (modificar cantidades, etc.)
drop policy if exists "clients update own preorder items" on public.preorder_items;
create policy "clients update own preorder items" on public.preorder_items
  for update
  using (
    preorder_id in (
      select id from public.preorders
      where client_id in (select client_id from public.profiles where id = auth.uid())
        and status in ('pendiente', 'revision')
    )
  );

-- 2) Quitar renglones (borrar un producto de la preorden)
drop policy if exists "clients delete own preorder items" on public.preorder_items;
create policy "clients delete own preorder items" on public.preorder_items
  for delete
  using (
    preorder_id in (
      select id from public.preorders
      where client_id in (select client_id from public.profiles where id = auth.uid())
        and status in ('pendiente', 'revision')
    )
  );

-- 3) Guardar el encabezado de su preorden mientras no esté confirmada/cancelada
drop policy if exists "clients update own preorders" on public.preorders;
create policy "clients update own preorders" on public.preorders
  for update
  using (
    client_id in (select client_id from public.profiles where id = auth.uid())
      and status in ('pendiente', 'revision')
  )
  with check (
    client_id in (select client_id from public.profiles where id = auth.uid())
  );

-- 4) El cliente puede BORRAR solo las preórdenes que ÉL creó, mientras no
--    estén confirmadas/canceladas. Las creadas por el admin no las puede borrar.
drop policy if exists "clients delete own preorders" on public.preorders;
create policy "clients delete own preorders" on public.preorders
  for delete
  using (
    created_by = auth.uid()
      and client_id in (select client_id from public.profiles where id = auth.uid())
      and status in ('pendiente', 'revision')
  );

notify pgrst, 'reload schema';
