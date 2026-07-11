-- RLS acceptance test for agenda_objectives / agenda_tasks / client_followup_summary.
-- Run in SQL Editor. Every failed assertion raises an exception.
do $$
declare
  v_tenant_a constant uuid := '99666666-0000-4000-8000-0000000000a1';
  v_tenant_b constant uuid := '99666666-0000-4000-8000-0000000000b2';
  v_admin_a constant uuid := '99777777-0000-4000-8000-0000000000a1';
  v_comercial_a constant uuid := '99777777-0000-4000-8000-0000000000c0';
  v_client_a constant uuid := '99777777-0000-4000-8000-0000000000c1';
  v_cliente uuid;
  v_objective uuid;
  v_count integer;
  v_blocked boolean;
begin
  delete from auth.users where id in (v_admin_a, v_comercial_a, v_client_a);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);

  insert into public.tenants (id, name, slug, status) values
    (v_tenant_a, 'Agenda RLS A', 'agenda-rls-a', 'active'),
    (v_tenant_b, 'Agenda RLS B', 'agenda-rls-b', 'active');

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    (v_admin_a, 'authenticated', 'authenticated', 'agenda-admin-a@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_comercial_a, 'authenticated', 'authenticated', 'agenda-comercial-a@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_client_a, 'authenticated', 'authenticated', 'agenda-client-a@example.com', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into public.profiles (id, email, role, tenant_id, active) values
    (v_admin_a, 'agenda-admin-a@example.com', 'tenant_admin', v_tenant_a, true),
    (v_comercial_a, 'agenda-comercial-a@example.com', 'comercial', v_tenant_a, true),
    (v_client_a, 'agenda-client-a@example.com', 'client', v_tenant_a, true)
  on conflict (id) do update
  set role = excluded.role, tenant_id = excluded.tenant_id, active = true;

  insert into public.clients (tenant_id, name, company, email, type, active)
  values (v_tenant_a, 'Cliente Agenda', 'Agenda Co', 'agenda-cliente@example.com', 'cliente', true)
  returning id into v_cliente;

  -- Datos del tenant B para probar aislamiento
  insert into public.agenda_objectives (tenant_id, period_type, period_key, title)
  values (v_tenant_b, 'month', '2026-07', 'Objetivo ajeno');
  insert into public.agenda_tasks (tenant_id, title, task_date, category)
  values (v_tenant_b, 'Tarea ajena', current_date, 'administrativo');

  -- ── tenant_admin: puede crear objetivos y tareas ──
  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  insert into public.agenda_objectives (tenant_id, period_type, period_key, title, created_by)
  values (v_tenant_a, 'month', '2026-07', 'Vender 100 piezas', v_admin_a)
  returning id into v_objective;
  raise notice 'PASS: tenant admin crea objetivo';

  insert into public.agenda_tasks (tenant_id, title, task_date, category, client_id, objective_id, created_by)
  values (v_tenant_a, 'Llamar a Cliente Agenda', current_date, 'comercial', v_cliente, v_objective, v_admin_a);
  raise notice 'PASS: tenant admin crea tarea comercial';

  select count(*) into v_count from public.agenda_tasks;
  if v_count <> 1 then raise exception 'FAIL: admin A ve tareas de otro tenant (%)', v_count; end if;
  raise notice 'PASS: admin A solo ve tareas de su tenant';

  select count(*) into v_count from public.agenda_objectives;
  if v_count <> 1 then raise exception 'FAIL: admin A ve objetivos de otro tenant'; end if;
  raise notice 'PASS: admin A solo ve objetivos de su tenant';

  select count(*) into v_count from public.client_followup_summary where pendientes > 0;
  if v_count <> 1 then raise exception 'FAIL: vista de seguimiento no refleja pendientes'; end if;
  raise notice 'PASS: vista de seguimiento respeta el tenant y cuenta pendientes';

  -- Tarea administrativa con cliente debe fallar (check constraint)
  v_blocked := false;
  begin
    insert into public.agenda_tasks (tenant_id, title, task_date, category, client_id)
    values (v_tenant_a, 'Mal formada', current_date, 'administrativo', v_cliente);
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: tarea administrativa acepto cliente'; end if;
  raise notice 'PASS: solo tareas comerciales llevan cliente';

  reset role;

  -- ── rol comercial: tareas si, objetivos no ──
  perform set_config('request.jwt.claim.sub', v_comercial_a::text, true);
  set local role authenticated;

  insert into public.agenda_tasks (tenant_id, title, task_date, category, created_by)
  values (v_tenant_a, 'Seguimiento pendiente', current_date - 3, 'administrativo', v_comercial_a);
  raise notice 'PASS: rol comercial crea tareas';

  update public.agenda_tasks set status = 'done', completed_at = now()
  where title = 'Seguimiento pendiente';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'FAIL: rol comercial no pudo completar su tarea'; end if;
  raise notice 'PASS: rol comercial completa tareas';

  v_blocked := false;
  begin
    insert into public.agenda_objectives (tenant_id, period_type, period_key, title)
    values (v_tenant_a, 'week', '2026-W28', 'Objetivo no permitido');
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: rol comercial creo objetivos'; end if;
  raise notice 'PASS: rol comercial no puede crear objetivos';

  select count(*) into v_count from public.agenda_objectives;
  if v_count <> 1 then raise exception 'FAIL: rol comercial no lee objetivos de su tenant'; end if;
  raise notice 'PASS: rol comercial lee objetivos de su tenant';

  select count(*) into v_count from public.clients where tenant_id = v_tenant_a;
  if v_count <> 1 then raise exception 'FAIL: rol comercial no lee clientes de su tenant'; end if;
  raise notice 'PASS: rol comercial lee clientes de su tenant';

  update public.clients set name = 'Hackeado' where tenant_id = v_tenant_a;
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'FAIL: rol comercial modifico clientes'; end if;
  raise notice 'PASS: rol comercial no puede modificar clientes';

  reset role;

  -- ── rol client: sin acceso a la agenda ──
  perform set_config('request.jwt.claim.sub', v_client_a::text, true);
  set local role authenticated;

  select count(*) into v_count from public.agenda_tasks;
  if v_count <> 0 then raise exception 'FAIL: rol client ve tareas de agenda'; end if;
  raise notice 'PASS: rol client no ve la agenda';

  v_blocked := false;
  begin
    insert into public.agenda_tasks (tenant_id, title, task_date, category)
    values (v_tenant_a, 'Intrusa', current_date, 'administrativo');
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: rol client inserto tareas'; end if;
  raise notice 'PASS: rol client no puede crear tareas';

  reset role;

  -- ── Limpieza ──
  delete from public.agenda_tasks where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.agenda_objectives where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.clients where tenant_id in (v_tenant_a, v_tenant_b);
  delete from public.profiles where id in (v_admin_a, v_comercial_a, v_client_a);
  delete from auth.users where id in (v_admin_a, v_comercial_a, v_client_a);
  delete from public.tenants where id in (v_tenant_a, v_tenant_b);

  raise notice 'ALL PASS: agenda comercial aislamiento y roles';
end $$;
