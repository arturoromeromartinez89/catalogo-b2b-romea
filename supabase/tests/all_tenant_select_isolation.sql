-- Read-only acceptance test across every direct tenant_id table. It uses the
-- production pilot tenant or the isolated staging demo tenant.
do $$
declare
  v_user_id uuid;
  v_tenant_id uuid;
  v_table record;
  v_count bigint;
begin
  select p.id, p.tenant_id
  into v_user_id, v_tenant_id
  from public.profiles p
  join public.tenants t on t.id = p.tenant_id
  where t.slug in ('estuches-chavez', 'demo-staging')
    and p.role in ('admin', 'tenant_admin')
    and coalesce(p.active, true)
  order by case when t.slug = 'demo-staging' then 0 else 1 end,
           case when p.role = 'tenant_admin' then 0 else 1 end
  limit 1;

  if v_user_id is null or v_tenant_id is null then
    raise exception 'FAIL: no active pilot or staging administrator found';
  end if;

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  for v_table in
    select c.table_name
    from information_schema.columns c
    join pg_class cls on cls.relname = c.table_name
    join pg_namespace n on n.oid = cls.relnamespace and n.nspname = c.table_schema
    where c.table_schema = 'public'
      and c.column_name = 'tenant_id'
      and cls.relrowsecurity
    order by c.table_name
  loop
    execute format(
      'select count(*) from public.%I where tenant_id is not null and tenant_id <> $1',
      v_table.table_name
    ) into v_count using v_tenant_id;

    if v_count <> 0 then
      raise exception 'FAIL: % exposed % rows from another tenant',
        v_table.table_name, v_count;
    end if;
    raise notice 'PASS: % hides other tenants', v_table.table_name;
  end loop;

  reset role;
  raise notice 'ALL PASS: direct tenant table reads are isolated';
end $$;
