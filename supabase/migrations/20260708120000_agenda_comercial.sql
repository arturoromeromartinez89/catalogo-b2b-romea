-- Agenda Comercial (Nexor): tablero semanal de tareas comerciales/administrativas
-- por tenant, objetivos de mes/semana y seguimiento por cliente.
-- El rollover de tareas vencidas es logica de consulta (sin cron): la UI trae
-- pendientes con task_date < hoy y las muestra en la columna de hoy.

-- ── Rol comercial ────────────────────────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['superadmin', 'tenant_admin', 'admin', 'client', 'comercial']));

-- ── Flag de modulo por tenant ────────────────────────────────────────────────
alter table public.tenant_features
  add column if not exists modulo_agenda boolean not null default false;

-- ── Helper RLS: miembro con acceso a la agenda ───────────────────────────────
create or replace function public.is_agenda_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active is true
      and p.role in ('tenant_admin', 'admin', 'comercial')
  );
$$;

revoke all on function public.is_agenda_member() from public, anon;
grant execute on function public.is_agenda_member() to authenticated;

-- ── Objetivos (mes y semana) ─────────────────────────────────────────────────
create table if not exists public.agenda_objectives (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  period_type text not null check (period_type in ('month', 'week')),
  period_key text not null,            -- '2026-07' o '2026-W28'
  title text not null,
  position int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_agenda_objectives_org
  on public.agenda_objectives (tenant_id, period_type, period_key, position);

-- ── Tareas ───────────────────────────────────────────────────────────────────
create table if not exists public.agenda_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  task_date date not null,             -- fecha objetivo (columna del tablero)
  category text not null check (category in ('comercial', 'administrativo')),
  client_id uuid references public.clients(id) on delete set null,
  objective_id uuid references public.agenda_objectives(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'done', 'cancelled')),
  completed_at timestamptz,
  assignee_id uuid references public.profiles(id) on delete set null,
  position int not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint agenda_client_only_comercial check (category = 'comercial' or client_id is null)
);

create index if not exists idx_agenda_tasks_org_date
  on public.agenda_tasks (tenant_id, task_date, status);
create index if not exists idx_agenda_tasks_client
  on public.agenda_tasks (tenant_id, client_id) where client_id is not null;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.agenda_objectives enable row level security;
alter table public.agenda_tasks enable row level security;

drop policy if exists "agenda objectives read by members" on public.agenda_objectives;
create policy "agenda objectives read by members"
on public.agenda_objectives for select to authenticated
using (
  public.is_superadmin()
  or (public.is_agenda_member() and tenant_id = public.current_tenant_id())
);

drop policy if exists "agenda objectives managed by tenant admin" on public.agenda_objectives;
create policy "agenda objectives managed by tenant admin"
on public.agenda_objectives for all to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

drop policy if exists "agenda tasks managed by members" on public.agenda_tasks;
create policy "agenda tasks managed by members"
on public.agenda_tasks for all to authenticated
using (
  public.is_superadmin()
  or (public.is_agenda_member() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_agenda_member() and tenant_id = public.current_tenant_id())
);

-- ── El rol comercial puede LEER clientes de su tenant (no modificarlos) ──────
-- Necesario para el selector de cliente y el panel de seguimiento.
drop policy if exists "comercial reads clients" on public.clients;
create policy "comercial reads clients"
on public.clients for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active is true and p.role = 'comercial'
  )
);

-- ── Seguimiento por cliente: vista, no tabla ─────────────────────────────────
-- security_invoker: la vista respeta la RLS de clients y agenda_tasks del
-- usuario que consulta (sin esto filtraria datos entre tenants).
create or replace view public.client_followup_summary
with (security_invoker = true) as
select
  c.tenant_id,
  c.id as client_id,
  c.name,
  c.company,
  count(t.id) filter (where t.status = 'pending') as pendientes,
  count(t.id) filter (where t.status = 'done') as completadas,
  max(coalesce(t.completed_at, t.created_at)) as ultima_actividad
from public.clients c
left join public.agenda_tasks t on t.client_id = c.id and t.tenant_id = c.tenant_id
group by c.tenant_id, c.id, c.name, c.company;

grant select on public.client_followup_summary to authenticated;

-- ── Seed: activar agenda para Vanguardia Joyera ──────────────────────────────
insert into public.tenant_features (tenant_id, modulo_agenda)
select id, true from public.tenants where slug = 'vanguardia-joyera'
on conflict (tenant_id) do update set modulo_agenda = true, updated_at = now();

notify pgrst, 'reload schema';
