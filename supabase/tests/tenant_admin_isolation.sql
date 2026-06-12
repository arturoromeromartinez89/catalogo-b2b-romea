-- Manual staging verification for 20260612125000_enforce_tenant_admin_isolation.sql.
-- Replace every placeholder with staging UUIDs. Run as postgres.

begin;

set local role authenticated;
set local request.jwt.claim.sub = 'TENANT_A_ADMIN_USER_ID';
set local request.jwt.claim.role = 'authenticated';

do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows
  from public.clients where tenant_id = 'TENANT_B_ID'::uuid;
  if visible_rows <> 0 then raise exception 'FAILED: tenant A admin can read tenant B clients'; end if;

  select count(*) into visible_rows
  from public.products where tenant_id = 'TENANT_B_ID'::uuid;
  if visible_rows <> 0 then raise exception 'FAILED: tenant A admin can read tenant B products'; end if;

  select count(*) into visible_rows
  from public.company_settings where tenant_id = 'TENANT_B_ID'::uuid;
  if visible_rows <> 0 then raise exception 'FAILED: tenant A admin can read tenant B settings'; end if;

  select count(*) into visible_rows
  from public.product_lines where tenant_id = 'TENANT_B_ID'::uuid;
  if visible_rows <> 0 then raise exception 'FAILED: tenant A admin can read tenant B product lines'; end if;

  select count(*) into visible_rows
  from public.metal_prices where tenant_id = 'TENANT_B_ID'::uuid;
  if visible_rows <> 0 then raise exception 'FAILED: tenant A admin can read tenant B metal prices'; end if;

  select count(*) into visible_rows
  from public.preorders where tenant_id = 'TENANT_B_ID'::uuid;
  if visible_rows <> 0 then raise exception 'FAILED: tenant A admin can read tenant B preorders'; end if;

  select count(*) into visible_rows
  from public.labor_lists where tenant_id = 'TENANT_B_ID'::uuid;
  if visible_rows <> 0 then raise exception 'FAILED: tenant A admin can read tenant B labor lists'; end if;

  select count(*) into visible_rows
  from public.quote_links where tenant_id = 'TENANT_B_ID'::uuid;
  if visible_rows <> 0 then raise exception 'FAILED: tenant A admin can read tenant B quote links'; end if;
end
$$;

do $$
declare
  affected integer;
begin
  update public.products
  set descripcion = descripcion
  where id = 'TENANT_B_PRODUCT_ID'::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAILED: tenant A admin can update a tenant B product';
  end if;
end
$$;

do $$
declare
  unsafe_count integer;
begin
  select count(*) into unsafe_count
  from pg_policies
  where schemaname = 'public'
    and (
      coalesce(qual, '') ~ '(^|[^a-z_])is_admin\(\)'
      or coalesce(with_check, '') ~ '(^|[^a-z_])is_admin\(\)'
    )
    and coalesce(qual, '') not ilike '%tenant_id%'
    and coalesce(with_check, '') not ilike '%tenant_id%';

  if unsafe_count <> 0 then
    raise exception 'FAILED: % global is_admin policies remain', unsafe_count;
  end if;
end
$$;

rollback;
