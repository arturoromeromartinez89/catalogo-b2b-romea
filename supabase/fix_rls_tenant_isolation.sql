-- =============================================================================
-- Migración: Corrección de aislamiento RLS por tenant
-- Archivo:   supabase/fix_rls_tenant_isolation.sql
-- Fecha:     2026-06-01
-- Autor:     Claude (revisado por Codex antes de ejecutar)
--
-- PROPÓSITO:
--   Corregir dos vulnerabilidades críticas identificadas en auditoría:
--   1. catalog_products tenía using(true) — cualquier usuario autenticado
--      podía leer datos de catálogo de TODOS los tenants.
--   2. Las políticas admin en todas las tablas usaban is_admin() sin filtro
--      de tenant — un tenant_admin de Empresa A podía leer/escribir datos
--      de Empresa B.
--
-- DEPENDENCIAS:
--   Requiere que ya estén ejecutadas:
--   - supabase/schema.sql
--   - supabase/multi_tenant_migration.sql  (define tenants, current_tenant_id,
--                                           is_superadmin, is_tenant_admin)
--   - supabase/quote_links.sql
--
-- REGLAS DE ESTE SCRIPT:
--   - Solo SQL. Cero cambios en código de aplicación.
--   - Idempotente: usa DROP POLICY IF EXISTS antes de CREATE.
--   - No modifica datos. Solo funciones y políticas.
--   - Reversible: ver sección ROLLBACK al final.
--
-- INSTRUCCIONES:
--   Ejecutar en Supabase SQL Editor, sección a sección, verificando
--   que no haya errores antes de continuar con la siguiente.
-- =============================================================================


-- =============================================================================
-- SECCIÓN 1 — Función auxiliar: is_admin_of_tenant(t_id uuid)
-- Permite verificar si el usuario actual es admin del tenant especificado.
-- Útil para validaciones puntuales en lógica de aplicación.
-- =============================================================================

create or replace function public.is_admin_of_tenant(t_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('tenant_admin', 'admin')
      and tenant_id = t_id
  );
$$;

-- Verificación: debe retornar true solo para admins del tenant correcto.
-- select public.is_admin_of_tenant('uuid-del-tenant-aqui');


-- =============================================================================
-- SECCIÓN 2 — CORRECCIÓN CRÍTICA: catalog_products
-- ANTES: using(true) — cualquier usuario autenticado veía todos los registros.
-- DESPUÉS: superadmin ve todo; tenant_admin/admin ven su tenant; clients solo
--          los catálogos asignados a ellos.
-- =============================================================================

drop policy if exists "admins manage catalog products" on public.catalog_products;
create policy "admins manage catalog products" on public.catalog_products
for all using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and catalog_id in (
      select id from public.catalogs
      where tenant_id = public.current_tenant_id()
    )
  )
) with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and catalog_id in (
      select id from public.catalogs
      where tenant_id = public.current_tenant_id()
    )
  )
);

drop policy if exists "clients read catalog products" on public.catalog_products;
create policy "clients read catalog products" on public.catalog_products
for select using (
  -- Clientes solo ven productos de catálogos asignados a ellos
  catalog_id in (
    select cc.catalog_id
    from public.client_catalogs cc
    join public.profiles p on p.client_id = cc.client_id
    where p.id = auth.uid()
      and cc.active = true
  )
);


-- =============================================================================
-- SECCIÓN 3 — Tabla: products
-- =============================================================================

drop policy if exists "admins manage products" on public.products;
create policy "admins manage products" on public.products
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

-- Política de clientes: sin cambio funcional, solo reescrita para claridad.
drop policy if exists "clients read visible products" on public.products;
create policy "clients read visible products" on public.products
for select using (
  visible_web = true
  and tenant_id = public.current_tenant_id()
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'client'
  )
);


-- =============================================================================
-- SECCIÓN 4 — Tabla: clients
-- =============================================================================

drop policy if exists "admins manage clients" on public.clients;
create policy "admins manage clients" on public.clients
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

-- Clientes leen su propio registro: sin cambio.
drop policy if exists "clients read own client" on public.clients;
create policy "clients read own client" on public.clients
for select using (
  id in (
    select client_id from public.profiles where id = auth.uid()
  )
);


-- =============================================================================
-- SECCIÓN 5 — Tabla: catalogs
-- =============================================================================

drop policy if exists "admins manage catalogs" on public.catalogs;
create policy "admins manage catalogs" on public.catalogs
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

