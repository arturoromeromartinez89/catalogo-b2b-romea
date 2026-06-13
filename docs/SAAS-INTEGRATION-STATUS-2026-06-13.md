# Estado de integracion SaaS - 13 de junio de 2026

## Objetivo

Integrar la seguridad multi-tenant, el portal seguro y Storage privado sobre el
`main` actual sin perder el modulo administrativo desarrollado por Claude.

## Rama y base

- Worktree: `C:\Users\Vanguardia\Documents\New project\catalogo-b2b-saas-integration`
- Rama: `codex/saas-security-integration`
- Base de produccion: `36072bd` (`Mi inversion`).
- Produccion, Vercel y Supabase de produccion no fueron modificados.
- La rama no se ha subido a GitHub.

## Cambios administrativos preservados

La comparacion contra `origin/main` confirma que la integracion no modifica:

- `AdminDashboard.jsx`;
- `InicioFinancieroTab.jsx`;
- `GastosTab.jsx`;
- `RemisionWorkspace.jsx`;
- `CapitalTab.jsx`.

Por tanto se conservan Inicio financiero, captura guiada de gastos, cobros desde
Ventas y el modulo Mi inversion exactamente como estan en `main`.

## Bloques integrados

1. Seguridad base y CI (`aa503df`).
2. Bucket privado y RLS por tenant (`290457d`).
3. Pruebas de aislamiento de Storage (`c3884a7`).
4. Resolucion de URLs firmadas para portal (`6f2f6ae`).
5. Flujo completo de imagen privada, PDFs y Edge Function (`671e4a7`).
6. Registro actualizado de validacion en staging (`7c75391`).

No se incorporo el commit de productos personalizados `a1a7ea4`. El unico
conflicto se resolvio conservando el comportamiento actual de componentes y
aplicando solamente `StorageImage` para sus fotos.

## Verificaciones locales

- `npm ci`: correcto; reporta 3 alertas altas conocidas en Vite/esbuild.
- `npm run build`: correcto, 972 modulos transformados.
- Edge Function `sign-public-images`: bundle correcto con esbuild.
- Las cinco migraciones pasan `scripts/validate_sql.py`.
- `git diff --check`: correcto.
- El bundle principal sigue por encima de 500 kB; optimizacion pendiente.
- `@zxing/library` declara Node >= 24 mientras la estacion usa Node 22. El build
  funciona, pero debe revisarse antes de estandarizar CI.

## Estado de staging

El preview branch `staging-security` (`vafqcvpzksjlrborxoos`) ya contiene las
cinco migraciones y la Edge Function. Esa validacion se hizo antes de integrar
el `main` administrativo actual.

La siguiente validacion debe desplegar el frontend de esta rama en un ambiente
de preview conectado a staging y comprobar que seguridad y administracion
conviven. No aplicar nuevamente migraciones ya presentes sin consultar primero
el historial del branch.

## Siguiente secuencia

1. Confirmar si `client-access-setup.sql` ya fue aplicado en produccion.
2. Configurar un preview de Vercel para esta rama apuntando exclusivamente a
   `staging-security`.
3. Probar con dos tenant_admin y dos clientes reales de tenants distintos:
   catalogo, precios, preordenes, drag and drop, PDFs y acceso suspendido.
4. Subir una imagen fisica a Storage de staging, obtener URL firmada, descargarla
   y validar la liga publica de cotizacion.
5. Probar el modulo administrativo en el mismo preview, sin dar por confiables
   sus saldos hasta que Claude implemente RPCs atomicas de gastos y cobros.
6. Preparar el script de migracion de objetos existentes de produccion a rutas
   `{tenant_id}/...`, con conteos y rollback.
7. Preparar respaldo y runbook de produccion: base de datos, objetos, frontend,
   pruebas y reversa.
8. Solo con aprobacion explicita: desplegar primero base de datos, luego frontend
   compatible y finalmente volver privado el bucket.
9. Eliminar `staging-security` cuando todas las pruebas terminen para detener su
   costo.

## Trabajo paralelo de Claude

Claude puede continuar el modulo administrativo en otra rama. Sus prioridades
son RPCs atomicas para gastos/pagos y cobros, uso real de
`movimientos_caja_banco`, vencimientos y feature flag `modulo_admin`. No mezclar
ese trabajo en esta rama hasta que tenga pruebas propias y un commit claramente
delimitado.

