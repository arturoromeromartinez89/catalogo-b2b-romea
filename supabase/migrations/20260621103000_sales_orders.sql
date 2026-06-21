create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  preorder_id uuid references public.preorders(id) on delete set null,
  folio text not null,
  status text not null default 'confirmada',
  client_id uuid references public.clients(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  cliente_nombre text,
  cliente_empresa text,
  cliente_email text,
  cliente_telefono text,
  cliente_rfc text,
  moneda text not null default 'MXN',
  tipo_cambio numeric not null default 0,
  total_piezas numeric not null default 0,
  total_gramos numeric not null default 0,
  total_mxn numeric not null default 0,
  anticipo_mxn numeric not null default 0,
  comprobante_url text,
  terms_text text,
  terms_accepted boolean not null default false,
  accepted_by_name text,
  accepted_by_email text,
  accepted_at timestamptz,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sales_orders_tenant_folio_unique unique (tenant_id, folio),
  constraint sales_orders_preorder_unique unique (preorder_id),
  constraint sales_orders_status_check
    check (status in ('confirmada', 'en_produccion', 'lista', 'entregada', 'cancelada'))
);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  producto_codigo text,
  producto_descripcion text,
  producto_metal text,
  producto_kilataje text,
  producto_linea text,
  producto_foto_url text,
  piezas numeric not null default 0,
  gramos_por_pieza numeric not null default 0,
  gramos_total numeric not null default 0,
  labor_mxn numeric not null default 0,
  precio_gramo_mxn numeric not null default 0,
  precio_pieza_mxn numeric not null default 0,
  subtotal_mxn numeric not null default 0,
  comentarios text,
  configuracion jsonb not null default '{}'::jsonb,
  sort_order numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.preorders
  add column if not exists confirmed_order_id uuid references public.sales_orders(id) on delete set null;

create index if not exists sales_orders_tenant_idx on public.sales_orders (tenant_id);
create index if not exists sales_orders_preorder_idx on public.sales_orders (preorder_id);
create index if not exists sales_order_items_order_idx on public.sales_order_items (sales_order_id);
create index if not exists sales_order_items_tenant_idx on public.sales_order_items (tenant_id);

alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;

drop policy if exists "tenant admins manage sales orders" on public.sales_orders;
create policy "tenant admins manage sales orders"
on public.sales_orders for all to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

drop policy if exists "tenant admins manage sales order items" on public.sales_order_items;
create policy "tenant admins manage sales order items"
on public.sales_order_items for all to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

create or replace function public.next_sales_order_folio(p_tenant_id uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_next integer;
begin
  select coalesce(max((regexp_match(folio, '^ORD-' || v_year || '-([0-9]+)$'))[1]::integer), 0) + 1
  into v_next
  from public.sales_orders
  where tenant_id = p_tenant_id
    and folio ~ ('^ORD-' || v_year || '-[0-9]+$');

  return 'ORD-' || v_year || '-' || lpad(v_next::text, 4, '0');
end;
$$;

create or replace function public.confirm_preorder_as_order(
  p_preorder_id uuid,
  p_confirmation jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_preorder public.preorders%rowtype;
  v_order_id uuid;
  v_folio text;
  v_existing public.sales_orders%rowtype;
  v_terms_accepted boolean := coalesce((p_confirmation->>'terms_accepted')::boolean, false);
  v_accepted_at timestamptz := case when coalesce((p_confirmation->>'terms_accepted')::boolean, false) then now() else null end;
begin
  if not (public.is_superadmin() or public.is_tenant_admin()) then
    raise exception 'Solo un administrador puede confirmar una orden.' using errcode = '42501';
  end if;

  select * into v_preorder
  from public.preorders
  where id = p_preorder_id;

  if v_preorder.id is null then
    raise exception 'Preorden no encontrada.' using errcode = 'P0002';
  end if;

  if not public.is_superadmin() and v_preorder.tenant_id <> public.current_tenant_id() then
    raise exception 'La preorden no pertenece a tu empresa.' using errcode = '42501';
  end if;

  select * into v_existing
  from public.sales_orders
  where preorder_id = p_preorder_id;

  if v_existing.id is not null then
    return jsonb_build_object('id', v_existing.id, 'folio', v_existing.folio, 'already_exists', true);
  end if;

  if not exists (select 1 from public.preorder_items where preorder_id = p_preorder_id) then
    raise exception 'No se puede confirmar una orden sin partidas.';
  end if;

  v_folio := public.next_sales_order_folio(v_preorder.tenant_id);

  insert into public.sales_orders (
    tenant_id, preorder_id, folio, status, client_id, confirmed_by, confirmed_at,
    cliente_nombre, cliente_empresa, cliente_email, cliente_telefono, cliente_rfc,
    moneda, tipo_cambio, total_piezas, total_gramos, total_mxn,
    anticipo_mxn, comprobante_url, terms_text, terms_accepted,
    accepted_by_name, accepted_by_email, accepted_at, notas
  ) values (
    v_preorder.tenant_id, v_preorder.id, v_folio, 'confirmada', v_preorder.client_id, auth.uid(), now(),
    v_preorder.cliente_nombre, v_preorder.cliente_empresa, v_preorder.cliente_email, v_preorder.cliente_telefono, v_preorder.cliente_rfc,
    coalesce(v_preorder.moneda, 'MXN'), coalesce(v_preorder.tipo_cambio, 0),
    coalesce(v_preorder.total_piezas, 0), coalesce(v_preorder.total_gramos, 0), coalesce(v_preorder.total_mxn, 0),
    coalesce((p_confirmation->>'anticipo_mxn')::numeric, 0),
    nullif(p_confirmation->>'comprobante_url', ''),
    nullif(p_confirmation->>'terms_text', ''),
    v_terms_accepted,
    nullif(p_confirmation->>'accepted_by_name', ''),
    nullif(p_confirmation->>'accepted_by_email', ''),
    v_accepted_at,
    nullif(p_confirmation->>'notas', '')
  )
  returning id, folio into v_order_id, v_folio;

  insert into public.sales_order_items (
    sales_order_id, tenant_id, producto_codigo, producto_descripcion, producto_metal,
    producto_kilataje, producto_linea, producto_foto_url, piezas, gramos_por_pieza,
    gramos_total, labor_mxn, precio_gramo_mxn, precio_pieza_mxn, subtotal_mxn,
    comentarios, configuracion, sort_order
  )
  select
    v_order_id, v_preorder.tenant_id, producto_codigo, producto_descripcion, producto_metal,
    producto_kilataje, producto_linea, producto_foto_url, piezas, gramos_por_pieza,
    gramos_total, labor_mxn, precio_gramo_mxn, coalesce(precio_pieza_mxn, 0), subtotal_mxn,
    comentarios, coalesce(configuracion, '{}'::jsonb), sort_order
  from public.preorder_items
  where preorder_id = p_preorder_id
  order by sort_order;

  update public.preorders
  set status = 'confirmada',
      confirmed_order_id = v_order_id,
      updated_at = now()
  where id = p_preorder_id;

  return jsonb_build_object('id', v_order_id, 'folio', v_folio, 'already_exists', false);
end;
$$;

revoke all on function public.next_sales_order_folio(uuid) from public, anon;
grant execute on function public.next_sales_order_folio(uuid) to authenticated;
revoke all on function public.confirm_preorder_as_order(uuid, jsonb) from public, anon;
grant execute on function public.confirm_preorder_as_order(uuid, jsonb) to authenticated;
