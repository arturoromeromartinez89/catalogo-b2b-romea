-- NEXOR IA Project Planning Workspace.
-- Objectives, tasks, Kanban movement, comments and private task attachments.

create table if not exists public.project_objectives (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 180),
  description text not null default '',
  period_label text not null default '',
  period_start date not null,
  period_end date not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'at_risk')),
  progress_percentage integer not null default 0 check (progress_percentage between 0 and 100),
  sort_order integer not null default 0,
  visible_to_client boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  objective_id uuid references public.project_objectives(id) on delete set null,
  phase_id uuid references public.project_phases(id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 180),
  description text not null default '',
  status text not null default 'todo' check (status in ('backlog', 'todo', 'in_progress', 'review', 'done', 'blocked')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  start_date date,
  due_date date,
  progress_percentage integer not null default 0 check (progress_percentage between 0 and 100),
  assignee_name text not null default '',
  sort_order numeric(12, 3) not null default 0,
  visible_to_client boolean not null default true,
  client_can_move boolean not null default true,
  client_can_comment boolean not null default true,
  client_can_upload boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date)
);

create table if not exists public.project_task_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  visible_to_client boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.project_task_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  file_name text not null check (char_length(trim(file_name)) between 1 and 240),
  storage_path text not null unique,
  mime_type text not null default 'application/octet-stream',
  file_size bigint not null default 0 check (file_size between 0 and 26214400),
  visible_to_client boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_objectives_project on public.project_objectives(project_id, sort_order, period_start);
create index if not exists idx_project_tasks_project_status on public.project_tasks(project_id, status, sort_order);
create index if not exists idx_project_tasks_dates on public.project_tasks(project_id, start_date, due_date);
create index if not exists idx_project_task_comments_task on public.project_task_comments(task_id, created_at);
create index if not exists idx_project_task_attachments_task on public.project_task_attachments(task_id, created_at);

create or replace function public.project_planning_validate_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.projects p
    where p.id = new.project_id and p.tenant_id = new.tenant_id
  ) then
    raise exception 'project_id and tenant_id must belong to the same tenant';
  end if;
  if new.objective_id is not null and not exists (
    select 1 from public.project_objectives o
    where o.id = new.objective_id and o.project_id = new.project_id and o.tenant_id = new.tenant_id
  ) then
    raise exception 'objective_id must belong to the same project and tenant';
  end if;
  if new.phase_id is not null and not exists (
    select 1 from public.project_phases ph
    where ph.id = new.phase_id and ph.project_id = new.project_id and ph.tenant_id = new.tenant_id
  ) then
    raise exception 'phase_id must belong to the same project and tenant';
  end if;
  return new;
end;
$$;

create or replace function public.project_planning_validate_task_child()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.project_tasks task
    where task.id = new.task_id
      and task.project_id = new.project_id
      and task.tenant_id = new.tenant_id
  ) then
    raise exception 'task_id, project_id and tenant_id must belong together';
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['project_objectives'] loop
    execute format('drop trigger if exists project_hub_validate_tenant on public.%I', table_name);
    execute format('create trigger project_hub_validate_tenant before insert or update on public.%I for each row execute function public.project_hub_validate_child_tenant()', table_name);
  end loop;

  drop trigger if exists project_planning_validate_task on public.project_tasks;
  create trigger project_planning_validate_task before insert or update on public.project_tasks
  for each row execute function public.project_planning_validate_task();

  foreach table_name in array array['project_task_comments', 'project_task_attachments'] loop
    execute format('drop trigger if exists project_planning_validate_task_child on public.%I', table_name);
    execute format('create trigger project_planning_validate_task_child before insert or update on public.%I for each row execute function public.project_planning_validate_task_child()', table_name);
  end loop;

  foreach table_name in array array['project_objectives', 'project_tasks'] loop
    execute format('drop trigger if exists project_hub_touch_updated_at on public.%I', table_name);
    execute format('create trigger project_hub_touch_updated_at before update on public.%I for each row execute function public.project_hub_touch_updated_at()', table_name);
  end loop;
end $$;

alter table public.project_objectives enable row level security;
alter table public.project_tasks enable row level security;
alter table public.project_task_comments enable row level security;
alter table public.project_task_attachments enable row level security;

create policy "superadmins manage project objectives" on public.project_objectives
for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "tenant admins read project objectives" on public.project_objectives
for select to authenticated using (
  visible_to_client is true and tenant_id = public.current_tenant_id() and public.is_tenant_admin()
  and exists (select 1 from public.projects p where p.id = project_id and p.tenant_id = project_objectives.tenant_id and p.published is true)
);

create policy "superadmins manage project tasks" on public.project_tasks
for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "tenant admins read project tasks" on public.project_tasks
for select to authenticated using (
  visible_to_client is true and tenant_id = public.current_tenant_id() and public.is_tenant_admin()
  and exists (select 1 from public.projects p where p.id = project_id and p.tenant_id = project_tasks.tenant_id and p.published is true)
);

