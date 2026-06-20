-- Pin SECURITY DEFINER functions to a safe search path.
alter function public.current_tenant_id() set search_path = '';
alter function public.is_admin() set search_path = '';
alter function public.is_superadmin() set search_path = '';
alter function public.is_tenant_admin() set search_path = '';
alter function public.is_admin_of_tenant(uuid) set search_path = '';
alter function public.client_allowed_skus() set search_path = '';
alter function public.set_updated_at() set search_path = '';
-- RLS helpers are available only to signed-in users.
revoke all on function public.current_tenant_id() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_superadmin() from public, anon;
revoke all on function public.is_tenant_admin() from public, anon;
revoke all on function public.is_admin_of_tenant(uuid) from public, anon;
revoke all on function public.client_allowed_skus() from public, anon;
grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.is_tenant_admin() to authenticated;
grant execute on function public.is_admin_of_tenant(uuid) to authenticated;
grant execute on function public.client_allowed_skus() to authenticated;
-- Trigger functions must not be callable through the REST RPC endpoint.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
-- Atomic preorder writes require a session, never anonymous access.
revoke all on function public.save_preorder_transaction(jsonb, jsonb, text, boolean) from public, anon;
grant execute on function public.save_preorder_transaction(jsonb, jsonb, text, boolean) to authenticated;
-- Public bucket URLs remain readable, but visitors cannot enumerate every object.
drop policy if exists "public read assets" on storage.objects;
notify pgrst, 'reload schema';
