-- =============================================================================
-- Migración: Corrección de aislamiento RLS por tenant
-- Archivo:   supabase/fix_rls_tenant_isolation.sql
-- Fecha:     2026-06-01
-- Revisión:  Codex (ajustes aplicados post-revisión)
--
-- PROPÓSITO:
--   Corregir vulnerabilidades críticas de aislamiento entre tenants:
--   1. catalog_products tenía using(true) — cualquier usuario autenticado
--      podía leer datos de catálogo de TODOS los tenants.
--   2. Las políticas admin en todas las tablas usaban is_admin() sin filtro
--      de tenant — un tenant_admin de Empresa A podía operar datos de Empresa B.
--   3. company_settings quedaba abierta a todos los usuarios autenticados.
--   4. labor_lists y labor_list_lines no tenían aislamiento por tenant.
--   5. Políticas "clients read own" sin defensa doble de tenant.
--
-- DEPENDENCIAS (deben estar ejecutadas antes):
--   - supabase/schema.sql
--   - supabase/multi_tenant_migration.sql
--   - supabase/quote_links.sql
--   - supabase/labor_lists.sql
--
-- REGLAS:
--   - Solo SQL. Cero cambios en código de aplicación.
--   - Idempotente: DROP POLICY IF EXISTS antes de cada CREATE.
--   - No modifica datos. Solo funciones, políticas e índices.
--   - Reversible: ver sección ROLLBACK al final.
--
-- INSTRUCCIONES:
--   Ejecutar en Supabase SQL Editor, sección a sección.
--   Verificar que cada sección no genera errores antes de continuar.
-- =============================================================================


-- =============================================================================
-- SECCIÓN 1 — Función: is_admin_of_tenant(t_id uuid)
--
-- Incluye superadmin para uso como helper general sin confusión futura.
-- Codex: "si se va a usar como helper general, debe incluir superadmin".
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
      and (
        role = 'superadmin'
        or (
          role in ('tenant_admin', 'admin')
          and tenant_id = t_id
        )
      )
  );
$$;

-- Verificación:
-- select public.is_admin_of_tenant('uuid-del-tenant');


-- =============================================================================
-- SECCIÓN 2 — Índices en columnas puente (junction tables)
--
-- Necesarios para que los subqueries de las políticas RLS no hagan seq scans.
-- Codex: "siempre que existan índices en las columnas puente".
-- =============================================================================

create index if not exists idx_catalog_products_catalog_id   on public.catalog_products(catalog_id);
create index if not exists idx_catalog_products_product_id   on public.catalog_products(product_id);
create index if not exists idx_price_list_items_pricelist_id on public.price_list_items(price_list_id);
create index if not exists idx_preorder_items_preorder_id    on public.preorder_items(preorder_id);
create index if not exists idx_client_catalogs_client_id     on public.client_catalogs(client_id);
create index if not exists idx_client_pricelists_client_id   on public.client_price_lists(client_id);
create index if not exists idx_client_line_margins_client_id on public.client_line_margins(client_id);
create index if not exists idx_labor_list_lines_list_id      on public.labor_list_lines(labor_list_id);


-- =============================================================================
-- SECCIÓN 3 — CORRECCIÓN CRÍTICA: catalog_products
--
-- ANTES: using(true) — cualquier usuario autenticado leía todos los registros.
-- DESPUÉS:
--   superadmin → todo
--   tenant_admin/admin → catálogos de su tenant
--   client → solo catálogos asignados a su client_id
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
  catalog_id in (
    select cc.catalog_id
    from public.client_catalogs cc
    join public.profiles p on p.client_id = cc.client_id
    where p.id = auth.uid()
      and p.tenant_id = public.current_tenant_id()
      and cc.active = true
  )
);


-- =============================================================================
-- SECCIÓN 4 — Tabla: products
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

drop policy if exists "clients read visible products" on public.products;
create policy "clients read visible products" on public.products
for select using (
  visible_web = true
  and tenant_id = public.current_tenant_id()
  and exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'client'
      and profiles.tenant_id = public.current_tenant_id()
  )
);


