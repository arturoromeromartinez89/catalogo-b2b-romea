# Fase 3 — Baseline y aislamiento de lineas de producto

**Fecha:** 23 de agosto de 2026

**Rama:** `codex/phase3-baseline-product-lines`
**Produccion:** sin migraciones, sin deploy y sin cambios de datos.

## Resultado

- Baseline funcional de produccion respaldada en privado y protegida por
  SHA-256; GitHub conserva solo su manifiesto porque el repositorio es publico.
- Mapa de ambientes corregido: produccion tiene 44 tablas publicas; staging 66.
- Escrituras de productos y lineas bloqueadas cuando no existe tenant activo.
- Conflictos de upsert fijados a `(tenant_id,codigo)`.
- Borrado de producto condicionado tambien por `tenant_id`.
- Fase expand aplicada exclusivamente en Supabase staging
  `vafqcvpzksjlrborxoos`.
- Frontend desplegado exclusivamente en Vercel staging y verificado en
  `https://catalogo-b2b-staging-security.vercel.app/catalogo/`.
- Fase contract preparada fuera de migraciones automaticas y no aplicada.

## Evidencia de staging

Preflight antes de expand:

- `product_lines`: 37 registros;
- filas con `tenant_id` nulo: 0;
- grupos duplicados `(tenant_id,codigo)`: 0;
- indice compuesto: ausente;
- unicidad global `product_lines_codigo_key`: presente.

`supabase db push --dry-run` mostro una sola migracion pendiente:

```text
20260823120000_product_lines_tenant_unique_expand.sql
```

Postflight:

- registros: 37;
- nulos: 0;
- duplicados: 0;
- `product_lines_tenant_codigo_uidx`: presente y unico;
- `product_lines_codigo_key`: conservado;
- migracion `20260823120000`: registrada remotamente.

## Evidencia de despliegue

- Vercel project: `catalogo-b2b-staging-security`;
- deployment: `dpl_DnceJ4J9aR2DMxrt3iYUiEr6s5zp`;
- estado observado: `READY`;
- alias estable: `https://catalogo-b2b-staging-security.vercel.app`;
- `HEAD /catalogo/`: `200 OK`;
- produccion comercial: sin deploy.

## Verificaciones

- `npm run check:baseline`: PASS sobre el manifiesto de la baseline privada.
- `npm run test:tenant-isolation`: 2/2 PASS.
- `npm run check:design-policy`: PASS.
- `npm run build:staging`: PASS, 996 modulos transformados.
- `git diff --check`: PASS.

Advertencias no introducidas por esta fase:

- npm reporta 3 vulnerabilidades de dependencias: 1 moderada y 2 altas;
- `client_access_cors.test.mjs` necesita `EDGE_FUNCTION_URL`;
- `sin_piedra.test.mjs` no resuelve un import ESM sin extension bajo Node 22;
- Vite conserva advertencia de chunk principal mayor a 500 kB.

## Condiciones para contract

No promover `supabase/rollouts/product_lines_contract.sql` hasta completar:

1. deploy del frontend nuevo a staging;
2. importacion y sincronizacion de lineas con tenant activo;
3. comprobacion con dos tenants;
4. periodo de observacion sin conflictos por `codigo`;
5. autorizacion separada antes de cualquier cambio productivo.
