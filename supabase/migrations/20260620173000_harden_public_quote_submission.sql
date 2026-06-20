alter table public.quote_links
  add column if not exists submission_count integer not null default 0,
  add column if not exists max_submissions integer not null default 100,
  add column if not exists last_submitted_at timestamptz;
alter table public.quote_links
  drop constraint if exists quote_links_submission_count_check,
  add constraint quote_links_submission_count_check
    check (submission_count >= 0),
  drop constraint if exists quote_links_max_submissions_check,
  add constraint quote_links_max_submissions_check
    check (max_submissions between 1 and 1000);
create or replace function public.submit_quote_link_preorder(
  p_token text,
  p_customer jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.quote_links%rowtype;
  v_preorder_id uuid;
  item jsonb;
  source_product jsonb;
  seen_codes text[] := array[]::text[];
  code text;
  qty numeric;
  g_piece numeric;
  g_total numeric;
  price numeric;
  subtotal numeric;
  idx integer := 0;
begin
  if p_token is null or length(p_token) > 128 then
    raise exception 'La liga no existe o ya expiro.';
  end if;
  if jsonb_typeof(p_customer) <> 'object' then
    raise exception 'Los datos de contacto no son validos.';
  end if;
  if jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 100 then
    raise exception 'La seleccion debe contener entre 1 y 100 productos.';
  end if;
  if length(coalesce(p_customer->>'name', '')) > 120
    or length(coalesce(p_customer->>'company', '')) > 160
    or length(coalesce(p_customer->>'email', '')) > 254
    or length(coalesce(p_customer->>'phone', '')) > 40
    or length(coalesce(p_customer->>'rfc', '')) > 20 then
    raise exception 'Los datos de contacto exceden el tamano permitido.';
  end if;
  if nullif(trim(coalesce(p_customer->>'name', '')), '') is null
    and nullif(trim(coalesce(p_customer->>'company', '')), '') is null then
    raise exception 'Indica un nombre o empresa.';
  end if;
  if nullif(trim(coalesce(p_customer->>'email', '')), '') is null
    and nullif(trim(coalesce(p_customer->>'phone', '')), '') is null then
    raise exception 'Indica un correo o telefono.';
  end if;
  if nullif(trim(coalesce(p_customer->>'email', '')), '') is not null
    and trim(p_customer->>'email') !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    raise exception 'El correo no es valido.';
  end if;

  select * into q
  from public.quote_links
  where token = p_token
    and expires_at > now()
  for update;

  if q.id is null or q.tenant_id is null then
    raise exception 'La liga no existe o ya expiro.';
  end if;
  if q.submission_count >= q.max_submissions then
    raise exception 'La liga alcanzo su limite de solicitudes.';
  end if;
  if q.last_submitted_at is not null
    and q.last_submitted_at > now() - interval '10 seconds' then
    raise exception 'Espera unos segundos antes de volver a enviar.';
  end if;

  -- Validate every requested code before creating any preorder. Product data
  -- always comes from the administrator-approved quote snapshot.
  for item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'La seleccion contiene un producto invalido.';
    end if;
    code := nullif(trim(coalesce(item->>'codigo', '')), '');
    if code is null or code = any(seen_codes) then
      raise exception 'La seleccion contiene codigos invalidos o repetidos.';
    end if;
    if coalesce(item->>'quantity', '') !~ '^[0-9]+([.][0-9]+)?$' then
      raise exception 'La cantidad del producto % no es valida.', code;
    end if;
    qty := (item->>'quantity')::numeric;
    if qty <= 0 or qty > 10000 then
      raise exception 'La cantidad del producto % esta fuera del limite.', code;
    end if;

    select value into source_product
    from jsonb_array_elements(q.products)
    where value->>'codigo' = code
    limit 1;
    if source_product is null then
      raise exception 'El producto % no pertenece a esta liga.', code;
    end if;
    seen_codes := array_append(seen_codes, code);
  end loop;

  insert into public.preorders (
    folio, status, client_id, created_by, cliente_nombre, cliente_empresa,
    cliente_email, cliente_telefono, cliente_rfc, tipo_cambio, moneda, notas,
    total_piezas, total_gramos, total_mxn, tenant_id, updated_at
  ) values (
    'PRE-' || to_char(clock_timestamp(), 'YYYYMMDD-HH24MISS-MS'),
    'pendiente', q.client_id, q.created_by,
    trim(coalesce(p_customer->>'name', '')),
    trim(coalesce(p_customer->>'company', '')),
    lower(trim(coalesce(p_customer->>'email', ''))),
    trim(coalesce(p_customer->>'phone', '')),
    upper(trim(coalesce(p_customer->>'rfc', ''))),
    0, 'MXN', 'Preorden recibida desde liga publica de cotizacion.',
    0, 0, 0, q.tenant_id, now()
  ) returning id into v_preorder_id;

  for item in select value from jsonb_array_elements(p_items)
  loop
    code := trim(item->>'codigo');
    qty := (item->>'quantity')::numeric;
    select value into source_product
    from jsonb_array_elements(q.products)
    where value->>'codigo' = code
    limit 1;

    g_piece := case
      when coalesce(source_product->>'pesoPromedio', '') ~ '^[0-9]+([.][0-9]+)?$'
        then least((source_product->>'pesoPromedio')::numeric, 1000000)
      else 0
    end;
    price := case
      when coalesce(source_product->>'precioMinimo', '') ~ '^[0-9]+([.][0-9]+)?$'
        then least((source_product->>'precioMinimo')::numeric, 1000000000)
      else 0
    end;
    g_total := qty * g_piece;
    subtotal := g_total * price;

    insert into public.preorder_items (
      preorder_id, producto_codigo, producto_descripcion, producto_metal,
      producto_kilataje, producto_linea, producto_foto_url, piezas,
      gramos_por_pieza, gramos_total, labor_mxn, precio_gramo_mxn,
      subtotal_mxn, sort_order, updated_at
    ) values (
      v_preorder_id, code,
      left(coalesce(source_product->>'descripcion', ''), 500),
      left(coalesce(source_product->>'metal', ''), 100),
      left(coalesce(source_product->>'kilataje', ''), 100),
      left(coalesce(source_product->>'linea', ''), 160),
      left(coalesce(source_product->>'fotoUrl', ''), 2000),
      qty, g_piece, g_total, 0, price, subtotal, idx, now()
    );
    idx := idx + 1;
  end loop;

  update public.preorders
  set total_piezas = coalesce((select sum(piezas) from public.preorder_items where preorder_id = v_preorder_id), 0),
      total_gramos = coalesce((select sum(gramos_total) from public.preorder_items where preorder_id = v_preorder_id), 0),
      total_mxn = coalesce((select sum(subtotal_mxn) from public.preorder_items where preorder_id = v_preorder_id), 0),
      updated_at = now()
  where id = v_preorder_id;

  update public.quote_links
  set submission_count = submission_count + 1,
      last_submitted_at = now()
  where id = q.id;

  return v_preorder_id;
end;
$$;
revoke all on function public.submit_quote_link_preorder(text, jsonb, jsonb) from public;
grant execute on function public.submit_quote_link_preorder(text, jsonb, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
