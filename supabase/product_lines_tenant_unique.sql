-- Required for safe multi-tenant upserts in product_lines.
-- Run this once in Supabase SQL Editor if the constraint does not exist.

create unique index if not exists product_lines_tenant_codigo_uidx
on public.product_lines (tenant_id, codigo);
