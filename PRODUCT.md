# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

El usuario principal es el cliente de NEXOR IA que necesita entender el estado de su proyecto, revisar el trabajo disponible y tomar decisiones sin depender de lenguaje técnico ni de conversaciones dispersas.

El usuario secundario es el equipo NEXOR IA, que administra cada proyecto, organiza su alcance y publica la información que puede consultar el cliente.

## Product Purpose

Project Hub es un portal seguro de seguimiento de proyectos. Centraliza el plan maestro, las soluciones que componen cada proyecto, el avance, las tareas, los documentos, los entregables y las aprobaciones.

El producto existe para dar al cliente una visión clara y confiable del trabajo contratado y para que NEXOR IA mantenga esa comunicación estructurada desde un espacio operativo común.

## Positioning

La diferenciación frente a otras herramientas de gestión aún no está confirmada. Las decisiones futuras no deben inventar una ventaja competitiva hasta que exista evidencia o una definición explícita.

## Operating Context

- Cada cliente accede a información asociada a su empresa y a sus proyectos publicados.
- NEXOR Studio permite al equipo interno crear, actualizar y publicar proyectos y sus registros relacionados.
- El cliente consulta cronogramas, soluciones, tareas, documentos, entregables y solicitudes de aprobación.
- La experiencia debe presentar el estado del proyecto en términos ejecutivos y comprensibles, conservando el detalle operativo cuando sea necesario.
- El staging de Estuches Chávez funciona actualmente como superficie demostrativa para validar la experiencia antes de conectarla al seguimiento real.

## Capabilities and Constraints

- Aplicación web construida con React y Vite.
- Supabase proporciona autenticación, datos multiempresa, archivos y operaciones del Project Hub.
- La interfaz actual está redactada principalmente en español.
- El portal debe funcionar de forma responsive en escritorio y móvil.
- El tema claro es el predeterminado en superficies destinadas a clientes.
- La información demostrativa no debe confundirse con datos reales ni presentarse como evidencia comercial.
- La identidad de NEXOR IA debe convivir con la marca del cliente sin apropiarse de las aplicaciones independientes que se le entreguen.

## Brand Commitments

- Nombre maestro: NEXOR IA.
- Concepto de identidad: “Nodo · Bóveda segura”.
- La voz debe comunicar software serio, escalable, seguro y técnico.
- Debe usarse el componente o lockup oficial de NEXOR cuando exista espacio; no recrear el logo como texto plano.
- El cian se reserva para señales activas y acciones principales, el azul para navegación o progreso y el amarillo para atención o decisiones pendientes.
- El portal puede mostrar la identidad del cliente junto con NEXOR, manteniendo una jerarquía clara entre ambas.

## Evidence on Hand

- Sistema visual documentado en `docs/NEXOR-BRAND-SYSTEM.md`.
- Tokens de marca implementados en `src/nexorBrand.css`.
- Componentes de marca en `src/components/branding/NexorBrand.jsx`.
- Implementación del portal en `src/components/ProjectHub.jsx`, `src/components/ProjectSolutionsPlan.jsx` y `src/components/SolutionWorkspace.jsx`.
- Administración interna en `src/components/superadmin/ProjectHubManager.jsx`.
- Staging verificable en `https://catalogo-b2b-staging-security.vercel.app/catalogo/demo/project-hub`.
- No existe todavía evidencia confirmada de una ventaja competitiva frente a otros productos.

## Product Principles

1. Explicar el proyecto con claridad ejecutiva antes de exponer complejidad operativa.
2. Convertir avances, pendientes y decisiones en información visible y accionable.
3. Mantener una separación inequívoca entre datos demostrativos, borradores internos e información publicada al cliente.
4. Transmitir seguridad y control mediante comportamiento consistente, trazabilidad y estados comprensibles.
5. Respetar la identidad de cada cliente dentro del sistema maestro de NEXOR IA.

## Accessibility & Inclusion

- Mantener contraste suficiente y estados de foco visibles.
- No depender únicamente del color para comunicar estado, riesgo, progreso o aprobación.
- Conservar navegación y lectura utilizables en escritorio y móvil.
