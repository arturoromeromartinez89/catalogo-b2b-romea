# Estado técnico y arquitectura

## Stack

- React 18 + Vite 6.
- Supabase para autenticación, base de datos, almacenamiento y aislamiento multiempresa.
- Vercel para despliegue.
- Interfaz principalmente en español.

## Repositorio y ambientes

- Repositorio local: `C:\Users\Vanguardia\Documents\GitHub\catalogo-b2b-romea-project-hub-deploy`
- Remoto: `https://github.com/arturoromeromartinez89/catalogo-b2b-romea.git`
- Rama: `codex/project-hub-staging`
- Supabase staging: `vafqcvpzksjlrborxoos`
- Supabase producción: `pyignizeoevafifzfnik`
- Staging web: <https://catalogo-b2b-staging-security.vercel.app/catalogo/demo/project-hub>

No utilizar el proyecto Supabase de producción ni desplegar producción durante el cierre de esta vertical.

## Implementación funcional actual

El portal ahora deriva sus métricas desde registros relacionados:

- avance confirmado desde entregables aceptados;
- avance de trabajo desde tareas y estimaciones;
- horas desde registros de tiempo;
- líneas de código desde actividad de desarrollo;
- acciones del cliente desde decisiones pendientes.

La demo sembrada produce, de forma rastreable:

- 17 % de avance confirmado;
- 7 % de avance de trabajo;
- 17.3 horas;
- 3,102 líneas de código;
- 1 solución;
- 1 Ficha de solución;
- 3 criterios de aceptación;
- 10 tareas relacionadas.

El demo público del frontend agrega una undécima actividad sintética cancelada para comprobar el estado negro y su exclusión del avance. El seed de base de datos conserva sus 10 tareas originales.

Son datos sintéticos identificados como demostración, pero no números escritos arbitrariamente en componentes.

## Migraciones funcionales

- `20260817120000_project_hub_functional_foundation.sql`
- `20260817130000_project_hub_integrity_hardening.sql`
- `20260817140000_project_hub_evidence_timestamp_backfill.sql`

Las tres se aplicaron correctamente a staging. La verificación devolvió 40 eventos de auditoría, una aprobación con fecha y un criterio con fecha.

También se incorporaron al repositorio diez migraciones remotas históricas que faltaban localmente para volver a sincronizar la historia de staging. Ver inventario.

## Integridad implementada

- relaciones entre proyecto, solución, entregable, criterio, tarea y evidencia;
- marcas de tiempo para aceptación y decisiones;
- auditoría de acciones críticas;
- datos demostrativos coherentes;
- persistencia compatible con columnas heredadas, manteniendo el avance funcional como valor derivado.

## Interfaz implementada

- La tarjeta/placa del proyecto aparece solo en Inicio.
- Inicio presenta avance confirmado, etapa, atención del cliente, líneas de código y horas.
- Un único cronograma muestra tres meses.
- Una solución se despliega in situ para revelar sus tareas.
- Una tarea abre directamente su detalle.
- En móvil el cronograma se transforma en una lista/accordion sin desplazamiento horizontal.
- Los seis estados globales conservan color y texto en escritorio y móvil.
- Las tareas canceladas aparecen en negro, abren su detalle y no cuentan en el avance.
- Portal y NEXOR Studio comparten la misma regla de avance confirmado.
- Aprobar y Solicitar cambios tienen jerarquía equilibrada.

## Validación ya realizada

- `npm run build`: aprobado.
- `npm run build:staging`: aprobado.
- Migraciones: aplicadas en staging.
- Seed funcional: aplicado en staging.
- QA de navegación: la placa desaparece fuera de Inicio, la solución abre y la tarea abre.
- QA público posterior al deploy: 12 filas de cronograma, actividad cancelada operable, cero errores de consola y sin desbordamiento móvil.
- Staging canónico desplegado en Vercel con deployment `dpl_F8gxhTmntF8w7djRWpyUh5qnBLpL`.
- Las capturas de referencia existentes permanecen en `.impeccable/review/`; la API de captura agotó su tiempo de espera en Chrome y en el navegador integrado, por lo que no se sobrescribieron con imágenes incompletas.

El lint enlazado de Supabase no se pudo ejecutar porque la sesión no tenía `SUPABASE_DB_PASSWORD`. No es evidencia de error en las migraciones; debe repetirse cuando exista la credencial, sin escribirla en Git ni en esta documentación.

## Riesgos conocidos

- Supabase DB lint sigue pendiente hasta disponer de `SUPABASE_DB_PASSWORD` en una sesión segura.
- Las capturas PNG deben regenerarse en un futuro pase de evidencia; la verificación actual se hizo contra DOM, estilos calculados, interacciones y consola del staging público.
- `.impeccable/design.json` quedó anterior a la actualización de `DESIGN.md`. Debe refrescarse mediante el flujo `impeccable document` en una tarea de documentación dedicada, sin mezclarlo con trabajo funcional.
