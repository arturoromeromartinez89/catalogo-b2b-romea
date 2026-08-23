begin transaction read only;

select
  (select count(*) from public.product_lines) as total_rows,
  (select count(*) from public.product_lines where tenant_id is null) as null_tenant_rows,
  (
    select count(*)
    from (
      select tenant_id, codigo
      from public.product_lines
      group by tenant_id, codigo
      having count(*) > 1
    ) duplicates
  ) as duplicate_tenant_codigo_groups,
  (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', c.conname,
      'type', c.contype,
      'definition', pg_get_constraintdef(c.oid)
    ) order by c.conname), '[]'::jsonb)
    from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public' and r.relname = 'product_lines'
  ) as constraints,
  (
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', indexname,
      'definition', indexdef
    ) order by indexname), '[]'::jsonb)
    from pg_indexes
    where schemaname = 'public' and tablename = 'product_lines'
  ) as indexes;

rollback;
