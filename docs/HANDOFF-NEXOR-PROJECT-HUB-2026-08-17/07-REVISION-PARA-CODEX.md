# Revisión solicitada a Codex — trabajo de Claude del 17 de agosto de 2026

## Resultado de la revisión

Revisión completada por Codex el 17 de agosto de 2026: las siete correcciones fueron confirmadas, se unificó la nomenclatura restante de “Plan maestro” a “Inicio”, se sincronizaron los briefs persistentes y se desplegó staging. La actividad cancelada permanece en el demo del frontend como evidencia sintética y no altera 17 % / 7 %. `src/utils/projectHubModel.js` queda aprobado como fuente compartida y fue agregado al inventario.

Staging verificado: <https://catalogo-b2b-staging-security.vercel.app/catalogo/demo/project-hub>

Deployment: `dpl_F8gxhTmntF8w7djRWpyUh5qnBLpL`

Este documento se conserva como registro histórico. Sus secciones “Pendientes reales” y “Lo que se pide a Codex” describen el estado previo a esta revisión; el estado vigente está en `00-LEEME-PRIMERO.md` y `03-ESTADO-TECNICO-Y-ARQUITECTURA.md`.

Este documento existe para que Codex revise lo que hizo Claude sobre las siete correcciones de cierre y le informe a Arturo si algo está mal, incompleto o fuera de plan.

## Dónde está el trabajo

| Dato | Valor |
| --- | --- |
| Repositorio | `C:\Users\Vanguardia\Documents\GitHub\catalogo-b2b-romea-project-hub-deploy` |
| Rama | `codex/project-hub-staging` |
| Commit base | `43b5ad6 feat(project-hub): add functional vertical and master handoff` |
| Estado | **Cambios sin commit en el árbol de trabajo.** No hay commit, no hay push, no hay etiqueta. |
| Staging | **No se desplegó.** La URL canónica sigue sirviendo el código anterior. |

Para ver exactamente lo que cambió:

```powershell
Set-Location 'C:\Users\Vanguardia\Documents\GitHub\catalogo-b2b-romea-project-hub-deploy'
git status --short
git diff
```

Archivos tocados (7 modificados, 1 nuevo):

- `src/utils/projectHubModel.js` **(nuevo)**
- `src/components/ProjectSolutionsPlan.jsx`
- `src/components/ProjectHub.jsx`
- `src/components/SolutionWorkspace.jsx`
- `src/components/ProjectWorkboard.jsx`
- `src/components/superadmin/ProjectHubManager.jsx`
- `src/projectHub.css`
- `DESIGN.md`

No se tocaron migraciones, seeds, RLS, producción ni la base de datos.

## Qué se hizo por cada corrección

1. **Estados en la lista móvil.** Cada fila del cronograma lleva `project-gantt__row--state-<estado>`, que declara `--project-state-line`, `--project-state-tint` y `--project-state-ink` para los seis estados. Dentro de `@media (max-width: 760px)` esas variables pintan el borde izquierdo de la fila y una píldora con la palabra del estado (`.project-gantt__state-text`). En escritorio la píldora queda inerte para no alterar la composición ya revisada.
2. **Canceladas visibles.** Se eliminó el filtro `task.status !== "cancelled"` del cronograma. Se muestran en negro, abren su detalle, y el panel de actividad presenta el estado como chip negro de solo lectura con la nota "Retirada del alcance. No cuenta en el avance." El conteo de la solución dice `N actividades · 1 cancelada`, separando lo comprometido de lo retirado.
3. **Ficha de solución.** Las pestañas ahora son `Soluciones` y `Ficha de solución` (sin numeración). `childTitle` devuelve siempre "Ficha de solución" para esa tabla y `childMeta` agrega `Versión N` como metadato secundario. También se tradujeron `update_type` y `document_type` para no mostrar claves.
4. **Un solo cálculo de avance.** `src/utils/projectHubModel.js` es ahora la única fuente: `weightedPercentage`, `confirmedProgress`, `workProgress`, `toVisualStatus`, `statusLabel`, `VISUAL_STATUS_LABELS`. Excluye canceladas y registros no publicados, y un elemento sin estimación válida pesa una unidad. El portal y `ProjectHubManager` consumen la misma función.
5. **Sin claves internas.** `SolutionWorkspace` y `ProjectWorkboard` usan `statusLabel` del modelo compartido; se borraron sus mapas locales incompletos y el mapa duplicado del Studio.
6. **DESIGN.md.** Se eliminó la prescripción Cronograma/Tablero y se documentaron: cronograma único, soluciones desplegables in situ, lista móvil sin timeline horizontal y estados en el cronograma. Se sustituyeron las menciones a "Plan maestro" que ya no existen en la interfaz.
7. **Kicker.** Se eliminó `<p>Próximos 3 meses</p>` y su regla CSS; el horizonte aparece una sola vez en el texto auxiliar del encabezado.

## Cambio de datos que Codex debe validar

Se agregó **una** actividad cancelada sintética al proyecto demo de Estuches Chávez en `ProjectHub.jsx` (`task-11`, "Migrar historial anterior de existencias"), necesaria para verificar el estado negro exigido por la corrección 2.

