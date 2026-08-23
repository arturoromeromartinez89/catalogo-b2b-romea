# Rollouts manuales pendientes

Los archivos de esta carpeta no se aplican con `supabase db push`. Cada uno debe
promoverse a `supabase/migrations` solamente cuando su condicion previa haya
sido verificada y exista aprobacion para el ambiente objetivo.

`product_lines_contract.sql` retira la unicidad global de `codigo`. Requiere:

1. migracion expand aplicada;
2. frontend sin escrituras que omitan `tenant_id`;
3. pruebas con dos tenants en staging;
4. observacion de staging sin errores de conflicto;
5. nueva autorizacion antes de produccion.
