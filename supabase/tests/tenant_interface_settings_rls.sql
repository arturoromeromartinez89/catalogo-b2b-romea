-- RLS acceptance test for tenant_interface_settings.
-- Run in SQL Editor. Every failed assertion raises an exception.
do $$
declare
  v_tenant_a constant uuid := '96666666-0000-4000-8000-0000000000a1';
  v_tenant_b constant uuid := '96666666-0000-4000-8000-0000000000b2';
  v_admin_a constant uuid := '97777777-0000-4000-8000-0000000000a1';
  v_admin_b constant uuid := '97777777-0000-4000-8000-0000000000b2';
  v_client_a constant uuid := '97777777-0000-4000-8000-0000000000c1';
  v_count integer;
  v_blocked boolean;
begin
  delete from auth.users where id in (v_admin_a, v_admin_b, v_client_a);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);

  insert into public.tenants (id, name, slug, status) values
    (v_tenant_a, 'Interface RLS A', 'interface-rls-a', 'active'),
    (v_tenant_b, 'Interface RLS B', 'interface-rls-b', 'active');

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (v_admin_a, 'authenticated', 'authenticated', 'interface-rls-a@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_admin_b, 'authenticated', 'authenticated', 'interface-rls-b@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_client_a, 'authenticated', 'authenticated', 'interface-client-a@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.profiles (id, email, role, tenant_id, active) values
    (v_admin_a, 'interface-rls-a@example.com', 'tenant_admin', v_tenant_a, true),
    (v_admin_b, 'interface-rls-b@example.com', 'tenant_admin', v_tenant_b, true),
    (v_client_a, 'interface-client-a@example.com', 'client', v_tenant_a, true)
  on conflict (id) do update
  set role = excluded.role, tenant_id = excluded.tenant_id, active = true;

  insert into public.tenant_interface_settings (tenant_id, theme_key, admin_product_card_config) values
    (v_tenant_a, 'premium', '{"fields":["codigo","descripcion"]}'::jsonb),
    (v_tenant_b, 'verde', '{"fields":["precio"]}'::jsonb);

  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into v_count from public.tenant_interface_settings where tenant_id = v_tenant_a;
  if v_count <> 1 then raise exception 'FAIL: tenant A cannot read own interface settings'; end if;
  raise notice 'PASS: tenant A reads own interface settings';

  select count(*) into v_count from public.tenant_interface_settings where tenant_id = v_tenant_b;
  if v_count <> 0 then raise exception 'FAIL: tenant A read tenant B interface settings'; end if;
  raise notice 'PASS: tenant A cannot read tenant B interface settings';

  update public.tenant_interface_settings set theme_key = 'azul' where tenant_id = v_tenant_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: tenant A updated tenant B interface settings'; end if;
  raise notice 'PASS: tenant A cannot update tenant B interface settings';

  delete from public.tenant_interface_settings where tenant_id = v_tenant_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: tenant A deleted tenant B interface settings'; end if;
  raise notice 'PASS: tenant A cannot delete tenant B interface settings';

  v_blocked := false;
  begin
    insert into public.tenant_interface_settings (tenant_id, theme_key)
    values (v_tenant_b, 'neutro');
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: tenant A inserted tenant B interface settings'; end if;
  raise notice 'PASS: tenant A cannot insert tenant B interface settings';

  insert into public.tenant_interface_settings (tenant_id, theme_key)
  values (v_tenant_a, 'azul')
  on conflict (tenant_id) do update set theme_key = excluded.theme_key;
  raise notice 'PASS: tenant A can upsert own interface settings';

  reset role;
  perform set_config('request.jwt.claim.sub', v_client_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into v_count from public.tenant_interface_settings where tenant_id = v_tenant_a;
  if v_count <> 1 then raise exception 'FAIL: tenant client cannot read own portal interface settings'; end if;
  raise notice 'PASS: tenant client can read own portal interface settings';

  select count(*) into v_count from public.tenant_interface_settings where tenant_id = v_tenant_b;
  if v_count <> 0 then raise exception 'FAIL: tenant client read another tenant interface settings'; end if;
  raise notice 'PASS: tenant client cannot read another tenant interface settings';

  update public.tenant_interface_settings set theme_key = 'neutro' where tenant_id = v_tenant_a;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: tenant client updated interface settings'; end if;
  raise notice 'PASS: tenant client cannot update interface settings';

  reset role;
  delete from public.tenant_interface_settings where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.profiles where id in (v_admin_a, v_admin_b, v_client_a);
  delete from auth.users where id in (v_admin_a, v_admin_b, v_client_a);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);

  raise notice 'ALL PASS: tenant_interface_settings isolation';
end $$;
