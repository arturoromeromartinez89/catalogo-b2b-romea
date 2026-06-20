do $$
begin
  if to_regprocedure('public.get_client_catalog()') is not null
    and has_function_privilege('anon', 'public.get_client_catalog()', 'execute') then
    raise exception 'FAIL: anon can execute get_client_catalog';
  end if;
  if to_regprocedure('public.get_client_preorders()') is not null
    and has_function_privilege('anon', 'public.get_client_preorders()', 'execute') then
    raise exception 'FAIL: anon can execute get_client_preorders';
  end if;
  if to_regprocedure('public.submit_client_preorder(jsonb,jsonb)') is not null
    and has_function_privilege('anon', 'public.submit_client_preorder(jsonb,jsonb)', 'execute') then
    raise exception 'FAIL: anon can execute submit_client_preorder';
  end if;
  if to_regprocedure('public.protect_profile_privileged_fields()') is not null and (
    has_function_privilege('anon', 'public.protect_profile_privileged_fields()', 'execute')
    or has_function_privilege('authenticated', 'public.protect_profile_privileged_fields()', 'execute')
  ) then
    raise exception 'FAIL: trigger function is exposed as RPC';
  end if;
  if to_regprocedure('public.get_client_catalog()') is not null
    and not has_function_privilege('authenticated', 'public.get_client_catalog()', 'execute') then
    raise exception 'FAIL: authenticated client portal lost catalog access';
  end if;
  raise notice 'PASS: RPC execution privileges are correctly scoped';
end $$;
