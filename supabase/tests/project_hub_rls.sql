-- Project Hub tenant isolation and controlled approval response acceptance test.
do $$
declare
  v_tenant_a constant uuid := 'aa888888-0000-4000-8000-0000000000a1';
  v_tenant_b constant uuid := 'aa888888-0000-4000-8000-0000000000b2';
  v_admin_a constant uuid := 'aa999999-0000-4000-8000-0000000000a1';
  v_admin_b constant uuid := 'aa999999-0000-4000-8000-0000000000b2';
  v_super constant uuid := 'aa999999-0000-4000-8000-0000000000ff';
  v_project_a uuid;
  v_project_b uuid;
  v_approval_a uuid;
  v_count integer;
  v_blocked boolean;
  v_status text;
begin
  delete from auth.users where id in (v_admin_a, v_admin_b, v_super);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);

  insert into public.tenants (id, name, slug, status) values
    (v_tenant_a, 'Project Hub A', 'project-hub-a', 'active'),
    (v_tenant_b, 'Project Hub B', 'project-hub-b', 'active');
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
    (v_admin_a, 'authenticated', 'authenticated', 'project-hub-a@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_admin_b, 'authenticated', 'authenticated', 'project-hub-b@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_super, 'authenticated', 'authenticated', 'project-hub-super@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.profiles (id, email, role, tenant_id, active) values
    (v_admin_a, 'project-hub-a@example.com', 'tenant_admin', v_tenant_a, true),
    (v_admin_b, 'project-hub-b@example.com', 'tenant_admin', v_tenant_b, true),
    (v_super, 'project-hub-super@example.com', 'superadmin', null, true)
  on conflict (id) do update set
    role = excluded.role, tenant_id = excluded.tenant_id, active = true;

  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  insert into public.projects (tenant_id, name, status, published) values
    (v_tenant_a, 'Visible A', 'active', true) returning id into v_project_a;
  insert into public.projects (tenant_id, name, status, published) values
    (v_tenant_b, 'Visible B', 'active', true) returning id into v_project_b;
  insert into public.projects (tenant_id, name, status, published) values
    (v_tenant_a, 'Hidden A', 'draft', false);
  insert into public.project_updates (tenant_id, project_id, title, visible_to_client) values
    (v_tenant_a, v_project_a, 'Visible update', true),
    (v_tenant_a, v_project_a, 'Internal update', false);
  insert into public.project_approvals (tenant_id, project_id, title, status, visible_to_client)
  values (v_tenant_a, v_project_a, 'Approve A', 'pending', true)
  returning id into v_approval_a;

  reset role;
  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into v_count from public.projects;
  if v_count <> 1 then raise exception 'FAIL: tenant A should see exactly its published project'; end if;
  raise notice 'PASS: tenant A sees only its published project';

  select count(*) into v_count from public.project_updates;
  if v_count <> 1 then raise exception 'FAIL: tenant A should see only client-visible updates'; end if;
  raise notice 'PASS: internal updates stay hidden';

  v_blocked := false;
  begin
    insert into public.projects (tenant_id, name) values (v_tenant_a, 'Unauthorized project');
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: tenant admin created a project'; end if;
  raise notice 'PASS: tenant admin cannot create project data';

  perform public.respond_project_approval(v_approval_a, 'approved', 'Aprobado por tenant A');
  select status into v_status from public.project_approvals where id = v_approval_a;
  if v_status <> 'approved' then raise exception 'FAIL: tenant A could not approve its item'; end if;
  raise notice 'PASS: tenant A responds through controlled RPC';

  reset role;
  perform set_config('request.jwt.claim.sub', v_admin_b::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into v_count from public.projects where tenant_id = v_tenant_a;
  if v_count <> 0 then raise exception 'FAIL: tenant B read tenant A project'; end if;
  raise notice 'PASS: tenant B cannot read tenant A project';

  v_blocked := false;
  begin
    perform public.respond_project_approval(v_approval_a, 'rejected', 'Cross tenant');
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: tenant B responded to tenant A approval'; end if;
  raise notice 'PASS: tenant B cannot respond to tenant A approval';

  reset role;
  delete from public.projects where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.profiles where id in (v_admin_a, v_admin_b, v_super);
  delete from auth.users where id in (v_admin_a, v_admin_b, v_super);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);
  raise notice 'ALL PASS: Project Hub isolation and approvals';
end $$;
