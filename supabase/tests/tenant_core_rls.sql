-- Core tenant isolation acceptance test: products, clients and preorders.
-- Run in Supabase SQL Editor. Every check must print PASS.
do $$
declare
  v_tenant_a constant uuid := '91111111-0000-4000-8000-0000000000a1';
  v_tenant_b constant uuid := '91111111-0000-4000-8000-0000000000b2';
  v_admin_a  constant uuid := '92222222-0000-4000-8000-0000000000a1';
  v_client_b constant uuid := '93333333-0000-4000-8000-0000000000b2';
  v_count integer;
  v_blocked boolean;
  v_preorder_b uuid;
begin
  delete from auth.users where id = v_admin_a;
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);

  insert into public.tenants (id, name, slug, status) values
    (v_tenant_a, 'Core RLS A', 'core-rls-a', 'active'),
    (v_tenant_b, 'Core RLS B', 'core-rls-b', 'active');
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_admin_a, 'authenticated', 'authenticated', 'core-rls-a@example.com', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );
  insert into public.profiles (id, email, role, tenant_id, active)
  values (v_admin_a, 'core-rls-a@example.com', 'tenant_admin', v_tenant_a, true)
  on conflict (id) do update set role = excluded.role, tenant_id = excluded.tenant_id, active = true;

  insert into public.products (tenant_id, codigo, descripcion)
  values (v_tenant_b, 'CORE-RLS-B', 'Producto privado B');
  insert into public.clients (id, tenant_id, name, email, active)
  values (v_client_b, v_tenant_b, 'Cliente privado B', 'core-client-b@example.com', true);
  insert into public.preorders (tenant_id, folio, client_id, status)
  values (v_tenant_b, 'CORE-RLS-B', v_client_b, 'pendiente')
  returning id into v_preorder_b;
  insert into public.preorder_items (
    preorder_id, producto_codigo, piezas, gramos_por_pieza, gramos_total
  ) values (v_preorder_b, 'CORE-ITEM-B', 1, 1, 1);

  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into v_count from public.products where tenant_id = v_tenant_b;
  if v_count <> 0 then raise exception 'FAIL: products SELECT crossed tenant'; end if;
  raise notice 'PASS: products SELECT isolated';
  update public.products set descripcion = 'HACK' where tenant_id = v_tenant_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: products UPDATE crossed tenant'; end if;
  raise notice 'PASS: products UPDATE isolated';
  delete from public.products where tenant_id = v_tenant_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: products DELETE crossed tenant'; end if;
  raise notice 'PASS: products DELETE isolated';
  v_blocked := false;
  begin
    insert into public.products (tenant_id, codigo, descripcion)
    values (v_tenant_b, 'CORE-RLS-HACK', 'HACK');
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: products INSERT crossed tenant'; end if;
  raise notice 'PASS: products INSERT isolated';

  select count(*) into v_count from public.clients where tenant_id = v_tenant_b;
  if v_count <> 0 then raise exception 'FAIL: clients SELECT crossed tenant'; end if;
  raise notice 'PASS: clients SELECT isolated';
  update public.clients set name = 'HACK' where tenant_id = v_tenant_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: clients UPDATE crossed tenant'; end if;
  raise notice 'PASS: clients UPDATE isolated';
  delete from public.clients where tenant_id = v_tenant_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: clients DELETE crossed tenant'; end if;
  raise notice 'PASS: clients DELETE isolated';
  v_blocked := false;
  begin
    insert into public.clients (tenant_id, name, email)
    values (v_tenant_b, 'HACK', 'core-hack@example.com');
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: clients INSERT crossed tenant'; end if;
  raise notice 'PASS: clients INSERT isolated';

  select count(*) into v_count from public.preorders where tenant_id = v_tenant_b;
  if v_count <> 0 then raise exception 'FAIL: preorders SELECT crossed tenant'; end if;
  raise notice 'PASS: preorders SELECT isolated';
  update public.preorders set status = 'HACK' where tenant_id = v_tenant_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: preorders UPDATE crossed tenant'; end if;
  raise notice 'PASS: preorders UPDATE isolated';
  delete from public.preorders where tenant_id = v_tenant_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: preorders DELETE crossed tenant'; end if;
  raise notice 'PASS: preorders DELETE isolated';
  v_blocked := false;
  begin
    insert into public.preorders (tenant_id, folio, status)
    values (v_tenant_b, 'CORE-RLS-HACK', 'pendiente');
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: preorders INSERT crossed tenant'; end if;
  raise notice 'PASS: preorders INSERT isolated';

  select count(*) into v_count
  from public.preorder_items where preorder_id = v_preorder_b;
  if v_count <> 0 then raise exception 'FAIL: preorder_items SELECT crossed tenant'; end if;
  raise notice 'PASS: preorder_items SELECT isolated';
  update public.preorder_items set piezas = 99 where preorder_id = v_preorder_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: preorder_items UPDATE crossed tenant'; end if;
  raise notice 'PASS: preorder_items UPDATE isolated';
  delete from public.preorder_items where preorder_id = v_preorder_b;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: preorder_items DELETE crossed tenant'; end if;
  raise notice 'PASS: preorder_items DELETE isolated';
  v_blocked := false;
  begin
    insert into public.preorder_items (
      preorder_id, producto_codigo, piezas, gramos_por_pieza, gramos_total
    ) values (v_preorder_b, 'CORE-ITEM-HACK', 1, 1, 1);
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: preorder_items INSERT crossed tenant'; end if;
  raise notice 'PASS: preorder_items INSERT isolated';

  reset role;
  delete from public.preorder_items where preorder_id = v_preorder_b;
  delete from public.preorders where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.clients where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.products where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.profiles where id = v_admin_a;
  delete from auth.users where id = v_admin_a;
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);
  raise notice 'ALL PASS: core tenant isolation';
end $$;
