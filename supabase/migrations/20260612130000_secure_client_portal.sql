-- Secure the client portal behind server-side pricing and controlled commands.
-- Requires 20260612120000_lock_down_profile_privileges.sql.

create extension if not exists "pgcrypto";

alter table public.profiles
  add column if not exists active boolean not null default true;
alter table public.clients
  add column if not exists allowed_skus text[] not null default '{}'::text[];
alter table public.clients
  add column if not exists labor_list_id text;
alter table public.preorder_items
  add column if not exists precio_pieza_mxn numeric not null default 0;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_client public.clients%rowtype;
begin
  select c.* into matched_client
  from public.clients c
  where lower(c.email) = lower(new.email)
    and c.active is true
    and not exists (
      select 1
      from public.clients other_client
      where other_client.id <> c.id
        and other_client.active is true
        and lower(other_client.email) = lower(c.email)
    )
  order by c.created_at
  limit 1;

  insert into public.profiles (id, email, role, client_id, tenant_id, active)
  values (
    new.id,
    lower(new.email),
    'client',
    matched_client.id,
    matched_client.tenant_id,
    matched_client.id is not null
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.tenant_id
  from public.profiles p
  join public.tenants t on t.id = p.tenant_id
  where p.id = auth.uid()
    and p.active is true
    and t.status = 'active';
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'superadmin'
      and p.active is true
  );
$$;

create or replace function public.is_tenant_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.tenants t on t.id = p.tenant_id
    where p.id = auth.uid()
      and p.role in ('tenant_admin', 'admin')
      and p.active is true
      and t.status = 'active'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_superadmin() or public.is_tenant_admin();
$$;

create or replace function public.is_admin_of_tenant(t_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_superadmin() or exists (
    select 1
    from public.profiles p
    join public.tenants t on t.id = p.tenant_id
    where p.id = auth.uid()
      and p.role in ('tenant_admin', 'admin')
      and p.active is true
      and p.tenant_id = t_id
      and t.status = 'active'
  );
$$;

revoke all on function public.current_tenant_id() from public;
revoke all on function public.is_superadmin() from public;
revoke all on function public.is_tenant_admin() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_admin_of_tenant(uuid) from public;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.is_tenant_admin() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin_of_tenant(uuid) to authenticated;

-- Clients no longer read commercially sensitive base tables through PostgREST.
drop policy if exists "clients read own client" on public.clients;
drop policy if exists "clients read visible products" on public.products;
drop policy if exists "clients read products" on public.products;
drop policy if exists "authenticated read company settings" on public.company_settings;
drop policy if exists "clients read company settings" on public.company_settings;
drop policy if exists "authenticated read product lines" on public.product_lines;
drop policy if exists "all read lines" on public.product_lines;
drop policy if exists "authenticated read metal prices" on public.metal_prices;
drop policy if exists "all read metal prices" on public.metal_prices;
drop policy if exists "clients read own line margins" on public.client_line_margins;
drop policy if exists "clients read own margins" on public.client_line_margins;
drop policy if exists "clients manage own preorders" on public.preorders;
drop policy if exists "clients manage own preorder items" on public.preorder_items;
drop policy if exists "clients insert own preorders" on public.preorders;
drop policy if exists "clients update own preorders" on public.preorders;
drop policy if exists "clients insert own preorder items" on public.preorder_items;
drop policy if exists "clients update own preorder items" on public.preorder_items;

-- The portal may only read its sanitized preorder representation through RPC.
drop policy if exists "clients read own preorders" on public.preorders;
drop policy if exists "clients read own preorder items" on public.preorder_items;

create or replace function public.get_public_company_branding(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'brand_name', cs.brand_name,
        'phone', cs.phone,
        'email', cs.email,
        'city', cs.city,
        'state', cs.state,
        'country', cs.country,
        'logo_url', cs.logo_url,
        'commercial_terms', cs.commercial_terms
      )
      from public.company_settings cs
      join public.tenants t on t.id = cs.tenant_id
      where cs.tenant_id = p_tenant_id
        and t.status = 'active'
      limit 1
    ),
    '{}'::jsonb
  );
$$;

revoke all on function public.get_public_company_branding(uuid) from public;
grant execute on function public.get_public_company_branding(uuid) to anon, authenticated;

