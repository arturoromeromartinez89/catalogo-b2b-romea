-- Modelo operativo simplificado de NEXOR IA: Proyecto → Solución → Tarea.
-- La tarea es la única unidad de trabajo. Puede depender de otra tarea y vincular
-- evidencia técnica sin convertir commits o líneas de código en porcentaje de avance.

alter table public.project_solutions
  add column if not exists objective text not null default '',
  add column if not exists goal text not null default '',
  add column if not exists limitations text[] not null default '{}';

alter table public.project_tasks
  add column if not exists depends_on_task_id uuid references public.project_tasks(id) on delete set null,
  add column if not exists repository_url text,
  add column if not exists repository_label text,
  add column if not exists branch_name text,
  add column if not exists pull_request_url text;

alter table public.project_development_activity
  add column if not exists task_id uuid references public.project_tasks(id) on delete set null;

create index if not exists idx_project_tasks_dependency on public.project_tasks(depends_on_task_id);
create index if not exists idx_project_development_task on public.project_development_activity(task_id, activity_date);

create or replace function public.project_hub_validate_task_dependency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  dependency public.project_tasks%rowtype;
begin
  if new.depends_on_task_id is null then return new; end if;
  if new.depends_on_task_id = new.id then raise exception 'Una tarea no puede depender de sí misma.'; end if;

  select * into dependency from public.project_tasks where id = new.depends_on_task_id;
  if dependency.id is null then raise exception 'La tarea requerida no existe.'; end if;
  if dependency.tenant_id <> new.tenant_id or dependency.project_id <> new.project_id then
    raise exception 'La dependencia debe pertenecer al mismo proyecto.';
  end if;
  if dependency.solution_id is distinct from new.solution_id then
    raise exception 'La dependencia debe pertenecer a la misma solución.';
  end if;
  if new.status in ('in_progress', 'review', 'done') and dependency.status <> 'done' then
    raise exception 'Primero debe completarse la tarea requerida: %.', dependency.title;
  end if;
  if exists (
    with recursive chain as (
      select id, depends_on_task_id from public.project_tasks where id = new.depends_on_task_id
      union all
      select task.id, task.depends_on_task_id
      from public.project_tasks task join chain on task.id = chain.depends_on_task_id
    ) select 1 from chain where id = new.id
  ) then raise exception 'La dependencia crea un ciclo de tareas.'; end if;
  return new;
end;
$$;

drop trigger if exists project_hub_validate_task_dependency on public.project_tasks;
create trigger project_hub_validate_task_dependency
before insert or update on public.project_tasks
for each row execute function public.project_hub_validate_task_dependency();

revoke all on function public.project_hub_validate_task_dependency() from public, anon, authenticated;

create or replace function public.create_project_task(
  p_tenant_id uuid,
  p_project_id uuid,
  p_solution_id uuid,
  p_title text,
  p_description text default '',
  p_assignee_name text default '',
  p_status text default 'todo',
  p_priority text default 'medium',
  p_start_date date default null,
  p_due_date date default null,
  p_estimated_hours numeric default null,
  p_deliverable_id uuid default null,
  p_depends_on_task_id uuid default null,
  p_repository_url text default null,
  p_repository_label text default null,
  p_branch_name text default null
)
returns public.project_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.project_tasks%rowtype;
begin
  if not public.is_superadmin() and not (public.is_tenant_admin() and p_tenant_id = public.current_tenant_id()) then
    raise exception 'No autorizado.';
  end if;
  if not exists (select 1 from public.projects where id = p_project_id and tenant_id = p_tenant_id and (published or public.is_superadmin())) then
    raise exception 'El proyecto no existe o no está disponible.';
  end if;
  if not exists (select 1 from public.project_solutions where id = p_solution_id and project_id = p_project_id and tenant_id = p_tenant_id) then
    raise exception 'La solución no pertenece al proyecto.';
  end if;

  insert into public.project_tasks (
    tenant_id, project_id, solution_id, deliverable_id, title, description,
    assignee_name, status, priority, start_date, due_date, estimated_hours,
    depends_on_task_id, repository_url, repository_label, branch_name,
    progress_percentage, sort_order, visible_to_client, created_by
  ) values (
    p_tenant_id, p_project_id, p_solution_id, p_deliverable_id, trim(p_title), coalesce(p_description, ''),
    coalesce(p_assignee_name, ''), p_status, p_priority, p_start_date, p_due_date, p_estimated_hours,
    p_depends_on_task_id, nullif(trim(p_repository_url), ''), nullif(trim(p_repository_label), ''), nullif(trim(p_branch_name), ''),
    case when p_status = 'done' then 100 else 0 end,
    coalesce((select max(sort_order) + 10 from public.project_tasks where project_id = p_project_id), 10),
    true, auth.uid()
  ) returning * into result;
  return result;
end;
$$;

revoke all on function public.create_project_task(uuid, uuid, uuid, text, text, text, text, text, date, date, numeric, uuid, uuid, text, text, text) from public, anon;
grant execute on function public.create_project_task(uuid, uuid, uuid, text, text, text, text, text, date, date, numeric, uuid, uuid, text, text, text) to authenticated;

comment on column public.project_tasks.depends_on_task_id is 'Tarea que debe completarse antes de iniciar, revisar o completar esta tarea.';
comment on column public.project_tasks.repository_url is 'Repositorio donde se produce el trabajo técnico asociado.';
comment on column public.project_development_activity.task_id is 'Evidencia técnica vinculada a la tarea que produjo el cambio.';
