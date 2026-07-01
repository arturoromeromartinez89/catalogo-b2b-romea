-- RLS + trigger acceptance test for tenant_commerce_settings.
-- Run in SQL Editor. Every failed assertion raises an exception.
do $$
declare
  v_tenant_a constant uuid := '98666666-0000-4000-8000-0000000000a1';
  v_tenant_b constant uuid := '98666666-0000-4000-8000-0000000000b2';
  v_admin_a constant uuid := '98777777-0000-4000-8000-0000000000a1';
  v_client_a constant uuid := '98777777-0000-4000-8000-0000000000c1';
  v_preorder_a constant uuid := '98888888-0000-4000-8000-0000000000f1';
  v_count integer;
  v_blocked boolean;
begin
  delete from auth.users where id in (v_admin_a, v_client_a);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);

  insert into public.tenants (id, name, slug, status) values
    (v_tenant_a, 'Commerce RLS A', 'commerce-rls-a', 'active'),
    (v_tenant_b, 'Commerce RLS B', 'commerce-rls-b', 'active');

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (v_admin_a, 'authenticated', 'authenticated', 'commerce-rls-a@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_client_a, 'authenticated', 'authenticated', 'commerce-client-a@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.profiles (id, email, role, tenant_id, active) values
    (v_admin_a, 'commerce-rls-a@example.com', 'tenant_admin', v_tenant_a, true),
    (v_client_a, 'commerce-client-a@example.com', 'client', v_tenant_a, true)
  on conflict (id) do update
  set role = excluded.role, tenant_id = excluded.tenant_id, active = true;

  -- Tenant A: solo pieza / solo MXN. Tenant B: sin fila (todo permitido).
  insert into public.tenant_commerce_settings (tenant_id, allowed_pricing_modes, allowed_currencies)
  values (v_tenant_a, array['piece'], array['MXN']);

  -- ── RLS: lectura propia, sin escritura para tenant admin ──
  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into v_count from public.tenant_commerce_settings where tenant_id = v_tenant_a;
  if v_count <> 1 then raise exception 'FAIL: tenant A cannot read own commerce settings'; end if;
  raise notice 'PASS: tenant A reads own commerce settings';

  select count(*) into v_count from public.tenant_commerce_settings where tenant_id = v_tenant_b;
  if v_count <> 0 then raise exception 'FAIL: tenant A read tenant B commerce settings'; end if;
  raise notice 'PASS: tenant A cannot read tenant B commerce settings';

  update public.tenant_commerce_settings
  set allowed_pricing_modes = array['gram', 'piece']
  where tenant_id = v_tenant_a;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: tenant admin updated own commerce settings (superadmin only)'; end if;
  raise notice 'PASS: tenant admin cannot update commerce settings';

  v_blocked := false;
  begin
    insert into public.tenant_commerce_settings (tenant_id) values (v_tenant_b);
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: tenant admin inserted commerce settings'; end if;
  raise notice 'PASS: tenant admin cannot insert commerce settings';

  reset role;
  perform set_config('request.jwt.claim.sub', v_client_a::text, true);
  set local role authenticated;

  select count(*) into v_count from public.tenant_commerce_settings where tenant_id = v_tenant_a;
  if v_count <> 1 then raise exception 'FAIL: client cannot read own tenant commerce settings'; end if;
  raise notice 'PASS: client reads own tenant commerce settings';

  reset role;

  -- ── Trigger: modo/moneda no permitidos se rechazan server-side ──
  v_blocked := false;
  begin
    insert into public.preorders (id, tenant_id, folio, status, moneda, pricing_mode)
    values (v_preorder_a, v_tenant_a, 'TEST-CM-001', 'pendiente', 'MXN', 'gram');
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: gram preorder accepted for piece-only tenant'; end if;
  raise notice 'PASS: gram preorder rejected for piece-only tenant';

  v_blocked := false;
  begin
    insert into public.preorders (id, tenant_id, folio, status, moneda, pricing_mode)
    values (v_preorder_a, v_tenant_a, 'TEST-CM-001', 'pendiente', 'USD', 'piece');
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: USD preorder accepted for MXN-only tenant'; end if;
  raise notice 'PASS: USD preorder rejected for MXN-only tenant';

  insert into public.preorders (id, tenant_id, folio, status, moneda, pricing_mode)
  values (v_preorder_a, v_tenant_a, 'TEST-CM-001', 'pendiente', 'MXN', 'piece');
  raise notice 'PASS: piece/MXN preorder accepted for piece-only tenant';

  -- Update que no toca modo/moneda pasa aunque la config sea restrictiva.
  update public.preorders set status = 'revision' where id = v_preorder_a;
  raise notice 'PASS: status update does not re-validate pricing mode';

  -- Cambiar el modo a uno prohibido se rechaza.
  v_blocked := false;
  begin
    update public.preorders set pricing_mode = 'gram' where id = v_preorder_a;
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: switching to gram accepted for piece-only tenant'; end if;
  raise notice 'PASS: switching to forbidden mode rejected';

  -- Tenant B sin fila: todo permitido.
  insert into public.preorders (tenant_id, folio, status, moneda, pricing_mode)
  values (v_tenant_b, 'TEST-CM-002', 'pendiente', 'USD', 'gram');
  raise notice 'PASS: tenant without commerce settings keeps both modes';

  -- ── Limpieza ──
  delete from public.preorders where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.tenant_commerce_settings where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.profiles where id in (v_admin_a, v_client_a);
  delete from auth.users where id in (v_admin_a, v_client_a);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);

  raise notice 'ALL PASS: tenant_commerce_settings isolation + enforcement';
end $$;
