-- Evita ciclos RLS entre tablas padre y sus asignaciones a clientes.

create or replace function public.tenant_owns_client(p_client_id uuid, p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.clients
    where id = p_client_id and tenant_id = p_tenant_id
  );
$$;

create or replace function public.tenant_owns_catalog(p_catalog_id uuid, p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.catalogs
    where id = p_catalog_id and tenant_id = p_tenant_id
  );
$$;

create or replace function public.tenant_owns_price_list(p_price_list_id uuid, p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.price_lists
    where id = p_price_list_id and tenant_id = p_tenant_id
  );
$$;

revoke all on function public.tenant_owns_client(uuid, uuid) from public;
revoke all on function public.tenant_owns_catalog(uuid, uuid) from public;
revoke all on function public.tenant_owns_price_list(uuid, uuid) from public;
grant execute on function public.tenant_owns_client(uuid, uuid) to authenticated;
grant execute on function public.tenant_owns_catalog(uuid, uuid) to authenticated;
grant execute on function public.tenant_owns_price_list(uuid, uuid) to authenticated;

drop policy if exists "admins manage client catalogs" on public.client_catalogs;
create policy "admins manage client catalogs"
on public.client_catalogs for all to authenticated
using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and public.tenant_owns_client(client_id, public.current_tenant_id())
    and public.tenant_owns_catalog(catalog_id, public.current_tenant_id())
  )
)
with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and public.tenant_owns_client(client_id, public.current_tenant_id())
    and public.tenant_owns_catalog(catalog_id, public.current_tenant_id())
  )
);

drop policy if exists "admins manage client price lists" on public.client_price_lists;
create policy "admins manage client price lists"
on public.client_price_lists for all to authenticated
using (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and public.tenant_owns_client(client_id, public.current_tenant_id())
    and public.tenant_owns_price_list(price_list_id, public.current_tenant_id())
  )
)
with check (
  public.is_superadmin()
  or (
    public.is_tenant_admin()
    and public.tenant_owns_client(client_id, public.current_tenant_id())
    and public.tenant_owns_price_list(price_list_id, public.current_tenant_id())
  )
);

notify pgrst, 'reload schema';
