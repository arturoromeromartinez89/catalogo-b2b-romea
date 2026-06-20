-- Public quote submissions must use the server-owned snapshot and bounded usage.

alter table public.quote_links
  add column if not exists submission_count integer not null default 0;
alter table public.quote_links
  add column if not exists max_submissions integer not null default 25;
alter table public.quote_links
  add column if not exists last_submitted_at timestamptz;
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
  submitted jsonb;
  snapshot jsonb;
  qty numeric;
  g_piece numeric;
  g_total numeric;
  price numeric;
  subtotal numeric;
  idx integer := 0;
  item_count integer;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'items must be an array';
  end if;

  item_count := jsonb_array_length(p_items);
  if item_count < 1 or item_count > 250 then
    raise exception 'selection must contain between 1 and 250 items';
  end if;

  select * into q
  from public.quote_links
  where token = p_token
    and expires_at > now()
  for update;

  if q.id is null then
    raise exception 'La liga no existe o ya expiro.';
  end if;

  if q.submission_count >= q.max_submissions then
    raise exception 'La liga alcanzo el limite de envios.';
  end if;

  insert into public.preorders (
    folio, status, client_id, created_by, cliente_nombre, cliente_empresa,
    cliente_email, cliente_telefono, cliente_rfc, tipo_cambio, moneda, notas,
    total_piezas, total_gramos, total_mxn, tenant_id, updated_at
  ) values (
    'PRE-' || to_char(now(), 'YYYYMMDD-HH24MISS') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)),
    'pendiente', q.client_id, q.created_by,
    left(coalesce(p_customer->>'name', ''), 200),
    left(coalesce(p_customer->>'company', ''), 200),
    left(coalesce(p_customer->>'email', ''), 320),
    left(coalesce(p_customer->>'phone', ''), 50),
    left(coalesce(p_customer->>'rfc', ''), 50),
    0, 'MXN', 'Preorden recibida desde liga publica de cotizacion.',
    0, 0, 0, q.tenant_id, now()
  ) returning id into v_preorder_id;

  for submitted in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(submitted->>'codigo', '') = ''
      or coalesce(submitted->>'quantity', '') !~ '^([0-9]+)(\.[0-9]+)?$' then
      raise exception 'item de cotizacion invalido';
    end if;

    qty := (submitted->>'quantity')::numeric;
    if qty <= 0 or qty > 10000 then
      raise exception 'cantidad invalida';
    end if;

    select value into snapshot
    from jsonb_array_elements(q.products)
    where value->>'codigo' = submitted->>'codigo'
    limit 1;

    if snapshot is null then
      raise exception 'el producto no pertenece a esta liga';
    end if;

    g_piece := greatest(coalesce((snapshot->>'pesoPromedio')::numeric, 0), 0);
    g_total := qty * g_piece;
    price := greatest(coalesce((snapshot->>'precioMinimo')::numeric, 0), 0);
    subtotal := g_total * price;

    insert into public.preorder_items (
      preorder_id, producto_codigo, producto_descripcion, producto_metal,
      producto_kilataje, producto_linea, producto_foto_url, piezas,
      gramos_por_pieza, gramos_total, labor_mxn, precio_gramo_mxn,
      subtotal_mxn, sort_order, updated_at
    ) values (
      v_preorder_id,
      left(coalesce(snapshot->>'codigo', ''), 200),
      left(coalesce(snapshot->>'descripcion', ''), 1000),
      left(coalesce(snapshot->>'metal', ''), 100),
      left(coalesce(snapshot->>'kilataje', ''), 100),
      left(coalesce(snapshot->>'linea', ''), 200),
      left(coalesce(snapshot->>'fotoUrl', ''), 2000),
      qty, g_piece, g_total, 0, price, subtotal, idx, now()
    );
    idx := idx + 1;
    snapshot := null;
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
