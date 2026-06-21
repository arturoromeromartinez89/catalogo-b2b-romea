create table if not exists public.tenant_interface_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  theme_key text not null default 'premium',
  admin_product_card_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_interface_settings_tenant_unique unique (tenant_id),
  constraint tenant_interface_settings_theme_check
    check (theme_key in ('premium', 'verde', 'azul', 'neutro'))
);

create index if not exists tenant_interface_settings_tenant_idx
  on public.tenant_interface_settings (tenant_id);

alter table public.tenant_interface_settings enable row level security;

drop policy if exists "tenant admins read interface settings" on public.tenant_interface_settings;
create policy "tenant admins read interface settings"
on public.tenant_interface_settings for select to authenticated
using (
  public.is_superadmin()
  or tenant_id = public.current_tenant_id()
);

drop policy if exists "tenant admins manage interface settings" on public.tenant_interface_settings;
create policy "tenant admins manage interface settings"
on public.tenant_interface_settings for all to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

create or replace function public.touch_tenant_interface_settings_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tenant_interface_settings_touch_updated_at
  on public.tenant_interface_settings;
create trigger tenant_interface_settings_touch_updated_at
before update on public.tenant_interface_settings
for each row
execute function public.touch_tenant_interface_settings_updated_at();
