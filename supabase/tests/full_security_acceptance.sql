-- End-to-end staging test with disposable fixtures.
-- Runs entirely inside a transaction and rolls all test data back.

begin;

insert into public.tenants (id, name, slug, status)
values
  ('10000000-0000-4000-8000-000000000001', 'Security Tenant A', 'security-a', 'active'),
  ('20000000-0000-4000-8000-000000000002', 'Security Tenant B', 'security-b', 'active');

insert into public.clients (id, name, company, email, phone, rfc, active, tenant_id, allowed_skus)
values
  ('ca000000-0000-4000-8000-000000000001', 'Client A', 'Company A', 'client-a-security@example.test', '', '', true, '10000000-0000-4000-8000-000000000001', '{}'),
  ('cb000000-0000-4000-8000-000000000002', 'Client B', 'Company B', 'client-b-security@example.test', '', '', true, '20000000-0000-4000-8000-000000000002', '{}');

insert into auth.users (id, email)
values
  ('90000000-0000-4000-8000-000000000009', 'superadmin-security@example.test'),
  ('a1000000-0000-4000-8000-000000000001', 'admin-a-security@example.test'),
  ('b2000000-0000-4000-8000-000000000002', 'admin-b-security@example.test'),
  ('c1000000-0000-4000-8000-000000000001', 'client-a-security@example.test'),
  ('d2000000-0000-4000-8000-000000000002', 'client-b-security@example.test');

insert into public.profiles (id, email, role, client_id, tenant_id, active)
values
  ('90000000-0000-4000-8000-000000000009', 'superadmin-security@example.test', 'superadmin', null, '10000000-0000-4000-8000-000000000001', true),
  ('a1000000-0000-4000-8000-000000000001', 'admin-a-security@example.test', 'tenant_admin', null, '10000000-0000-4000-8000-000000000001', true),
  ('b2000000-0000-4000-8000-000000000002', 'admin-b-security@example.test', 'tenant_admin', null, '20000000-0000-4000-8000-000000000002', true),
  ('c1000000-0000-4000-8000-000000000001', 'client-a-security@example.test', 'client', 'ca000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', true),
  ('d2000000-0000-4000-8000-000000000002', 'client-b-security@example.test', 'client', 'cb000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', true)
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role,
  client_id = excluded.client_id,
  tenant_id = excluded.tenant_id,
  active = excluded.active;

insert into public.product_lines (id, codigo, descripcion, mo_base, activa, tenant_id)
values
  ('11000000-0000-4000-8000-000000000001', 'LINE-A', 'Line A', 50, true, '10000000-0000-4000-8000-000000000001'),
  ('22000000-0000-4000-8000-000000000002', 'LINE-B', 'Line B', 80, true, '20000000-0000-4000-8000-000000000002');

insert into public.metal_prices (id, kitco_usd_oz, tipo_cambio, premio_pct, updated_by, tenant_id)
values
  ('31000000-0000-4000-8000-000000000001', 20 * 31.1035 / (1.04 * 17), 17, 4, 'security-test', '10000000-0000-4000-8000-000000000001'),
  ('32000000-0000-4000-8000-000000000002', 30 * 31.1035 / (1.04 * 17), 17, 4, 'security-test', '20000000-0000-4000-8000-000000000002');

insert into public.products (
  id, codigo, modelo, descripcion, metal, kilataje, linea, familia, grupo,
  genero, acabado, piedra, medida, peso_promedio, unidad_venta, clave_venta,
  moneda_precio_min, foto_url, foto_url_2, foto_url_3, tags_busqueda,
  search_text, visible_web, tenant_id, proveedor
)
values
  ('e1000000-0000-4000-8000-000000000001', 'SKU-A', '', 'Product A', 'Plata', '925', 'LINE-A', '', '', '', '', '', '', 2, 'PZA', '', 'MXN', '', '', '', '', '', true, '10000000-0000-4000-8000-000000000001', 'Private Supplier A'),
  ('e2000000-0000-4000-8000-000000000002', 'SKU-B', '', 'Product B', 'Plata', '925', 'LINE-B', '', '', '', '', '', '', 3, 'PZA', '', 'MXN', '', '', '', '', '', true, '20000000-0000-4000-8000-000000000002', 'Private Supplier B');

insert into public.company_settings (tenant_id, brand_name, legal_name, rfc, bank_accounts, commercial_terms)
values
  ('10000000-0000-4000-8000-000000000001', 'Public Brand A', 'Private Legal A', 'PRIVATE-RFC-A', '[{"account":"PRIVATE-A"}]', 'Terms A'),
  ('20000000-0000-4000-8000-000000000002', 'Public Brand B', 'Private Legal B', 'PRIVATE-RFC-B', '[{"account":"PRIVATE-B"}]', 'Terms B');

