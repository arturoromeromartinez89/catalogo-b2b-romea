# Sistema visual NEXOR IA

Fuente de referencia: `nexor-ia-nodo-x.html`, dirección **Nodo · Bóveda segura**.

## Alcance

Esta identidad se utiliza en:

- NEXOR IA como sistema maestro.
- NEXOR Studio y las herramientas internas de producción.
- Client Portal para seguimiento, aprobaciones, documentos y entregas.
- Pantallas que expresan conexión, seguridad, despliegues o estado técnico.

No se aplica automáticamente a las aplicaciones independientes entregadas a los clientes. Esas aplicaciones pueden vivir en el dominio, hosting, repositorio, base de datos e identidad del cliente. NEXOR sólo debe aparecer allí cuando exista una integración o atribución acordada.

## Identidad

- Concepto: **Nodo · Bóveda segura**.
- Isotipo: la X representa una red con un centro y cuatro nodos conectados.
- Wordmark: `ne` + X nodo + `or` + `IA` en cian y versalitas.
- Voz visual: software serio, escalable, seguro y técnico; evitar el aspecto de catálogo genérico.

## Tokens principales

| Token | Valor | Uso |
|---|---:|---|
| Tinta | `#0B1330` | Fondo principal |
| Tinta profunda | `#070D22` | Fondo de aplicación y navegación |
| Pizarra | `#1E2A54` | Superficies elevadas y estados hover |
| Cian señal | `#2FE3D0` | Estado activo, conexión, avance y acción primaria |
| Azul enlace | `#4F7BFF` | Navegación, vínculos y estados en progreso |
| Niebla | `#EAF0FF` | Texto principal |
| Muted | `#7E8BB5` | Texto secundario y líneas |

Los tokens implementados viven en `src/nexorBrand.css` bajo el prefijo `--nexor-*`.

## Tipografía

- **Space Grotesk**: marca, títulos, métricas y datos relevantes.
- **Inter**: navegación, formularios y texto de lectura.

## Componentes reutilizables

- `NexorBrand`: wordmark completo o compacto.
- `NexorNodeMark`: isotipo independiente para favicons, estados de conexión y superficies pequeñas.

No recrear el logo con texto plano `NEXOR IA` cuando haya espacio para usar el componente oficial.

## Reglas de interfaz

- Superficies oscuras con bordes discretos; profundidad por contraste, no por sombras pesadas.
- Cian reservado para señales activas y acciones principales.
- Azul reservado para navegación y elementos en progreso.
- Amarillo únicamente para atención o decisiones pendientes.
- Mantener contraste suficiente y estados visibles de foco.
- Usar el patrón de red con baja opacidad; nunca competir con los datos del cliente.
