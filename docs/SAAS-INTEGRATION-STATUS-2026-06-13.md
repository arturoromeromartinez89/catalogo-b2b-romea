# Estado de integracion SaaS - 13 de junio de 2026

## Objetivo

Integrar la seguridad multi-tenant, el portal seguro y Storage privado sobre el
`main` actual sin perder el modulo administrativo desarrollado por Claude.

## Rama y base

- Worktree: `C:\Users\Vanguardia\Documents\New project\catalogo-b2b-saas-integration`
- Rama: `codex/saas-security-integration`
- Base administrativa integrada: `e9dfade` (`Mi inversion` tolera tablas pendientes).
- La seguridad SaaS y Storage privado siguen sin aplicarse en produccion.
- Excepcion controlada del 14 de junio de 2026: se aplico en produccion la
  migracion aditiva que permite anticipos sin remision asociada.
- La rama fue subida a GitHub como `origin/codex/saas-security-integration`.
- Se creo un proyecto Vercel separado para pruebas; no se cambio el proyecto
  publico `catalogo-b2b-romea`.

## Modulo administrativo

Se integro `main` hasta `e9dfade` y el trabajo de Claude de Gastos 2.0. El modulo
administrativo ahora depende de `tenant_features.modulo_admin` y falla cerrado
si no existe una habilitacion explicita.

## Bloques integrados

1. Seguridad base y CI (`aa503df`).
2. Bucket privado y RLS por tenant (`290457d`).
3. Pruebas de aislamiento de Storage (`c3884a7`).
4. Resolucion de URLs firmadas para portal (`6f2f6ae`).
5. Flujo completo de imagen privada, PDFs y Edge Function (`671e4a7`).
6. Registro actualizado de validacion en staging (`7c75391`).
7. Gastos 2.0: vencimientos, documento, RPCs atomicas y UI (`d7b528b` a
   `b4fc068`, integrados y endurecidos en esta rama).

Las migraciones nuevas son:

- `20260614010000_add_expense_due_fields.sql`;
- `20260614011000_secure_expense_transactions.sql`;
- `20260614012000_enable_romea_admin_module.sql`.
- `20260614013000_allow_unassigned_customer_advances.sql`.

La prueba `expense_transactions_acceptance.sql` cubre pagos pendientes,
completos y parciales, sobrepago, ataques entre tenants, cuentas/categorias/
centros ajenos, suspensiones y rollback total ante fallo del libro bancario.
Las tres migraciones fueron aplicadas en `staging-security` el 14 de junio de
2026 y la prueba completa termino correctamente. El historial remoto quedo
alineado con los ocho archivos de migracion versionados.

La migracion de anticipos se aplico primero de forma aislada en produccion y se
registro en su historial sin empujar las migraciones de seguridad pendientes.
Luego se aplico tambien en `staging-security`. En ambos ambientes
`cobros.remision_id` devuelve `is_nullable = YES`. La prueba transaccional
`customer_advances_smoke.sql` inserto en produccion un anticipo sin remision y
un cobro ligado a una venta, valido ambos casos y revirtio todos los datos.

No se incorporo el commit de productos personalizados `a1a7ea4`. El unico
conflicto se resolvio conservando el comportamiento actual de componentes y
aplicando solamente `StorageImage` para sus fotos.

## Verificaciones locales

- `npm ci`: correcto; reporta 3 alertas altas conocidas en Vite/esbuild.
- `npm run build`: correcto, 972 modulos transformados.
- Edge Function `sign-public-images`: bundle correcto con esbuild.
- Las cinco migraciones pasan `scripts/validate_sql.py`.
- Las tres migraciones de Gastos 2.0 y su prueba pasan el parser PostgreSQL.
- `git diff --check`: correcto.
- Anticipos: prueba SQL con rollback correcta en produccion; no dejo cobros de
  prueba.
- El bundle principal sigue por encima de 500 kB; optimizacion pendiente.
- `@zxing/library` declara Node >= 24 mientras la estacion usa Node 22. El build
  funciona, pero debe revisarse antes de estandarizar CI.

## Estado de staging

El preview branch `staging-security` (`vafqcvpzksjlrborxoos`) ya contiene las
cinco migraciones y la Edge Function. Esa validacion se hizo antes de integrar
el `main` administrativo actual.

El frontend integrado ya esta desplegado en un proyecto Vercel aislado:
`https://catalogo-b2b-staging-security.vercel.app`. Sus variables apuntan al
project ref de staging y el bundle publicado contiene `vafqcvpzksjlrborxoos`,
sin contener el ref de produccion `pyignizeoevafifzfnik`. La pantalla de acceso
carga sin errores de navegador. No aplicar nuevamente migraciones ya presentes
sin consultar primero el historial del branch.

## Siguiente secuencia

1. Confirmar si `client-access-setup.sql` ya fue aplicado en produccion.
2. Completado: Vercel aislado apunta exclusivamente a `staging-security`.
3. Probar con dos tenant_admin y dos clientes reales de tenants distintos:
   catalogo, precios, preordenes, drag and drop, PDFs y acceso suspendido.
4. Subir una imagen fisica a Storage de staging, obtener URL firmada, descargarla
   y validar la liga publica de cotizacion.
5. Completado: migraciones y prueba transaccional de Gastos 2.0 en staging.
   Falta redesplegar el frontend de staging y probar el flujo visual con una
   cuenta de prueba, ya que el preview branch no copia usuarios/datos reales.
6. Preparar el script de migracion de objetos existentes de produccion a rutas
   `{tenant_id}/...`, con conteos y rollback.
7. Preparar respaldo y runbook de produccion: base de datos, objetos, frontend,
   pruebas y reversa.
8. Solo con aprobacion explicita: desplegar primero base de datos, luego frontend
   compatible y finalmente volver privado el bucket.
9. Eliminar `staging-security` cuando todas las pruebas terminen para detener su
   costo.

## Correccion puntual en produccion: anticipos

El 14 de junio de 2026 se confirmo que Vercel produccion usa el proyecto
Supabase `pyignizeoevafifzfnik`. La columna `public.cobros.remision_id` seguia
con `NOT NULL`, aunque el frontend ya enviaba `NULL` correctamente al registrar
un anticipo. Se aplico unicamente
`20260614013000_allow_unassigned_customer_advances.sql`, se recargo el esquema
de PostgREST y se verificaron los dos tipos de cobro mediante una transaccion
con rollback. No fue necesario redesplegar el frontend.

Pendiente funcional: aplicar un anticipo existente a una venta futura y probar
una captura real desde la interfaz con autorizacion del usuario.

## Trabajo paralelo de Claude

Claude puede continuar la banda operativa, dialogos y la adaptacion de Capital
en su rama. No debe desplegar su frontend antes de que las RPCs de Gastos 2.0
esten aplicadas y aprobadas en el ambiente correspondiente.
