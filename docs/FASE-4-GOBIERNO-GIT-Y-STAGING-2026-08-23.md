# Fase 4 — Gobierno Git y staging

Fecha de apertura: 23 de agosto de 2026  
Alcance autorizado: GitHub, copia local canonica y Vercel staging.  
Fuera de alcance: produccion, su base de datos, su proyecto Vercel, dominios y
la actualizacion de `main`.

## Objetivo

Hacer que cada cambio hacia staging tenga una rama, una PR, verificaciones
automaticas y una ruta de regreso identificable. Ningun cambio de esta fase
autoriza una publicacion productiva.

## Hallazgos iniciales

- `codex/project-hub-staging` estaba integrado en GitHub en `9e3d828`, pero la
  copia local canonica estaba cinco commits atras. Se sincronizo por
  fast-forward, sin cambios locales que preservar.
- El repositorio no tenia reglas de proteccion de ramas.
- No existia `.github/workflows`; el build y las pruebas dependian de ejecucion
  manual.
- `catalogo-b2b-staging-security` estaba aislado de produccion, pero no estaba
  conectado a un repositorio Git. Sus despliegues eran manuales por Vercel CLI.

## Controles de esta fase

1. La rama de staging recibe cambios mediante PR.
2. GitHub Actions ejecuta instalacion reproducible, baseline, aislamiento por
   tenant, politica de diseno y build de staging.
3. La rama `main` queda protegida, pero no se actualiza ni despliega durante
   esta fase.
4. Vercel staging se conecta exclusivamente al repositorio aprobado y usa
   `codex/project-hub-staging` como rama de produccion del proyecto de pruebas.
   La palabra "Production" dentro de ese proyecto sigue significando la URL
   estable de staging, no el sistema vivo de clientes.
5. La revision posterior al despliegue rechaza cualquier host distinto de
   `catalogo-b2b-staging-security.vercel.app`.

## Flujo diario

1. Crear una rama `codex/*` desde `codex/project-hub-staging` actualizado.
2. Implementar y probar localmente.
3. Abrir PR hacia `codex/project-hub-staging`.
4. Esperar que `Quality gate / Build and tenant checks` quede verde.
5. Revisar el preview de Vercel y el flujo afectado.
6. Aprobar y fusionar la PR.
7. Confirmar el despliegue estable de staging y registrar el SHA.

## Reversion ensayable en staging

La reversion de frontend no reescribe historial ni usa `git reset --hard`:

1. Identificar el ultimo SHA bueno en la PR y el deployment correspondiente.
2. En Vercel staging, promover nuevamente ese deployment a la URL estable, o
   crear una PR que revierta el commit defectuoso.
3. Ejecutar `npm run check:staging-deployment`.
4. Verificar login y el flujo afectado con datos ficticios.
5. Documentar incidente, SHA retirado, SHA restaurado y responsable.

Las migraciones de base siguen el patron expandir/migrar/comprobar/retirar. No
se revierten destruyendo columnas o datos. Esta fase no aplica SQL.

## Criterio de cierre

- PR de Fase 4 integrada en staging con el quality gate verde.
- Reglas de ramas visibles en GitHub.
- Vercel staging conectado a Git y desplegado desde un SHA identificable.
- Comprobacion HTTP de staging aprobada.
- Evidencia y limitaciones guardadas fuera del repositorio publico.

