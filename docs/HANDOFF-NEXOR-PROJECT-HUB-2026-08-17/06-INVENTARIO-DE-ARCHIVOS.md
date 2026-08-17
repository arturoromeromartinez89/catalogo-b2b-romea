# Inventario del avance

## Documentación de producto y diseño

- `PRODUCT.md`: contrato de producto, usuarios, principios, modelo operativo y estados.
- `DESIGN.md`: sistema visual persistente actualizado al cronograma único.
- `.impeccable/design.json`: tokens y metadatos del sistema visual.
- `.impeccable/project-hub-surface-brief.md`: brief de la superficie.
- `.impeccable/project-hub-quality-bar.md`: criterios de calidad.
- `docs/NEXOR-PROJECT-OPERATING-MODEL.md`: modelo operativo funcional.
- `docs/HANDOFF-NEXOR-PROJECT-HUB-2026-08-17/`: relevo y plan maestro.

## Interfaz y lógica

- `src/components/ProjectHub.jsx`: shell, navegación y dashboard de Inicio.
- `src/components/ProjectSolutionsPlan.jsx`: cronograma desplegable de tres meses.
- `src/components/ProjectWorkboard.jsx`: representación operativa de trabajo.
- `src/components/SolutionWorkspace.jsx`: detalle de la solución, ficha, entregables, criterios y decisiones.
- `src/components/superadmin/ProjectHubManager.jsx`: administración interna en NEXOR Studio.
- `src/services/projectHubService.js`: lectura, escritura, normalización y cálculos de datos del Project Hub.
- `src/utils/projectHubModel.js`: fuente única del lenguaje de estados y de los cálculos ponderados de avance.
- `src/i18n/translations.js`: textos traducibles.
- `src/projectHub.css`: sistema visual y responsive del portal.

## Base de datos y staging

- `supabase/migrations/20260817120000_project_hub_functional_foundation.sql`
- `supabase/migrations/20260817130000_project_hub_integrity_hardening.sql`
- `supabase/migrations/20260817140000_project_hub_evidence_timestamp_backfill.sql`
- `supabase/staging/seed_project_hub_functional.sql`
- `scripts/seed-staging.ps1`

Migraciones históricas recuperadas para sincronizar el repositorio con staging:

- `20260623170000_remove_pending_preorder_status.sql`
- `20260629170000_recalculate_preorder_totals_server_side.sql`
- `20260630123000_client_portal_interface_settings.sql`
- `20260701120000_tenant_commerce_settings.sql`
- `20260708120000_agenda_comercial.sql`
- `20260711130000_agenda_citas_viaje.sql`
- `20260719120000_estuches_public_storefront.sql`
- `20260719123000_fix_estuches_guest_piece_pricing.sql`
- `20260720173000_estuches_admin_only_auth.sql`
- `20260720201500_estuches_guest_preorder_receipt.sql`

## Evidencia visual

- `.impeccable/review/desktop.png`
- `.impeccable/review/mobile.png`
- `.impeccable/review/desktop-gantt.png`
- `.impeccable/review/mobile-gantt.png`

Los PNG corresponden al corte visual anterior. El cierre funcional se verificó en el staging público mediante DOM, estilos calculados, navegación y consola porque la API de captura agotó su tiempo de espera.

## Respaldo Git anterior

- `a95bfde feat(project-hub): establish reviewed visual foundation`
- `b331052 docs: record environment and backup inventory`
- etiqueta `backup/project-hub-visual-2026-08-17`
- etiqueta `backup/catalogo-b2b-ordered-2026-08-17`
- `43b5ad6 feat(project-hub): add functional vertical and master handoff`
- etiqueta `backup/project-hub-functional-handoff-2026-08-17`

El avance funcional posterior debe aparecer en un commit y etiqueta adicionales. Consultar `git log --oneline --decorate -10` para obtener los identificadores definitivos después del checkpoint.

## Archivos que no deben copiarse ni versionarse

- `.env*` con credenciales;
- `node_modules/`;
- artefactos temporales de build;
- tokens o salidas de consola que contengan secretos.
