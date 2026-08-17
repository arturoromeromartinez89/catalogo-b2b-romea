-- Estuches Chavez uses a public customer storefront. This helper lets the
-- frontend retire legacy client portals without exposing tenant information.

create or replace function public.is_current_user_estuches_chavez_client()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.tenants t on t.id = p.tenant_id
    where p.id = auth.uid()
      and p.role = 'client'
      and t.status = 'active'
      and (
        lower(coalesce(t.slug, '')) like '%estuches%chavez%'
        or lower(coalesce(t.name, '')) like '%estuches%chavez%'
      )
  );
$$;
revoke all on function public.is_current_user_estuches_chavez_client() from public, anon;
grant execute on function public.is_current_user_estuches_chavez_client() to authenticated;
