-- Manual staging verification for 20260612130000_secure_client_portal.sql.
-- Replace fixture placeholders with real staging UUIDs and run as postgres.

begin;

set local role authenticated;
set local request.jwt.claim.sub = 'TENANT_A_CLIENT_USER_ID';
set local request.jwt.claim.role = 'authenticated';

do $$
declare
  payload jsonb;
begin
  payload := public.get_client_catalog();
  if jsonb_typeof(payload->'products') <> 'array' then
    raise exception 'FAILED: client catalog did not return an array';
  end if;
  if payload::text ~* 'mo_base|labor_mxn|mano_obra|proveedor|margin|margen' then
    raise exception 'FAILED: client catalog exposed an internal commercial field';
  end if;
end
$$;

do $$
declare
  visible_rows integer;
begin
  select count(*) into visible_rows from public.product_lines;
  if visible_rows <> 0 then
    raise exception 'FAILED: client can read product_lines directly';
  end if;

  select count(*) into visible_rows from public.metal_prices;
  if visible_rows <> 0 then
    raise exception 'FAILED: client can read metal_prices directly';
  end if;

  select count(*) into visible_rows from public.client_line_margins;
  if visible_rows <> 0 then
    raise exception 'FAILED: client can read client_line_margins directly';
  end if;
end
$$;

do $$
declare
  affected integer := 0;
begin
  update public.preorders
  set total_mxn = 1, status = 'confirmada'
  where id = 'TENANT_A_CLIENT_PREORDER_ID'::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAILED: client altered preorder totals or status';
  end if;
end
$$;

do $$
declare
  affected integer := 0;
begin
  delete from public.preorder_items
  where preorder_id = 'TENANT_A_CLIENT_PREORDER_ID'::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAILED: client deleted preorder items';
  end if;
end
$$;

do $$
declare
  payload jsonb;
begin
  payload := public.get_client_preorders();
  if payload::text ~* 'labor_mxn|mo_base|mano_obra|margin|margen' then
    raise exception 'FAILED: client preorder history exposed internal pricing';
  end if;
end
$$;

rollback;

