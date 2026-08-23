-- REFERENCE ONLY. DO NOT EXECUTE DIRECTLY.
-- Staging was promoted through migration
-- 20260823144500_product_lines_tenant_unique_contract.sql on 2026-08-23.
-- Production requires a new preflight and explicit authorization.

begin;

lock table public.product_lines in share row exclusive mode;

do $$
begin
  if exists (select 1 from public.product_lines where tenant_id is null) then
    raise exception 'product_lines contains rows without tenant_id';
  end if;

  if to_regclass('public.product_lines_tenant_codigo_uidx') is null then
    raise exception 'product_lines expand index is missing';
  end if;
end
$$;

alter table public.product_lines
  alter column tenant_id set not null;

alter table public.product_lines
  drop constraint if exists product_lines_tenant_id_fkey,
  add constraint product_lines_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete restrict;

alter table public.product_lines
  drop constraint if exists product_lines_codigo_key;

commit;
