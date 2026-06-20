-- Internal policy helpers and trigger functions are not public RPC endpoints.
revoke all on function public.tenant_owns_client(uuid, uuid) from anon;
revoke all on function public.tenant_owns_catalog(uuid, uuid) from anon;
revoke all on function public.tenant_owns_price_list(uuid, uuid) from anon;
revoke all on function public.validate_cobro_destination_account() from public, anon, authenticated;
notify pgrst, 'reload schema';
