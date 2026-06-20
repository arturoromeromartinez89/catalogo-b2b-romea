-- Inventory for every tenant-scoped table and suspicious legacy policies.
with tenant_tables as (
  select c.table_schema, c.table_name
  from information_schema.columns c
  where c.table_schema = 'public' and c.column_name = 'tenant_id'
)
select
  t.table_name,
  cls.relrowsecurity as rls_enabled,
  count(p.policyname) as policy_count
from tenant_tables t
join pg_class cls on cls.relname = t.table_name
join pg_namespace n on n.oid = cls.relnamespace and n.nspname = t.table_schema
left join pg_policies p
  on p.schemaname = t.table_schema and p.tablename = t.table_name
group by t.table_name, cls.relrowsecurity
order by t.table_name;

select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (
    coalesce(qual, '') ~ 'is_admin\(\)'
    or coalesce(with_check, '') ~ 'is_admin\(\)'
    or coalesce(qual, '') in ('true', '(true)')
    or coalesce(with_check, '') in ('true', '(true)')
  )
order by tablename, policyname;