-- Clientes: sin cambio funcional.
drop policy if exists "clients read assigned catalogs" on public.catalogs;
create policy "clients read assigned catalogs" on public.catalogs
for select using (
  active = true
  and tenant_id = public.current_tenant_id()
  and id in (
    select cc.catalog_id from public.client_catalogs cc
    join public.profiles p on p.client_id = cc.client_id
    where p.id = auth.uid() and cc.active = true
  )
);


-- =============================================================================
-- SECCIÓN 6 — Tabla: price_lists
-- =============================================================================

drop policy if exists "admins manage price lists" on public.price_lists;
create policy "admins manage price lists" on public.price_lists
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

drop policy if exists "clients read assigned price lists" on public.price_lists;
create policy "clients read assigned price lists" on public.price_lists
for select using (
  active = true
  and id in (
    select cpl.price_list_id from public.client_price_lists cpl
    join public.profiles p on p.client_id = cpl.client_id
    where p.id = auth.uid() and cpl.active = true
  )
);


-- =============================================================================
-- SECCIÓN 7 — Tabla: price_list_items
-- (Deriva tenant desde price_list)
-- =============================================================================

drop policy if exists "admins manage price items" on public.price_list_items;
create policy "admins manage price items" on public.price_list_items
for all using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and price_list_id in (
      select id from public.price_lists
      where tenant_id = public.current_tenant_id()
    )
  )
) with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and price_list_id in (
      select id from public.price_lists
      where tenant_id = public.current_tenant_id()
    )
  )
);

drop policy if exists "clients read price items" on public.price_list_items;
create policy "clients read price items" on public.price_list_items
for select using (
  price_list_id in (
    select cpl.price_list_id from public.client_price_lists cpl
    join public.profiles p on p.client_id = cpl.client_id
    where p.id = auth.uid() and cpl.active = true
  )
);


-- =============================================================================
-- SECCIÓN 8 — Tabla: client_catalogs
-- (Deriva tenant desde clients)
-- =============================================================================

drop policy if exists "admins manage client catalogs" on public.client_catalogs;
create policy "admins manage client catalogs" on public.client_catalogs
for all using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and client_id in (
      select id from public.clients
      where tenant_id = public.current_tenant_id()
    )
  )
) with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and client_id in (
      select id from public.clients
      where tenant_id = public.current_tenant_id()
    )
  )
);

drop policy if exists "clients read own catalog assignments" on public.client_catalogs;
create policy "clients read own catalog assignments" on public.client_catalogs
for select using (
  client_id in (
    select client_id from public.profiles where id = auth.uid()
  )
);


-- =============================================================================
-- SECCIÓN 9 — Tabla: client_price_lists
-- (Deriva tenant desde clients)
-- =============================================================================

drop policy if exists "admins manage client price lists" on public.client_price_lists;
create policy "admins manage client price lists" on public.client_price_lists
for all using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and client_id in (
      select id from public.clients
      where tenant_id = public.current_tenant_id()
    )
  )
) with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and client_id in (
      select id from public.clients
      where tenant_id = public.current_tenant_id()
    )
  )
);

drop policy if exists "clients read own price assignments" on public.client_price_lists;
create policy "clients read own price assignments" on public.client_price_lists
for select using (
  client_id in (
    select client_id from public.profiles where id = auth.uid()
  )
);


-- =============================================================================
-- SECCIÓN 10 — Tabla: company_settings
-- Lectura pública autenticada se mantiene (QuotePage la necesita sin auth).
-- Solo se restringe la escritura por tenant.
-- =============================================================================

drop policy if exists "admins manage company settings" on public.company_settings;
create policy "admins manage company settings" on public.company_settings
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

-- Lectura: cualquier usuario autenticado puede leer (necesario para logo/brand en UI).
drop policy if exists "authenticated read company settings" on public.company_settings;
create policy "authenticated read company settings" on public.company_settings
for select using (auth.uid() is not null);


-- =============================================================================
-- SECCIÓN 11 — Tabla: product_lines
-- =============================================================================

drop policy if exists "admins manage product lines" on public.product_lines;
create policy "admins manage product lines" on public.product_lines
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

drop policy if exists "authenticated read product lines" on public.product_lines;
create policy "authenticated read product lines" on public.product_lines
for select using (
  public.is_superadmin()
  or tenant_id = public.current_tenant_id()
);


-- =============================================================================
-- SECCIÓN 12 — Tabla: metal_prices
-- =============================================================================

drop policy if exists "admins manage metal prices" on public.metal_prices;
create policy "admins manage metal prices" on public.metal_prices
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

