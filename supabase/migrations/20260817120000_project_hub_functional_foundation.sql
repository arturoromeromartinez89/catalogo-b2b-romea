-- NEXOR IA Project Hub functional foundation.
-- Adds the source-of-truth entities required by the first complete project vertical.

create table if not exists public.project_solutions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  phase_id uuid references public.project_phases(id) on delete set null,
  name text not null check (char_length(trim(name)) between 1 and 180),
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'planned', 'in_progress', 'waiting', 'needs_changes', 'completed', 'cancelled')),
  stage_name text not null default '',
  current_phase_name text not null default '',
  next_milestone text not null default '',
  scope_items text[] not null default '{}',
  start_date date,
  estimated_end_date date,
  completed_at timestamptz,
  sort_order integer not null default 0,
  visible_to_client boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name),
  check (estimated_end_date is null or start_date is null or estimated_end_date >= start_date)
);

alter table public.project_deliverables
  add column if not exists solution_id uuid references public.project_solutions(id) on delete set null,
  add column if not exists weight numeric(8, 2) not null default 1 check (weight > 0);

alter table public.project_approvals
  add column if not exists solution_id uuid references public.project_solutions(id) on delete set null,
  add column if not exists deliverable_id uuid references public.project_deliverables(id) on delete set null,
  add column if not exists decision_type text not null default 'general' check (decision_type in ('general', 'solution_brief', 'deliverable_acceptance', 'scope_change'));

alter table public.project_documents
  add column if not exists solution_id uuid references public.project_solutions(id) on delete set null;

alter table public.project_tasks
  add column if not exists solution_id uuid references public.project_solutions(id) on delete set null,
  add column if not exists deliverable_id uuid references public.project_deliverables(id) on delete set null,
  add column if not exists estimated_hours numeric(8, 2) check (estimated_hours is null or estimated_hours >= 0),
  add column if not exists completed_at timestamptz;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'project_tasks_status_check') then
    alter table public.project_tasks drop constraint project_tasks_status_check;
  end if;
  alter table public.project_tasks
    add constraint project_tasks_status_check check (status in ('backlog', 'todo', 'in_progress', 'review', 'done', 'blocked', 'cancelled'));
exception when duplicate_object then null;
end $$;

create table if not exists public.project_solution_brief_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  solution_id uuid not null references public.project_solutions(id) on delete cascade,
  version_number integer not null default 1 check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'needs_changes', 'superseded')),
  problem text not null default '',
  objective text not null default '',
  current_process text not null default '',
  proposed_process text not null default '',
  included_scope text[] not null default '{}',
  excluded_scope text[] not null default '{}',
  users_and_permissions text not null default '',
  impacts text not null default '',
  assumptions_and_risks text not null default '',
  summary_pdf_url text,
  visible_to_client boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (solution_id, version_number),
  constraint project_solution_brief_https_url check (summary_pdf_url is null or summary_pdf_url ~* '^https://')
);

