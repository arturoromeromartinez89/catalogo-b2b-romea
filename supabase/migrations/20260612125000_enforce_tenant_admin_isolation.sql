-- Scope every legacy administrator policy to the administrator's tenant.
-- Requires 20260612120000_lock_down_profile_privileges.sql.

create index if not exists idx_catalog_products_catalog_id
  on public.catalog_products(catalog_id);
create index if not exists idx_catalog_products_product_id
  on public.catalog_products(product_id);
create index if not exists idx_price_list_items_price_list_id
  on public.price_list_items(price_list_id);
create index if not exists idx_client_catalogs_client_id
  on public.client_catalogs(client_id);
create index if not exists idx_client_price_lists_client_id
  on public.client_price_lists(client_id);
create index if not exists idx_client_line_margins_client_id
  on public.client_line_margins(client_id);
create index if not exists idx_preorder_items_preorder_id
  on public.preorder_items(preorder_id);
create index if not exists idx_labor_list_lines_labor_list_id
  on public.labor_list_lines(labor_list_id);
drop policy if exists "admins manage products" on public.products;
create policy "admins manage products"
on public.products for all to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);
drop policy if exists "admins manage clients" on public.clients;
create policy "admins manage clients"
on public.clients for all to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);
drop policy if exists "admins manage catalogs" on public.catalogs;
create policy "admins manage catalogs"
on public.catalogs for all to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);
drop policy if exists "admins manage catalog products" on public.catalog_products;
create policy "admins manage catalog products"
on public.catalog_products for all to authenticated
using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and exists (
      select 1 from public.catalogs c
      where c.id = catalog_id and c.tenant_id = public.current_tenant_id()
    )
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.tenant_id = public.current_tenant_id()
    )
  )
)
with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and exists (
      select 1 from public.catalogs c
      where c.id = catalog_id and c.tenant_id = public.current_tenant_id()
    )
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.tenant_id = public.current_tenant_id()
    )
  )
);
drop policy if exists "admins manage price lists" on public.price_lists;
create policy "admins manage price lists"
on public.price_lists for all to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);
drop policy if exists "admins manage price items" on public.price_list_items;
create policy "admins manage price items"
on public.price_list_items for all to authenticated
using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and exists (
      select 1 from public.price_lists pl
      where pl.id = price_list_id and pl.tenant_id = public.current_tenant_id()
    )
  )
)
with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and exists (
      select 1 from public.price_lists pl
      where pl.id = price_list_id and pl.tenant_id = public.current_tenant_id()
    )
  )
);
drop policy if exists "admins manage client catalogs" on public.client_catalogs;
create policy "admins manage client catalogs"
on public.client_catalogs for all to authenticated
using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and exists (
      select 1 from public.clients c
      where c.id = client_id and c.tenant_id = public.current_tenant_id()
    )
    and exists (
      select 1 from public.catalogs cat
      where cat.id = catalog_id and cat.tenant_id = public.current_tenant_id()
    )
  )
)
with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and exists (
      select 1 from public.clients c
      where c.id = client_id and c.tenant_id = public.current_tenant_id()
    )
    and exists (
      select 1 from public.catalogs cat
      where cat.id = catalog_id and cat.tenant_id = public.current_tenant_id()
    )
  )
);
drop policy if exists "admins manage client price lists" on public.client_price_lists;
create policy "admins manage client price lists"
on public.client_price_lists for all to authenticated
using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and exists (
      select 1 from public.clients c
      where c.id = client_id and c.tenant_id = public.current_tenant_id()
    )
    and exists (
      select 1 from public.price_lists pl
      where pl.id = price_list_id and pl.tenant_id = public.current_tenant_id()
    )
  )
)
with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and exists (
      select 1 from public.clients c
      where c.id = client_id and c.tenant_id = public.current_tenant_id()
    )
    and exists (
      select 1 from public.price_lists pl
      where pl.id = price_list_id and pl.tenant_id = public.current_tenant_id()
    )
  )
);
drop policy if exists "admin manage company settings" on public.company_settings;
drop policy if exists "admins manage company settings" on public.company_settings;
create policy "admins manage company settings"
on public.company_settings for all to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);
drop policy if exists "admin manage lines" on public.product_lines;
drop policy if exists "admins manage product lines" on public.product_lines;
create policy "admins manage product lines"
on public.product_lines for all to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);
drop policy if exists "admin manage metal prices" on public.metal_prices;
drop policy if exists "admins manage metal prices" on public.metal_prices;
create policy "admins manage metal prices"
on public.metal_prices for all to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);
drop policy if exists "admin manage margins" on public.client_line_margins;
drop policy if exists "admins manage client line margins" on public.client_line_margins;
create policy "admins manage client line margins"
on public.client_line_margins for all to authenticated
using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and exists (
      select 1 from public.clients c
      where c.id = client_id and c.tenant_id = public.current_tenant_id()
    )
  )
)
with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and exists (
      select 1 from public.clients c
      where c.id = client_id and c.tenant_id = public.current_tenant_id()
    )
  )
);
drop policy if exists "admin manage preorders" on public.preorders;
drop policy if exists "admins manage preorders" on public.preorders;
create policy "admins manage preorders"
on public.preorders for all to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);
drop policy if exists "admin manage preorder items" on public.preorder_items;
drop policy if exists "admins manage preorder items" on public.preorder_items;
create policy "admins manage preorder items"
on public.preorder_items for all to authenticated
using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and exists (
      select 1 from public.preorders po
      where po.id = preorder_id and po.tenant_id = public.current_tenant_id()
    )
  )
)
with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and exists (
      select 1 from public.preorders po
      where po.id = preorder_id and po.tenant_id = public.current_tenant_id()
    )
  )
);
drop policy if exists "admins manage quote links" on public.quote_links;
create policy "admins manage quote links"
on public.quote_links for all to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);
drop policy if exists "admins manage labor lists" on public.labor_lists;
create policy "admins manage labor lists"
on public.labor_lists for all to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);
drop policy if exists "admins manage labor list lines" on public.labor_list_lines;
create policy "admins manage labor list lines"
on public.labor_list_lines for all to authenticated
using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and exists (
      select 1 from public.labor_lists ll
      where ll.id = labor_list_id and ll.tenant_id = public.current_tenant_id()
    )
  )
)
with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and exists (
      select 1 from public.labor_lists ll
      where ll.id = labor_list_id and ll.tenant_id = public.current_tenant_id()
    )
  )
);
