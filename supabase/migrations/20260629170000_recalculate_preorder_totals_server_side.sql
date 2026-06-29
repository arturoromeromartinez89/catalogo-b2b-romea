-- Fase 0 SaaS: el navegador deja de ser la autoridad final de precios.
-- Este parche conserva el contrato del RPC existente, pero recalcula del lado
-- servidor cuando el producto existe en el catalogo del tenant.

create or replace function public.save_preorder_transaction(
  p_preorder jsonb,
  p_items jsonb,
  p_expected_updated_at text default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor public.profiles%rowtype;
  v_existing public.preorders%rowtype;
  v_product public.products%rowtype;
  v_preorder_id uuid;
  v_requested_id uuid;
  v_tenant_id uuid;
  v_client_id uuid;
  v_labor_list_id uuid;
  v_piece_price_list_id uuid;
  v_status text;
  v_pricing_mode text;
  v_folio text;
  v_updated_at timestamptz := clock_timestamp();
  v_expected timestamptz;
  v_item jsonb;
  v_item_piece_list_id uuid;
  v_item_pricing_mode text;
  v_item_count integer;
  v_item_code text;
  v_item_line text;
  v_pieces numeric;
  v_grams_per_piece numeric;
  v_grams_total numeric;
  v_labor_mxn numeric;
  v_price_gram_mxn numeric;
  v_price_piece_mxn numeric;
  v_subtotal_mxn numeric;
  v_sort_order numeric;
  v_total_pieces numeric := 0;
  v_total_grams numeric := 0;
  v_total_mxn numeric := 0;
  v_list_currency text;
  v_list_exchange numeric;
  v_currency_factor numeric := 1;
  v_has_product boolean;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_actor
  from public.profiles
  where id = auth.uid()
    and active is true;

  if not found or v_actor.role not in ('superadmin', 'tenant_admin', 'admin', 'client') then
    raise exception 'ACCOUNT_NOT_AUTHORIZED';
  end if;

  if jsonb_typeof(p_preorder) <> 'object' or jsonb_typeof(p_items) <> 'array' then
    raise exception 'INVALID_PREORDER_PAYLOAD';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 1000 then
    raise exception 'PREORDER_ITEMS_LIMIT';
  end if;

  v_requested_id := nullif(p_preorder->>'id', '')::uuid;
  v_client_id := nullif(p_preorder->>'client_id', '')::uuid;
  v_labor_list_id := nullif(p_preorder->>'labor_list_id', '')::uuid;
  v_piece_price_list_id := nullif(p_preorder->>'piece_price_list_id', '')::uuid;
  v_pricing_mode := coalesce(nullif(p_preorder->>'pricing_mode', ''), 'gram');
  v_status := coalesce(nullif(p_preorder->>'status', ''), 'pendiente');

  if v_actor.role = 'superadmin' then
    v_tenant_id := nullif(p_preorder->>'tenant_id', '')::uuid;
  else
    v_tenant_id := v_actor.tenant_id;
    if nullif(p_preorder->>'tenant_id', '') is not null
       and (p_preorder->>'tenant_id')::uuid <> v_tenant_id then
      raise exception 'TENANT_MISMATCH';
    end if;
  end if;

  if v_tenant_id is null or not exists (
    select 1 from public.tenants where id = v_tenant_id and status = 'active'
  ) then
    raise exception 'TENANT_NOT_ACTIVE';
  end if;

  if v_actor.role = 'client' then
    if v_actor.client_id is null then
      raise exception 'CLIENT_PROFILE_NOT_LINKED';
    end if;
    v_client_id := v_actor.client_id;
    v_status := 'pendiente';
  elsif v_status not in ('pendiente', 'revision', 'confirmada', 'cancelada') then
    raise exception 'INVALID_PREORDER_STATUS';
  end if;

  if v_client_id is null or not exists (
    select 1
    from public.clients
    where id = v_client_id
      and tenant_id = v_tenant_id
      and active is true
  ) then
    raise exception 'CLIENT_NOT_AVAILABLE_FOR_TENANT';
  end if;

  if v_actor.role = 'client' and v_labor_list_id is null then
    select labor_list_id::uuid into v_labor_list_id
    from public.clients
    where id = v_client_id
      and tenant_id = v_tenant_id
      and active is true
      and labor_list_id ~* '^[0-9a-f-]{36}$';
  end if;

  if v_pricing_mode not in ('gram', 'piece') then
    raise exception 'INVALID_PRICING_MODE';
  end if;

  if v_labor_list_id is not null and not exists (
    select 1 from public.labor_lists
    where id = v_labor_list_id and tenant_id = v_tenant_id and active is true
  ) then
    raise exception 'LABOR_LIST_TENANT_MISMATCH';
  end if;

  if v_piece_price_list_id is not null and not exists (
    select 1 from public.piece_price_lists
    where id = v_piece_price_list_id and tenant_id = v_tenant_id and active is true
  ) then
    raise exception 'PIECE_LIST_TENANT_MISMATCH';
  end if;

  if v_requested_id is not null then
    select * into v_existing
    from public.preorders
    where id = v_requested_id
      and tenant_id = v_tenant_id
    for update;

    if not found then
      raise exception 'PREORDER_NOT_FOUND';
    end if;

    if v_actor.role = 'client'
       and (v_existing.client_id <> v_client_id or v_existing.status <> 'pendiente') then
      raise exception 'CLIENT_PREORDER_LOCKED';
    end if;

    if not coalesce(p_force, false) and nullif(p_expected_updated_at, '') is not null then
      v_expected := p_expected_updated_at::timestamptz;
      if v_existing.updated_at <> v_expected then
        raise exception 'CONFLICT|%|%', to_char(v_existing.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), coalesce(v_existing.folio, '');
      end if;
    end if;

    update public.preorders
    set folio = coalesce(nullif(p_preorder->>'folio', ''), folio),
        status = v_status,
        client_id = v_client_id,
        cliente_nombre = coalesce(p_preorder->>'cliente_nombre', ''),
        cliente_empresa = coalesce(p_preorder->>'cliente_empresa', ''),
        cliente_email = coalesce(p_preorder->>'cliente_email', ''),
        cliente_telefono = coalesce(p_preorder->>'cliente_telefono', ''),
        cliente_rfc = coalesce(p_preorder->>'cliente_rfc', ''),
        tipo_cambio = coalesce((p_preorder->>'tipo_cambio')::numeric, 0),
        moneda = case when p_preorder->>'moneda' in ('MXN', 'USD') then p_preorder->>'moneda' else 'MXN' end,
        notas = coalesce(p_preorder->>'notas', ''),
        total_piezas = 0,
        total_gramos = 0,
        total_mxn = 0,
        labor_list_id = v_labor_list_id,
        pricing_mode = v_pricing_mode,
        piece_price_list_id = v_piece_price_list_id,
        updated_at = v_updated_at
    where id = v_requested_id
    returning id, folio into v_preorder_id, v_folio;

    delete from public.preorder_items where preorder_id = v_preorder_id;
  else
    insert into public.preorders (
      folio, status, client_id, created_by, cliente_nombre, cliente_empresa,
      cliente_email, cliente_telefono, cliente_rfc, tipo_cambio, moneda, notas,
      total_piezas, total_gramos, total_mxn, tenant_id, labor_list_id,
      pricing_mode, piece_price_list_id, updated_at
    ) values (
      coalesce(nullif(p_preorder->>'folio', ''), 'PRE-' || to_char(v_updated_at, 'YYYYMMDD-HH24MISS') || '-' || upper(substr(md5(random()::text), 1, 4))),
      v_status, v_client_id, auth.uid(), coalesce(p_preorder->>'cliente_nombre', ''),
      coalesce(p_preorder->>'cliente_empresa', ''), coalesce(p_preorder->>'cliente_email', ''),
      coalesce(p_preorder->>'cliente_telefono', ''), coalesce(p_preorder->>'cliente_rfc', ''),
      coalesce((p_preorder->>'tipo_cambio')::numeric, 0),
      case when p_preorder->>'moneda' in ('MXN', 'USD') then p_preorder->>'moneda' else 'MXN' end,
      coalesce(p_preorder->>'notas', ''), 0, 0, 0,
      v_tenant_id, v_labor_list_id, v_pricing_mode, v_piece_price_list_id, v_updated_at
    )
    returning id, folio into v_preorder_id, v_folio;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_item_code := btrim(coalesce(v_item->>'producto_codigo', ''));
    v_pieces := coalesce((v_item->>'piezas')::numeric, 0);
    v_item_pricing_mode := coalesce(nullif(v_item->>'pricing_mode', ''), v_pricing_mode);
    v_item_piece_list_id := coalesce(nullif(v_item->>'piece_price_list_id', '')::uuid, v_piece_price_list_id);
    v_sort_order := coalesce((v_item->>'sort_order')::numeric, 0);

    if v_item_code = '' or v_pieces <= 0 then
      raise exception 'INVALID_PREORDER_ITEM';
    end if;

    if v_item_pricing_mode not in ('gram', 'piece') then
      raise exception 'INVALID_ITEM_PRICING_MODE';
    end if;

    select * into v_product
    from public.products
    where tenant_id = v_tenant_id
      and upper(btrim(codigo)) = upper(v_item_code)
    limit 1;
    v_has_product := found;

    if not v_has_product and v_actor.role = 'client' then
      raise exception 'PRODUCT_NOT_AVAILABLE_FOR_TENANT';
    end if;

    v_item_line := coalesce(nullif(v_product.linea, ''), nullif(v_item->>'producto_linea', ''), '');
    v_grams_per_piece := case
      when v_has_product then coalesce(v_product.peso_promedio, 0)
      else coalesce((v_item->>'gramos_por_pieza')::numeric, 0)
    end;
    v_grams_total := case
      when v_has_product then v_grams_per_piece * v_pieces
      else coalesce((v_item->>'gramos_total')::numeric, 0)
    end;

    v_labor_mxn := 0;
    v_price_gram_mxn := 0;
    v_price_piece_mxn := 0;
    v_subtotal_mxn := 0;

    if v_item_pricing_mode = 'piece' then
      if v_item_piece_list_id is not null then
        if not exists (
          select 1
          from public.piece_price_lists
          where id = v_item_piece_list_id
            and tenant_id = v_tenant_id
            and active is true
        ) then
          raise exception 'ITEM_PIECE_LIST_TENANT_MISMATCH';
        end if;

        select coalesce(item.unit_price_mxn, item.unit_price, 0)
        into v_price_piece_mxn
        from public.piece_price_list_items item
        where item.piece_price_list_id = v_item_piece_list_id
          and upper(btrim(item.codigo)) = upper(v_item_code)
        limit 1;

        if not found then
          if v_actor.role = 'client' then
            raise exception 'PIECE_PRICE_NOT_AVAILABLE';
          end if;
          v_price_piece_mxn := coalesce((v_item->>'precio_pieza_mxn')::numeric, 0);
        end if;
      else
        if v_actor.role = 'client' then
          raise exception 'PIECE_PRICE_LIST_REQUIRED';
        end if;
        v_price_piece_mxn := coalesce((v_item->>'precio_pieza_mxn')::numeric, 0);
      end if;

      v_subtotal_mxn := v_price_piece_mxn * v_pieces;
    else
      if v_labor_list_id is not null then
        select coalesce(list.currency, 'MXN'), coalesce(list.tipo_cambio, 0)
        into v_list_currency, v_list_exchange
        from public.labor_lists list
        where list.id = v_labor_list_id
          and list.tenant_id = v_tenant_id
          and list.active is true
        limit 1;

        v_currency_factor := case
          when v_list_currency = 'USD' then coalesce(nullif(v_list_exchange, 0), nullif((p_preorder->>'tipo_cambio')::numeric, 0), 1)
          else 1
        end;

        select coalesce(line.final_labor, line.labor_mxn, line.mo_base, 0) * v_currency_factor,
               coalesce(line.integrated_price, line.final_labor + line.silver_fine, line.labor_mxn, line.mo_base, 0) * v_currency_factor
        into v_labor_mxn, v_price_gram_mxn
        from public.labor_list_lines line
        where line.labor_list_id = v_labor_list_id
          and upper(btrim(line.line_codigo)) = upper(btrim(v_item_line))
        limit 1;
      end if;

      if v_price_gram_mxn is null or v_price_gram_mxn <= 0 then
        if v_has_product then
          v_labor_mxn := coalesce(v_product.mano_obra, 0);
          v_price_gram_mxn := coalesce(v_product.precio_minimo, 0);
        else
          v_labor_mxn := coalesce((v_item->>'labor_mxn')::numeric, 0);
          v_price_gram_mxn := coalesce((v_item->>'precio_gramo_mxn')::numeric, 0);
        end if;
      end if;

      v_subtotal_mxn := v_grams_total * v_price_gram_mxn;
    end if;

    insert into public.preorder_items (
      preorder_id, producto_codigo, producto_descripcion, producto_metal,
      producto_kilataje, producto_linea, producto_foto_url, piezas,
      gramos_por_pieza, gramos_total, labor_mxn, precio_gramo_mxn,
      pricing_mode, piece_price_list_id, precio_pieza_mxn, subtotal_mxn,
      sort_order, comentarios, configuracion, updated_at
    ) values (
      v_preorder_id,
      v_item_code,
      case when v_has_product then coalesce(v_product.descripcion, '') else coalesce(v_item->>'producto_descripcion', '') end,
      case when v_has_product then coalesce(v_product.metal, '') else coalesce(v_item->>'producto_metal', '') end,
      case when v_has_product then coalesce(v_product.kilataje, '') else coalesce(v_item->>'producto_kilataje', '') end,
      v_item_line,
      case when v_has_product then coalesce(v_product.foto_url, '') else coalesce(v_item->>'producto_foto_url', '') end,
      v_pieces,
      v_grams_per_piece,
      v_grams_total,
      v_labor_mxn,
      v_price_gram_mxn,
      v_item_pricing_mode,
      v_item_piece_list_id,
      v_price_piece_mxn,
      v_subtotal_mxn,
      v_sort_order,
      coalesce(v_item->>'comentarios', ''),
      coalesce(v_item->'configuracion', '{}'::jsonb),
      v_updated_at
    );

    v_total_pieces := v_total_pieces + v_pieces;
    v_total_grams := v_total_grams + v_grams_total;
    v_total_mxn := v_total_mxn + v_subtotal_mxn;
  end loop;

  update public.preorders
  set total_piezas = v_total_pieces,
      total_gramos = v_total_grams,
      total_mxn = v_total_mxn,
      updated_at = v_updated_at
  where id = v_preorder_id;

  return jsonb_build_object(
    'id', v_preorder_id,
    'folio', v_folio,
    'updated_at', to_char(v_updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  );
end;
$$;

revoke all on function public.save_preorder_transaction(jsonb, jsonb, text, boolean) from public, anon;
grant execute on function public.save_preorder_transaction(jsonb, jsonb, text, boolean) to authenticated;

notify pgrst, 'reload schema';