create table if not exists public.project_acceptance_criteria (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  solution_id uuid not null references public.project_solutions(id) on delete cascade,
  deliverable_id uuid references public.project_deliverables(id) on delete cascade,
  description text not null check (char_length(trim(description)) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'needs_changes', 'not_applicable')),
  sort_order integer not null default 0,
  accepted_at timestamptz,
  visible_to_client boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_time_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  solution_id uuid references public.project_solutions(id) on delete set null,
  task_id uuid references public.project_tasks(id) on delete set null,
  work_date date not null default current_date,
  minutes integer not null check (minutes between 1 and 1440),
  description text not null default '',
  contributor_name text not null default '',
  visible_to_client boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_development_activity (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  solution_id uuid references public.project_solutions(id) on delete set null,
  activity_date date not null default current_date,
  repository_label text not null default '',
  lines_added integer not null default 0 check (lines_added >= 0),
  lines_deleted integer not null default 0 check (lines_deleted >= 0),
  commits_count integer not null default 0 check (commits_count >= 0),
  source text not null default 'manual' check (source in ('manual', 'git_import')),
  visible_to_client boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_audit_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  event_data jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_solutions_project on public.project_solutions(project_id, sort_order, start_date);
create index if not exists idx_project_solution_briefs_solution on public.project_solution_brief_versions(solution_id, version_number desc);
create index if not exists idx_project_acceptance_criteria_solution on public.project_acceptance_criteria(solution_id, deliverable_id, sort_order);
create index if not exists idx_project_time_entries_project on public.project_time_entries(project_id, work_date desc);
create index if not exists idx_project_development_activity_project on public.project_development_activity(project_id, activity_date desc);
create index if not exists idx_project_audit_events_project on public.project_audit_events(project_id, created_at desc);
create index if not exists idx_project_tasks_solution on public.project_tasks(solution_id, status, sort_order);
create index if not exists idx_project_deliverables_solution on public.project_deliverables(solution_id, estimated_delivery_date);

create or replace function public.project_hub_validate_solution_relation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.solution_id is not null and not exists (
    select 1 from public.project_solutions solution
    where solution.id = new.solution_id
      and solution.project_id = new.project_id
      and solution.tenant_id = new.tenant_id
  ) then
    raise exception 'solution_id must belong to the same project and tenant';
  end if;
  if nullif(to_jsonb(new)->>'deliverable_id', '') is not null and not exists (
    select 1 from public.project_deliverables deliverable
    where deliverable.id = (to_jsonb(new)->>'deliverable_id')::uuid
      and deliverable.project_id = new.project_id
      and deliverable.tenant_id = new.tenant_id
      and (new.solution_id is null or deliverable.solution_id = new.solution_id)
  ) then
    raise exception 'deliverable_id must belong to the same project, tenant and solution';
  end if;
  return new;
end;
$$;

create or replace function public.project_planning_validate_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.projects p where p.id = new.project_id and p.tenant_id = new.tenant_id) then
    raise exception 'project_id and tenant_id must belong to the same tenant';
  end if;
  if new.objective_id is not null and not exists (
    select 1 from public.project_objectives o where o.id = new.objective_id and o.project_id = new.project_id and o.tenant_id = new.tenant_id
  ) then raise exception 'objective_id must belong to the same project and tenant'; end if;
  if new.phase_id is not null and not exists (
    select 1 from public.project_phases ph where ph.id = new.phase_id and ph.project_id = new.project_id and ph.tenant_id = new.tenant_id
  ) then raise exception 'phase_id must belong to the same project and tenant'; end if;
  if new.solution_id is not null and not exists (
    select 1 from public.project_solutions s where s.id = new.solution_id and s.project_id = new.project_id and s.tenant_id = new.tenant_id
  ) then raise exception 'solution_id must belong to the same project and tenant'; end if;
  if new.deliverable_id is not null and not exists (
    select 1 from public.project_deliverables d where d.id = new.deliverable_id and d.project_id = new.project_id and d.tenant_id = new.tenant_id
      and (new.solution_id is null or d.solution_id = new.solution_id)
  ) then raise exception 'deliverable_id must belong to the same project, tenant and solution'; end if;
  if new.status = 'done' and old.status is distinct from 'done' then new.completed_at = coalesce(new.completed_at, now()); end if;
  if new.status <> 'done' then new.completed_at = null; end if;
  new.progress_percentage = case when new.status = 'done' then 100 when new.status in ('backlog', 'todo', 'cancelled') then 0 else new.progress_percentage end;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'project_solutions', 'project_solution_brief_versions', 'project_acceptance_criteria',
    'project_time_entries', 'project_development_activity', 'project_audit_events'
  ] loop
    execute format('drop trigger if exists project_hub_validate_tenant on public.%I', table_name);
    execute format('create trigger project_hub_validate_tenant before insert or update on public.%I for each row execute function public.project_hub_validate_child_tenant()', table_name);
  end loop;

  foreach table_name in array array[
    'project_deliverables', 'project_documents', 'project_approvals',
    'project_solution_brief_versions', 'project_acceptance_criteria',
    'project_time_entries', 'project_development_activity'
  ] loop
    execute format('drop trigger if exists project_hub_validate_solution_relation on public.%I', table_name);
    execute format('create trigger project_hub_validate_solution_relation before insert or update on public.%I for each row execute function public.project_hub_validate_solution_relation()', table_name);
  end loop;

  foreach table_name in array array[
    'project_solutions', 'project_solution_brief_versions', 'project_acceptance_criteria',
    'project_time_entries', 'project_development_activity'
  ] loop
    execute format('drop trigger if exists project_hub_touch_updated_at on public.%I', table_name);
    execute format('create trigger project_hub_touch_updated_at before update on public.%I for each row execute function public.project_hub_touch_updated_at()', table_name);
  end loop;
