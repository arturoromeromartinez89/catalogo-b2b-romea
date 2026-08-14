-- NEXOR IA Project Hub MVP.
-- Client-facing project tracking for tenant administrators, managed by NEXOR superadmins.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'on_hold', 'completed', 'cancelled')),
  health text not null default 'green' check (health in ('green', 'yellow', 'red')),
  progress_percentage integer not null default 0 check (progress_percentage between 0 and 100),
  current_phase_name text not null default '',
  start_date date,
  estimated_end_date date,
  actual_end_date date,
  internal_owner_name text not null default 'Equipo NEXOR IA',
  published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name),
  check (estimated_end_date is null or start_date is null or estimated_end_date >= start_date)
);

create table if not exists public.project_phases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '',
  sort_order integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'blocked')),
  progress_percentage integer not null default 0 check (progress_percentage between 0 and 100),
  start_date date,
  estimated_end_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, sort_order)
);

create table if not exists public.project_updates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text not null default '',
  update_type text not null default 'progress' check (update_type in ('progress', 'milestone', 'information', 'warning')),
  visible_to_client boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_deliverables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text not null default '',
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'delivered', 'approved')),
  estimated_delivery_date date,
  delivered_at timestamptz,
  approved_at timestamptz,
  external_url text,
  visible_to_client boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_deliverables_https_url check (external_url is null or external_url ~* '^https://')
);

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  document_type text not null default 'other' check (document_type in ('contract', 'proposal', 'scope', 'nda', 'invoice', 'manual', 'technical', 'other')),
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text not null default '',
  external_url text,
  visible_to_client boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_documents_https_url check (external_url is null or external_url ~* '^https://')
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_deliverables_https_url') then
    alter table public.project_deliverables
      add constraint project_deliverables_https_url check (external_url is null or external_url ~* '^https://');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'project_documents_https_url') then
    alter table public.project_documents
      add constraint project_documents_https_url check (external_url is null or external_url ~* '^https://');
  end if;
end $$;

create table if not exists public.project_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'resolved')),
  due_date date,
  requested_by uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  client_comment text not null default '',
  visible_to_client boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_tenant on public.projects(tenant_id, status, published);
create index if not exists idx_project_phases_project on public.project_phases(project_id, sort_order);
create index if not exists idx_project_updates_project on public.project_updates(project_id, created_at desc);
create index if not exists idx_project_deliverables_project on public.project_deliverables(project_id, estimated_delivery_date);
create index if not exists idx_project_documents_project on public.project_documents(project_id, document_type);
create index if not exists idx_project_approvals_project on public.project_approvals(project_id, status, due_date);

create or replace function public.project_hub_validate_child_tenant()
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
  return new;
end;
$$;

create or replace function public.project_hub_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'projects', 'project_phases', 'project_updates', 'project_deliverables',
    'project_documents', 'project_approvals'
  ] loop
    execute format('drop trigger if exists project_hub_touch_updated_at on public.%I', table_name);
    execute format(
      'create trigger project_hub_touch_updated_at before update on public.%I for each row execute function public.project_hub_touch_updated_at()',
      table_name
    );
  end loop;

  foreach table_name in array array[
    'project_phases', 'project_updates', 'project_deliverables',
    'project_documents', 'project_approvals'
  ] loop
    execute format('drop trigger if exists project_hub_validate_tenant on public.%I', table_name);
    execute format(
      'create trigger project_hub_validate_tenant before insert or update on public.%I for each row execute function public.project_hub_validate_child_tenant()',
      table_name
    );
  end loop;
end $$;

alter table public.projects enable row level security;
alter table public.project_phases enable row level security;
alter table public.project_updates enable row level security;
alter table public.project_deliverables enable row level security;
alter table public.project_documents enable row level security;
alter table public.project_approvals enable row level security;

-- NEXOR owns and publishes project information.
create policy "superadmins manage projects" on public.projects
for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

create policy "tenant admins read published projects" on public.projects
for select to authenticated using (
  published is true
  and tenant_id = public.current_tenant_id()
  and public.is_tenant_admin()
);

-- A table is client-visible only when both the project and the item are published.
create policy "superadmins manage project phases" on public.project_phases
for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "tenant admins read project phases" on public.project_phases
for select to authenticated using (
  tenant_id = public.current_tenant_id() and public.is_tenant_admin()
  and exists (select 1 from public.projects p where p.id = project_id and p.tenant_id = project_phases.tenant_id and p.published is true)
);

create policy "superadmins manage project updates" on public.project_updates
for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "tenant admins read project updates" on public.project_updates
for select to authenticated using (
  visible_to_client is true and tenant_id = public.current_tenant_id() and public.is_tenant_admin()
  and exists (select 1 from public.projects p where p.id = project_id and p.tenant_id = project_updates.tenant_id and p.published is true)
);

create policy "superadmins manage project deliverables" on public.project_deliverables
for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "tenant admins read project deliverables" on public.project_deliverables
for select to authenticated using (
  visible_to_client is true and tenant_id = public.current_tenant_id() and public.is_tenant_admin()
  and exists (select 1 from public.projects p where p.id = project_id and p.tenant_id = project_deliverables.tenant_id and p.published is true)
);

create policy "superadmins manage project documents" on public.project_documents
for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "tenant admins read project documents" on public.project_documents
for select to authenticated using (
  visible_to_client is true and tenant_id = public.current_tenant_id() and public.is_tenant_admin()
  and exists (select 1 from public.projects p where p.id = project_id and p.tenant_id = project_documents.tenant_id and p.published is true)
);

create policy "superadmins manage project approvals" on public.project_approvals
for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "tenant admins read project approvals" on public.project_approvals
for select to authenticated using (
  visible_to_client is true and tenant_id = public.current_tenant_id() and public.is_tenant_admin()
  and exists (select 1 from public.projects p where p.id = project_id and p.tenant_id = project_approvals.tenant_id and p.published is true)
);

create or replace function public.respond_project_approval(
  p_approval_id uuid,
  p_status text,
  p_comment text default ''
)
returns public.project_approvals
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.project_approvals%rowtype;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'Approval response must be approved or rejected';
  end if;
  if not public.is_tenant_admin() then
    raise exception 'Not authorized';
  end if;

  update public.project_approvals approval
  set status = p_status,
      client_comment = left(coalesce(p_comment, ''), 2000),
      resolved_by = auth.uid(),
      resolved_at = now()
  from public.projects project
  where approval.id = p_approval_id
    and approval.project_id = project.id
    and approval.tenant_id = public.current_tenant_id()
    and approval.visible_to_client is true
    and approval.status = 'pending'
    and project.published is true
  returning approval.* into result;

  if result.id is null then
    raise exception 'Approval not found or not available';
  end if;
  return result;
end;
$$;

revoke all on function public.project_hub_validate_child_tenant() from public, anon, authenticated;
revoke all on function public.project_hub_touch_updated_at() from public, anon, authenticated;
revoke all on function public.respond_project_approval(uuid, text, text) from public, anon;
grant execute on function public.respond_project_approval(uuid, text, text) to authenticated;

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_phases to authenticated;
grant select, insert, update, delete on public.project_updates to authenticated;
grant select, insert, update, delete on public.project_deliverables to authenticated;
grant select, insert, update, delete on public.project_documents to authenticated;
grant select, insert, update, delete on public.project_approvals to authenticated;

comment on table public.projects is 'Client-facing project summaries managed by NEXOR IA.';
comment on column public.project_updates.visible_to_client is 'Only curated updates are visible to tenant administrators.';
