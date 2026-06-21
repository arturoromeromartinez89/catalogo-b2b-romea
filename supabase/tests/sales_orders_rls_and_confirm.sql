do $$
declare
  v_tenant_a constant uuid := '98888888-0000-4000-8000-0000000000a1';
  v_tenant_b constant uuid := '98888888-0000-4000-8000-0000000000b2';
  v_admin_a constant uuid := '99999999-0000-4000-8000-0000000000a1';
  v_admin_b constant uuid := '99999999-0000-4000-8000-0000000000b2';
  v_client_a uuid;
  v_preorder uuid;
  v_order jsonb;
  v_count integer;
begin
  delete from auth.users where id in (v_admin_a, v_admin_b);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);

  insert into public.tenants (id, name, slug, status) values
    (v_tenant_a, 'Order Tenant A', 'order-tenant-a', 'active'),
    (v_tenant_b, 'Order Tenant B', 'order-tenant-b', 'active');

  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
    (v_admin_a, 'authenticated', 'authenticated', 'order-a@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_admin_b, 'authenticated', 'authenticated', 'order-b@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.profiles (id, email, role, tenant_id, active) values
    (v_admin_a, 'order-a@example.com', 'tenant_admin', v_tenant_a, true),
    (v_admin_b, 'order-b@example.com', 'tenant_admin', v_tenant_b, true)
  on conflict (id) do update set role = excluded.role, tenant_id = excluded.tenant_id, active = true;

  insert into public.clients (tenant_id, name, company, email, active)
  values (v_tenant_a, 'Cliente Orden', 'Empresa Orden', 'cliente-orden@example.com', true)
  returning id into v_client_a;

  insert into public.preorders (tenant_id, folio, status, client_id, created_by, cliente_nombre, cliente_empresa, total_piezas, total_gramos, total_mxn)
  values (v_tenant_a, 'PRE-ORDER-RLS', 'revision', v_client_a, v_admin_a, 'Cliente Orden', 'Empresa Orden', 2, 10, 500)
  returning id into v_preorder;

  insert into public.preorder_items (preorder_id, producto_codigo, producto_descripcion, piezas, gramos_por_pieza, gramos_total, precio_gramo_mxn, subtotal_mxn)
  values (v_preorder, 'SKU-ORD', 'Producto orden', 2, 5, 10, 50, 500);

  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  v_order := public.confirm_preorder_as_order(v_preorder, '{"terms_accepted":true,"accepted_by_name":"Cliente Orden","anticipo_mxn":100}'::jsonb);
  if coalesce(v_order->>'folio', '') not like 'ORD-%' then raise exception 'FAIL: order folio not generated'; end if;
  raise notice 'PASS: admin A confirms preorder into sales order %', v_order->>'folio';

  select count(*) into v_count from public.sales_order_items where sales_order_id = (v_order->>'id')::uuid;
  if v_count <> 1 then raise exception 'FAIL: order items were not copied'; end if;
  raise notice 'PASS: order items copied';

  reset role;
  perform set_config('request.jwt.claim.sub', v_admin_b::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into v_count from public.sales_orders where tenant_id = v_tenant_a;
  if v_count <> 0 then raise exception 'FAIL: tenant B read tenant A order'; end if;
  raise notice 'PASS: tenant B cannot read tenant A order';

  update public.sales_orders set status = 'cancelada' where tenant_id = v_tenant_a;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: tenant B updated tenant A order'; end if;
  raise notice 'PASS: tenant B cannot update tenant A order';

  reset role;
  delete from public.sales_orders where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.preorders where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.clients where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.profiles where id in (v_admin_a, v_admin_b);
  delete from auth.users where id in (v_admin_a, v_admin_b);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);
  raise notice 'ALL PASS: sales orders confirm flow and tenant isolation';
end $$;
