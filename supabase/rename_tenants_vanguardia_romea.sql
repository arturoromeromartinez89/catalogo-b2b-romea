-- Correccion de identidad de tenants.
-- Situacion actual:
-- - El tenant con id 77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb se llama ROMEA,
--   pero en realidad contiene la base de datos de Vanguardia Joyera.
-- - El tenant con id 3b5a512d-c7e8-4700-87a9-78cfd4d63d18 se llama ARGOZ,
--   pero debe convertirse en ROMEA, donde se cargara/trabajara el catalogo ROMEA.
--
-- Este script NO mueve productos, clientes ni preordenes.
-- Solo corrige nombre/slug/status de los tenants y asigna el admin operativo a ROMEA nuevo.

begin;

-- 1. Liberar temporalmente el slug "romea" para evitar conflicto unico.
update public.tenants
set slug = 'vanguardia-joyera-temp',
    updated_at = now()
where id = '77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb';

-- 2. Convertir el tenant anterior ROMEA en Vanguardia Joyera.
update public.tenants
set name = 'Vanguardia Joyera',
    slug = 'vanguardia-joyera',
    status = 'active',
    updated_at = now()
where id = '77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb';

-- 3. Convertir ARGOZ en ROMEA.
update public.tenants
set name = 'ROMEA',
    slug = 'romea',
    status = 'active',
    updated_at = now()
where id = '3b5a512d-c7e8-4700-87a9-78cfd4d63d18';

-- 4. Superadmin global queda sin tenant operativo.
update public.profiles
set role = 'superadmin',
    tenant_id = null
where lower(email) = lower('arturo.romero.martinez89@gmail.com');

-- 5. Admin operativo se asigna a ROMEA nuevo para trabajar hoy.
update public.profiles
set role = 'tenant_admin',
    tenant_id = '3b5a512d-c7e8-4700-87a9-78cfd4d63d18'
where lower(email) = lower('arturo.romero@vanguardiajoyera.com');

commit;

-- Verificacion esperada:
select id, name, slug, status
from public.tenants
where id in (
  '77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb',
  '3b5a512d-c7e8-4700-87a9-78cfd4d63d18'
)
order by name;

select email, role, tenant_id
from public.profiles
where lower(email) in (
  lower('arturo.romero.martinez89@gmail.com'),
  lower('arturo.romero@vanguardiajoyera.com')
)
order by email;
