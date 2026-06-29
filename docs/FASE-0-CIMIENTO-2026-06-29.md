# Fase 0 - Cimiento SaaS

Fecha: 2026-06-29

## Objetivo

Dejar una base verificable antes de iniciar Stripe: version unica de pruebas,
ambiente aislado, storage confirmado y calculo critico de preordenes desde
servidor.

## Version consolidada

- Rama fuente: `codex/fase0-cajita-consolidation`
- Base funcional: rama cajita amarilla `codex/paco-mvp-staging-base`
- Vercel pruebas: `catalogo-b2b-staging-security`
- Supabase pruebas: `vafqcvpzksjlrborxoos`
- URL pruebas: `https://catalogo-b2b-staging-security.vercel.app/catalogo/`

## Cambios aplicados

- Se agrego guard de ambiente en `vite.config.js`.
- Staging/produccion ahora requieren `VITE_SUPABASE_URL` y
  `VITE_SUPABASE_ANON_KEY`.
- Staging no puede compilar contra Supabase produccion.
- Produccion no puede compilar contra Supabase pruebas.
- `scripts/deploy-staging.ps1` valida Vercel staging, Supabase staging y
  variables de entorno antes de desplegar.
- `save_preorder_transaction` recalcula totales de preorden en servidor cuando
  el producto existe en el catalogo del tenant.
- Clientes pueden editar su propia preorden en `pendiente` o `revision`, acorde
  al trigger remoto que normaliza `pendiente` a `revision`.

## Base de datos

Migracion aplicada en Supabase staging:

- `20260629170000_recalculate_preorder_totals_server_side.sql`

Nota: staging tiene una migracion remota `20260623170000` que no existe como
archivo local en esta rama. Por seguridad, no se uso `supabase db push` masivo;
se ejecuto solo la migracion nueva y se marco como aplicada en el historial de
staging.

## Verificaciones realizadas

- `npm run build:staging`: PASS.
- `node supabase/tests/sin_piedra.test.mjs`: PASS.
- `node supabase/tests/preorder_last_saved_sort.test.mjs`: PASS.
- `supabase/tests/preorder_tenant_alignment_acceptance.sql` en staging: PASS.
- Deploy staging: PASS.
- Verificacion externa del bundle desplegado:
  - contiene ref de Supabase staging `vafqcvpzksjlrborxoos`
  - no contiene ref de produccion `pyignizeoevafifzfnik`
  - contiene version `0.1.0-staging`
  - contiene `tenant_interface_settings`
  - contiene `save_preorder_transaction`
- Storage staging:
  - bucket `company-assets` existe
  - bucket privado
  - MIME permitidos: JPEG, PNG, WebP
  - limite: 10 MB
  - politicas RLS de storage por tenant presentes

## Pendiente antes de billing

No iniciar Stripe todavia.

Falta validacion humana en la URL de pruebas y, si se aprueba, crear el tag
estable y definir el despliegue productivo desde ese tag.