insert into public.preorders (
  id, folio, status, client_id, created_by, cliente_nombre, cliente_empresa,
  cliente_email, cliente_telefono, cliente_rfc, moneda, tenant_id
)
values
  ('f1000000-0000-4000-8000-000000000001', 'SEC-A', 'pendiente', 'ca000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'Client A', 'Company A', 'client-a-security@example.test', '', '', 'MXN', '10000000-0000-4000-8000-000000000001'),
  ('f2000000-0000-4000-8000-000000000002', 'SEC-B', 'pendiente', 'cb000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', 'Client B', 'Company B', 'client-b-security@example.test', '', '', 'MXN', '20000000-0000-4000-8000-000000000002');

insert into storage.objects (bucket_id, name, owner_id)
values (
  'company-assets',
  '20000000-0000-4000-8000-000000000002/products/existing-b.jpg',
  'b2000000-0000-4000-8000-000000000002'
);

-- Tenant A administrator cannot see or alter tenant B.
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  visible_rows integer;
  affected integer;
  escalation_blocked boolean := false;
  cross_storage_insert_blocked boolean := false;
begin
  select count(*) into visible_rows from public.clients
  where tenant_id = '20000000-0000-4000-8000-000000000002';
  if visible_rows <> 0 then raise exception 'FAILED: admin A read tenant B clients'; end if;

  select count(*) into visible_rows from public.products
  where tenant_id = '20000000-0000-4000-8000-000000000002';
  if visible_rows <> 0 then raise exception 'FAILED: admin A read tenant B products'; end if;

  select count(*) into visible_rows from public.company_settings
  where tenant_id = '20000000-0000-4000-8000-000000000002';
  if visible_rows <> 0 then raise exception 'FAILED: admin A read tenant B company settings'; end if;

  select count(*) into visible_rows from public.product_lines
  where tenant_id = '20000000-0000-4000-8000-000000000002';
  if visible_rows <> 0 then raise exception 'FAILED: admin A read tenant B product lines'; end if;

  select count(*) into visible_rows from public.preorders
  where tenant_id = '20000000-0000-4000-8000-000000000002';
  if visible_rows <> 0 then raise exception 'FAILED: admin A read tenant B preorders'; end if;

  select count(*) into visible_rows from public.products
  where tenant_id = '10000000-0000-4000-8000-000000000001';
  if visible_rows <> 1 then raise exception 'FAILED: admin A cannot read own product'; end if;

  update public.products set descripcion = descripcion
  where id = 'e2000000-0000-4000-8000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAILED: admin A updated tenant B product'; end if;

  select count(*) into visible_rows from storage.objects
  where bucket_id = 'company-assets'
    and name like '20000000-0000-4000-8000-000000000002/%';
  if visible_rows <> 0 then raise exception 'FAILED: admin A read tenant B storage'; end if;

  insert into storage.objects (bucket_id, name, owner_id)
  values (
    'company-assets',
    '10000000-0000-4000-8000-000000000001/products/inserted-a.jpg',
    'a1000000-0000-4000-8000-000000000001'
  );

  begin
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'company-assets',
      '20000000-0000-4000-8000-000000000002/products/blocked-a.jpg',
      'a1000000-0000-4000-8000-000000000001'
    );
  exception when insufficient_privilege then
    cross_storage_insert_blocked := true;
  end;
  if not cross_storage_insert_blocked then
    raise exception 'FAILED: admin A inserted into tenant B storage';
  end if;

  begin
    update public.profiles set role = 'superadmin'
    where id = 'c1000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then
    escalation_blocked := true;
  end;
  if not escalation_blocked then raise exception 'FAILED: admin A escalated a client role'; end if;
end
$$;

-- Client A receives final prices only and cannot use base tables directly.
reset role;
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  payload jsonb;
  history jsonb;
  direct_rows integer;
  affected integer;
begin
  payload := public.get_client_catalog();
  if jsonb_array_length(payload->'products') <> 1 then
    raise exception 'FAILED: client A catalog product count is wrong';
  end if;
  if (payload->'products'->0->>'precio_minimo')::numeric <> 70 then
    raise exception 'FAILED: expected final price 70, got %', payload->'products'->0->>'precio_minimo';
  end if;
  if payload::text ~* 'mo_base|labor_mxn|mano_obra|proveedor|margin|margen' then
    raise exception 'FAILED: client catalog exposed an internal field';
  end if;

  select count(*) into direct_rows from public.product_lines;
  if direct_rows <> 0 then raise exception 'FAILED: client read product_lines'; end if;
  select count(*) into direct_rows from public.metal_prices;
  if direct_rows <> 0 then raise exception 'FAILED: client read metal_prices'; end if;
  select count(*) into direct_rows from public.client_line_margins;
  if direct_rows <> 0 then raise exception 'FAILED: client read margins'; end if;
  select count(*) into direct_rows from public.preorders;
  if direct_rows <> 0 then raise exception 'FAILED: client read preorders directly'; end if;

  select count(*) into direct_rows from storage.objects
  where bucket_id = 'company-assets'
    and name like '10000000-0000-4000-8000-000000000001/%';
  if direct_rows <> 1 then raise exception 'FAILED: client A cannot read own storage'; end if;
  select count(*) into direct_rows from storage.objects
  where bucket_id = 'company-assets'
    and name like '20000000-0000-4000-8000-000000000002/%';
  if direct_rows <> 0 then raise exception 'FAILED: client A read tenant B storage'; end if;

  perform public.submit_client_preorder(
    '{"notes":"Security test"}'::jsonb,
    '[{"codigo":"SKU-A","quantity":2,"comment":"test"}]'::jsonb
  );

  history := public.get_client_preorders();
  if jsonb_array_length(history) <> 2 then
    raise exception 'FAILED: sanitized preorder history count is wrong';
  end if;
  if history::text ~* 'labor_mxn|mo_base|mano_obra|margin|margen' then
    raise exception 'FAILED: preorder history exposed internal pricing';
  end if;

  update public.preorders set total_mxn = 1, status = 'confirmada'
  where id = 'f1000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAILED: client altered a preorder directly'; end if;
