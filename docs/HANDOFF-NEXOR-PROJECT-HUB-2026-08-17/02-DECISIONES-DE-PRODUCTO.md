# Decisiones de producto cerradas

## Regla madre

**Máximo rigor interno. Mínimo esfuerzo visible.**

La interfaz y los procesos deben ser hipersimples de entender y operar, aunque por debajo exista validación, seguridad, versiones, permisos y auditoría.

## Usuarios

- Principal: cliente de NEXOR IA que necesita entender el estado del proyecto y tomar decisiones.
- Secundario: equipo NEXOR IA que estructura, ejecuta, documenta y publica el trabajo.

## Jerarquía canónica

Cliente → Proyecto → Etapa → Solución → Entregable → Tarea o actividad.

- Un proyecto pertenece a un cliente nuevo o existente.
- Las etapas son bloques de tiempo y comunicación; no pesan en el avance.
- Las soluciones expresan valor entregado.
- Los entregables son compromisos verificables.
- Las tareas son el trabajo que produce los entregables.

## Nombre canónico del documento funcional

Usar siempre **Ficha de solución**. No mostrar “Functional Design Document”, “FDD”, “Ficha” aislada ni nombres alternativos al cliente.

Contenido mínimo:

- problema y objetivo;
- proceso actual y propuesto;
- alcance incluido y excluido;
- usuarios, permisos y afectaciones;
- supuestos y riesgos;
- entregables y criterios de aceptación;
- decisión, comentario y fecha.

Flujo visible:

crear → completar ficha → enviar a aprobación → planear trabajo → entregar y cerrar.

## Avance

- **Avance confirmado:** entregables aceptados, ponderados por su peso.
- **Avance de trabajo:** tareas terminadas, ponderadas por horas estimadas; una tarea sin estimación pesa una unidad.
- Las tareas canceladas se muestran, pero no participan en los cálculos.
- Las etapas no aportan peso.
- Todo porcentaje debe poder explicarse con sus componentes.

## Evidencia

- Horas dedicadas proceden de registros de tiempo.
- Líneas de código proceden de actividad de desarrollo registrada y muestran fecha de actualización.
- Las líneas de código no significan avance, calidad ni valor.
- El feed de actualizaciones es comunicación curada.
- La auditoría técnica es un registro separado e inmutable para acciones críticas.

## Estados globales

| Significado | Color | Estados equivalentes |
| --- | --- | --- |
| Terminado | Azul | terminado, entregado, aprobado |
| En proceso | Verde | activo, desarrollo, revisión interna |
| En espera | Naranja | pendiente, bloqueado, pausado, requiere cambios |
| Atrasado | Rojo | fecha vencida sin cierre |
| Cancelado | Negro | retirado del alcance |
| No iniciado | Gris | borrador, planeado |

Texto e icono acompañan siempre al color. Esta semántica aplica en dashboard, soluciones, entregables, tareas, decisiones, espacios internos y cronogramas.

## Navegación del cliente

Inicio / Soluciones / Entregables / Documentos / Decisiones.

Inicio debe mostrar, en ese orden conceptual:

1. avance confirmado;
2. etapa actual;
3. acciones o decisiones pendientes del cliente;
4. líneas de código registradas;
5. horas dedicadas;
6. cronograma desplegable de los siguientes tres meses.

La tarjeta principal del proyecto aparece únicamente en Inicio.

## Decisiones del cliente

Siempre ofrecer opciones equilibradas:

- Aprobar
- Solicitar cambios

Una aprobación debe registrar quién, cuándo y sobre qué versión decidió.

## Diferenciación

Todavía no existe evidencia suficiente para afirmar una ventaja competitiva frente a otras herramientas. No inventar claims. La hipótesis de valor es combinar rigor operativo con una experiencia del cliente radicalmente clara, y debe validarse con uso real.

## Fuera de alcance inmediato

- cascadas automáticas de fechas;
- integración automática con Git;
- firma electrónica;
- facturación por hitos;
- plantillas complejas;
- dependencias avanzadas;
- notificaciones complejas.
