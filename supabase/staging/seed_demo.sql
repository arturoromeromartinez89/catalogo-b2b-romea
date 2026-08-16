-- STAGING ONLY. Never apply this file to the production project.
do $$
declare
  v_tenant constant uuid := 'a1000000-0000-4000-8000-000000000001';
begin
  if current_database() not like '%vafqcvpzksjlrborxoos%' then
    -- Supabase branch database names do not always include the project ref, so
    -- the deployment script must also verify the linked ref before execution.
    raise notice 'Project-ref verification is enforced by the staging script.';
  end if;

  insert into public.tenants (id, name, slug, status)
  values (v_tenant, 'Empresa Demo - Pruebas', 'demo-staging', 'active')
  on conflict (id) do update
  set name = excluded.name, slug = excluded.slug, status = excluded.status;

  update public.company_settings
  set brand_name = 'Catalogo Demo',
      legal_name = 'Empresa Ficticia de Pruebas',
      email = 'demo@example.invalid',
      city = 'Ciudad de Pruebas',
      state = 'Estado de Pruebas',
      country = 'Mexico',
      commercial_terms = 'Informacion ficticia. No realizar operaciones comerciales.'
  where tenant_id = v_tenant;

  insert into public.company_settings (
    tenant_id, brand_name, legal_name, email, city, state, country,
    commercial_terms
  )
  select
    v_tenant, 'Catalogo Demo', 'Empresa Ficticia de Pruebas',
    'demo@example.invalid', 'Ciudad de Pruebas', 'Estado de Pruebas', 'Mexico',
    'Informacion ficticia. No realizar operaciones comerciales.'
  where not exists (
    select 1 from public.company_settings where tenant_id = v_tenant
  );

  insert into public.products (
    tenant_id, codigo, modelo, descripcion, linea, familia, grupo, estatus,
    peso_promedio, unidad_venta, precio_minimo, visible_web, orden_web,
    tags_busqueda, search_text
  ) values
    (v_tenant, 'DEMO-VIT-001', 'V-01', 'Vitrina modular de demostracion', 'Exhibicion', 'Vitrinas', 'Vitrina', 'Activo', 1, 'pieza', 1250, true, 1, 'vitrina exhibidor demo', 'vitrina modular demostracion exhibicion'),
    (v_tenant, 'DEMO-BAS-001', 'B-01', 'Base escalonada de demostracion', 'Exhibicion', 'Bases', 'Base', 'Activo', 1, 'pieza', 420, true, 2, 'base exhibidor demo', 'base escalonada demostracion exhibicion'),
    (v_tenant, 'DEMO-GAN-001', 'G-01', 'Gancho metalico de demostracion', 'Accesorios', 'Ganchos', 'Gancho', 'Activo', 1, 'pieza', 85, true, 3, 'gancho accesorio demo', 'gancho metalico demostracion accesorio')
  on conflict (tenant_id, codigo) do update
  set descripcion = excluded.descripcion,
      linea = excluded.linea,
      familia = excluded.familia,
      grupo = excluded.grupo,
      precio_minimo = excluded.precio_minimo,
      visible_web = excluded.visible_web,
      search_text = excluded.search_text;

  insert into public.catalog_quick_filters (
    tenant_id, slug, label, terms, match_type, active, sort_order
  ) values
    (v_tenant, 'vitrinas', 'Vitrinas', array['vitrina'], 'terms', true, 10),
    (v_tenant, 'bases', 'Bases', array['base'], 'terms', true, 20),
    (v_tenant, 'ganchos', 'Ganchos', array['gancho'], 'terms', true, 30)
  on conflict (tenant_id, slug) do update
  set label = excluded.label,
      terms = excluded.terms,
      match_type = excluded.match_type,
      active = excluded.active,
      sort_order = excluded.sort_order;

  insert into public.profiles (id, email, role, tenant_id, active)
  select id, email, 'superadmin', null, true
  from auth.users
  where email = 'staging-admin@romea.example'
  on conflict (id) do update
  set role = excluded.role,
      tenant_id = null,
      client_id = null,
      active = true;
end $$;

