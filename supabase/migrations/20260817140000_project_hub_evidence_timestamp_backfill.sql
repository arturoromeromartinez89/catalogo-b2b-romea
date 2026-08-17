-- Ensure accepted evidence always carries a timestamp, including legacy rows.
create or replace function public.project_hub_sync_evidence_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'project_deliverables' then
    if new.status in ('delivered', 'approved') then
      new.delivered_at = coalesce(new.delivered_at, now());
    end if;
    if new.status = 'approved' then
      new.approved_at = coalesce(new.approved_at, now());
    else
      new.approved_at = null;
    end if;
  elsif tg_table_name = 'project_acceptance_criteria' then
    if new.status = 'accepted' then
      new.accepted_at = coalesce(new.accepted_at, now());
    else
      new.accepted_at = null;
    end if;
  end if;
  return new;
end;
$$;

update public.project_deliverables
set approved_at = coalesce(approved_at, updated_at),
    delivered_at = coalesce(delivered_at, updated_at)
where status = 'approved';

update public.project_deliverables
set delivered_at = coalesce(delivered_at, updated_at)
where status = 'delivered';

update public.project_acceptance_criteria
set accepted_at = coalesce(accepted_at, updated_at)
where status = 'accepted';

revoke all on function public.project_hub_sync_evidence_timestamps() from public, anon, authenticated;
