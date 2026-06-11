-- =============================================================================
-- ACCESO DE CLIENTES — migración completa (correr una sola vez)
-- Arregla: perfiles de cliente sin tenant_id, productos invisibles para
-- clientes con allowed_skus, y agrega el toggle de suspensión de cuenta.
-- =============================================================================

-- 1. Columna active en profiles — toggle encender/apagar cuenta
alter table public.profiles
  add column if not exists active boolean not null default true;

-- 2. Trigger handle_new_user — ahora vincula client_id Y tenant_id.
--    Sin tenant_id, todas las políticas RLS le niegan los datos al cliente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  matched_client record;
begin
  select id, tenant_id into matched_client
  from public.clients
  where lower(email) = lower(new.email)
  limit 1;

  insert into public.profiles (id, email, role, client_id, tenant_id)
  values (new.id, new.email, 'client', matched_client.id, matched_client.tenant_id)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 3. Backfill — reparar perfiles de cliente ya creados sin client_id/tenant_id
--    (incluye la cuenta de David creada antes de este fix)
update public.profiles p
set client_id = coalesce(p.client_id, c.id),
    tenant_id = coalesce(p.tenant_id, c.tenant_id)
from public.clients c
where lower(p.email) = lower(c.email)
  and p.role = 'client'
  and (p.client_id is null or p.tenant_id is null);

-- 4. Función helper (security definer evita recursión de RLS):
--    devuelve los allowed_skus del cliente logueado.
--    NULL  = no es cliente
--    '{}'  = cliente sin restricción (ve todo lo visible_web)
--    [...] = cliente restringido a esos SKUs
create or replace function public.client_allowed_skus()
returns text[]
language sql
stable
security definer
as $$
  select coalesce(c.allowed_skus, '{}')
  from public.profiles p
  left join public.clients c on c.id = p.client_id
  where p.id = auth.uid() and p.role = 'client';
$$;

-- 5. Política de productos para clientes:
--    - Sin restricción → ve productos visible_web de su tenant
--    - Con allowed_skus → ve ESOS productos aunque no tengan visible_web
drop policy if exists "clients read visible products" on public.products;
drop policy if exists "clients read products" on public.products;
create policy "clients read products" on public.products
for select using (
  tenant_id = public.current_tenant_id()
  and (
    (public.client_allowed_skus() = '{}' and visible_web = true)
    or codigo = any(public.client_allowed_skus())
  )
);

-- 6. Verificación — corre esto al final y revisa el resultado:
--    El perfil de David debe mostrar client_id y tenant_id NO nulos.
select p.email, p.role, p.active, p.client_id, p.tenant_id,
       c.company, coalesce(array_length(c.allowed_skus, 1), 0) as skus_asignados
from public.profiles p
left join public.clients c on c.id = p.client_id
where p.role = 'client';
