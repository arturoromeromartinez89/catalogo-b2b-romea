# Handoff - Correccion de anticipos en Cobros

Fecha: 14 de junio de 2026

## Estado

Resuelto en Supabase de produccion y staging. El frontend no requirio cambios.

## Causa confirmada

La app de produccion usa el proyecto Supabase `pyignizeoevafifzfnik`. El
frontend ya enviaba `remision_id: null` para un anticipo, pero la columna
`public.cobros.remision_id` seguia definida como `NOT NULL` en esa base.

## Correccion aplicada

Migracion versionada:

`supabase/migrations/20260614013000_allow_unassigned_customer_advances.sql`

La migracion elimina solamente el `NOT NULL`, documenta que `NULL` representa
saldo a favor no aplicado y solicita a PostgREST recargar el esquema.

Se aplico de forma aislada en:

- Produccion: `pyignizeoevafifzfnik`.
- Preview/staging: `vafqcvpzksjlrborxoos`.

La consulta a `information_schema.columns` devolvio `is_nullable = YES` en
ambos ambientes.

## Prueba ejecutada

`supabase/tests/customer_advances_smoke.sql` se ejecuto en produccion dentro de
una transaccion. Probo:

1. Un anticipo de 1000 USD, tipo de cambio 17, con `remision_id = NULL`.
2. Un cobro ligado a una remision real.
3. La lectura de ambos registros recien insertados.
4. `ROLLBACK` final para no conservar movimientos financieros de prueba.

Resultado: correcto. No quedaron cobros falsos en produccion.

## Verificacion pendiente del usuario

Registrar nuevamente un anticipo real desde
`https://catalogo-b2b-romea.vercel.app`. No se hizo esa captura final desde la
interfaz porque generaria un movimiento financiero real.

## Trabajo posterior relacionado

- Permitir aplicar saldo a favor a una venta futura.
- Actualizar `cuentas_caja_banco.saldo_actual` de forma atomica al cobrar.
- Mover el registro completo de cobros a una RPC segura y auditable.