No altera las cifras registradas en el relevo: avance confirmado 17 % y avance de trabajo 7 % se mantienen, precisamente porque las canceladas quedan fuera del cálculo. Si Codex prefiere que el ejemplo cancelado viva solo en el seed de staging y no en los datos demo del front, hay que decirlo antes del commit.

## Verificación ya ejecutada

```powershell
npm run build          # aprobado
npm run build:staging  # aprobado
git diff --check        # limpio
```

Revisión funcional sobre servidor local de Vite en `http://localhost:5186/demo/project-hub`, midiendo el DOM y los estilos calculados:

- La placa aparece solo en Inicio; Soluciones, Entregables, Documentos y Decisiones no la muestran.
- 12 filas en el cronograma: 1 solución + 11 actividades, incluida la cancelada.
- La actividad cancelada abre su detalle: chip negro `#15171d` con texto blanco, sin selector editable.
- Móvil 390×844: `scrollWidth` igual a `clientWidth`, sin desbordamiento horizontal; píldoras y bordes con los colores correctos.
- Escritorio 1280: barras intactas, incluida la barra negra de la cancelada; la píldora móvil no se activa.
- Ninguna clave interna (`planned`, `waiting`, `needs_changes`, `cancelled`, `backlog`, `todo`, `review`, `on_hold`, `at_risk`) aparece en el texto del portal en ninguna sección.

El servidor local necesitó variables de relleno porque el repositorio no tiene `.env` propio, solo `.env.example`, `.env.local` y `.env.staging.example`:

```powershell
$env:VITE_DEPLOY_ENV = 'staging'
$env:VITE_SUPABASE_URL = 'https://localpreview.supabase.co'
$env:VITE_SUPABASE_ANON_KEY = 'local-preview-placeholder'
node node_modules\vite\bin\vite.js --force --port 5186
```

La ruta `/demo/project-hub` solo se renderiza cuando `VITE_DEPLOY_ENV` es `staging`. Ese detalle debería quedar escrito en el relevo definitivo.

## Pendientes reales

1. **Deploy a staging no ejecutado.** Falta `npm run deploy:staging`. Arturo lo detuvo para pedir esta revisión.
2. **Capturas de `.impeccable/review/` no actualizadas.** No hay Playwright ni Puppeteer en el proyecto y el panel de navegador de la sesión no compone imágenes, así que no se pudieron regenerar `desktop.png` ni `mobile.png`. La evidencia disponible es la medición de DOM y estilos calculados descrita arriba. Los PNG siguen siendo los del corte anterior.
3. **Supabase DB lint pendiente**, igual que en el corte anterior: no hubo `SUPABASE_DB_PASSWORD` en la sesión y no se pidió acceso.
4. **Naranja y rojo sin filas vivas en la demo.** El dataset demostrativo no tiene actividades en espera ni atrasadas, así que esos dos colores solo se ven en la leyenda. El código los resuelve igual que los otros cuatro; se comprobó que las variables devuelven `#e88a17` y `#d73d50`. Si se quiere evidencia visual de los seis colores hay que sembrar una actividad bloqueada y una con fecha vencida, y eso sí movería el avance de trabajo.
5. **`evidence-toggle-active` sigue en el frontmatter de `DESIGN.md`.** Se conservó el token para no romper el esquema de `.impeccable/design.json`, aunque el control ya no existe en la superficie del cliente. Decidir si se retira.

## Decisiones que conviene confirmar o rebatir

1. Nuevo archivo `src/utils/projectHubModel.js` como fuente única en lugar de ampliar `projectHubService.js`. Se eligió `utils` porque no toca Supabase y lo consumen componentes puros. Falta agregarlo al inventario `06-INVENTARIO-DE-ARCHIVOS.md`.
2. El cliente **no** puede cancelar una actividad desde el portal: la RPC `move_project_task` solo acepta `backlog, todo, in_progress, review, done, blocked`, así que el estado cancelado se muestra de solo lectura en vez de ofrecer una opción que fallaría en el servidor. Cancelar es decisión interna de NEXOR. Si se quiere permitirlo habría que migrar la función.
3. El Kanban de la solución sigue con cinco columnas y **no** muestra las canceladas; la corrección 2 se aplicó al cronograma, que es lo que pedía la revisión. Confirmar si el tablero también debe exhibirlas.
4. `statusLabel` devuelve cadena vacía cuando el registro no maneja estado, para que el Studio pueda caer al tipo de documento o de actualización. Un estado desconocido se traduce al estado visual equivalente y nunca se imprime la clave.
5. En el Studio, la opción `planned` de periodos pasó de "Programado" a "Por iniciar" y `at_risk` de "En riesgo" a "Atrasado", para hablar el mismo idioma que la tabla global de estados.

## Lo que se pide a Codex

1. Leer `git diff` completo en la rama y confirmar que las siete correcciones quedaron resueltas como pedía `04-INSTRUCCIONES-PARA-CLAUDE.md`.
2. Verificar que no se rompió el catálogo ni ninguna función previa.
3. Opinar sobre las cinco decisiones anteriores y sobre la actividad cancelada agregada a los datos demo.
4. Decir si se procede con deploy a staging, commit, push y etiqueta, o si algo debe corregirse antes.
