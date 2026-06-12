-- Manual security verification for 20260612120000_lock_down_profile_privileges.sql.
-- Run in staging after replacing the UUIDs below with real staging users.
-- Every attack update must affect zero rows. The final client suspension must
-- affect one row.

begin;

-- Required fixtures:
--   TENANT_ADMIN_USER_ID: tenant_admin in TENANT_A_ID
--   OTHER_ADMIN_USER_ID: tenant_admin/admin in TENANT_A_ID
--   CLIENT_USER_ID: client in TENANT_A_ID
--   OTHER_TENANT_CLIENT_USER_ID: client profile in a different tenant
--   OTHER_TENANT_CLIENT_ID: clients.id belonging to another tenant
--   OTHER_TENANT_ID: a tenant different from TENANT_A_ID

set local role authenticated;
set local request.jwt.claim.sub = 'TENANT_ADMIN_USER_ID';
set local request.jwt.claim.role = 'authenticated';

do $$
declare
  affected integer := 0;
  blocked boolean := false;
begin
  begin
    update public.profiles
    set role = 'superadmin', tenant_id = null
    where id = 'TENANT_ADMIN_USER_ID'::uuid;
    get diagnostics affected = row_count;
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked and affected <> 0 then
    raise exception 'FAILED: tenant admin promoted itself';
  end if;
end
$$;

do $$
declare
  affected integer := 0;
  blocked boolean := false;
begin
  begin
    update public.profiles
    set active = false
    where id = 'OTHER_ADMIN_USER_ID'::uuid;
    get diagnostics affected = row_count;
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked and affected <> 0 then
    raise exception 'FAILED: tenant admin suspended an administrative profile';
  end if;
end
$$;

do $$
declare
  affected integer := 0;
  blocked boolean := false;
begin
  begin
    update public.profiles
    set active = false
    where id = 'OTHER_TENANT_CLIENT_USER_ID'::uuid;
    get diagnostics affected = row_count;
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked and affected <> 0 then
    raise exception 'FAILED: tenant admin suspended another tenant client';
  end if;
end
$$;

do $$
declare
  affected integer := 0;
  blocked boolean := false;
begin
  begin
    update public.profiles
    set role = 'superadmin', tenant_id = null
    where id = 'OTHER_ADMIN_USER_ID'::uuid;
    get diagnostics affected = row_count;
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked and affected <> 0 then
    raise exception 'FAILED: tenant admin promoted another administrator';
  end if;
end
$$;

do $$
declare
  affected integer := 0;
  blocked boolean := false;
begin
  begin
    update public.profiles
    set tenant_id = 'OTHER_TENANT_ID'::uuid
    where id = 'CLIENT_USER_ID'::uuid;
    get diagnostics affected = row_count;
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked and affected <> 0 then
    raise exception 'FAILED: tenant admin moved a client to another tenant';
  end if;
end
$$;

do $$
declare
  affected integer := 0;
  blocked boolean := false;
begin
  begin
    update public.profiles
    set email = 'attacker-controlled@example.com'
    where id = 'CLIENT_USER_ID'::uuid;
    get diagnostics affected = row_count;
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked and affected <> 0 then
    raise exception 'FAILED: tenant admin changed a client identity';
  end if;
end
$$;

do $$
declare
  affected integer := 0;
  blocked boolean := false;
begin
  begin
    update public.profiles
    set client_id = 'OTHER_TENANT_CLIENT_ID'::uuid
    where id = 'CLIENT_USER_ID'::uuid;
    get diagnostics affected = row_count;
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked and affected <> 0 then
    raise exception 'FAILED: tenant admin linked a client from another tenant';
  end if;
end
$$;

do $$
declare
  affected integer := 0;
begin
  update public.profiles
  set active = false
  where id = 'CLIENT_USER_ID'::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'FAILED: legitimate client suspension affected % rows', affected;
  end if;
end
$$;

rollback;
