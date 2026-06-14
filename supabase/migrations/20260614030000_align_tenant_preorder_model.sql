-- Unifica el motor de preordenes para todos los tenants sin mezclar sus datos.

alter table public.preorder_items
  add column if not exists comentarios text not null default '',
  add column if not exists configuracion jsonb not null default '{}'::jsonb;

comment on column public.preorder_items.comentarios is
  'Notas visibles de la linea de preorden.';
comment on column public.preorder_items.configuracion is
  'Snapshot de selecciones del configurador para poder reabrir la preorden.';

insert into public.tenant_features (tenant_id, modulo_admin, modulo_configurable)
select configured.tenant_id, configured.modulo_admin, configured.modulo_configurable
from (values
  ('3b5a512d-c7e8-4700-87a9-78cfd4d63d18'::uuid, true, true),
  ('77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb'::uuid, false, false)
) as configured(tenant_id, modulo_admin, modulo_configurable)
join public.tenants on tenants.id = configured.tenant_id
on conflict (tenant_id) do update
set modulo_admin = excluded.modulo_admin,
    modulo_configurable = excluded.modulo_configurable,
    updated_at = now();

-- Los superadmins no pertenecen a una empresa y los administradores no son clientes.
update public.profiles
set tenant_id = null,
    client_id = null
where role = 'superadmin'
  and (tenant_id is not null or client_id is not null);

update public.profiles
set client_id = null
where role in ('admin', 'tenant_admin')
  and client_id is not null;

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

  if v_pricing_mode not in ('gram', 'piece') then
    raise exception 'INVALID_PRICING_MODE';
  end if;

  if v_labor_list_id is not null and not exists (
    select 1 from public.labor_lists
    where id = v_labor_list_id and tenant_id = v_tenant_id
  ) then
    raise exception 'LABOR_LIST_TENANT_MISMATCH';
  end if;

  if v_piece_price_list_id is not null and not exists (
    select 1 from public.piece_price_lists
    where id = v_piece_price_list_id and tenant_id = v_tenant_id
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
        total_piezas = coalesce((p_preorder->>'total_piezas')::numeric, 0),
        total_gramos = coalesce((p_preorder->>'total_gramos')::numeric, 0),
        total_mxn = coalesce((p_preorder->>'total_mxn')::numeric, 0),
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
      coalesce(p_preorder->>'notas', ''), coalesce((p_preorder->>'total_piezas')::numeric, 0),
      coalesce((p_preorder->>'total_gramos')::numeric, 0), coalesce((p_preorder->>'total_mxn')::numeric, 0),
      v_tenant_id, v_labor_list_id, v_pricing_mode, v_piece_price_list_id, v_updated_at
    )
    returning id, folio into v_preorder_id, v_folio;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(btrim(v_item->>'producto_codigo'), '') = ''
       or coalesce((v_item->>'piezas')::numeric, 0) <= 0 then
      raise exception 'INVALID_PREORDER_ITEM';
    end if;

    v_item_pricing_mode := coalesce(nullif(v_item->>'pricing_mode', ''), v_pricing_mode);
    if v_item_pricing_mode not in ('gram', 'piece') then
      raise exception 'INVALID_ITEM_PRICING_MODE';
    end if;

    v_item_piece_list_id := nullif(v_item->>'piece_price_list_id', '')::uuid;
    if v_item_piece_list_id is not null and not exists (
      select 1 from public.piece_price_lists
      where id = v_item_piece_list_id and tenant_id = v_tenant_id
    ) then
      raise exception 'ITEM_PIECE_LIST_TENANT_MISMATCH';
    end if;

    insert into public.preorder_items (
      preorder_id, producto_codigo, producto_descripcion, producto_metal,
      producto_kilataje, producto_linea, producto_foto_url, piezas,
      gramos_por_pieza, gramos_total, labor_mxn, precio_gramo_mxn,
      pricing_mode, piece_price_list_id, precio_pieza_mxn, subtotal_mxn,
      sort_order, comentarios, configuracion, updated_at
    ) values (
      v_preorder_id, btrim(v_item->>'producto_codigo'), coalesce(v_item->>'producto_descripcion', ''),
      coalesce(v_item->>'producto_metal', ''), coalesce(v_item->>'producto_kilataje', ''),
      coalesce(v_item->>'producto_linea', ''), coalesce(v_item->>'producto_foto_url', ''),
      coalesce((v_item->>'piezas')::numeric, 0), coalesce((v_item->>'gramos_por_pieza')::numeric, 0),
      coalesce((v_item->>'gramos_total')::numeric, 0), coalesce((v_item->>'labor_mxn')::numeric, 0),
      coalesce((v_item->>'precio_gramo_mxn')::numeric, 0), v_item_pricing_mode,
      v_item_piece_list_id, coalesce((v_item->>'precio_pieza_mxn')::numeric, 0),
      coalesce((v_item->>'subtotal_mxn')::numeric, 0), coalesce((v_item->>'sort_order')::numeric, 0),
      coalesce(v_item->>'comentarios', ''), coalesce(v_item->'configuracion', '{}'::jsonb), v_updated_at
    );
  end loop;

  return jsonb_build_object(
    'id', v_preorder_id,
    'folio', v_folio,
    'updated_at', to_char(v_updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  );
end;
$$;

revoke all on function public.save_preorder_transaction(jsonb, jsonb, text, boolean) from public;
grant execute on function public.save_preorder_transaction(jsonb, jsonb, text, boolean) to authenticated;

notify pgrst, 'reload schema';
