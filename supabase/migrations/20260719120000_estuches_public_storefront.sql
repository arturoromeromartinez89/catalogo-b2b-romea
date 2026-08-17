-- Public storefront for Estuches Chavez. Anonymous users never receive direct
-- table privileges; these RPCs expose only visible products and validate every
-- line again on the server before creating a preorder.

create or replace function public.is_estuches_chavez_tenant(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenants t
    where t.id = p_tenant_id
      and t.status = 'active'
      and (
        lower(coalesce(t.slug, '')) like '%estuches%chavez%'
        or lower(coalesce(t.name, '')) like '%estuches%chavez%'
      )
  );
$$;
revoke all on function public.is_estuches_chavez_tenant(uuid) from public, anon, authenticated;
create or replace function public.normalize_preorder_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'pendiente' and not public.is_estuches_chavez_tenant(new.tenant_id) then
    new.status := 'revision';
  end if;
  return new;
end;
$$;
create or replace function public.get_estuches_public_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_products jsonb;
begin
  select t.id into v_tenant_id
  from public.tenants t
  where t.status = 'active'
    and (
      lower(coalesce(t.slug, '')) like '%estuches%chavez%'
      or lower(coalesce(t.name, '')) like '%estuches%chavez%'
    )
  order by case when lower(coalesce(t.slug, '')) = 'estuches-chavez' then 0 else 1 end
  limit 1;

  if v_tenant_id is null then
    raise exception 'El catalogo no esta disponible.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'codigo', p.codigo,
    'modelo', p.modelo,
    'descripcion', p.descripcion,
    'metal', p.metal,
    'kilataje', p.kilataje,
    'linea', p.linea,
    'familia', p.familia,
    'grupo', p.grupo,
    'peso_promedio', p.peso_promedio,
    'unidad_venta', p.unidad_venta,
    'clave_venta', p.clave_venta,
    'precio_minimo', p.precio_minimo,
    'moneda_precio_min', coalesce(p.moneda_precio_min, 'MXN'),
    'foto_url', p.foto_url,
    'tags_busqueda', p.tags_busqueda
  ) order by coalesce(p.orden_web, 999999), p.codigo), '[]'::jsonb)
  into v_products
  from public.products p
  where p.tenant_id = v_tenant_id
    and p.visible_web is true
    and lower(coalesce(p.estatus, 'activo')) not in ('baja', 'inactivo');

  return jsonb_build_object(
    'brand_name', 'Estuches Chavez',
    'products', v_products
  );
