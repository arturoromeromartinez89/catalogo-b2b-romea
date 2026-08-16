-- Project planning workspace: tenant isolation and controlled client interactions.
do $$
declare
  v_tenant_a constant uuid := 'ab888888-0000-4000-8000-0000000000a1';
  v_tenant_b constant uuid := 'ab888888-0000-4000-8000-0000000000b2';
  v_admin_a constant uuid := 'ab999999-0000-4000-8000-0000000000a1';
  v_admin_b constant uuid := 'ab999999-0000-4000-8000-0000000000b2';
  v_super constant uuid := 'ab999999-0000-4000-8000-0000000000ff';
  v_project_a uuid;
  v_project_b uuid;
  v_objective_a uuid;
  v_task_a uuid;
  v_task_b uuid;
  v_count integer;
  v_blocked boolean;
  v_status text;
begin
  delete from auth.users where id in (v_admin_a, v_admin_b, v_super);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);

  insert into public.tenants (id, name, slug, status) values
    (v_tenant_a, 'Planning A', 'planning-a', 'active'),
    (v_tenant_b, 'Planning B', 'planning-b', 'active');
  insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
    (v_admin_a, 'authenticated', 'authenticated', 'planning-a@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_admin_b, 'authenticated', 'authenticated', 'planning-b@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_super, 'authenticated', 'authenticated', 'planning-super@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.profiles (id, email, role, tenant_id, active) values
    (v_admin_a, 'planning-a@example.com', 'tenant_admin', v_tenant_a, true),
    (v_admin_b, 'planning-b@example.com', 'tenant_admin', v_tenant_b, true),
    (v_super, 'planning-super@example.com', 'superadmin', null, true)
  on conflict (id) do update set role = excluded.role, tenant_id = excluded.tenant_id, active = true;

  perform set_config('request.jwt.claim.sub', v_super::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
  insert into public.projects (tenant_id, name, status, published) values
    (v_tenant_a, 'Plan visible A', 'active', true) returning id into v_project_a;
  insert into public.projects (tenant_id, name, status, published) values
    (v_tenant_b, 'Plan visible B', 'active', true) returning id into v_project_b;
  insert into public.project_objectives (tenant_id, project_id, title, period_start, period_end, status)
  values (v_tenant_a, v_project_a, 'Objetivo A', current_date, current_date + 7, 'active')
  returning id into v_objective_a;
  insert into public.project_tasks (tenant_id, project_id, objective_id, title, status, created_by)
  values (v_tenant_a, v_project_a, v_objective_a, 'Tarea A', 'todo', v_super)
  returning id into v_task_a;
  insert into public.project_tasks (tenant_id, project_id, title, status, created_by)
  values (v_tenant_b, v_project_b, 'Tarea B', 'todo', v_super)
  returning id into v_task_b;

  reset role;
  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into v_count from public.project_objectives;
  if v_count <> 1 then raise exception 'FAIL: tenant A should see one objective'; end if;
  select count(*) into v_count from public.project_tasks;
  if v_count <> 1 then raise exception 'FAIL: tenant A should see one task'; end if;
  raise notice 'PASS: objectives and tasks are isolated by tenant';

  update public.project_tasks set status = 'done' where id = v_task_a;
  select status into v_status from public.project_tasks where id = v_task_a;
  if v_status <> 'todo' then raise exception 'FAIL: tenant admin updated task directly'; end if;
  raise notice 'PASS: direct task updates are blocked';

  perform public.move_project_task(v_task_a, 'review', 20);
  select status into v_status from public.project_tasks where id = v_task_a;
  if v_status <> 'review' then raise exception 'FAIL: controlled move did not update task'; end if;
  raise notice 'PASS: tenant A moves its visible card through RPC';

  insert into public.project_task_comments (tenant_id, project_id, task_id, body, created_by)
  values (v_tenant_a, v_project_a, v_task_a, 'Comentario del cliente A', v_admin_a);
  insert into public.project_task_attachments (tenant_id, project_id, task_id, file_name, storage_path, created_by)
  values (v_tenant_a, v_project_a, v_task_a, 'evidencia.pdf', v_tenant_a::text || '/' || v_project_a::text || '/' || v_task_a::text || '/evidencia.pdf', v_admin_a);
  raise notice 'PASS: tenant A adds comments and attachment metadata to its task';

  reset role;
  perform set_config('request.jwt.claim.sub', v_admin_b::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into v_count from public.project_tasks where id = v_task_a;
  if v_count <> 0 then raise exception 'FAIL: tenant B read tenant A task'; end if;

  v_blocked := false;
  begin
    perform public.move_project_task(v_task_a, 'done', 30);
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: tenant B moved tenant A task'; end if;

  v_blocked := false;
  begin
    insert into public.project_task_comments (tenant_id, project_id, task_id, body, created_by)
    values (v_tenant_a, v_project_a, v_task_a, 'Cross tenant', v_admin_b);
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: tenant B commented on tenant A task'; end if;
  raise notice 'PASS: cross-tenant moves and comments are blocked';

  reset role;
  delete from public.projects where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.profiles where id in (v_admin_a, v_admin_b, v_super);
  delete from auth.users where id in (v_admin_a, v_admin_b, v_super);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);
  raise notice 'ALL PASS: project planning workspace isolation';
end $$;
