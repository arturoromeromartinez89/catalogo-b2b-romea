-- Agrega proveedor a productos para que el importador de Commercia Gold pueda conservarlo.
-- Ejecutar una sola vez en Supabase SQL Editor antes de esperar datos reales de proveedor.

alter table public.products
add column if not exists proveedor text;

create index if not exists products_tenant_proveedor_idx
on public.products (tenant_id, proveedor);
