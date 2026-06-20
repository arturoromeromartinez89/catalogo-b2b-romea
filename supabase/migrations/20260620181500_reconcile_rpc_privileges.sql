-- Reconcile environments where legacy portal functions may already be absent.
do $$
begin
  if to_regprocedure('public.get_client_catalog()') is not null then
    execute 'revoke all on function public.get_client_catalog() from anon';
    execute 'grant execute on function public.get_client_catalog() to authenticated';
  end if;
  if to_regprocedure('public.get_client_preorders()') is not null then
    execute 'revoke all on function public.get_client_preorders() from anon';
    execute 'grant execute on function public.get_client_preorders() to authenticated';
  end if;
  if to_regprocedure('public.submit_client_preorder(jsonb,jsonb)') is not null then
    execute 'revoke all on function public.submit_client_preorder(jsonb, jsonb) from anon';
    execute 'grant execute on function public.submit_client_preorder(jsonb, jsonb) to authenticated';
  end if;
  if to_regprocedure('public.protect_profile_privileged_fields()') is not null then
    execute 'revoke all on function public.protect_profile_privileged_fields() from public, anon, authenticated';
  end if;
end $$;

notify pgrst, 'reload schema';