drop policy if exists "authenticated read metal prices" on public.metal_prices;
create policy "authenticated read metal prices" on public.metal_prices
for select using (
  public.is_superadmin()
  or tenant_id = public.current_tenant_id()
);


-- =============================================================================
-- SECCIÓN 13 — Tabla: client_line_margins
-- (Deriva tenant desde clients)
-- =============================================================================

drop policy if exists "admins manage client line margins" on public.client_line_margins;
create policy "admins manage client line margins" on public.client_line_margins
for all using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and client_id in (
      select id from public.clients
      where tenant_id = public.current_tenant_id()
    )
  )
) with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and client_id in (
      select id from public.clients
      where tenant_id = public.current_tenant_id()
    )
  )
);

drop policy if exists "clients read own line margins" on public.client_line_margins;
create policy "clients read own line margins" on public.client_line_margins
for select using (
  client_id in (
    select client_id from public.profiles where id = auth.uid()
  )
);


-- =============================================================================
-- SECCIÓN 14 — Tabla: preorders
-- =============================================================================

drop policy if exists "admins manage preorders" on public.preorders;
create policy "admins manage preorders" on public.preorders
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

drop policy if exists "clients manage own preorders" on public.preorders;
create policy "clients manage own preorders" on public.preorders
for all using (
  tenant_id = public.current_tenant_id()
  and client_id in (
    select client_id from public.profiles where id = auth.uid()
  )
) with check (
  tenant_id = public.current_tenant_id()
  and client_id in (
    select client_id from public.profiles where id = auth.uid()
  )
);


-- =============================================================================
-- SECCIÓN 15 — Tabla: preorder_items
-- (Deriva tenant desde preorders)
-- =============================================================================

drop policy if exists "admins manage preorder items" on public.preorder_items;
create policy "admins manage preorder items" on public.preorder_items
for all using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and preorder_id in (
      select id from public.preorders
      where tenant_id = public.current_tenant_id()
    )
  )
) with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and preorder_id in (
      select id from public.preorders
      where tenant_id = public.current_tenant_id()
    )
  )
);

drop policy if exists "clients manage own preorder items" on public.preorder_items;
create policy "clients manage own preorder items" on public.preorder_items
for all using (
  preorder_id in (
    select po.id from public.preorders po
    join public.profiles p on p.client_id = po.client_id
    where p.id = auth.uid()
      and po.tenant_id = public.current_tenant_id()
  )
) with check (
  preorder_id in (
    select po.id from public.preorders po
    join public.profiles p on p.client_id = po.client_id
    where p.id = auth.uid()
      and po.tenant_id = public.current_tenant_id()
  )
);


-- =============================================================================
-- SECCIÓN 16 — Tabla: quote_links
-- =============================================================================

drop policy if exists "admins manage quote links" on public.quote_links;
create policy "admins manage quote links" on public.quote_links
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);


-- =============================================================================
-- VERIFICACIÓN FINAL
-- Ejecutar estas queries después de aplicar la migración para confirmar que
-- no hay políticas con using(true) ni políticas admin sin filtro de tenant.
-- =============================================================================

-- Query 1: Buscar políticas con using(true) — resultado esperado: 0 filas.
-- select tablename, policyname, qual
-- from pg_policies
-- where schemaname = 'public'
--   and qual = 'true';

-- Query 2: Listar todas las políticas activas para revisión manual.
-- select tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;

-- Query 3: Confirmar que is_admin_of_tenant existe.
-- select proname, prosecdef from pg_proc
-- where proname = 'is_admin_of_tenant'
--   and pronamespace = 'public'::regnamespace;


-- =============================================================================
-- ROLLBACK — Solo ejecutar si algo falla y hay que revertir.
-- Restaura las políticas originales de schema.sql + multi_tenant_migration.sql.
-- NO ejecutar en producción sin validar primero en staging.
-- =============================================================================

/*
-- Restaurar catalog_products a estado ANTERIOR (VULNERABLE — solo para rollback):
drop policy if exists "admins manage catalog products" on public.catalog_products;
drop policy if exists "clients read catalog products" on public.catalog_products;
create policy "admins manage catalog products" on public.catalog_products for all using (public.is_admin()) with check (public.is_admin());
create policy "clients read catalog products" on public.catalog_products for select using (true);

-- Para restaurar el resto de tablas a su estado anterior, re-ejecutar:
-- supabase/schema.sql (solo la sección de políticas, no la de tablas)
-- supabase/multi_tenant_migration.sql (solo la sección de políticas)
*/