end $$;

alter table public.project_solutions enable row level security;
alter table public.project_solution_brief_versions enable row level security;
alter table public.project_acceptance_criteria enable row level security;
alter table public.project_time_entries enable row level security;
alter table public.project_development_activity enable row level security;
alter table public.project_audit_events enable row level security;

create policy "superadmins manage project solutions" on public.project_solutions
for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "tenant admins read project solutions" on public.project_solutions
for select to authenticated using (
  visible_to_client is true and tenant_id = public.current_tenant_id() and public.is_tenant_admin()
  and exists (select 1 from public.projects p where p.id = project_id and p.tenant_id = project_solutions.tenant_id and p.published is true)
);

create policy "superadmins manage solution briefs" on public.project_solution_brief_versions
for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "tenant admins read solution briefs" on public.project_solution_brief_versions
for select to authenticated using (
  visible_to_client is true and status <> 'draft' and tenant_id = public.current_tenant_id() and public.is_tenant_admin()
  and exists (select 1 from public.projects p where p.id = project_id and p.published is true)
);

create policy "superadmins manage acceptance criteria" on public.project_acceptance_criteria
for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "tenant admins read acceptance criteria" on public.project_acceptance_criteria
for select to authenticated using (
  visible_to_client is true and tenant_id = public.current_tenant_id() and public.is_tenant_admin()
  and exists (select 1 from public.projects p where p.id = project_id and p.published is true)
);

create policy "superadmins manage time entries" on public.project_time_entries
for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "tenant admins read time entries" on public.project_time_entries
for select to authenticated using (
  visible_to_client is true and tenant_id = public.current_tenant_id() and public.is_tenant_admin()
  and exists (select 1 from public.projects p where p.id = project_id and p.published is true)
);

create policy "superadmins manage development activity" on public.project_development_activity
for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "tenant admins read development activity" on public.project_development_activity
for select to authenticated using (
  visible_to_client is true and tenant_id = public.current_tenant_id() and public.is_tenant_admin()
  and exists (select 1 from public.projects p where p.id = project_id and p.published is true)
);

create policy "superadmins read audit events" on public.project_audit_events
for select to authenticated using (public.is_superadmin());
create policy "superadmins add audit events" on public.project_audit_events
for insert to authenticated with check (public.is_superadmin());

grant select, insert, update, delete on public.project_solutions to authenticated;
grant select, insert, update, delete on public.project_solution_brief_versions to authenticated;
grant select, insert, update, delete on public.project_acceptance_criteria to authenticated;
grant select, insert, update, delete on public.project_time_entries to authenticated;
grant select, insert, update, delete on public.project_development_activity to authenticated;
grant select, insert on public.project_audit_events to authenticated;
grant usage, select on sequence public.project_audit_events_id_seq to authenticated;

comment on table public.project_solutions is 'Value-producing solution units that make up a NEXOR project.';
comment on table public.project_solution_brief_versions is 'Versioned Ficha de solución records used for specification and approval.';
comment on table public.project_acceptance_criteria is 'Verifiable conditions used to accept a solution or deliverable.';
comment on table public.project_time_entries is 'Source of truth for dedicated project hours.';
comment on table public.project_development_activity is 'Recorded code activity. It is evidence, not a progress proxy.';
comment on table public.project_audit_events is 'Append-only technical audit trail, separate from curated project updates.';
