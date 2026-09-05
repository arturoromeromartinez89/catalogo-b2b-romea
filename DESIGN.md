---
name: "NEXOR IA Studio"
description: "Sistema visual de bóveda clara para accesos, operación y liberación segura de trabajo."
colors:
  vault-ink: "#0b1330"
  vault-ink-deep: "#070d22"
  vault-blue: "#4f7bff"
  live-cyan: "#2fe3d0"
  live-cyan-strong: "#17b9ab"
  live-cyan-hover: "#6df3e5"
  attention-yellow: "#ffcf71"
  attention-soft: "#fff4d9"
  vault-ground: "#f2f5fa"
  vault-paper: "#ffffff"
  vault-fog: "#eaf0ff"
  operational-muted: "#71809f"
  operational-muted-dark: "#52627f"
  danger-signal: "#ff7c88"
typography:
  display:
    fontFamily: "Space Grotesk, Inter, system-ui, sans-serif"
    fontSize: "clamp(32px, 4.2vw, 58px)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Space Grotesk, Inter, system-ui, sans-serif"
    fontSize: "clamp(26px, 3vw, 38px)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Space Grotesk, Inter, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.62
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "9px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "0.1em"
rounded:
  sm: "10px"
  md: "14px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.live-cyan}"
    textColor: "{colors.vault-ink-deep}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.live-cyan-hover}"
    textColor: "{colors.vault-ink-deep}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.vault-paper}"
    textColor: "{colors.vault-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "40px"
  briefing-plate:
    backgroundColor: "{colors.vault-ink}"
    textColor: "{colors.vault-fog}"
    rounded: "{rounded.lg}"
    padding: "clamp(24px, 3.2vw, 38px)"
  attention-module:
    backgroundColor: "{colors.attention-soft}"
    textColor: "{colors.vault-ink}"
    rounded: "{rounded.lg}"
    padding: "18px"
  plan-container:
    backgroundColor: "{colors.vault-paper}"
    textColor: "{colors.vault-ink}"
    rounded: "{rounded.lg}"
    padding: "clamp(22px, 2.8vw, 32px)"
  release-line:
    backgroundColor: "{colors.vault-ink}"
    textColor: "{colors.vault-fog}"
    rounded: "{rounded.lg}"
    height: "82px"
  work-ledger:
    backgroundColor: "{colors.vault-paper}"
    textColor: "{colors.vault-ink}"
    rounded: "{rounded.lg}"
---

# Design System: NEXOR IA Studio

## Overview

**Creative North Star: "La Bóveda de Briefing"**

Project Hub se siente como una bóveda clara que ha abierto una placa de briefing ejecutivo: la información decisiva queda protegida por tinta profunda y aparece antes que la evidencia operativa. La composición modular responde, en este orden, dónde está el proyecto, qué se está moviendo y qué requiere atención del cliente. El resultado debe ser serio, preciso y técnico sin exigir vocabulario de gestión de proyectos.

La luz fría, el campo de nodos restringido y la asimetría editorial forman el mundo NEXOR sin convertir la superficie en una pieza promocional. Cian, azul y amarillo son señales escasas con funciones distintas; el resto de la interfaz permanece calmado para que progreso, navegación y decisiones no compitan entre sí. La dirección `project-briefing`, semilla `afbec59f`, superó la revisión final con disposición `ship` y es la autoridad durable para futuras superficies cliente del hub.

En superficies internas de operación, la misma bóveda se expresa como una línea de liberación visible seguida por un libro de trabajo denso. Cada etapa declara secuencia, volumen y estado; cada registro mantiene una sola acción siguiente hasta quedar completo para su consumidor. Esta extensión conserva el shell de navegación, las superficies blancas de evidencia y la disciplina cromática incumbentes.

**Key Characteristics:**

- Briefing ejecutivo antes que detalle operativo.
- Bóveda luminosa con una placa central de tinta profunda.
- Asimetría modular legible, no una cuadrícula de tarjetas equivalentes.
- Cian para señal viva y acción principal; azul para navegación y progreso; amarillo para atención.
- Campo de nodos tenue y profundidad ambiental, nunca ornamental.
- Tipografía de display compacta y datos con numerales tabulares.
- Flujos operativos con etapas visibles, cola searchable y una sola acción siguiente.

## Identidad NEXOR IA Studio