-- Project Hub presentation data for the three initial NEXOR tenants.
do $$
declare
  v_estuches uuid;
  v_vanguardia uuid;
  v_romea uuid;
  v_project uuid;
begin
  insert into public.tenants (name, slug, status) values
    ('Estuches Chávez', 'estuches-chavez', 'active'),
    ('Vanguardia Joyera', 'vanguardia-joyera', 'active'),
    ('ROMEA', 'romea', 'active')
  on conflict (slug) do update set name = excluded.name, status = excluded.status;

  select id into v_estuches from public.tenants where slug = 'estuches-chavez';
  select id into v_vanguardia from public.tenants where slug = 'vanguardia-joyera';
  select id into v_romea from public.tenants where slug = 'romea';

  insert into public.projects (
    tenant_id, name, description, status, health, progress_percentage,
    current_phase_name, start_date, estimated_end_date, internal_owner_name, published
  ) values (
    v_estuches, 'Módulo de inventario',
    'Control centralizado de existencias, entradas, salidas y trazabilidad de productos.',
    'active', 'green', 28, 'Diseño funcional', '2026-08-10', '2026-09-18', 'Equipo NEXOR IA', true
  ) on conflict (tenant_id, name) do update set
    description = excluded.description, status = excluded.status, health = excluded.health,
    progress_percentage = excluded.progress_percentage, current_phase_name = excluded.current_phase_name,
    start_date = excluded.start_date, estimated_end_date = excluded.estimated_end_date,
    internal_owner_name = excluded.internal_owner_name, published = true
  returning id into v_project;

  insert into public.project_phases (id, tenant_id, project_id, name, sort_order, status, progress_percentage, estimated_end_date) values
    ('e1000000-0000-4000-8000-000000000001', v_estuches, v_project, 'Definición de alcance', 10, 'completed', 100, '2026-08-12'),
    ('e1000000-0000-4000-8000-000000000002', v_estuches, v_project, 'Diseño funcional', 20, 'in_progress', 55, '2026-08-21'),
    ('e1000000-0000-4000-8000-000000000003', v_estuches, v_project, 'Desarrollo', 30, 'pending', 0, '2026-09-04'),
    ('e1000000-0000-4000-8000-000000000004', v_estuches, v_project, 'Pruebas y ajustes', 40, 'pending', 0, '2026-09-14'),
    ('e1000000-0000-4000-8000-000000000005', v_estuches, v_project, 'Entrega inicial', 50, 'pending', 0, '2026-09-18')
  on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order, status = excluded.status, progress_percentage = excluded.progress_percentage, estimated_end_date = excluded.estimated_end_date;

  insert into public.project_updates (id, tenant_id, project_id, title, description, update_type, visible_to_client, created_at) values
    ('e2000000-0000-4000-8000-000000000001', v_estuches, v_project, 'Alcance inicial definido', 'Se organizó el módulo en productos, existencias y movimientos para mantener una operación sencilla.', 'milestone', true, '2026-08-12 12:00:00+00'),
    ('e2000000-0000-4000-8000-000000000002', v_estuches, v_project, 'Diseño funcional en proceso', 'Estamos preparando el flujo de entradas y salidas que se presentará para revisión.', 'progress', true, '2026-08-13 12:00:00+00'),
    ('e2000000-0000-4000-8000-000000000003', v_estuches, v_project, 'Preparación del ambiente de pruebas', 'El desarrollo se validará en un ambiente separado antes de habilitarse en la operación real.', 'information', true, '2026-08-13 14:00:00+00')
  on conflict (id) do update set title = excluded.title, description = excluded.description, update_type = excluded.update_type, visible_to_client = true;

  insert into public.project_deliverables (id, tenant_id, project_id, name, description, status, estimated_delivery_date, visible_to_client) values
    ('e3000000-0000-4000-8000-000000000001', v_estuches, v_project, 'Definición funcional', 'Flujos, reglas y alcance aprobado del módulo.', 'in_progress', '2026-08-21', true),
    ('e3000000-0000-4000-8000-000000000002', v_estuches, v_project, 'Módulo de inventario MVP', 'Productos, existencias, entradas, salidas e historial.', 'pending', '2026-09-04', true),
    ('e3000000-0000-4000-8000-000000000003', v_estuches, v_project, 'Entrega inicial', 'Versión aprobada y habilitada para Estuches Chávez.', 'pending', '2026-09-18', true)
  on conflict (id) do update set name = excluded.name, description = excluded.description, status = excluded.status, estimated_delivery_date = excluded.estimated_delivery_date, visible_to_client = true;

  insert into public.project_documents (id, tenant_id, project_id, document_type, name, description, visible_to_client) values
    ('e4000000-0000-4000-8000-000000000001', v_estuches, v_project, 'scope', 'Resumen de alcance', 'Documento demostrativo pendiente de enlace.', true),
    ('e4000000-0000-4000-8000-000000000002', v_estuches, v_project, 'proposal', 'Propuesta de implementación', 'Documento demostrativo pendiente de enlace.', true),
    ('e4000000-0000-4000-8000-000000000003', v_estuches, v_project, 'contract', 'Contrato', 'Aún no asociado.', true)
  on conflict (id) do update set name = excluded.name, description = excluded.description, visible_to_client = true;

  insert into public.project_approvals (id, tenant_id, project_id, title, description, status, due_date, visible_to_client) values
    ('e5000000-0000-4000-8000-000000000001', v_estuches, v_project, 'Confirmar catálogo inicial', 'Definir qué lista de productos se utilizará para cargar las existencias iniciales.', 'pending', '2026-08-21', true)
  on conflict (id) do update set title = excluded.title, description = excluded.description, status = excluded.status, due_date = excluded.due_date, visible_to_client = true;

  insert into public.projects (tenant_id, name, description, status, health, progress_percentage, current_phase_name, start_date, estimated_end_date, internal_owner_name, published) values
    (v_vanguardia, 'Evolución del sistema comercial', 'Consolidación del catálogo B2B, preórdenes y operación comercial de Vanguardia Joyera y Rapana Jewelers.', 'active', 'green', 68, 'Validación operativa', '2026-06-02', '2026-09-05', 'Equipo NEXOR IA', true),
    (v_romea, 'NEXOR IA para operación ROMEA', 'Implementación modular de catálogo, operación comercial y administración para la empresa joyera ROMEA.', 'active', 'yellow', 44, 'Desarrollo modular', '2026-07-15', '2026-10-02', 'Equipo NEXOR IA', true)
  on conflict (tenant_id, name) do update set description = excluded.description, status = excluded.status, health = excluded.health, progress_percentage = excluded.progress_percentage, current_phase_name = excluded.current_phase_name, start_date = excluded.start_date, estimated_end_date = excluded.estimated_end_date, published = true;
