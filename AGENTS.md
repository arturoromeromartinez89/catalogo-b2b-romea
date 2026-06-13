# Manual de trabajo - Catalogo B2B

## 1. Proyecto y objetivo

Este repositorio contiene un catalogo B2B multi-tenant para joyerias. Incluye catalogo, clientes, precios por plata, preordenes, PDFs, remisiones, administracion y portales de cliente.

La meta del negocio es convertirlo en una empresa SaaS para cientos de joyerias, con onboarding self-service, planes, suscripciones y cobro con Stripe. El dueno del proyecto no es programador y dirige el desarrollo con agentes de IA. Toda decision tecnica debe explicarse en lenguaje claro, incluyendo riesgo y efecto comercial.

La carpeta activa para integrar el SaaS es `catalogo-b2b-saas-integration`, rama `codex/saas-security-integration`. Parte del `main` de produccion en `36072bd` e incorpora seguridad y Storage sin modificar produccion. `catalogo-b2b-drag` conserva el historial original de esos cambios; `catalogo-b2b` es una copia antigua con conflictos y no debe usarse.

## 2. Stack real

- React 18.3 y Vite 6.
- JavaScript; no hay TypeScript.
- Supabase es el backend actual: PostgreSQL, Auth, RLS, RPC y Storage.
- El navegador consulta Supabase directamente con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Vercel despliega la SPA desde `main`.
- No existe todavia un servidor propio. La primera Supabase Edge Function, `sign-public-images`, ya esta desplegada y probada en staging.
- PDFs con jsPDF; Excel con SheetJS/xlsx.

## 3. Arquitectura multi-tenant

- La separacion principal es `tenant_id` en perfiles y tablas de negocio.
- `withTenant()` en `src/services/tenantUtils.js` filtra consultas del frontend, pero no es una barrera de seguridad.
- La seguridad real debe vivir en PostgreSQL mediante RLS.
- `supabase/fix_rls_tenant_isolation.sql` contiene la generacion mas completa de politicas para las tablas centrales.
- Perfiles y tenants se definen principalmente en `supabase/multi_tenant_migration.sql`.
- `supabase/migrations/20260612120000_lock_down_profile_privileges.sql` corrige la escalacion de privilegios en `profiles`.
- `supabase/migrations/20260612125000_enforce_tenant_admin_isolation.sql` reemplaza 17 politicas globales `is_admin()` verificadas en produccion por politicas limitadas al tenant.
- `supabase/migrations/20260612130000_secure_client_portal.sql` prepara RPCs para catalogo, precios y preordenes de cliente sin exponer tablas sensibles.
- `supabase/migrations/20260612140000_harden_public_quotes.sql` valida en servidor los productos y precios de ligas publicas.
- `supabase/migrations/20260612150000_secure_storage.sql` vuelve privado `company-assets` y aisla objetos por tenant.
- Estas migraciones se aplicaron y pasaron la prueba completa en el preview branch de staging `staging-security` el 12 de junio de 2026. Produccion sigue sin cambios.
- La integracion con el modulo administrativo actual esta documentada en `docs/SAAS-INTEGRATION-STATUS-2026-06-13.md`.
- El registro de validacion esta en `docs/staging-security-validation-2026-06-12.md`.
- El snapshot real de produccion del 12 de junio de 2026 esta en `docs/production-security-snapshot-2026-06-12.md`.
- Listas por pieza, componentes y modulo administrativo tienen SQLs separados.
- Los SQL se han ejecutado manualmente y existen generaciones antiguas incompatibles. Nunca asumir que produccion coincide con el repo: verificar `pg_policies` y el historial de migraciones.

## 4. Roles y autorizacion

Roles presentes en el codigo:

- `superadmin`: acceso de plataforma y soporte entre tenants.
- `tenant_admin`: administra una empresa.
- `admin`: rol legado tratado como administrador de tenant.
- `client`: portal del cliente.

El frontend usa `ADMIN_ROLES` para presentar vistas. PostgreSQL usa funciones `is_admin()`, `is_superadmin()`, `is_tenant_admin()`, `current_tenant_id()` e `is_admin_of_tenant()` para RLS. No confiar nunca en botones ocultos.

El repo ya incluye una politica y un trigger que impiden a admins de tenant modificar perfiles administrativos, elevar roles, mover cuentas entre tenants o vincular clientes de otro tenant. El riesgo sigue vigente en cualquier ambiente donde la migracion `20260612120000_lock_down_profile_privileges.sql` no se haya aplicado y verificado.

## 5. Reglas de negocio criticas

### Precio por plata

Formula base verificada:

1. Plata fina por gramo USD = `kitco_usd_oz / 31.1035`.
2. Aplicar premio: `base * (1 + premio_pct / 100)`.
3. Convertir a MXN con `tipo_cambio` cuando corresponda.
4. Sumar mano de obra por linea (`mo_base`) para obtener precio integrado.
5. Listas de labor, precio por pieza y margenes pueden modificar el precio final.

### Confidencialidad comercial

El cliente nunca debe recibir mano de obra interna, costos, margenes, notas internas ni datos de proveedor no autorizados. Esto debe cumplirse en SELECT/RPC/RLS, no solo ocultando campos en React.

El frontend preparado usa `get_client_catalog`, `submit_client_preorder` y `get_client_preorders` para no consultar directamente costos internos. Este cambio no protege ningun ambiente hasta que la migracion correspondiente este aplicada; desplegar siempre base de datos antes que Vercel.

### Importacion

- Productos se leen y guardan en lotes de 500 (`UPSERT_BATCH_SIZE`).
- Mantener la clave unica por tenant y codigo.
- Los importadores preparados limitan hojas a 10 MB y 10,000 filas; las imagenes a 8 MB y lotes de 1,000. Mantener esos limites o endurecerlos, no eliminarlos sin una razon medida.

