-- Explicit grants to anon survive a REVOKE FROM public. These portal RPCs use
-- auth.uid() and are valid only for signed-in client accounts.
revoke all on function public.get_client_catalog() from anon;
revoke all on function public.get_client_preorders() from anon;
revoke all on function public.submit_client_preorder(jsonb, jsonb) from anon;

grant execute on function public.get_client_catalog() to authenticated;
grant execute on function public.get_client_preorders() to authenticated;
grant execute on function public.submit_client_preorder(jsonb, jsonb) to authenticated;

-- Trigger functions are internal and must never be exposed as REST RPCs.
revoke all on function public.protect_profile_privileged_fields()
from public, anon, authenticated;

notify pgrst, 'reload schema';
