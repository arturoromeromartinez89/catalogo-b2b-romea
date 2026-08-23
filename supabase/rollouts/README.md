# Rollouts manuales pendientes

Los archivos de esta carpeta no se aplican con `supabase db push`. Cada uno debe
promoverse a `supabase/migrations` solamente cuando su condicion previa haya
sido verificada y exista aprobacion para el ambiente objetivo.

`product_lines_contract.sql` queda como referencia historica. En staging fue
promovido como
`20260823144500_product_lines_tenant_unique_contract.sql` el 23 de agosto de
2026 y no debe ejecutarse directamente otra vez.

Antes de promover el mismo cambio a produccion se requiere:

1. migracion expand aplicada;
2. frontend sin escrituras que omitan `tenant_id`;
3. repetir preflight sobre datos productivos;
4. revisar la evidencia funcional de staging;
5. nueva autorizacion explicita para produccion.