create or replace function public.get_client_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_client public.clients%rowtype;
  v_products jsonb;
begin
  select p.* into v_profile
  from public.profiles p
  join public.tenants t on t.id = p.tenant_id
  where p.id = auth.uid()
    and p.role = 'client'
    and p.active is true
    and t.status = 'active';

  if v_profile.id is null or v_profile.client_id is null then
    raise exception 'client account is not active or linked' using errcode = '42501';
  end if;

  select c.* into v_client
  from public.clients c
  where c.id = v_profile.client_id
    and c.tenant_id = v_profile.tenant_id
    and c.active is true;

  if v_client.id is null then
    raise exception 'client record is not active' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(product_row order by product_row->>'codigo'), '[]'::jsonb)
  into v_products
  from (
    select jsonb_build_object(
      'id', p.id,
      'codigo', p.codigo,
      'modelo', p.modelo,
      'descripcion', p.descripcion,
      'metal', p.metal,
      'kilataje', p.kilataje,
      'linea', p.linea,
      'familia', p.familia,
      'grupo', p.grupo,
      'genero', p.genero,
      'acabado', p.acabado,
      'piedra', p.piedra,
      'medida', p.medida,
      'estatus', p.estatus,
      'peso_promedio', p.peso_promedio,
      'unidad_venta', p.unidad_venta,
      'clave_venta', p.clave_venta,
      'precio_minimo', pricing.final_price,
      'moneda_precio_min', 'MXN',
      'foto_url', p.foto_url,
      'foto_url_2', p.foto_url_2,
      'foto_url_3', p.foto_url_3,
      'visible_web', p.visible_web,
      'orden_web', p.orden_web,
      'tags_busqueda', p.tags_busqueda
    ) as product_row
    from public.products p
    left join public.product_lines pl
      on pl.tenant_id = p.tenant_id and upper(trim(pl.codigo)) = upper(trim(p.linea)) and pl.activa is true
    left join lateral (
      select mp.* from public.metal_prices mp
      where mp.tenant_id = p.tenant_id
      order by mp.updated_at desc
      limit 1
    ) mp on true
    left join lateral (
      select ll.*, lll.integrated_price, lll.final_labor
      from public.labor_lists ll
      join public.labor_list_lines lll on lll.labor_list_id = ll.id
      where v_client.labor_list_id ~* '^[0-9a-f-]{36}$'
        and ll.id = v_client.labor_list_id::uuid
        and ll.tenant_id = p.tenant_id
        and ll.active is true
        and ll.status = 'activa'
        and upper(trim(lll.line_codigo)) = upper(trim(p.linea))
      limit 1
    ) assigned on true
    cross join lateral (
      select ceil(
        greatest(
          case
            when coalesce(assigned.integrated_price, 0) > 0 then
              assigned.integrated_price * case when assigned.currency = 'USD' then coalesce(nullif(assigned.tipo_cambio, 0), 1) else 1 end
            else
              coalesce(pl.mo_base, 0) +
              case
                when coalesce(mp.plata_fina_mxn, 0) > 0 then mp.plata_fina_mxn
                when coalesce(mp.kitco_usd_oz, 0) > 0 and coalesce(mp.tipo_cambio, 0) > 0 then
                  (mp.kitco_usd_oz / 31.1035) * (1 + coalesce(mp.premio_pct, 0) / 100) * mp.tipo_cambio
                else 0
              end
          end,
          0
        ) * 100
      ) / 100 as final_price
    ) pricing
    where p.tenant_id = v_profile.tenant_id
      and (
        (coalesce(array_length(v_client.allowed_skus, 1), 0) = 0 and p.visible_web is true)
        or p.codigo = any(coalesce(v_client.allowed_skus, '{}'::text[]))
      )
  ) catalog_rows;

  return jsonb_build_object(
    'client', jsonb_build_object(
      'id', v_client.id,
      'tenant_id', v_client.tenant_id,
      'name', v_client.name,
      'company', v_client.company,
      'email', v_client.email,
      'phone', v_client.phone,
      'rfc', v_client.rfc,
      'allowed_skus', coalesce(v_client.allowed_skus, '{}'::text[])
    ),
    'products', v_products
  );
end;
$$;

revoke all on function public.get_client_catalog() from public;
grant execute on function public.get_client_catalog() to authenticated;

