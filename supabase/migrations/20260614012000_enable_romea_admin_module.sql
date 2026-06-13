-- Enable the administrative module for the existing Romea tenant.

insert into public.tenant_features (tenant_id, modulo_admin)
select t.id, true
from public.tenants t
where t.id = '3b5a512d-c7e8-4700-87a9-78cfd4d63d18'
on conflict (tenant_id) do update
set modulo_admin = excluded.modulo_admin,
    updated_at = now();
