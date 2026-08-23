-- Staging acceptance: product_lines must be isolated in both directions.
-- Uses synthetic rows and removes them before completing successfully.
do $$
declare
  v_tenant_a constant uuid := 'a8230000-0000-4000-8000-0000000000a1';
  v_tenant_b constant uuid := 'a8230000-0000-4000-8000-0000000000b2';
  v_admin_a  constant uuid := 'b8230000-0000-4000-8000-0000000000a1';
  v_admin_b  constant uuid := 'b8230000-0000-4000-8000-0000000000b2';
  v_count integer;
  v_blocked boolean;
begin
  delete from auth.users where id in (v_admin_a, v_admin_b);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);

  insert into public.tenants (id, name, slug, status) values
    (v_tenant_a, 'NEXOR Product Lines A', 'nexor-product-lines-a', 'active'),
    (v_tenant_b, 'NEXOR Product Lines B', 'nexor-product-lines-b', 'active');

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (v_admin_a, 'authenticated', 'authenticated', 'nexor-lines-a@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_admin_b, 'authenticated', 'authenticated', 'nexor-lines-b@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.profiles (id, email, role, tenant_id, active) values
    (v_admin_a, 'nexor-lines-a@example.com', 'tenant_admin', v_tenant_a, true),
    (v_admin_b, 'nexor-lines-b@example.com', 'tenant_admin', v_tenant_b, true)
  on conflict (id) do update set
    role = excluded.role,
    tenant_id = excluded.tenant_id,
    active = true;

  insert into public.product_lines (tenant_id, codigo, descripcion, mo_base, activa) values
    (v_tenant_a, 'NEXOR-SHARED-LINE', 'Linea privada A', 10, true),
    (v_tenant_b, 'NEXOR-SHARED-LINE', 'Linea privada B', 20, true);

  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into v_count from public.product_lines where tenant_id = v_tenant_a;
  if v_count <> 1 then raise exception 'FAIL: tenant A cannot read its own line'; end if;
  raise notice 'PASS: tenant A reads its own product line';

  select count(*) into v_count from public.product_lines where tenant_id = v_tenant_b;
  if v_count <> 0 then raise exception 'FAIL: tenant A read tenant B product lines'; end if;
  raise notice 'PASS: tenant A cannot read tenant B product lines';

  update public.product_lines set descripcion = 'HACK A TO B' where tenant_id = v_tenant_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: tenant A updated tenant B product lines'; end if;
  raise notice 'PASS: tenant A cannot update tenant B product lines';

  delete from public.product_lines where tenant_id = v_tenant_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: tenant A deleted tenant B product lines'; end if;
  raise notice 'PASS: tenant A cannot delete tenant B product lines';

  v_blocked := false;
  begin
    insert into public.product_lines (tenant_id, codigo, descripcion)
    values (v_tenant_b, 'NEXOR-LINE-HACK-A', 'HACK');
  exception when others then
    v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: tenant A inserted into tenant B'; end if;
  raise notice 'PASS: tenant A cannot insert into tenant B';

  v_blocked := false;
  begin
    insert into public.product_lines (tenant_id, codigo, descripcion)
    values (v_tenant_a, 'NEXOR-SHARED-LINE', 'DUPLICATE');
  exception when unique_violation then
    v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: tenant A duplicated its own code'; end if;
  raise notice 'PASS: tenant A cannot duplicate its own code';

  reset role;
  perform set_config('request.jwt.claim.sub', v_admin_b::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into v_count from public.product_lines where tenant_id = v_tenant_b;
  if v_count <> 1 then raise exception 'FAIL: tenant B cannot read its own line'; end if;
  raise notice 'PASS: tenant B reads its own product line';

  select count(*) into v_count from public.product_lines where tenant_id = v_tenant_a;
  if v_count <> 0 then raise exception 'FAIL: tenant B read tenant A product lines'; end if;
  raise notice 'PASS: tenant B cannot read tenant A product lines';

  v_blocked := false;
  begin
    insert into public.product_lines (tenant_id, codigo, descripcion)
    values (v_tenant_a, 'NEXOR-LINE-HACK-B', 'HACK');
  exception when others then
    v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: tenant B inserted into tenant A'; end if;
  raise notice 'PASS: tenant B cannot insert into tenant A';

  reset role;
  delete from public.product_lines where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.profiles where id in (v_admin_a, v_admin_b);
  delete from auth.users where id in (v_admin_a, v_admin_b);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);
  raise notice 'ALL PASS: product_lines is isolated between two tenants';
end $$;