-- =============================================================================
-- SECCIÓN 5 — Tabla: clients
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

-- Codex: defensa doble — validar client_id Y tenant_id del perfil.
drop policy if exists "clients read own client" on public.clients;
create policy "clients read own client" on public.clients
for select using (
  id in (
    select client_id from public.profiles
    where id = auth.uid()
      and tenant_id = public.current_tenant_id()
  )
);


-- =============================================================================
-- SECCIÓN 6 — Tabla: catalogs
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

drop policy if exists "clients read assigned catalogs" on public.catalogs;
create policy "clients read assigned catalogs" on public.catalogs
for select using (
  active = true
  and tenant_id = public.current_tenant_id()
  and id in (
    select cc.catalog_id from public.client_catalogs cc
    join public.profiles p on p.client_id = cc.client_id
    where p.id = auth.uid()
      and p.tenant_id = public.current_tenant_id()
      and cc.active = true
  )
);


-- =============================================================================
-- SECCIÓN 7 — Tabla: price_lists
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
    where p.id = auth.uid()
      and p.tenant_id = public.current_tenant_id()
      and cpl.active = true
  )
);


-- =============================================================================
-- SECCIÓN 8 — Tabla: price_list_items (deriva tenant desde price_lists)
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
    where p.id = auth.uid()
      and p.tenant_id = public.current_tenant_id()
      and cpl.active = true
  )
);


-- =============================================================================
-- SECCIÓN 9 — Tabla: client_catalogs (deriva tenant desde clients)
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

-- Codex: defensa doble con tenant_id en el perfil.
drop policy if exists "clients read own catalog assignments" on public.client_catalogs;
create policy "clients read own catalog assignments" on public.client_catalogs
for select using (
  client_id in (
    select client_id from public.profiles
    where id = auth.uid()
      and tenant_id = public.current_tenant_id()
  )
);


-- =============================================================================
-- SECCIÓN 10 — Tabla: client_price_lists (deriva tenant desde clients)
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

-- Codex: defensa doble con tenant_id en el perfil.
drop policy if exists "clients read own price assignments" on public.client_price_lists;
create policy "clients read own price assignments" on public.client_price_lists
for select using (
  client_id in (
    select client_id from public.profiles
    where id = auth.uid()
      and tenant_id = public.current_tenant_id()
  )
);


-- =============================================================================
-- SECCIÓN 11 — Tabla: company_settings
--
-- ANTES: lectura abierta a cualquier usuario autenticado (auth.uid() is not null)
--        exponía RFC, cuentas bancarias, términos de todos los tenants.
-- DESPUÉS: lectura restringida por tenant. Acceso público del QuotePage
--          debe usar función RPC segura, no RLS directo.
-- Codex: "Debe quedar por tenant; no abrir toda la tabla".
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

-- NOTA PARA EL EQUIPO: QuotePage pública carga company_settings vía
-- fetchCompanySettings(tenant_id). Con esta política, esa llamada fallará
-- para usuarios no autenticados. Migrar a función RPC como:
-- get_company_settings_public_by_tenant(p_tenant_id uuid) SECURITY DEFINER
-- que exponga solo: brand_name, logo_url, city, state, country.
-- Mientras tanto, se mantiene lectura para autenticados por tenant.
drop policy if exists "authenticated read company settings" on public.company_settings;
create policy "authenticated read company settings" on public.company_settings
for select using (
  public.is_superadmin()
  or tenant_id = public.current_tenant_id()
);


-- =============================================================================
-- SECCIÓN 12 — Tabla: product_lines
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
-- SECCIÓN 13 — Tabla: metal_prices
-- Codex: "está bien restringida, debe quedarse así".
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
-- SECCIÓN 14 — Tabla: client_line_margins (deriva tenant desde clients)
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

-- Codex: defensa doble con tenant_id en el perfil.
drop policy if exists "clients read own line margins" on public.client_line_margins;
create policy "clients read own line margins" on public.client_line_margins
for select using (
  client_id in (
    select client_id from public.profiles
    where id = auth.uid()
      and tenant_id = public.current_tenant_id()
  )
);


