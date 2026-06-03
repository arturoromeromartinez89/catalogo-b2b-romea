-- Listas de precios por pieza.
-- Ejecutar en Supabase SQL Editor antes de usar la cotizacion por pieza.

create table if not exists public.piece_price_lists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  currency text not null default 'MXN',
  status text not null default 'borrador',
  margin_pct numeric not null default 0,
  tipo_cambio numeric not null default 0,
  comments text not null default '',
  prepared_by text not null default '',
  active boolean not null default true,
  source_snapshot jsonb not null default '{}'::jsonb,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.piece_price_lists drop constraint if exists piece_price_lists_currency_check;
alter table public.piece_price_lists
  add constraint piece_price_lists_currency_check check (currency in ('MXN', 'USD'));

alter table public.piece_price_lists drop constraint if exists piece_price_lists_status_check;
alter table public.piece_price_lists
  add constraint piece_price_lists_status_check check (status in ('borrador', 'activa'));

create table if not exists public.piece_price_list_items (
  id uuid primary key default gen_random_uuid(),
  piece_price_list_id uuid not null references public.piece_price_lists(id) on delete cascade,
  codigo text not null,
  descripcion text not null default '',
  cost_mxn numeric not null default 0,
  cost_usd numeric not null default 0,
  margin_pct numeric not null default 0,
  unit_price numeric not null default 0,
  unit_price_mxn numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(piece_price_list_id, codigo)
);

alter table public.preorders add column if not exists pricing_mode text not null default 'gram';
alter table public.preorders add column if not exists piece_price_list_id uuid references public.piece_price_lists(id) on delete set null;

alter table public.preorder_items add column if not exists pricing_mode text not null default 'gram';
alter table public.preorder_items add column if not exists piece_price_list_id uuid references public.piece_price_lists(id) on delete set null;
alter table public.preorder_items add column if not exists precio_pieza_mxn numeric not null default 0;
alter table public.preorder_items add column if not exists costo_pieza_mxn numeric not null default 0;
alter table public.preorder_items add column if not exists margen_pieza_pct numeric not null default 0;

alter table public.preorders drop constraint if exists preorders_pricing_mode_check;
alter table public.preorders
  add constraint preorders_pricing_mode_check check (pricing_mode in ('gram', 'piece'));

alter table public.preorder_items drop constraint if exists preorder_items_pricing_mode_check;
alter table public.preorder_items
  add constraint preorder_items_pricing_mode_check check (pricing_mode in ('gram', 'piece'));

create index if not exists piece_price_lists_tenant_currency_status_idx
  on public.piece_price_lists (tenant_id, currency, status, active);

create index if not exists piece_price_items_list_codigo_idx
  on public.piece_price_list_items (piece_price_list_id, codigo);

create index if not exists preorders_piece_price_list_id_idx
  on public.preorders (piece_price_list_id);

alter table public.piece_price_lists enable row level security;
alter table public.piece_price_list_items enable row level security;

drop policy if exists "admins manage piece price lists" on public.piece_price_lists;
drop policy if exists "admins manage piece price list items" on public.piece_price_list_items;
drop policy if exists "clients read piece price lists" on public.piece_price_lists;
drop policy if exists "clients read piece price list items" on public.piece_price_list_items;

create policy "admins manage piece price lists"
  on public.piece_price_lists for all
  using (
    public.is_superadmin()
    or (tenant_id = public.current_tenant_id() and public.is_tenant_admin())
  )
  with check (
    public.is_superadmin()
    or (tenant_id = public.current_tenant_id() and public.is_tenant_admin())
  );

create policy "admins manage piece price list items"
  on public.piece_price_list_items for all
  using (
    public.is_superadmin()
    or exists (
      select 1
      from public.piece_price_lists ppl
      where ppl.id = piece_price_list_id
        and ppl.tenant_id = public.current_tenant_id()
        and public.is_tenant_admin()
    )
  )
  with check (
    public.is_superadmin()
    or exists (
      select 1
      from public.piece_price_lists ppl
      where ppl.id = piece_price_list_id
        and ppl.tenant_id = public.current_tenant_id()
        and public.is_tenant_admin()
    )
  );

-- Nota de seguridad:
-- Los clientes no tienen politicas SELECT sobre costos/margenes por pieza.
-- El cliente solo debe recibir precios finales ya calculados en preorden/cotizacion.
