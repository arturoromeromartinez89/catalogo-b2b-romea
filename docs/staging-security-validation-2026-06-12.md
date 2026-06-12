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

## Verificaciones locales

- Sintaxis de las cuatro migraciones: correcta.
- Sintaxis de la prueba completa: correcta.
- `npm run build`: correcto.
- `npm audit --omit=dev`: `0` vulnerabilidades.
- `git diff --check`: sin errores de whitespace; solo avisos de conversion LF/CRLF en Windows.

## Pendientes antes de produccion

- Probar Storage privado por tenant; el preview branch no contiene buckets ni archivos clonados.
- Probar el flujo visual completo con cuentas reales de staging, incluyendo catalogo, preorden y PDF.
- Preparar respaldo y ventana de despliegue.
- Aplicar primero migraciones en produccion, verificar RPC/RLS y solo despues desplegar el frontend compatible en Vercel.
- Mantener produccion sin cambios hasta aprobar expresamente ese despliegue.
