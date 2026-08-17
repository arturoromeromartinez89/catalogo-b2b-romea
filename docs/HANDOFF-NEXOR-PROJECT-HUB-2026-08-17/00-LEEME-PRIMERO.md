# Relevo del Project Hub de NEXOR IA

Fecha de corte: 17 de agosto de 2026

Repositorio canónico: `C:\Users\Vanguardia\Documents\GitHub\catalogo-b2b-romea-project-hub-deploy`

Rama de trabajo: `codex/project-hub-staging`

Staging: <https://catalogo-b2b-staging-security.vercel.app/catalogo/demo/project-hub>

## Propósito de esta carpeta

Esta carpeta permite que Arturo, Claude u otro desarrollador continúen el proyecto sin depender de la conversación que originó el trabajo. Resume la meta, las decisiones ya cerradas, el estado técnico, lo que está desplegado y el orden exacto de lo que falta.

## Meta del producto

Construir el sistema operativo de proyectos de NEXOR IA: un espacio interno riguroso para convertir un cliente y un acuerdo en proyectos, etapas, soluciones, entregables y tareas verificables; y un portal externo hipersimple donde el cliente pueda entender el avance, revisar evidencia y tomar decisiones.

La regla madre es:

> Máximo rigor interno. Mínimo esfuerzo visible.

El cliente no debe aprender gestión de proyectos ni lenguaje técnico para saber:

1. cuánto está realmente terminado;
2. en qué etapa se encuentra el proyecto;
3. qué necesita aprobar o responder;
4. qué trabajo se ha realizado;
5. qué ocurrirá durante los siguientes tres meses.

## Qué ya existe

- Base visual revisada y respaldada en Git.
- Inicio del portal convertido en dashboard funcional.
- Cronograma desplegable de tres meses con soluciones y tareas.
- Modelo de datos funcional en Supabase staging.
- Registros reales de demostración para entregables, criterios, tareas, horas, código y decisiones.
- Cálculo separado de avance confirmado y avance de trabajo.
- Flujo de aprobación y solicitud de cambios.
- Migraciones de integridad, auditoría y marcas de tiempo aplicadas en staging.
- Build de producción y build de staging aprobados.
- Evidencia visual de escritorio y móvil guardada en `.impeccable/review/`.

Los datos que se ven en la demostración siguen siendo sintéticos, pero ya se calculan desde registros coherentes; no son porcentajes escritos arbitrariamente en la interfaz.

## Cómo retomar sin riesgo

Leer, en este orden:

1. `00-LEEME-PRIMERO.md`
2. `01-PLAN-MAESTRO.md`
3. `02-DECISIONES-DE-PRODUCTO.md`
4. `03-ESTADO-TECNICO-Y-ARQUITECTURA.md`
5. `04-INSTRUCCIONES-PARA-CLAUDE.md`
6. `05-VERIFICACION-DEPLOY-Y-SEGURIDAD.md`
7. `06-INVENTARIO-DE-ARCHIVOS.md`
8. `PRODUCT.md`
9. `DESIGN.md`
10. `docs/NEXOR-PROJECT-OPERATING-MODEL.md`

Antes de modificar cualquier archivo:

```powershell
Set-Location 'C:\Users\Vanguardia\Documents\GitHub\catalogo-b2b-romea-project-hub-deploy'
git status --short
git branch --show-current
git log -5 --oneline
```

No cambiar de rama, no limpiar cambios locales y no usar comandos destructivos. Nunca desplegar al proyecto de producción desde este relevo.

## Estado de corte

La primera vertical funcional está implementada y desplegada en staging. Una revisión final independiente pidió siete ajustes antes de considerarla cerrada. Están enumerados, en orden, en `04-INSTRUCCIONES-PARA-CLAUDE.md`. El siguiente responsable debe resolverlos, verificar, volver a desplegar staging y actualizar esta carpeta con el nuevo estado.
