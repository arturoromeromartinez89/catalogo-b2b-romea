# Plan maestro de NEXOR IA

## Norte

NEXOR IA debe convertir información dispersa de una relación con el cliente en una cadena auditable:

**Cliente → Proyecto → Etapa → Solución → Entregable → Tarea o actividad**

La complejidad vive dentro del sistema. Al cliente se le presenta una secuencia sencilla: entender, revisar y decidir.

## Principios que gobiernan todas las fases

1. Máximo rigor interno, mínimo esfuerzo visible.
2. Ningún porcentaje real puede ser arbitrario.
3. Todo compromiso debe terminar en un entregable verificable y criterios de aceptación.
4. Una sola fuente de verdad; no duplicar conceptos con nombres distintos.
5. Cada persona ve únicamente lo necesario para su función.
6. El color siempre va acompañado de texto e icono.
7. Demo, borrador, información interna y publicación al cliente deben distinguirse inequívocamente.
8. La automatización debe reducir trabajo, no ocultar decisiones ni inventar evidencia.

## Fase 0 — Base segura y diseño del portal

Estado: terminada.

- Ordenar el repositorio y separar staging de producción.
- Documentar la identidad NEXOR y la dirección visual.
- Rediseñar Project Hub sin romper el catálogo existente.
- Crear respaldos Git y evidencia visual.

Puerta de salida: build aprobado, staging independiente y producción intacta.

## Fase 1 — Primera vertical funcional

Estado: terminada y respaldada.

- Inicio con avance confirmado, etapa, acciones, código y horas.
- Cronograma de tres meses con soluciones desplegables.
- Apertura directa del detalle de una tarea.
- Ficha de solución, entregables, criterios, tareas y decisiones conectados.
- Registros de tiempo y actividad de código como evidencia separada.
- Auditoría y marcas de tiempo.
- Estados globales coherentes.

Puerta de salida:

- Los siete ajustes de revisión están resueltos.
- Desktop y móvil conservan los estados por color y texto.
- Build y staging pasan.
- El último código está desplegado en la URL canónica de staging.
- Existe commit y etiqueta de respaldo funcional.

## Fase 2 — Alta interna de clientes y proyectos

Estado: siguiente bloque de producto.

- Crear cliente nuevo o seleccionar cliente existente.
- Crear un proyecto ligado al cliente.
- Registrar objetivo, meta, alcance incluido, exclusiones, responsables, fechas y criterio global de éxito.
- Definir etapas como bloques temporales, sin inventar peso de avance.
- Crear roles internos y permisos de publicación.
- Separar borrador interno de información visible al cliente.

Puerta de salida: un usuario NEXOR puede crear y publicar un proyecto completo sin editar la base de datos ni el código.

## Fase 3 — Operación completa de soluciones

Estado: modelo definido; experiencia de creación pendiente.

- Crear una solución dentro de un proyecto.
- Generar primero su **Ficha de solución**.
- Versionar la ficha y registrar entrevistas, proceso actual/propuesto, usuarios, permisos, afectaciones, riesgos, alcance y exclusiones.
- Definir entregables y criterios de aceptación.
- Obtener aprobación o solicitud de cambios.
- Planear tareas, asignaciones, estimaciones y fechas.
- Registrar horas, evidencia y bloqueos.
- Cerrar una solución solo cuando sus entregables comprometidos hayan sido aceptados.

Puerta de salida: de una entrevista se puede llegar a una solución aprobada, ejecutada y cerrada con trazabilidad completa.

## Fase 4 — Portal del cliente completo

Estado: Inicio avanzado; demás secciones por completar.

Navegación canónica:

- Inicio
- Soluciones
- Entregables
- Documentos
- Decisiones

Objetivos:

- Mostrar solo contenido publicado y relevante.
- Concentrar aprobaciones, solicitudes de cambio y fechas límite.
- Permitir abrir la evidencia de cada porcentaje.
- Presentar documentos y entregables con estado, versión y decisión.
- Diseñar vacíos, errores, permisos y notificaciones sin lenguaje técnico.

Puerta de salida: un cliente puede entender y atender su proyecto sin capacitación formal.

## Fase 5 — Documentos comerciales y contractuales

Estado: pendiente de diseño funcional y revisión legal.

Generar desde los mismos datos del sistema:

- contrato;
- Statement of Work (SOW);
- resumen ejecutivo de entregables;
- resumen visual de una hoja por solución;
- anexo de alcance, exclusiones y criterios de aceptación.

Los documentos deben tener versión, fecha, origen de datos y estado de aprobación. La generación automática no sustituye revisión humana o legal.

Puerta de salida: el sistema produce un paquete coherente sin volver a capturar objetivo, alcance, fechas o entregables.

## Fase 6 — Integraciones y automatización

Estado: deliberadamente postergada hasta estabilizar el proceso humano.

- Importar actividad de Git como evidencia, no como avance ni calidad.
- Enviar notificaciones configurables.
- Integrar firma electrónica si el proceso ya está validado.
- Sincronizar calendarios o herramientas operativas solo donde reduzca duplicidad.
- Evaluar facturación por hitos después de cerrar el modelo de aceptación.

Puerta de salida: cada integración tiene propietario, reintentos, auditoría y modo manual de contingencia.

## Fase 7 — Gobierno, seguridad y escala

Estado: transversal; se endurece en cada entrega.

- Matriz de roles y permisos por empresa y proyecto.
- Pruebas de aislamiento multiempresa y políticas RLS.
- Historial inmutable de decisiones críticas.
- Respaldo y restauración ensayados.
- Observabilidad, errores y métricas de uso.
- Accesibilidad y responsive.
- Rendimiento con múltiples proyectos, soluciones y documentos.
- Analítica para descubrir fricción, sin convertir métricas en vigilancia.

Puerta de salida: auditoría de seguridad y recuperación satisfactoria antes de ampliar el uso real.

## Secuencia inmediata recomendada

1. Diseñar el recorrido interno mínimo de Fase 2.
2. Implementar un proyecto real con una solución real como piloto.
3. Completar el flujo de Fase 3 a partir de ese caso.
4. Construir Documentos, Entregables y Decisiones del portal con los mismos registros.
5. Generar el primer resumen de una hoja y SOW desde datos reales.
6. Solo entonces priorizar integraciones automáticas.

## Cómo se gobierna este plan

Cada bloque nuevo debe registrar:

- problema que resuelve;
- usuario y momento de uso;
- decisión de producto;
- datos fuente;
- definición de terminado;
- riesgos y permisos;
- prueba de escritorio y móvil;
- evidencia de staging;
- commit y respaldo.

Este archivo es el plan maestro. Debe actualizarse cuando cambie una decisión estructural, no por cada ajuste cosmético.
