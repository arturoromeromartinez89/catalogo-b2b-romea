do $$
declare
  v_tenant constant uuid := '40000000-0000-4000-8000-000000000001';
  v_user constant uuid := '40000000-0000-4000-8000-000000000002';
  v_client constant uuid := '40000000-0000-4000-8000-000000000003';
begin
  delete from public.preorders where client_id = v_client or tenant_id = v_tenant;
  delete from auth.users where id = v_user;
  delete from public.clients where id = v_client or email = 'visual-client@example.com';
  delete from public.products where tenant_id = v_tenant or codigo in ('ROM-CHI-CHN-10MM', 'ROM-CHI-BRC-10MM');
  delete from public.company_settings where tenant_id = v_tenant;
  delete from public.tenant_features where tenant_id = v_tenant;
  delete from public.tenants where id = v_tenant;

  insert into public.tenants (id, name, slug, status)
  values (v_tenant, 'CODEX ROMEA UI', 'codex-romea-ui', 'active');

  insert into public.tenant_features (tenant_id, modulo_admin, modulo_configurable)
  values (v_tenant, true, true);

  insert into public.company_settings (tenant_id, brand_name, legal_name, country)
  values (v_tenant, 'CODEX ROMEA UI', 'CODEX ROMEA UI', 'Mexico');

  insert into public.clients (id, tenant_id, name, company, email, active)
  values (v_client, v_tenant, 'Cliente visual', 'Joyería visual', 'visual-client@example.com', true);

  insert into public.products (
    tenant_id, codigo, modelo, descripcion, metal, kilataje, linea,
    grupo, estatus, peso_promedio, precio_minimo, visible_web, orden_web
  ) values
    (v_tenant, 'ROM-CHI-CHN-10MM', 'CHI-10MM', 'Cadena chino 10MM', 'Plata', '925', 'Cadenas', 'CHI-10MM', 'Activo', 12, 150, true, 1),
    (v_tenant, 'ROM-CHI-BRC-10MM', 'CHI-10MM', 'Pulso chino 10MM', 'Plata', '925', 'Cadenas', 'CHI-10MM', 'Activo', 14, 150, true, 2);

  insert into public.product_components (
    tenant_id, codigo, nombre, tipo, descripcion, peso, unidad,
    foto_url, visible_web, estatus, orden, metadata
  ) values
    (v_tenant, 'BROCHE-MOSQ', 'Broche mosquetón', 'broche', 'Broche físico', 1.2, 'g', '', true, 'activo', 1, '{}'::jsonb),
    (v_tenant, 'LARGO-55', '55 cm', 'largo', 'Medida sin peso ni foto', 0, 'cm', '', true, 'activo', 2, '{}'::jsonb),
    (v_tenant, 'TERM-BRILLO', 'Brillante', 'terminado', 'Acabado físico vigente', 0.2, 'g', '', true, 'activo', 3, '{}'::jsonb);
end;
$$;
