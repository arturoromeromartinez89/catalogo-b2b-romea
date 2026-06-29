do $$
declare
  v_tenant_a constant uuid := '10000000-0000-4000-8000-000000000001';
  v_tenant_b constant uuid := '10000000-0000-4000-8000-000000000002';
  v_admin constant uuid := '20000000-0000-4000-8000-000000000001';
  v_client_user constant uuid := '20000000-0000-4000-8000-000000000002';
  v_client_a constant uuid := '30000000-0000-4000-8000-000000000001';
  v_client_b constant uuid := '30000000-0000-4000-8000-000000000002';
  v_saved jsonb;
  v_client_saved jsonb;
  v_first_updated_at text;
  v_failed boolean;
begin
  delete from auth.users where id in (v_admin, v_client_user);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);

  insert into public.tenants (id, name, slug, status)
  values
    (v_tenant_a, 'CODEX Tenant A', 'codex-preorder-a', 'active'),
    (v_tenant_b, 'CODEX Tenant B', 'codex-preorder-b', 'active');

  insert into public.clients (id, tenant_id, name, company, email, active)
  values
    (v_client_a, v_tenant_a, 'Cliente A', 'Empresa A', 'codex-client-a@example.com', true),
    (v_client_b, v_tenant_b, 'Cliente B', 'Empresa B', 'codex-client-b@example.com', true);

  insert into public.products (
    tenant_id, codigo, descripcion, metal, kilataje, linea,
    peso_promedio, precio_minimo, mano_obra, visible_web
  ) values (
    v_tenant_a, 'CODEX-CLIENT-001', 'Producto recalculado desde servidor',
    'Plata', '925', '010', 4, 20, 5, true
  );

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (v_admin, 'authenticated', 'authenticated', 'codex-admin@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_client_user, 'authenticated', 'authenticated', 'codex-client@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.profiles (id, email, role, tenant_id, client_id, active)
  values
    (v_admin, 'codex-admin@example.com', 'tenant_admin', v_tenant_a, null, true),
    (v_client_user, 'codex-client@example.com', 'client', v_tenant_a, v_client_a, true)
  on conflict (id) do update
  set email = excluded.email,
      role = excluded.role,
      tenant_id = excluded.tenant_id,
      client_id = excluded.client_id,
      active = excluded.active;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  v_saved := public.save_preorder_transaction(
    jsonb_build_object(
      'folio', 'CODEX-ATOMIC-ADMIN',
      'tenant_id', v_tenant_a,
      'client_id', v_client_a,
      'status', 'pendiente',
      'cliente_nombre', 'Cliente A',
      'cliente_empresa', 'Empresa A',
      'moneda', 'MXN',
      'total_piezas', 2,
      'total_gramos', 10,
      'total_mxn', 1500,
      'pricing_mode', 'gram'
    ),
    jsonb_build_array(jsonb_build_object(
      'producto_codigo', 'CODEX-ROMEA-001',
      'producto_descripcion', 'Cadena personalizada',
      'piezas', 2,
      'gramos_por_pieza', 5,
      'gramos_total', 10,
      'precio_gramo_mxn', 150,
      'subtotal_mxn', 1500,
      'comentarios', 'Largo especial',
      'configuracion', jsonb_build_object(
        'version', 1,
        'group', true,
        'selections', jsonb_build_object('largo', jsonb_build_object('label', '55 cm'))
      )
    )),
    null,
    false
  );

  if not exists (
    select 1
    from public.preorders p
    join public.preorder_items i on i.preorder_id = p.id
    where p.id = (v_saved->>'id')::uuid
      and p.tenant_id = v_tenant_a
      and i.comentarios = 'Largo especial'
      and i.configuracion #>> '{selections,largo,label}' = '55 cm'
  ) then
    raise exception 'TEST_FAILED: configurable item was not persisted';
  end if;

  v_first_updated_at := v_saved->>'updated_at';
  v_saved := public.save_preorder_transaction(
    jsonb_build_object(
      'id', v_saved->>'id',
      'folio', 'CODEX-ATOMIC-ADMIN',
      'tenant_id', v_tenant_a,
      'client_id', v_client_a,
      'status', 'revision',
      'cliente_nombre', 'Cliente A',
      'moneda', 'MXN',
      'total_piezas', 1,
      'total_gramos', 6,
      'total_mxn', 900,
      'pricing_mode', 'gram'
    ),
    jsonb_build_array(jsonb_build_object(
      'producto_codigo', 'CODEX-ROMEA-002',
      'piezas', 1,
      'gramos_por_pieza', 6,
      'gramos_total', 6,
      'precio_gramo_mxn', 150,
      'subtotal_mxn', 900
    )),
    v_first_updated_at,
    false
  );

  if (select count(*) from public.preorder_items where preorder_id = (v_saved->>'id')::uuid) <> 1 then
    raise exception 'TEST_FAILED: update did not replace items atomically';
  end if;

  v_failed := false;
  begin
    perform public.save_preorder_transaction(
      jsonb_build_object(
        'id', v_saved->>'id', 'folio', 'CODEX-ATOMIC-ADMIN',
        'tenant_id', v_tenant_a, 'client_id', v_client_a,
        'status', 'revision', 'total_piezas', 1
      ),
      jsonb_build_array(jsonb_build_object('producto_codigo', 'CODEX-X', 'piezas', 1)),
      v_first_updated_at,
      false
    );
  exception when others then
    v_failed := position('CONFLICT|' in sqlerrm) > 0;
  end;
  if not v_failed then
    raise exception 'TEST_FAILED: optimistic conflict was not rejected';
  end if;

  v_failed := false;
  begin
    perform public.save_preorder_transaction(
      jsonb_build_object(
        'folio', 'CODEX-MUST-ROLLBACK', 'tenant_id', v_tenant_a,
        'client_id', v_client_a, 'status', 'pendiente', 'total_piezas', 1
      ),
      jsonb_build_array(jsonb_build_object('producto_codigo', '', 'piezas', 1)),
      null,
      false
    );
  exception when others then
    v_failed := position('INVALID_PREORDER_ITEM' in sqlerrm) > 0;
  end;
  if not v_failed or exists (select 1 from public.preorders where folio = 'CODEX-MUST-ROLLBACK') then
    raise exception 'TEST_FAILED: failed item left an orphan preorder header';
  end if;

  v_failed := false;
  begin
    perform public.save_preorder_transaction(
      jsonb_build_object(
        'folio', 'CODEX-CROSS-TENANT', 'tenant_id', v_tenant_b,
        'client_id', v_client_b, 'status', 'pendiente', 'total_piezas', 1
      ),
      jsonb_build_array(jsonb_build_object('producto_codigo', 'CODEX-X', 'piezas', 1)),
      null,
      false
    );
  exception when others then
    v_failed := position('TENANT_MISMATCH' in sqlerrm) > 0;
  end;
  if not v_failed then
    raise exception 'TEST_FAILED: tenant admin crossed tenant boundary';
  end if;

  perform set_config('request.jwt.claim.sub', v_client_user::text, true);
  v_client_saved := public.save_preorder_transaction(
    jsonb_build_object(
      'folio', 'CODEX-CLIENT-OWN', 'tenant_id', v_tenant_a,
      'client_id', v_client_b, 'status', 'confirmada', 'total_piezas', 1
    ),
    jsonb_build_array(jsonb_build_object(
      'producto_codigo', 'CODEX-CLIENT-001',
      'piezas', 1,
      'gramos_por_pieza', 999,
      'gramos_total', 999,
      'precio_gramo_mxn', 999,
      'subtotal_mxn', 999
    )),
    null,
    false
  );

  if not exists (
    select 1 from public.preorders
    where id = (v_client_saved->>'id')::uuid
      and tenant_id = v_tenant_a
      and client_id = v_client_a
      and status in ('pendiente', 'revision')
      and total_gramos = 4
      and total_mxn = 80
  ) then
    raise exception 'TEST_FAILED: client ownership/status/server totals were not enforced';
  end if;

  delete from public.preorders where folio like 'CODEX-%';
  delete from public.products where codigo in ('CODEX-CLIENT-001');
  delete from auth.users where id in (v_admin, v_client_user);
  delete from public.clients where id in (v_client_a, v_client_b);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);

  raise notice 'PREORDER_TENANT_ALIGNMENT_ACCEPTANCE_OK';
end;
$$;
