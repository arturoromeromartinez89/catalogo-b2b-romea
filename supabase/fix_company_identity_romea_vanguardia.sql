-- Correccion opcional de identidad visual por tenant.
-- Ejecutar solo si en la pantalla Empresa o en PDFs sigue apareciendo el nombre/logo
-- de otra empresa despues de desplegar el codigo.
--
-- Tenant historico con base de Vanguardia Joyera:
-- 77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb
-- Tenant que debe operar como ROMEA:
-- 3b5a512d-c7e8-4700-87a9-78cfd4d63d18

-- 1. Revisar configuraciones actuales.
select
  cs.id,
  cs.tenant_id,
  t.name as tenant_name,
  cs.brand_name,
  cs.legal_name,
  cs.logo_url
from public.company_settings cs
left join public.tenants t on t.id = cs.tenant_id
order by cs.created_at nulls last, cs.id;

-- 2. Si existia una configuracion global de Vanguardia sin tenant,
-- asignarla al tenant historico de Vanguardia para que no contamine ROMEA.
update public.company_settings
set tenant_id = '77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb'
where tenant_id is null
  and (
    brand_name ilike '%vanguardia%'
    or legal_name ilike '%vanguardia%'
    or logo_url ilike '%vanguardia%'
  );

-- 3. Si el tenant ROMEA nuevo tenia por error identidad de Vanguardia,
-- limpiar solo esos campos visuales. Despues carga el logo correcto desde Empresa.
update public.company_settings
set
  brand_name = '',
  legal_name = '',
  logo_url = ''
where tenant_id = '3b5a512d-c7e8-4700-87a9-78cfd4d63d18'
  and (
    brand_name ilike '%vanguardia%'
    or legal_name ilike '%vanguardia%'
    or logo_url ilike '%vanguardia%'
  );

-- 4. Verificar resultado.
select
  cs.id,
  cs.tenant_id,
  t.name as tenant_name,
  cs.brand_name,
  cs.legal_name,
  cs.logo_url
from public.company_settings cs
left join public.tenants t on t.id = cs.tenant_id
order by cs.created_at nulls last, cs.id;