El logotipo oficial con la palabra `studio` es la marca maestra de producto en acceso, portal cliente y Superadmin. En superficies claras se usa `nexoria-studio_lockup_dark-on-transparent.svg`; sobre tinta profunda se usa `nexoria-studio_lockup_transparent.svg`. No se alteran curvas, colores, proporción ni línea base del archivo oficial.

El lockup completo nunca se muestra por debajo de 160px de ancho. En encabezados móviles se sustituye por `nexoria-studio_isotipo_on-white.svg`, conservando así legibilidad y jerarquía. El acceso compartido es siempre neutral y muestra únicamente NEXOR IA Studio; la identidad del cliente aparece después de autenticar, dentro de su espacio de trabajo, y nunca reemplaza a la marca del sistema.

**The Master Brand Rule.** NEXOR IA Studio identifica el producto y es la única marca del acceso. El logotipo y nombre del cliente identifican su espacio únicamente después de iniciar sesión. Nunca fusionar ambos niveles en un logotipo inventado.

**The Secure Threshold Rule.** El acceso debe sentirse como el umbral de una bóveda operativa: logotipo dominante y promesa breve sobre tinta profunda, formulario directo sobre suelo claro y una sola acción cian. En el formulario se usa el isotipo institucional libre, nunca el mosaico de aplicación ni ornamentos externos. La animación sucede únicamente en sus conexiones y nodos oficiales; `prefers-reduced-motion` conserva una señal visible mediante color y opacidad, sin desplazamiento.

## Colors

La paleta combina un suelo frío y papel blanco con tinta de bóveda; los acentos funcionan como señales operativas de baja frecuencia.

### Primary

- **Tinta de Bóveda:** Base de las placas ejecutivas, resúmenes de evidencia y texto de máxima autoridad.
- **Cian Vivo:** Estado activo, acción principal y señal de sistema en curso.

### Secondary

- **Azul de Progreso:** Navegación, cambio de vista, foco y avance; conecta la interfaz con la evidencia temporal.

### Tertiary

- **Amarillo de Atención:** Decisiones y revisiones pendientes del cliente; siempre aparece junto a texto o cantidad explícita.

### Neutral

- **Suelo de Bóveda:** Fondo frío del espacio de trabajo y soporte del campo de nodos.
- **Papel de Evidencia:** Cronograma, módulos claros y controles secundarios.
- **Niebla de Bóveda:** Texto y marcas sobre tinta profunda.
- **Silencio Operativo:** Metadatos, ayudas y etiquetas secundarias sobre superficies claras.

### Named Rules

**The Three Signals Rule.** Cian significa actividad o acción principal, azul significa navegación o progreso y amarillo significa atención; no intercambiar sus funciones.

**The Signal Rarity Rule.** Mantener los acentos fuera de superficies extensas: su escasez es lo que hace visibles los estados y decisiones.

## Typography

**Display Font:** Space Grotesk (con Inter y system-ui como fallback)
**Body Font:** Inter (con system-ui y Segoe UI como fallback)
**Label/Mono Font:** Inter; usar numerales tabulares en progreso, conteos y fechas.

**Character:** Space Grotesk aporta la voz compacta, geométrica y ejecutiva de NEXOR. Inter conserva claridad en descripciones, navegación, controles y datos densos; la pareja debe sentirse técnica pero accesible para un cliente no especialista.

### Hierarchy

- **Display** (700, escala fluida, 0.98): Nombre del proyecto dentro de la placa de briefing; balancear líneas y limitar su ancho para conservar el golpe editorial.
- **Headline** (700, escala fluida, 1.1): Títulos de evidencia y secciones principales como el cronograma de soluciones.
- **Title** (700, 20px, 1.25): Nombres de solución, tarjetas operativas y encabezados secundarios.
- **Body** (400, 14px, 1.62): Descripción del proyecto y ayudas; mantener una medida aproximada de 68 caracteres.
- **Label** (800, 9px, 0.1em, mayúsculas): Hechos, estados y metadatos compactos; no usar para párrafos.

### Named Rules

**The Executive Compression Rule.** Reservar Space Grotesk y el tracking negativo para identidad, cifras y títulos; la lectura operativa permanece en Inter.

## Layout

El espacio de trabajo usa un campo centrado de hasta 1240px sobre una trama de nodos de 30px. La portada es un grid asimétrico: la placa principal ocupa la columna dominante y dos módulos compactos apilan progreso y atención; el cronograma sigue inmediatamente como evidencia. El ritmo se apoya en pasos de 4px con separaciones recurrentes de 12px, 16px, 20px, 24px y 32px.

