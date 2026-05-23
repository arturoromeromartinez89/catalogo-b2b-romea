-- Listas de precios congeladas por moneda.
-- Ejecutar en Supabase SQL Editor antes de usar el nuevo menu de precios.

alter table public.labor_lists add column if not exists currency text not null default 'MXN';
alter table public.labor_lists add column if not exists status text not null default 'borrador';
alter table public.labor_lists add column if not exists pf_mode text not null default 'manual';
alter table public.labor_lists add column if not exists kitco_usd_oz numeric not null default 0;
alter table public.labor_lists add column if not exists oz_grams numeric not null default 31.1;
alter table public.labor_lists add column if not exists premio_pct numeric not null default 0;
alter table public.labor_lists add column if not exists tipo_cambio numeric not null default 0;
alter table public.labor_lists add column if not exists plata_fina_value numeric not null default 0;
alter table public.labor_lists add column if not exists exchange_rate_date date;
alter table public.labor_lists add column if not exists kitco_date date;
alter table public.labor_lists add column if not exists comments text not null default '';
alter table public.labor_lists add column if not exists activated_at timestamptz;
alter table public.labor_lists add column if not exists source_snapshot jsonb not null default '{}'::jsonb;

alter table public.labor_lists drop constraint if exists labor_lists_currency_check;
alter table public.labor_lists
  add constraint labor_lists_currency_check check (currency in ('MXN', 'USD'));

alter table public.labor_lists drop constraint if exists labor_lists_status_check;
alter table public.labor_lists
  add constraint labor_lists_status_check check (status in ('borrador', 'activa'));

alter table public.labor_lists drop constraint if exists labor_lists_pf_mode_check;
alter table public.labor_lists
  add constraint labor_lists_pf_mode_check check (pf_mode in ('manual', 'kitco'));

alter table public.labor_list_lines add column if not exists descripcion text not null default '';
alter table public.labor_list_lines add column if not exists labor_mxn numeric not null default 0;
alter table public.labor_list_lines add column if not exists labor_usd numeric not null default 0;
alter table public.labor_list_lines add column if not exists silver_fine numeric not null default 0;
alter table public.labor_list_lines add column if not exists total_cost numeric not null default 0;
alter table public.labor_list_lines add column if not exists margin_pct numeric not null default 0;
alter table public.labor_list_lines add column if not exists integrated_price numeric not null default 0;
alter table public.labor_list_lines add column if not exists final_labor numeric not null default 0;

create index if not exists labor_lists_tenant_currency_status_idx
on public.labor_lists (tenant_id, currency, status, active);

alter table public.preorders add column if not exists labor_list_id uuid references public.labor_lists(id) on delete set null;