create policy "superadmins manage project task comments" on public.project_task_comments
for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "tenant admins read task comments" on public.project_task_comments
for select to authenticated using (
  visible_to_client is true and tenant_id = public.current_tenant_id() and public.is_tenant_admin()
  and exists (
    select 1 from public.project_tasks task join public.projects p on p.id = task.project_id
    where task.id = task_id and task.tenant_id = project_task_comments.tenant_id
      and task.visible_to_client is true and p.published is true
  )
);
create policy "tenant admins add task comments" on public.project_task_comments
for insert to authenticated with check (
  created_by = auth.uid() and tenant_id = public.current_tenant_id() and public.is_tenant_admin()
  and exists (
    select 1 from public.project_tasks task join public.projects p on p.id = task.project_id
    where task.id = task_id and task.tenant_id = project_task_comments.tenant_id
      and task.visible_to_client is true and task.client_can_comment is true and p.published is true
  )
);

create policy "superadmins manage project task attachments" on public.project_task_attachments
for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "tenant admins read task attachments" on public.project_task_attachments
for select to authenticated using (
  visible_to_client is true and tenant_id = public.current_tenant_id() and public.is_tenant_admin()
  and exists (
    select 1 from public.project_tasks task join public.projects p on p.id = task.project_id
    where task.id = task_id and task.tenant_id = project_task_attachments.tenant_id
      and task.visible_to_client is true and p.published is true
  )
);
create policy "tenant admins add task attachments" on public.project_task_attachments
for insert to authenticated with check (
  created_by = auth.uid() and tenant_id = public.current_tenant_id() and public.is_tenant_admin()
  and exists (
    select 1 from public.project_tasks task join public.projects p on p.id = task.project_id
    where task.id = task_id and task.tenant_id = project_task_attachments.tenant_id
      and task.visible_to_client is true and task.client_can_upload is true and p.published is true
  )
);
create policy "tenant admins delete own task attachments" on public.project_task_attachments
for delete to authenticated using (
  created_by = auth.uid() and tenant_id = public.current_tenant_id() and public.is_tenant_admin()
);

create or replace function public.move_project_task(
  p_task_id uuid,
  p_status text,
  p_sort_order numeric default 0
)
returns public.project_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.project_tasks%rowtype;
begin
  if p_status not in ('backlog', 'todo', 'in_progress', 'review', 'done', 'blocked') then
    raise exception 'Invalid task status';
  end if;
  if not public.is_tenant_admin() then
    raise exception 'Not authorized';
  end if;

  update public.project_tasks task
  set status = p_status,
      sort_order = greatest(0, coalesce(p_sort_order, 0)),
      progress_percentage = case
        when p_status = 'done' then 100
        when task.status = 'done' and p_status <> 'done' then least(task.progress_percentage, 90)
        else task.progress_percentage
      end
  from public.projects project
  where task.id = p_task_id
    and task.project_id = project.id
    and task.tenant_id = public.current_tenant_id()
    and task.visible_to_client is true
    and task.client_can_move is true
    and project.published is true
  returning task.* into result;

  if result.id is null then
    raise exception 'Task not found or cannot be moved';
  end if;
  return result;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-hub-files',
  'project-hub-files',
  false,
  26214400,
  array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
    'text/plain', 'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "superadmins manage project hub files" on storage.objects
for all to authenticated
using (bucket_id = 'project-hub-files' and public.is_superadmin())
with check (bucket_id = 'project-hub-files' and public.is_superadmin());

create policy "tenant admins read project hub files" on storage.objects
for select to authenticated using (
  bucket_id = 'project-hub-files'
  and public.is_tenant_admin()
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
  and exists (
    select 1 from public.project_tasks task join public.projects p on p.id = task.project_id
    where task.id::text = (storage.foldername(name))[3]
      and task.project_id::text = (storage.foldername(name))[2]
      and task.tenant_id = public.current_tenant_id()
      and task.visible_to_client is true and p.published is true
  )
);

create policy "tenant admins upload project hub files" on storage.objects
for insert to authenticated with check (
  bucket_id = 'project-hub-files'
  and public.is_tenant_admin()
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
  and exists (
    select 1 from public.project_tasks task join public.projects p on p.id = task.project_id
    where task.id::text = (storage.foldername(name))[3]
      and task.project_id::text = (storage.foldername(name))[2]
      and task.tenant_id = public.current_tenant_id()
      and task.visible_to_client is true and task.client_can_upload is true and p.published is true
  )
);

create policy "tenant admins delete own project hub files" on storage.objects
for delete to authenticated using (
  bucket_id = 'project-hub-files'
  and public.is_tenant_admin()
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
  and exists (
    select 1 from public.project_task_attachments attachment
    where attachment.storage_path = name and attachment.created_by = auth.uid()
  )
);

revoke all on function public.project_planning_validate_task() from public, anon, authenticated;
revoke all on function public.project_planning_validate_task_child() from public, anon, authenticated;
revoke all on function public.move_project_task(uuid, text, numeric) from public, anon;
grant execute on function public.move_project_task(uuid, text, numeric) to authenticated;

grant select, insert, update, delete on public.project_objectives to authenticated;
grant select, insert, update, delete on public.project_tasks to authenticated;
grant select, insert, update, delete on public.project_task_comments to authenticated;
grant select, insert, update, delete on public.project_task_attachments to authenticated;

comment on table public.project_objectives is 'Client-visible objectives grouped by specific delivery periods.';
comment on table public.project_tasks is 'Single task source rendered as Gantt rows and Kanban cards.';
comment on function public.move_project_task(uuid, text, numeric) is 'Allows tenant administrators to move client-visible tasks without broader update rights.';
