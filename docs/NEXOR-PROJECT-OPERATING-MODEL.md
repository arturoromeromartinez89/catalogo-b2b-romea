# Modelo operativo de proyectos NEXOR IA

## Decisión principal

NEXOR IA conserva rigor, trazabilidad y evidencia en su operación interna, pero presenta al cliente una experiencia hipersimple. El cliente no debe aprender gestión de proyectos para entender qué se terminó, qué está ocurriendo y qué necesita decidir.

## Jerarquía canónica

1. Cliente
2. Proyecto
3. Etapa
4. Solución
5. Entregable
6. Tarea o actividad

Las etapas ordenan el tiempo. Las soluciones agrupan el valor que NEXOR entrega. Los entregables son compromisos verificables. Las tareas registran el trabajo que produce esos entregables.

## Ficha de solución

“Ficha de solución” es el nombre canónico del documento funcional que antecede el trabajo. Puede tener versiones, pero el cliente siempre encuentra un solo concepto.

Contenido mínimo:

- problema y objetivo;
- proceso actual y proceso propuesto;
- alcance incluido y excluido;
- usuarios, permisos y afectaciones;
- supuestos y riesgos;
- entregables y criterios de aceptación;
- decisión del cliente con comentario y fecha.

## Avance verificable

Se muestran dos medidas distintas:

- **Avance confirmado:** porcentaje ponderado de entregables aceptados por el cliente.
- **Avance de trabajo:** porcentaje ponderado de tareas terminadas respecto del trabajo estimado.

Las tareas canceladas se excluyen. Si una tarea no tiene estimación, pesa una unidad. Las etapas no agregan peso. Todo porcentaje debe poder abrirse y explicar sus componentes.

## Evidencia operativa

- Horas dedicadas: suma de registros de tiempo aprobados o registrados por el equipo.
- Líneas de código: suma de adiciones y eliminaciones registradas por periodo; no se interpreta como calidad ni como avance.
- Acciones del cliente: decisiones pendientes y solicitudes de cambios, con fecha límite cuando exista.
- Auditoría: eventos técnicos inmutables separados del feed editorial de actualizaciones.

## Estados globales

| Significado | Color | Ejemplos |
| --- | --- | --- |
| Terminado | Azul | terminado, entregado, aprobado |
| En proceso | Verde | activo, desarrollo, revisión interna |
| En espera | Naranja | pendiente de cliente, bloqueado, pausado, requiere cambios |
| Atrasado | Rojo | fecha vencida sin cierre |
| Cancelado | Negro | trabajo retirado del alcance |
| No iniciado | Gris | borrador, planeado |

El color nunca funciona solo: siempre aparece una etiqueta legible.

## Alcance inicial

La primera vertical funcional conecta un proyecto real con una solución, su Ficha de solución, entregables, criterios de aceptación, tareas, horas, actividad de desarrollo, una decisión del cliente y el dashboard/Gantt. Quedan fuera por ahora las firmas electrónicas, facturación por hitos, integración automática con Git, dependencias avanzadas y cascadas automáticas de fechas.
