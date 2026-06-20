-- Verified-domain isolation and authorization acceptance test.
-- Run against the linked database; every failed assertion raises an exception.
do $$
declare
  v_tenant_a constant uuid := '94444444-0000-4000-8000-0000000000a1';
  v_tenant_b constant uuid := '94444444-0000-4000-8000-0000000000b2';
  v_admin_a constant uuid := '95555555-0000-4000-8000-0000000000a1';
  v_count integer;
  v_blocked boolean;
begin
  delete from auth.users where id = v_admin_a;
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);

  insert into public.tenants (id, name, slug, status) values
    (v_tenant_a, 'Domain RLS A', 'domain-rls-a', 'active'),
    (v_tenant_b, 'Domain RLS B', 'domain-rls-b', 'active');
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_admin_a, 'authenticated', 'authenticated', 'domain-rls-a@example.com', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );
  insert into public.profiles (id, email, role, tenant_id, active)
  values (v_admin_a, 'domain-rls-a@example.com', 'tenant_admin', v_tenant_a, true)
  on conflict (id) do update
  set role = excluded.role, tenant_id = excluded.tenant_id, active = true;

  insert into public.tenant_domains (tenant_id, hostname, status, verified_at) values
    (v_tenant_a, 'a.domain-rls.example', 'active', now()),
    (v_tenant_b, 'b.domain-rls.example', 'active', now());

  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into v_count from public.tenant_domains where tenant_id = v_tenant_a;
  if v_count <> 1 then raise exception 'FAIL: tenant A cannot read its own domain'; end if;
  raise notice 'PASS: tenant A reads its own domain';

  select count(*) into v_count from public.tenant_domains where tenant_id = v_tenant_b;
  if v_count <> 0 then raise exception 'FAIL: tenant A read tenant B domain'; end if;
  raise notice 'PASS: tenant A cannot read tenant B domain';

  update public.tenant_domains set hostname = 'hijacked.domain-rls.example'
  where tenant_id = v_tenant_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: tenant A updated tenant B domain'; end if;
  raise notice 'PASS: tenant A cannot update tenant B domain';

  delete from public.tenant_domains where tenant_id = v_tenant_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: tenant A deleted tenant B domain'; end if;
  raise notice 'PASS: tenant A cannot delete tenant B domain';

  v_blocked := false;
  begin
    insert into public.tenant_domains (tenant_id, hostname)
    values (v_tenant_b, 'hack.domain-rls.example');
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: tenant A inserted tenant B domain'; end if;
  raise notice 'PASS: tenant A cannot insert tenant B domain';

  -- Domain verification is superadmin-only, including the tenant's own row.
  update public.tenant_domains set status = 'disabled' where tenant_id = v_tenant_a;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: tenant admin changed domain authorization'; end if;
  raise notice 'PASS: tenant admin cannot change domain authorization';

  reset role;
  delete from public.tenant_domains where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.profiles where id = v_admin_a;
  delete from auth.users where id = v_admin_a;
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);
  raise notice 'ALL PASS: tenant domain isolation';
end $$;
