-- STAGING ONLY. Run after seed_demo.sql.
-- First functional Project Hub vertical: solution, brief, evidence and calculated metrics.
do $$
declare
  v_tenant uuid;
  v_project uuid;
  v_solution constant uuid := 'e8000000-0000-4000-8000-000000000001';
begin
  select id into v_tenant from public.tenants where slug = 'estuches-chavez';
  select id into v_project from public.projects where tenant_id = v_tenant and name = 'Módulo de inventario';

  if v_project is null then
    raise exception 'The Estuches Chávez staging project must exist before the functional seed runs.';
  end if;

  insert into public.project_solutions (
    id, tenant_id, project_id, phase_id, name, description, status, stage_name,
    current_phase_name, next_milestone, scope_items, start_date, estimated_end_date,
    sort_order, visible_to_client
  ) values (
    v_solution, v_tenant, v_project, 'e1000000-0000-4000-8000-000000000002',
    'Inventario', 'Control de productos, existencias, entradas, salidas y trazabilidad en una sola operación.',
    'in_progress', 'Etapa 1 · Operación', 'Diseño funcional',
    'Aprobación del flujo de entradas y salidas',
    array['Productos', 'Existencias', 'Entradas y salidas', 'Trazabilidad'],
    '2026-08-10', '2026-09-18', 10, true
  ) on conflict (id) do update set
    name = excluded.name, description = excluded.description, status = excluded.status,
    stage_name = excluded.stage_name, current_phase_name = excluded.current_phase_name,
    next_milestone = excluded.next_milestone, scope_items = excluded.scope_items,
    start_date = excluded.start_date, estimated_end_date = excluded.estimated_end_date,
    visible_to_client = true;

  insert into public.project_solution_brief_versions (
    id, tenant_id, project_id, solution_id, version_number, status, problem, objective,
    current_process, proposed_process, included_scope, excluded_scope, users_and_permissions,
    impacts, assumptions_and_risks, visible_to_client
  ) values (
    'e8100000-0000-4000-8000-000000000001', v_tenant, v_project, v_solution, 1, 'approved',
    'Las existencias y movimientos se controlan en fuentes separadas sin una trazabilidad única.',
    'Centralizar inventario y movimientos con responsables, evidencia e historial consultable.',
    'Captura manual y conciliación posterior.',
    'Registro único de entradas, salidas y ajustes con actualización inmediata de existencias.',
    array['Catálogo de productos', 'Existencias', 'Entradas', 'Salidas', 'Historial'],
    array['Compras automáticas', 'Facturación', 'Integración contable'],
    'Administración configura; operación registra; dirección consulta y autoriza ajustes.',
    'Sustituye el control paralelo de existencias.',
    'La carga inicial depende del catálogo validado por el cliente.', true
  ) on conflict (id) do update set
    status = excluded.status, problem = excluded.problem, objective = excluded.objective,
    current_process = excluded.current_process, proposed_process = excluded.proposed_process,
    included_scope = excluded.included_scope, excluded_scope = excluded.excluded_scope,
    users_and_permissions = excluded.users_and_permissions, impacts = excluded.impacts,
    assumptions_and_risks = excluded.assumptions_and_risks, visible_to_client = true;

  update public.projects set progress_percentage = 0 where id = v_project;

  update public.project_deliverables set
    solution_id = v_solution,
    name = case id
      when 'e3000000-0000-4000-8000-000000000001' then 'Ficha de solución'
      when 'e3000000-0000-4000-8000-000000000002' then 'Primera versión de Inventario'
      else name end,
    status = case when id = 'e3000000-0000-4000-8000-000000000001' then 'approved' else status end,
    weight = case id
      when 'e3000000-0000-4000-8000-000000000001' then 1
      when 'e3000000-0000-4000-8000-000000000002' then 2
      else 2 end,
    approved_at = case when id = 'e3000000-0000-4000-8000-000000000001' then '2026-08-12 12:00:00+00'::timestamptz else approved_at end
  where project_id = v_project;

  update public.project_approvals set solution_id = v_solution, decision_type = 'solution_brief'
  where project_id = v_project;
  update public.project_documents set solution_id = v_solution
  where project_id = v_project and document_type in ('scope', 'proposal');

  update public.project_tasks set
    solution_id = v_solution,
    deliverable_id = case
      when objective_id = 'e6000000-0000-4000-8000-000000000001' then 'e3000000-0000-4000-8000-000000000001'::uuid
      when objective_id = 'e6000000-0000-4000-8000-000000000002' then 'e3000000-0000-4000-8000-000000000002'::uuid
      else 'e3000000-0000-4000-8000-000000000003'::uuid end,
    estimated_hours = case id
      when 'e7000000-0000-4000-8000-000000000001' then 8
      when 'e7000000-0000-4000-8000-000000000002' then 5
      when 'e7000000-0000-4000-8000-000000000003' then 12
      when 'e7000000-0000-4000-8000-000000000004' then 18
      when 'e7000000-0000-4000-8000-000000000005' then 16
      when 'e7000000-0000-4000-8000-000000000006' then 16
      when 'e7000000-0000-4000-8000-000000000007' then 12
      when 'e7000000-0000-4000-8000-000000000008' then 8
      when 'e7000000-0000-4000-8000-000000000009' then 10
      else 4 end
  where project_id = v_project;

  insert into public.project_acceptance_criteria (
    id, tenant_id, project_id, solution_id, deliverable_id, description, status, sort_order, visible_to_client
  ) values
    ('e8200000-0000-4000-8000-000000000001', v_tenant, v_project, v_solution, 'e3000000-0000-4000-8000-000000000001', 'La Ficha de solución describe alcance incluido y excluido.', 'accepted', 10, true),
    ('e8200000-0000-4000-8000-000000000002', v_tenant, v_project, v_solution, 'e3000000-0000-4000-8000-000000000002', 'Permite crear y consultar productos con existencia actual.', 'pending', 20, true),
    ('e8200000-0000-4000-8000-000000000003', v_tenant, v_project, v_solution, 'e3000000-0000-4000-8000-000000000002', 'Cada movimiento conserva fecha, tipo, cantidad y usuario responsable.', 'pending', 30, true)
  on conflict (id) do update set description = excluded.description, status = excluded.status, sort_order = excluded.sort_order, visible_to_client = true;

  insert into public.project_time_entries (
    id, tenant_id, project_id, solution_id, task_id, work_date, minutes, description, contributor_name, visible_to_client
  ) values
    ('e8300000-0000-4000-8000-000000000001', v_tenant, v_project, v_solution, 'e7000000-0000-4000-8000-000000000001', '2026-08-10', 330, 'Entrevista y levantamiento de movimientos', 'Equipo NEXOR IA', true),
    ('e8300000-0000-4000-8000-000000000002', v_tenant, v_project, v_solution, 'e7000000-0000-4000-8000-000000000001', '2026-08-12', 420, 'Documentación de la Ficha de solución', 'Equipo NEXOR IA', true),
    ('e8300000-0000-4000-8000-000000000003', v_tenant, v_project, v_solution, 'e7000000-0000-4000-8000-000000000003', '2026-08-15', 285, 'Prototipo funcional de entradas y salidas', 'Equipo NEXOR IA', true)
  on conflict (id) do update set work_date = excluded.work_date, minutes = excluded.minutes, description = excluded.description, contributor_name = excluded.contributor_name, visible_to_client = true;

  insert into public.project_development_activity (
    id, tenant_id, project_id, solution_id, activity_date, repository_label,
    lines_added, lines_deleted, commits_count, source, visible_to_client
  ) values
    ('e8400000-0000-4000-8000-000000000001', v_tenant, v_project, v_solution, '2026-08-14', 'inventario', 1842, 216, 9, 'manual', true),
    ('e8400000-0000-4000-8000-000000000002', v_tenant, v_project, v_solution, '2026-08-16', 'inventario', 1260, 184, 6, 'manual', true)
  on conflict (id) do update set activity_date = excluded.activity_date, repository_label = excluded.repository_label, lines_added = excluded.lines_added, lines_deleted = excluded.lines_deleted, commits_count = excluded.commits_count, visible_to_client = true;
end $$;