end
$$;

-- Superadmin can support both tenants, while anonymous visitors cannot read
-- private objects directly.
reset role;
select set_config('request.jwt.claim.sub', '90000000-0000-4000-8000-000000000009', true);
select set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000009","role":"authenticated"}', true);
set local role authenticated;

do $$
declare visible_rows integer;
begin
  select count(*) into visible_rows from storage.objects
  where bucket_id = 'company-assets';
  if visible_rows <> 2 then raise exception 'FAILED: superadmin cannot read both tenant objects'; end if;
end
$$;

reset role;
select set_config('request.jwt.claims', '{}', true);
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $$
declare visible_rows integer;
begin
  select count(*) into visible_rows from storage.objects
  where bucket_id = 'company-assets';
  if visible_rows <> 0 then raise exception 'FAILED: anon read private storage'; end if;
end
$$;

-- Public quote submissions cannot replace the server-owned snapshot.
reset role;
select set_config('request.jwt.claims', '{}', true);
select set_config('request.jwt.claim.sub', '', true);

insert into public.quote_links (
  token, products, show_price, show_weight, expires_at, client_id,
  created_by, tenant_id, max_submissions
)
values (
  'security-public-token',
  '[{"codigo":"SKU-A","descripcion":"Server Product A","metal":"Plata","kilataje":"925","linea":"LINE-A","fotoUrl":"","pesoPromedio":2,"precioMinimo":70}]',
  true, true, now() + interval '1 day',
  'ca000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  1
);

set local role anon;
select set_config(
  'test.quote_preorder_id',
  public.submit_quote_link_preorder(
    'security-public-token',
    '{"name":"Public Buyer","email":"buyer@example.test"}'::jsonb,
    '[{"codigo":"SKU-A","quantity":2,"descripcion":"Tampered","pesoPromedio":999,"precioMinimo":0.01}]'::jsonb
  )::text,
  true
);

do $$
declare
  branding jsonb;
  blocked boolean := false;
begin
  branding := public.get_public_company_branding('10000000-0000-4000-8000-000000000001');
  if branding->>'brand_name' <> 'Public Brand A' then
    raise exception 'FAILED: public branding did not return the brand';
  end if;
  if branding::text ~* 'bank_accounts|PRIVATE-A|legal_name|PRIVATE-RFC-A' then
    raise exception 'FAILED: public branding exposed private company data';
  end if;

  begin
    perform public.submit_quote_link_preorder(
      'security-public-token',
      '{"name":"Second Buyer"}'::jsonb,
      '[{"codigo":"SKU-A","quantity":1}]'::jsonb
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAILED: public quote exceeded submission limit'; end if;
end
$$;

reset role;

do $$
declare
  quote_preorder uuid := current_setting('test.quote_preorder_id')::uuid;
  stored_total numeric;
  stored_price numeric;
  stored_description text;
  submissions integer;
begin
  select total_mxn into stored_total from public.preorders where id = quote_preorder;
  select precio_gramo_mxn, producto_descripcion
  into stored_price, stored_description
  from public.preorder_items where preorder_id = quote_preorder;
  select submission_count into submissions
  from public.quote_links where token = 'security-public-token';

  if stored_total <> 280 or stored_price <> 70 then
    raise exception 'FAILED: public quote accepted tampered pricing';
  end if;
  if stored_description <> 'Server Product A' then
    raise exception 'FAILED: public quote accepted tampered product metadata';
  end if;
  if submissions <> 1 then
    raise exception 'FAILED: public quote submission counter is wrong';
  end if;
end
$$;

-- Suspended users and tenants are rejected by server-side authorization.
reset role;
select set_config('request.jwt.claims', '{}', true);
select set_config('request.jwt.claim.sub', '', true);
update public.profiles set active = false
where id = 'c1000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare blocked boolean := false;
begin
  begin
    perform public.get_client_catalog();
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAILED: suspended client accessed catalog'; end if;
end
$$;

reset role;
select set_config('request.jwt.claims', '{}', true);
select set_config('request.jwt.claim.sub', '', true);
update public.profiles set active = true
where id = 'c1000000-0000-4000-8000-000000000001';
update public.tenants set status = 'suspended'
where id = '10000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub', 'c1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare blocked boolean := false;
begin
  begin
    perform public.get_client_catalog();
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAILED: client of suspended tenant accessed catalog'; end if;
end
$$;

reset role;
rollback;

select 'PASS: tenant isolation, privilege escalation, client pricing, preorder, storage and suspension checks' as result;