create or replace function public.submit_client_preorder(p_customer jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_client public.clients%rowtype;
  v_preorder_id uuid;
  v_folio text;
  v_now timestamptz := now();
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity numeric;
  v_price numeric;
  v_labor numeric;
  v_silver numeric;
  v_total_pieces numeric := 0;
  v_total_grams numeric := 0;
  v_total_mxn numeric := 0;
  v_index integer := 0;
  v_item_count integer;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be an array';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 250 then
    raise exception 'preorder must contain between 1 and 250 items';
  end if;

  select p.* into v_profile
  from public.profiles p
  join public.tenants t on t.id = p.tenant_id
  where p.id = auth.uid()
    and p.role = 'client'
    and p.active is true
    and t.status = 'active';

  if v_profile.id is null or v_profile.client_id is null then
    raise exception 'client account is not active or linked' using errcode = '42501';
  end if;

  select c.* into v_client
  from public.clients c
  where c.id = v_profile.client_id
    and c.tenant_id = v_profile.tenant_id
    and c.active is true;

  if v_client.id is null then
    raise exception 'client record is not active' using errcode = '42501';
  end if;

  v_folio := 'PRE-' || to_char(v_now, 'YYYYMMDD-HH24MISS') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4));

  insert into public.preorders (
    folio, status, client_id, created_by, cliente_nombre, cliente_empresa,
    cliente_email, cliente_telefono, cliente_rfc, tipo_cambio, moneda, notas,
    total_piezas, total_gramos, total_mxn, tenant_id, updated_at
  ) values (
    v_folio, 'pendiente', v_client.id, v_profile.id, v_client.name, v_client.company,
    v_client.email, v_client.phone, v_client.rfc, 0, 'MXN', left(coalesce(p_customer->>'notes', ''), 2000),
    0, 0, 0, v_profile.tenant_id, v_now
  ) returning id into v_preorder_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(v_item->>'codigo', '') = ''
      or coalesce(v_item->>'quantity', '') !~ '^([0-9]+)(\.[0-9]+)?$' then
      raise exception 'invalid preorder item';
    end if;

    v_quantity := (v_item->>'quantity')::numeric;
    if v_quantity <= 0 or v_quantity > 10000 then
      raise exception 'invalid item quantity';
    end if;

    select p.* into v_product
    from public.products p
    where p.tenant_id = v_profile.tenant_id
      and p.codigo = v_item->>'codigo'
      and (
        (coalesce(array_length(v_client.allowed_skus, 1), 0) = 0 and p.visible_web is true)
        or p.codigo = any(coalesce(v_client.allowed_skus, '{}'::text[]))
      )
    limit 1;

    if v_product.id is null then
      raise exception 'product is not available to this client';
    end if;

    select
      coalesce(
        case when assigned.integrated_price > 0 then
          assigned.integrated_price * case when assigned.currency = 'USD' then coalesce(nullif(assigned.tipo_cambio, 0), 1) else 1 end
        end,
        coalesce(pl.mo_base, 0) + fine.silver
      ),
      coalesce(
        case when assigned.final_labor > 0 then
          assigned.final_labor * case when assigned.currency = 'USD' then coalesce(nullif(assigned.tipo_cambio, 0), 1) else 1 end
        end,
        pl.mo_base,
        0
      ),
      fine.silver
    into v_price, v_labor, v_silver
    from (select 1) seed
    left join public.product_lines pl
      on pl.tenant_id = v_product.tenant_id and upper(trim(pl.codigo)) = upper(trim(v_product.linea)) and pl.activa is true
    left join lateral (
      select mp.* from public.metal_prices mp
      where mp.tenant_id = v_product.tenant_id
      order by mp.updated_at desc limit 1
    ) mp on true
    left join lateral (
      select case
        when coalesce(mp.plata_fina_mxn, 0) > 0 then mp.plata_fina_mxn
        when coalesce(mp.kitco_usd_oz, 0) > 0 and coalesce(mp.tipo_cambio, 0) > 0 then
          ceil(((mp.kitco_usd_oz / 31.1035) * (1 + coalesce(mp.premio_pct, 0) / 100) * mp.tipo_cambio) * 100) / 100
        else 0
      end as silver
    ) fine on true
    left join lateral (
      select ll.currency, ll.tipo_cambio, lll.integrated_price, lll.final_labor
      from public.labor_lists ll
      join public.labor_list_lines lll on lll.labor_list_id = ll.id
      where v_client.labor_list_id ~* '^[0-9a-f-]{36}$'
        and ll.id = v_client.labor_list_id::uuid
        and ll.tenant_id = v_product.tenant_id
        and ll.active is true and ll.status = 'activa'
        and upper(trim(lll.line_codigo)) = upper(trim(v_product.linea))
      limit 1
    ) assigned on true;

    v_price := ceil(greatest(coalesce(v_price, 0), 0) * 100) / 100;
    v_labor := ceil(greatest(coalesce(v_labor, 0), 0) * 100) / 100;

    insert into public.preorder_items (
      preorder_id, producto_codigo, producto_descripcion, producto_metal,
      producto_kilataje, producto_linea, producto_foto_url, piezas,
      gramos_por_pieza, gramos_total, labor_mxn, precio_gramo_mxn,
      subtotal_mxn, sort_order, updated_at
    ) values (
      v_preorder_id,
      v_product.codigo,
      case
        when coalesce(v_item->>'comment', '') <> '' then
          v_product.descripcion || E'\nNota: ' || left(v_item->>'comment', 500)
        else v_product.descripcion
      end,
      v_product.metal,
      v_product.kilataje, v_product.linea, v_product.foto_url, v_quantity,
      coalesce(v_product.peso_promedio, 0), v_quantity * coalesce(v_product.peso_promedio, 0),
      v_labor, v_price, v_quantity * coalesce(v_product.peso_promedio, 0) * v_price,
      v_index, v_now
    );

    v_total_pieces := v_total_pieces + v_quantity;
    v_total_grams := v_total_grams + v_quantity * coalesce(v_product.peso_promedio, 0);
    v_total_mxn := v_total_mxn + v_quantity * coalesce(v_product.peso_promedio, 0) * v_price;
    v_index := v_index + 1;
  end loop;

  update public.preorders
  set total_piezas = v_total_pieces,
      total_gramos = v_total_grams,
      total_mxn = v_total_mxn,
      updated_at = v_now
  where id = v_preorder_id;

  return jsonb_build_object('id', v_preorder_id, 'folio', v_folio, 'updated_at', v_now);