-- =============================================================================
-- SECCIÓN 15 — Tabla: preorders
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
    select client_id from public.profiles
    where id = auth.uid()
      and tenant_id = public.current_tenant_id()
  )
) with check (
  tenant_id = public.current_tenant_id()
  and client_id in (
    select client_id from public.profiles
    where id = auth.uid()
      and tenant_id = public.current_tenant_id()
  )
);


-- =============================================================================
-- SECCIÓN 16 — Tabla: preorder_items (deriva tenant desde preorders)
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
      and p.tenant_id = public.current_tenant_id()
      and po.tenant_id = public.current_tenant_id()
  )
) with check (
  preorder_id in (
    select po.id from public.preorders po
    join public.profiles p on p.client_id = po.client_id
    where p.id = auth.uid()
      and p.tenant_id = public.current_tenant_id()
      and po.tenant_id = public.current_tenant_id()
  )
);


-- =============================================================================
-- SECCIÓN 17 — Tabla: quote_links
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

-- NOTA PARA EL EQUIPO: las funciones SECURITY DEFINER de quote_links.sql
-- (get_quote_link_by_token, submit_quote_link_preorder) ya validan expiración
-- y token. Revisar en iteración futura que exponen solo datos necesarios
-- y que el tenant_id del resultado se valida correctamente en la aplicación.


-- =============================================================================
-- SECCIÓN 18 — Tablas: labor_lists y labor_list_lines
--
-- FALTABAN en la primera versión del PR.
-- Codex: "punto más importante que falta — parte central del negocio".
-- =============================================================================

drop policy if exists "admins manage labor lists" on public.labor_lists;
create policy "admins manage labor lists" on public.labor_lists
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

-- NOTA: clientes NO deben leer labor_lists directamente.
-- Las tablas contienen información sensible: mano de obra, costos, plata fina,
-- márgenes y estructura interna de precio. Si la vista cliente necesita precios,
-- debe recibirlos ya calculados o via RPC segura que exponga solo el precio final.
-- (Codex: retirar lectura directa client, 2026-06-01)

drop policy if exists "admins manage labor list lines" on public.labor_list_lines;
create policy "admins manage labor list lines" on public.labor_list_lines
for all using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and labor_list_id in (
      select id from public.labor_lists
      where tenant_id = public.current_tenant_id()
    )
  )
) with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and labor_list_id in (
      select id from public.labor_lists
      where tenant_id = public.current_tenant_id()
    )
  )
);

-- NOTA: clientes NO deben leer labor_list_lines directamente por las mismas
-- razones que labor_lists. Solo admins y superadmin tienen acceso.


-- =============================================================================
-- VERIFICACIÓN FINAL
-- Ejecutar después de aplicar la migración.
-- =============================================================================

-- Query 1: No debe retornar ninguna fila.
-- select tablename, policyname, qual
-- from pg_policies
-- where schemaname = 'public'
--   and qual = 'true';

-- Query 2: Todas las políticas activas para revisión manual.
-- select tablename, policyname, cmd, qual
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;

-- Query 3: Confirmar función is_admin_of_tenant.
-- select proname from pg_proc
-- where proname = 'is_admin_of_tenant'
--   and pronamespace = 'public'::regnamespace;

-- Query 4: Confirmar índices de columnas puente.
-- select indexname, tablename from pg_indexes
-- where schemaname = 'public'
--   and indexname like 'idx_%'
-- order by tablename;


-- =============================================================================
-- ROLLBACK
--
-- IMPORTANTE: el rollback NO restaura using(true) porque esa es la
-- vulnerabilidad que se está corrigiendo.
-- Para revertir, re-ejecutar las políticas de la migración anterior validada:
--   - supabase/multi_tenant_migration.sql  (sección de políticas)
--   - supabase/labor_lists.sql             (políticas de labor)
-- Hacerlo sección a sección en Supabase SQL Editor.
-- Nunca hacer rollback completo con un solo comando sin verificar el estado
-- actual de las tablas.
-- =============================================================================
