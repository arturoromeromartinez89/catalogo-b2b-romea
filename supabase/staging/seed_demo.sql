-- STAGING ONLY. Never apply this file to the production project.
do $$
declare
  v_tenant constant uuid := 'a1000000-0000-4000-8000-000000000001';
begin
  if current_database() not like '%vafqcvpzksjlrborxoos%' then
    -- Supabase branch database names do not always include the project ref, so
    -- the deployment script must also verify the linked ref before execution.
    raise notice 'Project-ref verification is enforced by the staging script.';
  end if;

  insert into public.tenants (id, name, slug, status)
  values (v_tenant, 'Empresa Demo - Pruebas', 'demo-staging', 'active')
  on conflict (id) do update
  set name = excluded.name, slug = excluded.slug, status = excluded.status;

  update public.company_settings
  set brand_name = 'Catalogo Demo',
      legal_name = 'Empresa Ficticia de Pruebas',
      email = 'demo@example.invalid',
      city = 'Ciudad de Pruebas',
      state = 'Estado de Pruebas',
      country = 'Mexico',
      commercial_terms = 'Informacion ficticia. No realizar operaciones comerciales.'
  where tenant_id = v_tenant;

  insert into public.company_settings (
    tenant_id, brand_name, legal_name, email, city, state, country,
    commercial_terms
  )
  select
    v_tenant, 'Catalogo Demo', 'Empresa Ficticia de Pruebas',
    'demo@example.invalid', 'Ciudad de Pruebas', 'Estado de Pruebas', 'Mexico',
    'Informacion ficticia. No realizar operaciones comerciales.'
  where not exists (
    select 1 from public.company_settings where tenant_id = v_tenant
  );

  insert into public.products (
    tenant_id, codigo, modelo, descripcion, linea, familia, grupo, estatus,
    peso_promedio, unidad_venta, precio_minimo, visible_web, orden_web,
    tags_busqueda, search_text
  ) values
    (v_tenant, 'DEMO-VIT-001', 'V-01', 'Vitrina modular de demostracion', 'Exhibicion', 'Vitrinas', 'Vitrina', 'Activo', 1, 'pieza', 1250, true, 1, 'vitrina exhibidor demo', 'vitrina modular demostracion exhibicion'),
    (v_tenant, 'DEMO-BAS-001', 'B-01', 'Base escalonada de demostracion', 'Exhibicion', 'Bases', 'Base', 'Activo', 1, 'pieza', 420, true, 2, 'base exhibidor demo', 'base escalonada demostracion exhibicion'),
    (v_tenant, 'DEMO-GAN-001', 'G-01', 'Gancho metalico de demostracion', 'Accesorios', 'Ganchos', 'Gancho', 'Activo', 1, 'pieza', 85, true, 3, 'gancho accesorio demo', 'gancho metalico demostracion accesorio')
  on conflict (tenant_id, codigo) do update
  set descripcion = excluded.descripcion,
      linea = excluded.linea,
      familia = excluded.familia,
      grupo = excluded.grupo,
      precio_minimo = excluded.precio_minimo,
      visible_web = excluded.visible_web,
      search_text = excluded.search_text;

  insert into public.catalog_quick_filters (
    tenant_id, slug, label, terms, match_type, active, sort_order
  ) values
    (v_tenant, 'vitrinas', 'Vitrinas', array['vitrina'], 'terms', true, 10),
    (v_tenant, 'bases', 'Bases', array['base'], 'terms', true, 20),
    (v_tenant, 'ganchos', 'Ganchos', array['gancho'], 'terms', true, 30)
  on conflict (tenant_id, slug) do update
  set label = excluded.label,
      terms = excluded.terms,
      match_type = excluded.match_type,
      active = excluded.active,
      sort_order = excluded.sort_order;

  insert into public.profiles (id, email, role, tenant_id, active)
  select id, email, 'tenant_admin', v_tenant, true
  from auth.users
  where email = 'staging-admin@romea.example'
  on conflict (id) do update
  set role = excluded.role,
      tenant_id = excluded.tenant_id,
      active = true;
end $$;
