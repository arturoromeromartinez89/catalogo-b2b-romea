-- Read-only snapshot of the live Supabase security state.
-- Run in the production SQL Editor and export the result before applying migrations.

select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
  and c.relkind = 'r'
order by n.nspname, c.relname;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proconfig as function_settings
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'current_tenant_id',
    'is_admin',
    'is_superadmin',
    'is_tenant_admin',
    'handle_new_user',
    'get_quote_link_by_token',
    'submit_quote_link_preorder',
    'get_client_catalog',
    'submit_client_preorder',
    'get_client_preorders'
  )
order by p.proname, arguments;

select id, name, slug, status, created_at, updated_at
from public.tenants
order by name;

select
  role,
  active,
  count(*) as profile_count,
  count(*) filter (where tenant_id is null) as missing_tenant,
  count(*) filter (where role = 'client' and client_id is null) as clients_missing_link
from public.profiles
group by role, active
order by role, active;

select
  p.id as profile_id,
  p.email,
  p.tenant_id as profile_tenant_id,
  p.client_id,
  c.tenant_id as client_tenant_id
from public.profiles p
left join public.clients c on c.id = p.client_id
where p.role = 'client'
  and (
    p.tenant_id is null
    or p.client_id is null
    or c.id is null
    or p.tenant_id is distinct from c.tenant_id
  )
order by p.email;

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;

-- Must return zero after the tenant-isolation migration.
select
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (
    coalesce(qual, '') ~ '(^|[^a-z_])is_admin\(\)'
    or coalesce(with_check, '') ~ '(^|[^a-z_])is_admin\(\)'
  )
  and coalesce(qual, '') not ilike '%tenant_id%'
  and coalesce(with_check, '') not ilike '%tenant_id%'
order by tablename, policyname;
