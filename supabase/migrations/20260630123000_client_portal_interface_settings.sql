alter table public.tenant_interface_settings
  add column if not exists client_portal_config jsonb not null default '{}'::jsonb;

comment on column public.tenant_interface_settings.client_portal_config is
  'Configuracion del portal cliente por tenant: anuncio superior, carrusel de inicio y boton de WhatsApp.';

-- Preserve any data written during early tests before moving the source of truth.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'company_settings'
      and column_name = 'client_portal_config'
  ) then
    insert into public.tenant_interface_settings (tenant_id, client_portal_config)
    select cs.tenant_id, cs.client_portal_config
    from public.company_settings cs
    where cs.tenant_id is not null
      and cs.client_portal_config is not null
      and cs.client_portal_config <> '{}'::jsonb
    on conflict (tenant_id) do update
    set client_portal_config = case
      when public.tenant_interface_settings.client_portal_config = '{}'::jsonb
        then excluded.client_portal_config
      else public.tenant_interface_settings.client_portal_config
    end;

    alter table public.company_settings drop column if exists client_portal_config;
  end if;
end $$;

drop policy if exists "tenant admins read interface settings" on public.tenant_interface_settings;
drop policy if exists "authenticated read tenant interface settings" on public.tenant_interface_settings;
drop policy if exists "tenant users read interface settings" on public.tenant_interface_settings;
drop policy if exists "admins manage tenant interface settings" on public.tenant_interface_settings;
drop policy if exists "tenant admins manage interface settings" on public.tenant_interface_settings;
create policy "tenant users read interface settings"
on public.tenant_interface_settings for select to authenticated
using (
  public.is_superadmin()
  or tenant_id = public.current_tenant_id()
);

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

create or replace function public.get_public_company_branding(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'brand_name', cs.brand_name,
        'legal_name', cs.legal_name,
        'phone', cs.phone,
        'email', cs.email,
        'city', cs.city,
        'state', cs.state,
        'country', cs.country,
        'logo_url', cs.logo_url,
        'commercial_terms', cs.commercial_terms
      )
      from public.company_settings cs
      join public.tenants t on t.id = cs.tenant_id
      where cs.tenant_id = p_tenant_id
        and t.status = 'active'
      limit 1
    ),
    '{}'::jsonb
  );
$$;

revoke all on function public.get_public_company_branding(uuid) from public;
grant execute on function public.get_public_company_branding(uuid) to anon, authenticated;
