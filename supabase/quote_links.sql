-- Feature: ligas publicas de cotizacion.
-- Ejecutar manualmente en Supabase SQL Editor.
-- No altera tablas existentes; crea una tabla nueva, politicas RLS y una funcion segura
-- para convertir una liga publica en preorden pendiente.

create table if not exists public.quote_links (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  products jsonb not null default '[]'::jsonb,
  show_price boolean not null default true,
  show_weight boolean not null default true,
  expires_at timestamptz not null default (now() + interval '30 days'),
  client_id uuid references public.clients(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists quote_links_token_idx on public.quote_links(token);
create index if not exists quote_links_expires_at_idx on public.quote_links(expires_at);

alter table public.quote_links enable row level security;

drop policy if exists "admins manage quote links" on public.quote_links;
create policy "admins manage quote links" on public.quote_links
for all
using (public.is_admin())
with check (public.is_admin());

create or replace function public.get_quote_link_by_token(p_token text)
returns table (
  token text,
  products jsonb,
  show_price boolean,
  show_weight boolean,
  expires_at timestamptz,
  client_id uuid,
  tenant_id uuid
)
language sql
security definer
set search_path = public
as $$
  select
    q.token,
    q.products,
    q.show_price,
    q.show_weight,
    q.expires_at,
    q.client_id,
    q.tenant_id
  from public.quote_links q
  where q.token = p_token
    and q.expires_at > now()
  limit 1;
$$;

create or replace function public.submit_quote_link_preorder(
  p_token text,
  p_customer jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quote_links%rowtype;
  v_preorder_id uuid;
  item jsonb;
  qty numeric;
  g_piece numeric;
  g_total numeric;
  price numeric;
  labor numeric;
  subtotal numeric;
  idx integer := 0;
begin
  select * into q
  from public.quote_links
  where token = p_token
    and expires_at > now()
  limit 1;

  if q.id is null then
    raise exception 'La liga no existe o ya expiro.';
  end if;

  insert into public.preorders (
    folio,
    status,
    client_id,
    created_by,
    cliente_nombre,
    cliente_empresa,
    cliente_email,
    cliente_telefono,
    cliente_rfc,
    tipo_cambio,
    moneda,
    notas,
    total_piezas,
    total_gramos,
    total_mxn,
    tenant_id,
    updated_at
  )
  values (
    'PRE-' || to_char(now(), 'YYYYMMDD-HH24MI'),
    'pendiente',
    q.client_id,
    q.created_by,
    coalesce(p_customer->>'name', ''),
    coalesce(p_customer->>'company', ''),
    coalesce(p_customer->>'email', ''),
    coalesce(p_customer->>'phone', ''),
    coalesce(p_customer->>'rfc', ''),
    0,
    'MXN',
    'Preorden recibida desde liga publica de cotizacion.',
    0,
    0,
    0,
    q.tenant_id,
    now()
  )
  returning id into v_preorder_id;

  for item in select * from jsonb_array_elements(p_items)
  loop
    qty := greatest(coalesce((item->>'quantity')::numeric, 0), 0);
    if qty > 0 then
      g_piece := coalesce((item->>'pesoPromedio')::numeric, 0);
      g_total := qty * g_piece;
      price := coalesce((item->>'precioMinimo')::numeric, 0);
      -- La liga publica no recibe desglose de mano de obra.
      -- El cliente/prospecto solo debe enviar precio final.
      labor := 0;
      subtotal := g_total * price;

      insert into public.preorder_items (
        preorder_id,
        producto_codigo,
        producto_descripcion,
        producto_metal,
        producto_kilataje,
        producto_linea,
        producto_foto_url,
        piezas,
        gramos_por_pieza,
        gramos_total,
        labor_mxn,
        precio_gramo_mxn,
        subtotal_mxn,
        sort_order,
        updated_at
      )
      values (
        v_preorder_id,
        coalesce(item->>'codigo', ''),
        coalesce(item->>'descripcion', ''),
        coalesce(item->>'metal', ''),
        coalesce(item->>'kilataje', ''),
        coalesce(item->>'linea', ''),
        coalesce(item->>'fotoUrl', ''),
        qty,
        g_piece,
        g_total,
        labor,
        price,
        subtotal,
        idx,
        now()
      );

      idx := idx + 1;
    end if;
  end loop;

  update public.preorders
  set
    total_piezas = coalesce((select sum(piezas) from public.preorder_items where preorder_id = v_preorder_id), 0),
    total_gramos = coalesce((select sum(gramos_total) from public.preorder_items where preorder_id = v_preorder_id), 0),
    total_mxn = coalesce((select sum(subtotal_mxn) from public.preorder_items where preorder_id = v_preorder_id), 0),
    updated_at = now()
  where id = v_preorder_id;

  return v_preorder_id;
end;
$$;

grant execute on function public.get_quote_link_by_token(text) to anon, authenticated;
grant execute on function public.submit_quote_link_preorder(text, jsonb, jsonb) to anon, authenticated;
