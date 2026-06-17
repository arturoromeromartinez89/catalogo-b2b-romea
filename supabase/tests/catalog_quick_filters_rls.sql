-- ============================================================================
-- TEST RLS — catalog_quick_filters: aislamiento entre tenants
-- Correr en el SQL Editor. Debe imprimir solo líneas "PASS: ...".
-- Si algo falla, lanza EXCEPTION con el detalle.
--
-- Patrón: igual que preorder_tenant_alignment_acceptance.sql — se crean datos
-- de prueba como owner, luego se impersona un usuario con `set local role
-- authenticated` + jwt claim sub, de modo que la RLS sí se evalúe.
-- ============================================================================
do $$
declare
  v_tenant_a constant uuid := '11111111-0000-4000-8000-0000000000a1';
  v_tenant_b constant uuid := '11111111-0000-4000-8000-0000000000b2';
  v_admin_a  constant uuid := '22222222-0000-4000-8000-0000000000a1';
  v_admin_b  constant uuid := '22222222-0000-4000-8000-0000000000b2';
  v_count int;
  v_blocked boolean;
begin
  -- ---- Setup (como owner; la RLS no aplica al owner) ----
  delete from auth.users where id in (v_admin_a, v_admin_b);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);

  insert into public.tenants (id, name, slug, status) values
    (v_tenant_a, 'QF Tenant A', 'qf-test-a', 'active'),
    (v_tenant_b, 'QF Tenant B', 'qf-test-b', 'active');

  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
    (v_admin_a, 'authenticated', 'authenticated', 'qf-admin-a@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_admin_b, 'authenticated', 'authenticated', 'qf-admin-b@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.profiles (id, email, role, tenant_id, active) values
    (v_admin_a, 'qf-admin-a@example.com', 'tenant_admin', v_tenant_a, true),
    (v_admin_b, 'qf-admin-b@example.com', 'tenant_admin', v_tenant_b, true)
  on conflict (id) do update set role = excluded.role, tenant_id = excluded.tenant_id, active = true;

  insert into public.catalog_quick_filters (tenant_id, slug, label, terms, match_type, sort_order) values
    (v_tenant_a, 'anillos', 'Anillos', array['anillo'], 'terms', 0),
    (v_tenant_b, 'vitrinas', 'Vitrinas', array['vitrina'], 'terms', 0);

  -- ---- Impersonar admin A ----
  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  -- 1) A lee SUS filtros
  select count(*) into v_count from public.catalog_quick_filters where tenant_id = v_tenant_a;
  if v_count < 1 then raise exception 'FAIL: tenant A no puede leer sus propios filtros'; end if;
  raise notice 'PASS: tenant A lee sus propios filtros (%).', v_count;

  -- 2) A NO lee filtros de B
  select count(*) into v_count from public.catalog_quick_filters where tenant_id = v_tenant_b;
  if v_count <> 0 then raise exception 'FAIL: tenant A pudo leer % filtros de tenant B', v_count; end if;
  raise notice 'PASS: tenant A no lee filtros de tenant B';

  -- 3) A NO puede INSERTAR en tenant B (WITH CHECK lo bloquea)
  v_blocked := false;
  begin
    insert into public.catalog_quick_filters (tenant_id, slug, label) values (v_tenant_b, 'hack', 'Hack');
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: tenant A pudo insertar filtro en tenant B'; end if;
  raise notice 'PASS: tenant A no puede insertar filtros en tenant B';

  -- 4a) A NO puede BORRAR filtros de B (RLS los oculta → 0 filas)
  delete from public.catalog_quick_filters where tenant_id = v_tenant_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: tenant A borró % filtros de tenant B', v_count; end if;
  raise notice 'PASS: tenant A no puede borrar filtros de tenant B';

  -- 4b) A NO puede ACTUALIZAR filtros de B (RLS los oculta → 0 filas afectadas)
  update public.catalog_quick_filters set label = 'hackeado' where tenant_id = v_tenant_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: tenant A actualizó % filtros de tenant B', v_count; end if;
  raise notice 'PASS: tenant A no puede actualizar filtros de tenant B';

  -- 5) A SÍ puede insertar en su propio tenant
  insert into public.catalog_quick_filters (tenant_id, slug, label) values (v_tenant_a, 'pulseras', 'Pulseras');
  raise notice 'PASS: tenant A sí puede insertar filtros en su propio tenant';

  -- ---- Limpieza (volver a owner) ----
  reset role;
  delete from public.catalog_quick_filters where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.profiles where id in (v_admin_a, v_admin_b);
  delete from auth.users where id in (v_admin_a, v_admin_b);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);

  raise notice '== TODOS LOS PASS: aislamiento tenant correcto en catalog_quick_filters ==';
end $$;
