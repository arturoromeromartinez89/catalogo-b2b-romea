-- Jerarquía operativa de NEXOR IA: Cliente → Proyecto → Solución → Tarea.
-- Bloque A: se agrega lo que faltaba para operar proyectos reales sin duplicar entidades.
--   * El cliente sigue siendo public.tenants y el usuario sigue siendo public.profiles.
--   * La tarea es la única unidad de acción, producción y seguimiento.
--   * Ningún porcentaje se captura a mano en los padres: el avance se deriva desde abajo.

-- 1. Ficha del proyecto: objetivo, meta, alcance incluido y exclusiones.
alter table public.projects
  add column if not exists objective text not null default '',
  add column if not exists goal text not null default '',
  add column if not exists included_scope text[] not null default '{}',
  add column if not exists excluded_scope text[] not null default '{}';

-- 2. Peso de la solución. Uno por omisión: la interfaz no obliga a entender ponderaciones.
alter table public.project_solutions
  add column if not exists weight numeric(8, 2) not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_solutions_weight_check') then
    alter table public.project_solutions
      add constraint project_solutions_weight_check check (weight > 0);
  end if;
end $$;

-- 3. Tarea, responsable real y peso.
alter table public.project_tasks
  add column if not exists assignee_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists weight numeric(8, 2) not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_tasks_weight_check') then
    alter table public.project_tasks
      add constraint project_tasks_weight_check check (weight > 0);
  end if;
end $$;

create index if not exists idx_project_tasks_assignee on public.project_tasks(assignee_profile_id, status);

-- 4. Equipo interno del proyecto. No es un segundo sistema de usuarios: apunta a profiles.
create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  project_role text not null default 'colaborador'
    check (project_role in ('responsable', 'colaborador', 'revisor')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, profile_id)
);

create index if not exists idx_project_members_project on public.project_members(project_id, active);
create index if not exists idx_project_members_profile on public.project_members(profile_id, active);

alter table public.project_members enable row level security;

drop policy if exists "superadmins manage project members" on public.project_members;
create policy "superadmins manage project members" on public.project_members
for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists "members read own project membership" on public.project_members;
create policy "members read own project membership" on public.project_members
for select to authenticated using (profile_id = auth.uid());

grant select, insert, update, delete on public.project_members to authenticated;

-- 5. El equipo hereda la maquinaria existente de tenant, updated_at y auditoría.
do $$
begin
  drop trigger if exists project_hub_touch_updated_at on public.project_members;
  create trigger project_hub_touch_updated_at before update on public.project_members
  for each row execute function public.project_hub_touch_updated_at();

  drop trigger if exists project_hub_validate_tenant on public.project_members;
  create trigger project_hub_validate_tenant before insert or update on public.project_members
  for each row execute function public.project_hub_validate_child_tenant();

  drop trigger if exists project_hub_audit_event on public.project_members;
  create trigger project_hub_audit_event after insert or update or delete on public.project_members
  for each row execute function public.project_hub_write_audit_event();
end $$;

comment on table public.project_members is 'Equipo interno NEXOR asignado a un proyecto. Referencia profiles; no duplica usuarios.';
comment on column public.project_tasks.assignee_profile_id is 'Responsable real ligado a profiles. assignee_name queda como respaldo heredado.';
comment on column public.project_tasks.weight is 'Peso operativo de la tarea. Uno por omisión.';
comment on column public.project_solutions.weight is 'Peso operativo de la solución dentro del proyecto. Uno por omisión.';
comment on column public.projects.objective is 'Objetivo acordado del proyecto.';
comment on column public.projects.goal is 'Meta medible del proyecto.';
comment on column public.projects.included_scope is 'Alcance incluido, una entrada por compromiso.';
comment on column public.projects.excluded_scope is 'Exclusiones explícitas del alcance.';