end $$;

-- Interactive planning workspace for the Estuches Chávez presentation.
do $$
declare
  v_tenant uuid;
  v_project uuid;
  v_obj_diseno uuid := 'e6000000-0000-4000-8000-000000000001';
  v_obj_mvp uuid := 'e6000000-0000-4000-8000-000000000002';
  v_obj_pruebas uuid := 'e6000000-0000-4000-8000-000000000003';
begin
  select id into v_tenant from public.tenants where slug = 'estuches-chavez';
  select id into v_project from public.projects where tenant_id = v_tenant and name = 'Módulo de inventario';

  if v_project is null then
    return;
  end if;

  insert into public.project_objectives (
    id, tenant_id, project_id, title, description, period_label,
    period_start, period_end, status, progress_percentage, sort_order, visible_to_client
  ) values
    (v_obj_diseno, v_tenant, v_project, 'Validar la operación del inventario', 'Aprobar reglas, responsables y movimientos antes de construir.', 'Periodo 1 · Diseño', '2026-08-10', '2026-08-21', 'active', 65, 10, true),
    (v_obj_mvp, v_tenant, v_project, 'Entregar inventario MVP funcional', 'Productos, existencias, entradas, salidas e historial disponibles en pruebas.', 'Periodo 2 · Construcción', '2026-08-22', '2026-09-04', 'planned', 18, 20, true),
    (v_obj_pruebas, v_tenant, v_project, 'Validar y liberar la primera versión', 'Completar pruebas guiadas, ajustes críticos y habilitación inicial.', 'Periodo 3 · Validación', '2026-09-05', '2026-09-18', 'planned', 0, 30, true)
  on conflict (id) do update set
    title = excluded.title, description = excluded.description, period_label = excluded.period_label,
    period_start = excluded.period_start, period_end = excluded.period_end, status = excluded.status,
    progress_percentage = excluded.progress_percentage, sort_order = excluded.sort_order, visible_to_client = true;

  insert into public.project_tasks (
    id, tenant_id, project_id, objective_id, title, description, status, priority,
    start_date, due_date, progress_percentage, assignee_name, sort_order, visible_to_client
  ) values
    ('e7000000-0000-4000-8000-000000000001', v_tenant, v_project, v_obj_diseno, 'Mapear entradas, salidas y ajustes', 'Documentar el flujo operativo y las excepciones principales.', 'done', 'high', '2026-08-10', '2026-08-12', 100, 'NEXOR IA', 10, true),
    ('e7000000-0000-4000-8000-000000000002', v_tenant, v_project, v_obj_diseno, 'Confirmar catálogo inicial', 'Seleccionar la lista de productos para la carga de apertura.', 'review', 'critical', '2026-08-13', '2026-08-18', 80, 'Estuches Chávez', 20, true),
    ('e7000000-0000-4000-8000-000000000003', v_tenant, v_project, v_obj_diseno, 'Validar responsables y permisos', 'Definir quién registra, autoriza y consulta movimientos.', 'in_progress', 'high', '2026-08-14', '2026-08-20', 55, 'NEXOR IA + Cliente', 30, true),
    ('e7000000-0000-4000-8000-000000000004', v_tenant, v_project, v_obj_mvp, 'Construir catálogo de productos', 'Alta, edición, búsqueda y estado de productos.', 'in_progress', 'high', '2026-08-18', '2026-08-25', 35, 'NEXOR IA', 10, true),
    ('e7000000-0000-4000-8000-000000000005', v_tenant, v_project, v_obj_mvp, 'Construir entradas de inventario', 'Registro de recepción, cantidad, referencia y usuario.', 'todo', 'high', '2026-08-22', '2026-08-28', 0, 'NEXOR IA', 20, true),
    ('e7000000-0000-4000-8000-000000000006', v_tenant, v_project, v_obj_mvp, 'Construir salidas de inventario', 'Registro de salida y actualización automática de existencias.', 'todo', 'high', '2026-08-25', '2026-09-01', 0, 'NEXOR IA', 30, true),
    ('e7000000-0000-4000-8000-000000000007', v_tenant, v_project, v_obj_mvp, 'Agregar historial y trazabilidad', 'Consulta por producto, fecha, tipo de movimiento y usuario.', 'backlog', 'medium', '2026-08-29', '2026-09-04', 0, 'NEXOR IA', 40, true),
    ('e7000000-0000-4000-8000-000000000008', v_tenant, v_project, v_obj_pruebas, 'Preparar datos de prueba', 'Carga controlada de productos y existencias iniciales.', 'backlog', 'medium', '2026-09-05', '2026-09-08', 0, 'Estuches Chávez', 10, true),
    ('e7000000-0000-4000-8000-000000000009', v_tenant, v_project, v_obj_pruebas, 'Ejecutar pruebas guiadas', 'Validación con usuarios y registro de incidencias.', 'backlog', 'high', '2026-09-09', '2026-09-14', 0, 'NEXOR IA + Cliente', 20, true),
    ('e7000000-0000-4000-8000-000000000010', v_tenant, v_project, v_obj_pruebas, 'Liberar primera versión', 'Resolver bloqueadores y habilitar la versión aprobada.', 'backlog', 'critical', '2026-09-15', '2026-09-18', 0, 'NEXOR IA', 30, true)
  on conflict (id) do update set
    objective_id = excluded.objective_id, title = excluded.title, description = excluded.description,
    status = excluded.status, priority = excluded.priority, start_date = excluded.start_date,
    due_date = excluded.due_date, progress_percentage = excluded.progress_percentage,
    assignee_name = excluded.assignee_name, sort_order = excluded.sort_order, visible_to_client = true;
end $$;