end;
$$;

revoke all on function public.submit_client_preorder(jsonb, jsonb) from public;
grant execute on function public.submit_client_preorder(jsonb, jsonb) to authenticated;

create or replace function public.get_client_preorders()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(preorder_row order by preorder_row->>'created_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', po.id,
      'folio', po.folio,
      'status', po.status,
      'client_id', po.client_id,
      'cliente_nombre', po.cliente_nombre,
      'cliente_empresa', po.cliente_empresa,
      'moneda', po.moneda,
      'total_piezas', po.total_piezas,
      'total_gramos', po.total_gramos,
      'total_mxn', po.total_mxn,
      'created_at', po.created_at,
      'updated_at', po.updated_at,
      'preorder_items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', pi.id,
          'producto_codigo', pi.producto_codigo,
          'producto_descripcion', pi.producto_descripcion,
          'producto_metal', pi.producto_metal,
          'producto_kilataje', pi.producto_kilataje,
          'producto_linea', pi.producto_linea,
          'producto_foto_url', pi.producto_foto_url,
          'piezas', pi.piezas,
          'gramos_por_pieza', pi.gramos_por_pieza,
          'gramos_total', pi.gramos_total,
          'precio_gramo_mxn', pi.precio_gramo_mxn,
          'precio_pieza_mxn', coalesce(pi.precio_pieza_mxn, 0),
          'subtotal_mxn', pi.subtotal_mxn,
          'sort_order', pi.sort_order
        ) order by pi.sort_order)
        from public.preorder_items pi where pi.preorder_id = po.id
      ), '[]'::jsonb)
    ) as preorder_row
    from public.preorders po
    join public.profiles p on p.client_id = po.client_id and p.tenant_id = po.tenant_id
    join public.tenants t on t.id = p.tenant_id
    where p.id = auth.uid()
      and p.role = 'client'
      and p.active is true
      and t.status = 'active'
  ) rows;
$$;

revoke all on function public.get_client_preorders() from public;
grant execute on function public.get_client_preorders() to authenticated;
