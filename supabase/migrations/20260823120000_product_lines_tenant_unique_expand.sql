-- Expand phase: provide the conflict target used by tenant-aware application
-- writes. The legacy global unique constraint remains until the new frontend
-- has been deployed and observed. See supabase/rollouts/product_lines_contract.sql.

begin;

lock table public.product_lines in share row exclusive mode;

do $$
begin
  if exists (select 1 from public.product_lines where tenant_id is null) then
    raise exception 'product_lines contains rows without tenant_id';
  end if;

  if exists (
    select 1
    from public.product_lines
    group by tenant_id, codigo
    having count(*) > 1
  ) then
    raise exception 'product_lines contains duplicate (tenant_id, codigo) rows';
  end if;
end
$$;

create unique index if not exists product_lines_tenant_codigo_uidx
  on public.product_lines (tenant_id, codigo);

comment on index public.product_lines_tenant_codigo_uidx is
  'Tenant-scoped conflict target; expand phase 2026-08-23.';

commit;