En anchos intermedios la columna de señales se estrecha sin perder su jerarquía. A 760px o menos, la placa ocupa todo el ancho y progreso/atención forman dos columnas en la fila siguiente; la franja de resumen del cronograma conserva sus tres métricas en una banda desplazable. La navegación lateral colapsa a iconos sin alterar el orden de lectura. No debe existir desbordamiento horizontal de la página en 390×844; solo los datos intrínsecamente panorámicos, como la franja métrica, pueden desplazarse dentro de su propio contenedor.

**The Briefing-Then-Evidence Rule.** La identidad, el estado, el movimiento y la atención se leen antes del detalle del plan; no insertar paneles equivalentes entre ambas capas.

En flujos internos de varias manos, la primera vista conserva el resumen de acción y una línea compacta de etapas antes de la cola. El libro de trabajo se extiende hasta 1440px para sostener densidad; al seleccionar un registro abre un inspector lateral de 320–390px, que baja debajo de la cola a 900px. A 620px la línea se pliega a dos columnas y cada fila reduce su información a identificador, descripción, dato esencial y estado, sin scroll lateral de página.

**The Visible Handoff Rule.** Cada etapa de un flujo compartido muestra secuencia y volumen antes de la cola; el detalle conserva una sola acción siguiente y no permite publicar mientras falten controles.

## Elevation & Depth

El sistema usa profundidad ambiental: sombras largas, muy recortadas y de baja opacidad separan briefing, señales y plan del suelo frío, mientras el contraste tonal hace la mayor parte del trabajo. El campo de nodos permanece casi subliminal y solo la placa oscura admite un patrón interno más expresivo. Los controles pueden elevarse 2px al pasar el puntero, pero las superficies están quietas en reposo.

### Shadow Vocabulary

- **Placa de briefing** (`0 24px 54px -38px rgba(7, 13, 34, .78)`): Ancla la gran superficie de tinta sin crear una tarjeta flotante pesada.
- **Señal clara** (`0 20px 42px -34px rgba(11, 19, 48, .55)`): Separa progreso del suelo manteniendo una lectura plana.
- **Plan de evidencia** (`0 28px 58px -46px rgba(11, 19, 48, .58)`): Da continuidad vertical al cronograma de soluciones.

**The Ambient Depth Rule.** Las sombras organizan capas y nunca decoran cada elemento; dentro de una superficie, preferir líneas tenues y contraste tonal.

## Shapes

La forma dominante es un rectángulo suavemente curvado de 16px para placas y contenedores, con radios de 14px en resúmenes internos y 10px en controles. Píldoras completas se reservan para estados, conteos y marcadores circulares. Los cortes editoriales aparecen mediante módulos asimétricos, bordes de estado y divisiones finas; no mediante diagonales gratuitas o siluetas ilustrativas. Los nodos son puntos pequeños y repetidos, nunca una textura protagonista.

## Components

### Buttons

- **Shape:** Control compacto y seguro con esquinas de 10px y altura mínima de 40px.
- **Primary:** Cian vivo sobre tinta profunda, peso 600 y padding horizontal de 16px; es la acción única de mayor prioridad en su contexto.
- **Hover / Focus:** El hover aclara el cian; el foco usa un contorno azul de 3px con offset de 3px y nunca depende solo del cambio de color.
- **Secondary:** Papel blanco, texto de tinta y borde tenue; en placas oscuras se vuelve translúcido con texto blanco sin perder el borde.

### Chips

- **Style:** Píldoras compactas con texto semibold; los estados activos usan cian suave y los pendientes usan amarillo suave.
- **State:** Cada chip combina color con una palabra de estado o conteo; nunca dejar un punto cromático sin explicación.

### Cards / Containers

- **Corner Style:** Placas y plan en 16px; bloques internos y franjas de resumen en 14px.
- **Background:** Tinta para briefing y consolidación; papel para evidencia; amarillo suave solo para atención pendiente.
- **Shadow Strategy:** Aplicar exclusivamente el vocabulario ambiental de la sección Elevation & Depth.
- **Border:** Omitir el borde cuando el contraste tonal ya separa la superficie; usar líneas frías y tenues para divisiones internas.
- **Internal Padding:** Entre 18px y 38px según jerarquía y viewport.

### Inputs / Fields

- **Style:** Papel blanco, trazo frío de 1px, esquinas de 10px, texto de 14px y padding de 12px.
- **Focus:** Contorno azul visible de 3px y offset exterior; conservar el trazo base.
- **Error / Disabled:** Combinar mensaje o etiqueta con la señal roja; los estados deshabilitados reducen opacidad sin borrar la etiqueta.

