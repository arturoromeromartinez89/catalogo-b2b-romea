-- MVP Paco: reglas de comercio por tenant.
-- Controla que modos de cotizacion (por gramo / por pieza) y monedas puede
-- usar cada tenant. Default: todo permitido, los tenants existentes no cambian.
-- El superadmin prende/apaga los modos desde la pestana de empresas.

create table if not exists public.tenant_commerce_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  allowed_pricing_modes text[] not null default array['gram', 'piece'],
  allowed_currencies text[] not null default array['MXN', 'USD'],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_commerce_modes_valid
    check (allowed_pricing_modes <@ array['gram', 'piece'] and array_length(allowed_pricing_modes, 1) >= 1),
  constraint tenant_commerce_currencies_valid
    check (allowed_currencies <@ array['MXN', 'USD'] and array_length(allowed_currencies, 1) >= 1)
);

alter table public.tenant_commerce_settings enable row level security;

drop policy if exists "commerce read by tenant" on public.tenant_commerce_settings;
create policy "commerce read by tenant"
on public.tenant_commerce_settings for select
using (public.is_superadmin() or tenant_id = public.current_tenant_id());

drop policy if exists "commerce write by superadmin" on public.tenant_commerce_settings;
create policy "commerce write by superadmin"
on public.tenant_commerce_settings for all
using (public.is_superadmin())
with check (public.is_superadmin());

-- Validacion server-side: ninguna preorden puede usar un modo de precio o
-- moneda que su tenant no tenga permitido. Se valida con trigger (y no dentro
-- de save_preorder_transaction) para cubrir tambien escrituras directas y
-- futuros RPCs sin duplicar la funcion.
create or replace function public.enforce_tenant_commerce_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modes text[];
  v_currencies text[];
begin
  -- Las preordenes legacy conservan su modo: solo se valida al insertar
  -- o cuando el modo/moneda realmente cambian.
  if tg_op = 'UPDATE'
    and new.pricing_mode is not distinct from old.pricing_mode
    and new.moneda is not distinct from old.moneda then
    return new;
  end if;

  select allowed_pricing_modes, allowed_currencies
  into v_modes, v_currencies
  from public.tenant_commerce_settings
  where tenant_id = new.tenant_id;

  if v_modes is not null
    and not (coalesce(nullif(new.pricing_mode, ''), 'gram') = any(v_modes)) then
    raise exception 'PRICING_MODE_NOT_ALLOWED';
  end if;

  if v_currencies is not null
    and not (coalesce(nullif(new.moneda, ''), 'MXN') = any(v_currencies)) then
    raise exception 'CURRENCY_NOT_ALLOWED';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_tenant_commerce on public.preorders;
create trigger trg_enforce_tenant_commerce
before insert or update on public.preorders
for each row execute function public.enforce_tenant_commerce_settings();

-- Estuches Chavez (Paco) vende solo por pieza y solo en MXN.
insert into public.tenant_commerce_settings (tenant_id, allowed_pricing_modes, allowed_currencies)
select id, array['piece'], array['MXN']
from public.tenants
where slug = 'estuches-chavez'
on conflict (tenant_id) do update
set allowed_pricing_modes = excluded.allowed_pricing_modes,
    allowed_currencies = excluded.allowed_currencies,
    updated_at = now();