## 6. Patrones que no se deben romper

- Mantener `tenant_id` en todas las operaciones y contratos de datos.
- Mantener las funciones SQL de roles y reforzarlas; no reemplazarlas con validacion de UI.
- `PreorderEditor` tiene candado optimista mediante `updated_at`, `expectedUpdatedAt` y `forceOverwrite`.
- El editor se presenta como overlay de pantalla completa. En el `main` actual no usa `createPortal`; no asumir que existe React Portal por documentacion antigua. Si se cambia el montaje, probar foco, scroll, drag and drop y cierre tanto en admin como cliente.
- Al guardar preordenes se eliminan campos sinteticos y se normaliza el orden de items. No eliminar el control de conflicto.
- Productos configurables dependen de patrones de codigo y metadata existentes; cualquier generalizacion debe ser por tenant.

## 7. Seguridad innegociable

- Nunca poner `service_role`, secretos de Stripe, credenciales privadas o llaves administrativas en React, variables `VITE_*`, Git o Vercel como variables expuestas al cliente.
- Operaciones privilegiadas deben pasar por Edge Functions o RPCs estrictas, no por el navegador.
- Toda tabla nueva debe tener `tenant_id` cuando aplique, RLS habilitado y politicas de lectura/escritura por tenant y rol.
- Las relaciones entre tablas deben impedir referencias cruzadas entre tenants.
- No usar `is_admin()` solo como permiso global; combinar rol y tenant.
- No permitir que admins de tenant cambien `role` o `tenant_id`.
- Suspender una cuenta o tenant debe bloquear tambien RLS/RPC, no solo la pantalla.
- Los clientes no deben actualizar directamente precios, totales o estatus de preordenes. Validar del lado servidor.
- Storage debe usar rutas por tenant y politicas sobre `storage.objects`; documentarlas en migraciones.
- Migraciones versionadas con Supabase CLI. No pegar SQL manualmente en produccion como proceso normal.
- Probar aislamiento con usuarios reales de al menos dos tenants antes de desplegar.

## 8. Forma de trabajo

1. Leer este archivo, `git status`, historial reciente y archivos afectados.
2. Trabajar desde el `origin/main` vigente y un worktree limpio.
3. Hacer un cambio a la vez.
4. Antes de implementar, explicar al dueno que archivos se tocaran, que comportamiento cambia y que podria romperse.
5. No revertir trabajo ajeno ni resolver conflictos descartando cambios sin autorizacion.
6. Ejecutar al menos `npm run build`; agregar pruebas proporcionales al riesgo.
7. Probar primero en staging. Existe el preview branch temporal `staging-security`; no confundirlo con un proyecto permanente e independiente de staging.
8. No probar por primera vez cambios destructivos en produccion.
9. Desplegar a `main` solo con alcance y verificacion claros.

## 9. Deuda tecnica conocida

- Migraciones manuales y deriva entre `schema.sql`, `SETUP_COMPLETO.sql`, `multi_tenant_migration.sql` y correcciones posteriores.
- Migracion contra escalacion de privilegios en `profiles` validada en staging; pendiente de produccion.
- El bloqueo de cuentas/tenants suspendidos en funciones de rol y RPC paso la prueba de staging; pendiente de produccion.
- Produccion tiene 17 politicas administrativas globales confirmadas que permiten acceso entre tenants; la correccion paso en staging pero aun no se aplica a produccion.
- Produccion tiene un perfil cliente activo sin `client_id` y sin cliente coincidente por correo. La migracion de perfiles lo desactivara; no vincularlo automaticamente.
- Las migraciones retiran acceso directo del cliente a precios y preordenes y pasaron la prueba de staging; falta desplegarlas y repetir la verificacion en produccion.
- `tenant_features.modulo_admin` ya controla la visibilidad del modulo administrativo y las RPC de Gastos 2.0. Falta extender el mismo control a todos los modulos y operaciones del servidor.
- Gastos 2.0 usa RPCs atomicas para gasto, pago, saldo de cuenta y movimiento bancario. Tras desplegar frontend y RPCs de forma compatible, falta revocar o restringir las escrituras financieras directas heredadas por PostgREST.
- Las ligas publicas validan contra su snapshot y limitan envios; esto paso en staging, pero aun necesitan rate limiting perimetral.
- Storage sigue publico en produccion. La migracion privada y sus pruebas de aislamiento pasaron en staging.
- Las rutas frontend, URLs firmadas y PDFs estan implementados localmente. La Edge Function `sign-public-images` esta desplegada en staging y paso pruebas de token invalido y bloqueo de rutas ajenas; falta probar la descarga de un archivo fisico y migrar los objetos existentes antes de produccion.
- `npm audit --omit=dev` reporta 3 alertas altas en la cadena Vite/esbuild. La correccion automatica salta a Vite 8 y es breaking; actualizar y probar en un cambio separado.
- Hay CI y una prueba SQL transaccional de seguridad, pero faltan pruebas automatizadas de UI, TypeScript y un proyecto permanente e independiente de staging.
- La estructura de Supabase CLI y CI ya existe, pero falta una migracion base verificada; hoy `supabase db reset` no puede reconstruir toda la base historica.
- README obsoleto.
- `styles.css` y algunos componentes son monoliticos.
- Sistemas de precios v1/v2 coexistentes.
- Configurables parcialmente hardcodeados.
- Creacion de cuentas cliente desde el navegador con `authLock`; migrar a Edge Function.
- Sin auditoria de impersonacion de superadmin.

## Regla final

Ante una diferencia entre un resumen anterior y el codigo, manda el codigo verificado y el estado real de Supabase. Si Supabase no se pudo consultar, declarar la incertidumbre explicitamente.
