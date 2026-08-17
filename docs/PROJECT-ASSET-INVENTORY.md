# Inventario maestro del proyecto NEXOR / Catálogo B2B

Actualizado: 17 de agosto de 2026.

Este documento identifica la ubicación canónica del código, los ambientes
publicados y las carpetas históricas conocidas. Su objetivo es impedir que una
copia antigua se confunda con el sistema activo. No autoriza eliminar archivos
ni sustituye la política de ambientes de `ENVIRONMENTS-AND-RELEASE-POLICY.md`.

## Ubicación canónica

- Repositorio Git principal: `C:\Users\Vanguardia\Documents\GitHub\catalogo-b2b-romea`
- Worktree activo de Project Hub: `C:\Users\Vanguardia\Documents\GitHub\catalogo-b2b-romea-project-hub-deploy`
- Rama de trabajo: `codex/project-hub-staging`
- Remoto: `https://github.com/arturoromeromartinez89/catalogo-b2b-romea.git`

El worktree de Project Hub es una carpeta de trabajo vinculada al repositorio
principal. No es un repositorio independiente ni una copia sin control de
versiones.

## Ambientes publicados

| Ambiente | URL | Versión observada | Uso |
|---|---|---|---|
| Producción | `https://catalogo-b2b-romea.vercel.app/` | `1.2.2-production` | Clientes y datos reales |
| Staging | `https://catalogo-b2b-staging-security.vercel.app/catalogo/` | `0.1.0-staging` | Desarrollo, pruebas y aprobación |
| Project Hub demo | `https://catalogo-b2b-staging-security.vercel.app/catalogo/demo/project-hub` | `0.1.0-staging` | Validación del portal de proyectos |

Producción y staging usan proyectos Vercel y bases Supabase diferentes. Nunca
deben intercambiarse variables, credenciales ni datos de clientes. Los IDs de
ambiente y el procedimiento seguro están documentados en
`docs/ENVIRONMENTS-AND-RELEASE-POLICY.md`.

## Información funcional valiosa ya presente

El repositorio activo contiene, entre otros, estos dominios:

- autenticación, perfiles, roles y multi-tenant;
- catálogo de productos, líneas, imágenes y filtros;
- listas de precios, metal, mano de obra y márgenes por cliente;
- clientes, prospectos y control de acceso;
- preórdenes, cotizaciones públicas, PDFs y exportaciones Excel;
- remisiones, cobros, pagos, gastos, capital, cuentas y estados financieros;
- portal de cliente, administración por tenant y superadministración;
- Project Hub con proyectos, etapas, objetivos, soluciones, tareas, avances,
  entregables, documentos y aprobaciones;
- migraciones Supabase, pruebas RLS y datos ficticios de staging.

El informe histórico `INFORME-PARA-ASESOR.md` conserva una auditoría detallada
del catálogo y sus riesgos. No debe eliminarse ni reemplazarse sin producir una
nueva auditoría equivalente.

## Fuente de verdad actual

- Los datos funcionales del catálogo vivo residen en Supabase.
- Las variables privadas locales residen en archivos `.env*.local` ignorados
  por Git. Nunca deben copiarse a documentación o commits.
- Vercel conserva artefactos publicados, pero no sustituye el respaldo del
  código fuente en GitHub.
- El Project Hub demo todavía conserva datos de muestra en
  `src/components/ProjectHub.jsx`; la fase funcional debe migrarlos a tablas y
  cálculos auditables de Supabase.
- Las migraciones del Project Hub están en
  `supabase/migrations/20260813120000_project_hub_mvp.sql` y
  `supabase/migrations/20260816120000_project_planning_workspace.sql`.

## Diseño y decisiones del Project Hub

- Contexto de producto: `PRODUCT.md`
- Sistema visual: `DESIGN.md`
- Dirección, quality bar y decisiones: `.impeccable/`
- Implementación principal: `src/components/ProjectHub.jsx`
- Gantt y tablero: `src/components/ProjectSolutionsPlan.jsx`
- Estilos: `src/projectHub.css`

## Carpetas históricas o auxiliares conocidas

Estas ubicaciones se conservaron intactas durante la operación de respaldo:

- `C:\Users\Vanguardia\Documents\ChatGPT\catalogo-b2b-romea-project-hub-deploy`
  — carpeta auxiliar de herramientas, sin código de aplicación.
- `C:\Users\Vanguardia\Documents\GitHub\catalogo-b2b-romea-project-hub-node_modules-install`
  — ubicación auxiliar de dependencias, no fuente del producto.
- `C:\Users\Vanguardia\Documents\New project\catalogo-b2b-fase0-source`
- `C:\Users\Vanguardia\Documents\New project\catalogo-b2b-produccion-v1.2-cajita-amarilla-publicada`
- `C:\Users\Vanguardia\Documents\New project\catalogo-b2b-pruebas-v1.3-cajita-amarilla`
- `C:\Users\Vanguardia\Documents\New project\_RESPALDO_VERSIONES_NO_USAR_20260625`

No se movió, renombró ni eliminó ninguna de estas carpetas. Antes de archivar
una versión histórica se debe comparar su inventario funcional contra el
repositorio canónico.

## Reglas de conservación

1. Todo desarrollo nuevo parte del repositorio Git principal o de uno de sus
   worktrees registrados.
2. Ninguna carpeta histórica se borra por nombre o antigüedad.
3. Los cambios se prueban y publican primero en staging.
4. Cada hito aprobado recibe commit, push y una etiqueta Git descriptiva.
5. Las migraciones SQL nuevas viven en `supabase/migrations`.
6. Los archivos sensibles permanecen fuera de Git.
7. Producción solo se modifica con aprobación humana explícita.
