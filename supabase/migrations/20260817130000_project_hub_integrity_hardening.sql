-- NEXOR IA Project Hub integrity hardening.
-- Keeps hierarchy relationships tenant-safe and records technical audit evidence.

create or replace function public.project_hub_validate_solution()
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
    raise exception 'project_id and tenant_id must belong together';
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

create or replace function public.project_hub_validate_time_entry()
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
    raise exception 'project_id and tenant_id must belong together';
  end if;
  if new.solution_id is not null and not exists (
    select 1 from public.project_solutions s
    where s.id = new.solution_id and s.project_id = new.project_id and s.tenant_id = new.tenant_id
  ) then
    raise exception 'solution_id must belong to the same project and tenant';
  end if;
  if new.task_id is not null and not exists (
    select 1 from public.project_tasks t
    where t.id = new.task_id and t.project_id = new.project_id and t.tenant_id = new.tenant_id
      and (new.solution_id is null or t.solution_id = new.solution_id)
  ) then
    raise exception 'task_id must belong to the same project, tenant and solution';
  end if;
  return new;
end;
$$;

create or replace function public.project_hub_sync_evidence_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'project_deliverables' then
    if new.status in ('delivered', 'approved') and old.status is distinct from new.status then
      new.delivered_at = coalesce(new.delivered_at, now());
    end if;
    if new.status = 'approved' and old.status is distinct from 'approved' then
      new.approved_at = coalesce(new.approved_at, now());
    elsif new.status <> 'approved' then
      new.approved_at = null;
    end if;
  elsif tg_table_name = 'project_acceptance_criteria' then
    if new.status = 'accepted' and old.status is distinct from 'accepted' then
      new.accepted_at = coalesce(new.accepted_at, now());
    elsif new.status <> 'accepted' then
      new.accepted_at = null;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.project_hub_write_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  previous_data jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
begin
  insert into public.project_audit_events (
    tenant_id, project_id, entity_type, entity_id, action, event_data, actor_id
  ) values (
    (row_data->>'tenant_id')::uuid,
    (row_data->>'project_id')::uuid,
    tg_table_name,
    row_data->>'id',
    lower(tg_op),
    jsonb_strip_nulls(jsonb_build_object('before', previous_data, 'after', case when tg_op = 'DELETE' then null else row_data end)),
    auth.uid()
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  drop trigger if exists project_hub_validate_solution on public.project_solutions;
  create trigger project_hub_validate_solution before insert or update on public.project_solutions
  for each row execute function public.project_hub_validate_solution();

  drop trigger if exists project_hub_validate_time_entry on public.project_time_entries;
  create trigger project_hub_validate_time_entry before insert or update on public.project_time_entries
  for each row execute function public.project_hub_validate_time_entry();

  drop trigger if exists project_hub_sync_evidence_timestamps on public.project_deliverables;
  create trigger project_hub_sync_evidence_timestamps before insert or update on public.project_deliverables
  for each row execute function public.project_hub_sync_evidence_timestamps();

  drop trigger if exists project_hub_sync_evidence_timestamps on public.project_acceptance_criteria;
  create trigger project_hub_sync_evidence_timestamps before insert or update on public.project_acceptance_criteria
  for each row execute function public.project_hub_sync_evidence_timestamps();

  foreach table_name in array array[
    'project_solutions', 'project_solution_brief_versions', 'project_deliverables',
    'project_acceptance_criteria', 'project_tasks', 'project_time_entries',
    'project_development_activity', 'project_approvals'
  ] loop
    execute format('drop trigger if exists project_hub_audit_event on public.%I', table_name);
    execute format('create trigger project_hub_audit_event after insert or update or delete on public.%I for each row execute function public.project_hub_write_audit_event()', table_name);
  end loop;
end $$;

revoke all on function public.project_hub_validate_solution() from public, anon, authenticated;
revoke all on function public.project_hub_validate_time_entry() from public, anon, authenticated;
revoke all on function public.project_hub_sync_evidence_timestamps() from public, anon, authenticated;
revoke all on function public.project_hub_write_audit_event() from public, anon, authenticated;

comment on function public.project_hub_write_audit_event() is 'Writes immutable technical evidence without polluting the curated client update feed.';
