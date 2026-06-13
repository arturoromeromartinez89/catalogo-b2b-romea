# Validacion de seguridad en staging - 12 de junio de 2026

## Ambiente

- Proyecto Supabase de produccion: `pyignizeoevafifzfnik` (no modificado durante esta validacion).
- Preview branch de staging: `staging-security`.
- Project ref de staging: `vafqcvpzksjlrborxoos`.
- El branch copio el esquema de produccion, pero no sus datos ni buckets de Storage.

El preview branch tiene costo mientras permanezca activo. Se conserva temporalmente para continuar las pruebas de seguridad y debe eliminarse cuando deje de ser necesario.

## Migraciones aplicadas

Se aplicaron, en este orden y solo en staging:

1. `20260612120000_lock_down_profile_privileges.sql`
2. `20260612125000_enforce_tenant_admin_isolation.sql`
3. `20260612130000_secure_client_portal.sql`
4. `20260612140000_harden_public_quotes.sql`
5. `20260612150000_secure_storage.sql`

Todas terminaron correctamente.

## Revision estructural

Resultado despues de las migraciones:

- Politicas administrativas globales inseguras: `0`.
- Politicas de lectura directa de tablas internas para clientes: `0`.
- Politicas de preorden que permiten modificacion directa al cliente: `0`.
- Funciones seguras del portal de cliente: `4`.
- Funciones de roles endurecidas: `5`.
- Columnas de control para ligas publicas: `3`.
- Trigger de proteccion de perfiles: `1`.
- Tablas publicas sin RLS: `0`.

## Prueba de aceptacion

Se ejecuto `supabase/tests/full_security_acceptance.sql` dentro de una transaccion que crea datos desechables y finalmente hace `ROLLBACK`.

Resultado:

`PASS: tenant isolation, privilege escalation, client pricing, preorder and suspension checks`

La prueba verifico:

- Separacion entre dos tenants para administradores y clientes.
- Bloqueo de escalacion a `superadmin` y cambio indebido de `tenant_id`.
- Bloqueo de usuarios y tenants suspendidos.
- Catalogo de cliente sin costos internos de mano de obra.
- Precio final calculado y entregado por RPC.
- Creacion de preorden por RPC sin aceptar precio, total o descripcion manipulados por el navegador.
- Prohibicion de modificar directamente preordenes del cliente.
- Aislamiento administrativo de configuracion de empresa, lineas de producto y preordenes.
- Ligas publicas limitadas por cantidad de envios y con precio validado en servidor.
- Branding publico sin datos legales, fiscales ni bancarios privados.
- Bucket `company-assets` privado, con limite de 10 MB y MIME restringido a JPEG, PNG y WebP.
- Lectura de objetos limitada al tenant para administradores y clientes.
- Escritura, actualizacion y borrado limitados al administrador del tenant.
- Bloqueo de lectura anonima y escritura cruzada entre tenants.
- Acceso global de soporte conservado para `superadmin`.

## Verificaciones locales

- Sintaxis de las cuatro migraciones: correcta.
- Sintaxis de la prueba completa: correcta.
- `npm run build`: correcto.
- `npm audit --omit=dev`: 3 alertas altas en la cadena Vite/esbuild. La correccion automatica exige un salto mayor a Vite 8 y se dejo para un cambio separado.
- `git diff --check`: sin errores de whitespace; solo avisos de conversion LF/CRLF en Windows.

## Edge Function de imagenes publicas

Se desplego `sign-public-images` exclusivamente en `staging-security`:

- Endpoint: `https://vafqcvpzksjlrborxoos.supabase.co/functions/v1/sign-public-images`.
- `Verify JWT` esta desactivado porque el visitante de una cotizacion es anonimo; la funcion valida el token de cotizacion mediante RPC antes de usar el `service_role` interno.
- Un token inexistente devolvio `404 Quote not found`.
- Un token valido con una ruta autorizada y otra de un tenant distinto devolvio solamente la ruta autorizada.
- La URL firmada expira en 600 segundos.
- Los registros de tenant, empresa y cotizacion usados para la prueba se eliminaron al terminar.

La carga y descarga fisica de un PNG no se completo porque la extension local de Chrome no tiene habilitado acceso a archivos locales. La autorizacion y lista permitida si quedaron probadas usando un metadato desechable de Storage. Quedo un metadato huerfano bajo `70000000-0000-4000-8000-000000000007/`; desaparecera al eliminar este preview branch.

## Pendientes antes de produccion

- Repetir la prueba con un archivo fisico y verificar su descarga por URL firmada.
- Probar el flujo visual completo con cuentas reales de staging, incluyendo catalogo, preorden y PDF.
- Migrar objetos existentes de produccion a rutas `{tenant_id}/...` y convertir las URLs guardadas en paths.
- Preparar respaldo y ventana de despliegue.
- Aplicar primero migraciones en produccion, verificar RPC/RLS y solo despues desplegar el frontend compatible en Vercel.
- Mantener produccion sin cambios hasta aprobar expresamente ese despliegue.
