# Cambio: preordenes ordenadas por ultima fecha guardada

Fecha: 2026-06-22
Ambiente: staging / pruebas

## Objetivo

Que el administrador vea arriba la preorden que el cliente guardo mas recientemente, aunque esa preorden haya sido creada dias antes.

## Cambios aplicados

- El servicio de preordenes ahora consulta y ordena por `updated_at` descendente.
- El frontend refuerza el orden con `sortPreordersByLastSaved`.
- La tabla de preordenes muestra `Ultimo guardado` y debajo la fecha de creacion.
- La vista de preordenes muestra una notificacion superior con la ultima preorden guardada por cliente.
- La pagina Inicio usa tambien la fecha de guardado para sus pendientes de cliente.

## Riesgo controlado

No cambia RLS, permisos, productos, clientes ni la forma de guardar partidas. Solo cambia el orden y la visibilidad de la fecha relevante.

## Verificacion esperada

1. Crear o abrir una preorden antigua desde portal cliente.
2. Guardarla de nuevo.
3. Entrar como admin.
4. Confirmar que aparece arriba en Preordenes.
5. Confirmar que la notificacion superior apunta a esa preorden.
6. Confirmar que la fecha visible dice el ultimo guardado, no solo la fecha de creacion.