end;
$$;
revoke all on function public.get_estuches_public_catalog() from public;
grant execute on function public.get_estuches_public_catalog() to anon, authenticated;
create or replace function public.submit_estuches_guest_preorder(
  p_customer jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_preorder_id uuid;
  v_item jsonb;
  v_product public.products%rowtype;
  v_code text;
  v_quantity numeric;
  v_subtotal numeric;
  v_total_pieces numeric := 0;
  v_total_mxn numeric := 0;
  v_seen text[] := array[]::text[];
  v_index integer := 0;
  v_name text := trim(coalesce(p_customer->>'name', ''));
  v_address text := trim(coalesce(p_customer->>'address', ''));
  v_phone text := trim(coalesce(p_customer->>'phone', ''));
begin
  if jsonb_typeof(p_customer) <> 'object'
    or length(v_name) < 2 or length(v_name) > 120
    or length(v_address) < 5 or length(v_address) > 500
    or length(v_phone) > 40 then
    raise exception 'Completa un nombre y una direccion validos.';
  end if;
  if jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 100 then
    raise exception 'El pedido debe contener entre 1 y 100 productos.';
  end if;

  select t.id into v_tenant_id
  from public.tenants t
  where t.status = 'active'
    and (
      lower(coalesce(t.slug, '')) like '%estuches%chavez%'
      or lower(coalesce(t.name, '')) like '%estuches%chavez%'
    )
  order by case when lower(coalesce(t.slug, '')) = 'estuches-chavez' then 0 else 1 end
  limit 1;
  if v_tenant_id is null then raise exception 'El catalogo no esta disponible.'; end if;

  if exists (
    select 1 from public.preorders po
    where po.tenant_id = v_tenant_id
      and po.cliente_nombre = v_name
      and po.created_at > now() - interval '10 seconds'
  ) then
    raise exception 'Espera unos segundos antes de volver a enviar.';
  end if;

  insert into public.preorders (
    folio, status, client_id, created_by, cliente_nombre, cliente_empresa,
    cliente_telefono, tipo_cambio, moneda, notas, total_piezas,
    total_gramos, total_mxn, tenant_id, updated_at
  ) values (
    'PRE-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-MS'),
    'pendiente', null, null, v_name, '', v_phone, 0, 'MXN',
    'Pedido de invitado. Direccion: ' || v_address,
    0, 0, 0, v_tenant_id, now()
  ) returning id into v_preorder_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_code := nullif(trim(coalesce(v_item->>'codigo', '')), '');
    if v_code is null or v_code = any(v_seen) then
      raise exception 'El pedido contiene codigos invalidos o repetidos.';
    end if;
    if coalesce(v_item->>'quantity', '') !~ '^[0-9]+$' then
      raise exception 'La cantidad de % no es valida.', v_code;
    end if;
    v_quantity := (v_item->>'quantity')::numeric;
    if v_quantity < 1 or v_quantity > 10000 then
      raise exception 'La cantidad de % esta fuera del limite.', v_code;
    end if;

    select p.* into v_product
    from public.products p
    where p.tenant_id = v_tenant_id
      and p.codigo = v_code
      and p.visible_web is true
      and lower(coalesce(p.estatus, 'activo')) not in ('baja', 'inactivo')
    limit 1;
    if v_product.id is null then raise exception 'El producto % no esta disponible.', v_code; end if;

    v_subtotal := v_quantity * greatest(coalesce(v_product.precio_minimo, 0), 0);
    insert into public.preorder_items (
      preorder_id, producto_codigo, producto_descripcion, producto_metal,
      producto_kilataje, producto_linea, producto_foto_url, piezas,
      gramos_por_pieza, gramos_total, labor_mxn, precio_gramo_mxn,
      subtotal_mxn, sort_order, updated_at
    ) values (
      v_preorder_id, v_product.codigo, left(v_product.descripcion, 500),
      left(coalesce(v_product.metal, ''), 100), left(coalesce(v_product.kilataje, ''), 100),
      left(coalesce(v_product.linea, ''), 160), left(coalesce(v_product.foto_url, ''), 2000),
      v_quantity, 0, 0, 0, greatest(coalesce(v_product.precio_minimo, 0), 0),
      v_subtotal, v_index, now()
    );
    v_seen := array_append(v_seen, v_code);
    v_total_pieces := v_total_pieces + v_quantity;
    v_total_mxn := v_total_mxn + v_subtotal;
    v_index := v_index + 1;
  end loop;

  update public.preorders
  set total_piezas = v_total_pieces, total_mxn = v_total_mxn, updated_at = now()
  where id = v_preorder_id;
  return v_preorder_id;
end;
$$;
revoke all on function public.submit_estuches_guest_preorder(jsonb, jsonb) from public;
grant execute on function public.submit_estuches_guest_preorder(jsonb, jsonb) to anon, authenticated;
insert into public.tenant_features (tenant_id, modulo_agenda)
select t.id, true
from public.tenants t
where lower(coalesce(t.slug, '')) like '%estuches%chavez%'
   or lower(coalesce(t.name, '')) like '%estuches%chavez%'
on conflict (tenant_id) do update
set modulo_agenda = true, updated_at = now();
insert into public.tenant_interface_settings (tenant_id, client_portal_config)
select
  t.id,
  jsonb_build_object(
    'announcement', jsonb_build_object(
      'socials', jsonb_build_object(
        'show_website', true,
        'website', 'https://www.estucheschavez.com.mx/',
        'show_instagram', true,
        'instagram', 'https://www.instagram.com/estucheschavez',
        'show_facebook', true,
        'facebook', 'https://www.facebook.com/EstuchezChavez/',
        'show_tiktok', false,
        'show_linkedin', false
      )
    )
  )
from public.tenants t
where lower(coalesce(t.slug, '')) like '%estuches%chavez%'
   or lower(coalesce(t.name, '')) like '%estuches%chavez%'
on conflict (tenant_id) do update
set client_portal_config = jsonb_set(
  coalesce(public.tenant_interface_settings.client_portal_config, '{}'::jsonb),
  '{announcement,socials}',
  coalesce(public.tenant_interface_settings.client_portal_config #> '{announcement,socials}', '{}'::jsonb)
    || excluded.client_portal_config #> '{announcement,socials}',
  true
);
notify pgrst, 'reload schema';