### Navigation

La navegación lateral vive en tinta profunda y usa Inter semibold. El estado activo mezcla una banda cian/azul, una línea cian a la izquierda, texto blanco e icono cian; el estado por defecto usa azul grisáceo. En móvil colapsa a una columna de iconos de 66px, conservando foco, contadores y orden.

### Briefing Plate

Es el componente firma: gradiente de tinta profunda, título Space Grotesk, estado activo, descripción, contexto, contrato y tres hechos clave. Un campo de nodos restringido ocupa solo la esquina inferior; jamás debe competir con el nombre del proyecto.

### Cronograma de soluciones

Existe **un solo cronograma** en Inicio. No hay selector de vistas ni tablero paralelo: duplicar la misma evidencia con dos nombres rompe la fuente única de verdad.

- Cubre los próximos tres meses; el horizonte se enuncia una sola vez, en el texto auxiliar del encabezado, nunca como kicker adicional.
- Cada solución se despliega **in situ**, dentro del mismo cronograma, para revelar sus actividades; una actividad abre directamente su detalle.
- La entrada de contenido usa 320ms con desplazamiento corto y desenfoque que se anula por completo; `prefers-reduced-motion` reduce toda animación a duración prácticamente nula.

**Estados en el cronograma.** Solución y actividad muestran siempre su estado con color y palabra, según los seis estados globales. Las actividades canceladas se muestran en negro, conservan su detalle y quedan fuera de todo cálculo de avance; no se ocultan.

### Cronograma en móvil

A 760px o menos el cronograma se transforma en una **lista desplegable vertical**. No existe timeline horizontal, ni Gantt desplazable, ni scroll lateral de la página.

- Se ocultan la cabecera de meses y las barras; la señal de estado viaja en el borde izquierdo de la fila y en una píldora con la palabra del estado.
- Los seis colores —azul, verde, naranja, rojo, negro y gris— se conservan íntegros en solución y actividades.
- La jerarquía solución → actividad se conserva por sangría y por el control de desplegar, no por posición temporal.

### Línea de liberación

La línea de liberación es el componente firma para trabajo que pasa entre responsables. Usa una placa continua de tinta, cuatro etapas equivalentes, numerales tabulares y una línea inferior que combina cian, azul y amarillo; seleccionar una etapa filtra la misma cola, no abre un tablero paralelo. La entrada de la línea dura 560ms con una curva de desaceleración marcada y se reduce a 1ms bajo `prefers-reduced-motion`.

### Libro de trabajo e inspector

La cola es una superficie blanca, searchable y de alta densidad. Cada fila comunica identificador, descripción, dato operacional, etapa con palabra y siguiente control; el color refuerza, pero nunca sustituye, esas etiquetas. La selección se marca con un fondo azul tenue y un borde interior, y abre un inspector con encabezado de tinta, hechos tabulares, checklist de liberación y una sola acción primaria contextual. Los formularios se abren en ese mismo inspector para mantener la relación con la cola.

## Do's and Don'ts

### Do:

- **Do** mantener juntos progreso y atención como señales compactas inmediatamente adyacentes a la placa principal.
- **Do** hacer que el cronograma parezca evidencia de la síntesis ejecutiva, no una aplicación separada.
- **Do** usar etiquetas, cantidades y formas además del color para todos los estados.
- **Do** preservar el orden de lectura y los valores de progreso y atención en el primer viewport móvil.
- **Do** utilizar el lockup oficial de NEXOR cuando exista espacio y mantener clara la jerarquía con la marca del cliente.
- **Do** mostrar conteo, etapa escrita y siguiente control en los flujos que atraviesan varias manos.
- **Do** bloquear la acción de publicación hasta que los requisitos verificables del registro estén completos.

### Don't:

- **Don't** convertir la superficie en una cuadrícula uniforme de tarjetas de dashboard.
- **Don't** ampliar el campo de nodos hasta competir con texto, datos o controles.
- **Don't** usar fondos crema cálidos, grises slate genéricos o un tema oscuro como experiencia cliente predeterminada.
- **Don't** intercambiar cian, azul y amarillo ni comunicar estado únicamente con color.
- **Don't** introducir claims, métricas comerciales o ventajas competitivas que no estén confirmadas por el producto.
- **Don't** sustituir una línea de liberación por un formulario genérico que oculte trabajo incompleto o la siguiente acción.
