# Relevo para Codex — rediseño del superadmin (NEXOR Studio)

Fecha: 17 de agosto de 2026. Escrito por Claude para que Codex retome el trabajo.

## Encargo de Arturo

El superadmin **sigue viéndose mal**. Rehacerlo usando **la misma estructura de diseño de la primera versión del portal del cliente de Estuches Chávez**, que sí quedó bien.

La referencia visual que hay que respetar está viva y desplegada:

<https://catalogo-b2b-staging-security.vercel.app/catalogo/demo/project-hub>

## Dónde está todo

| Dato | Valor |
| --- | --- |
| Repositorio | `C:\Users\Vanguardia\Documents\GitHub\catalogo-b2b-romea-project-hub-deploy` |
| Rama | `codex/project-hub-staging` |
| Último commit | `648aefa fix(project-hub): close functional dashboard review` |
| Estado del árbol | **Todo lo de hoy está SIN COMMIT.** 5 archivos modificados, 6 nuevos. |
| Desplegado en staging | Sí, ya está en la URL canónica, aunque no esté commiteado. |
| Migración de base | **Ya aplicada** en Supabase staging `vafqcvpzksjlrborxoos`. |

Antes de tocar nada:

```powershell
Set-Location 'C:\Users\Vanguardia\Documents\GitHub\catalogo-b2b-romea-project-hub-deploy'
git status --short
git diff
```

## Archivos que toqué

### Nuevos

| Archivo | Qué es |
| --- | --- |
| `src/nexorStudio.css` | **La piel del superadmin. Este es el archivo del problema.** Todo bajo `.nexor-studio`. |
| `src/components/superadmin/ProjectStudio.jsx` | Alta de clientes y proyectos: lista de clientes, ficha del proyecto, equipo. |
| `src/pages/StudioDemoPage.jsx` | Ruta `/demo/studio`, solo staging, datos inventados, **sin login**. Sirve para revisar el diseño sin credenciales. |
| `supabase/migrations/20260817160000_project_operational_hierarchy.sql` | Migración ya aplicada. No volver a ejecutar. |
| `scripts/gen-definicion-funcional-pdf.py` | Genera el PDF de definición funcional. |
| `docs/NEXOR-IA-DEFINICION-FUNCIONAL-Y-DATOS.pdf` | Documento para el programador nuevo. |

### Modificados

| Archivo | Qué cambié |
| --- | --- |
| `src/components/superadmin/SuperAdminDashboard.jsx` | Reemplacé el shell viejo del catálogo por el shell del portal. Agregué prop `demoData`. |
| `src/App.jsx` | Ruta `/demo/studio` cuando `VITE_DEPLOY_ENV === "staging"`. |
| `src/main.jsx` | Importa `nexorStudio.css` al final. |
| `src/projectHub.css` | Estilos de `.ph-studio__*` para el alta de clientes. |
| `src/services/projectHubService.js` | Campos nuevos del proyecto y equipo (`project_members`). |

## Qué intenté y por qué sigue sin convencer

Reutilicé literalmente las clases del portal para el armazón:

```jsx
<div className="project-hub-demo-shell project-hub-demo-shell--light nexor-studio-shell">
  <header className="project-hub-demo-bar"> ... </header>
  <section className="project-hub project-hub--light nexor-studio">
    <aside className="project-hub__sidebar"> ... </aside>
    <main className="project-hub__workspace">
      <section className="project-section-page nexor-studio__page"> ... </section>
    </main>
  </section>
</div>
```

Medí contra el portal en vivo y los valores coinciden: barra `rgba(255,255,255,.98)` de 70 px, lockup de 48 px, lateral con el degradado de tinta, ancho 246 px que colapsa a 66 px, suelo `#f2f5fa` con campo de nodos, acento `#087e74`, títulos en Space Grotesk 24 px, apoyo `#5c698d`, tarjetas de papel con borde `rgba(30,42,84,.13)` y radio 16 px.

**El armazón coincide. Lo que no funciona es el contenido dentro del área de trabajo.** Mi hipótesis de por qué:

1. Los paneles internos (`CompaniesPanel`, `UsersPanel`, `MetricsPanel`) conservan el marcado del admin de Romea —`admin-soft-panel`, `simple-admin-table`, `form-grid`— y yo solo los repinté con CSS. Repintar no cambia la composición: siguen siendo formularios y tablas de otro producto metidos en una superficie que fue diseñada para otra cosa.
2. El portal del cliente **no usa tablas ni formularios**: usa placas, módulos de señal y listas con estado. Esa gramática es la que hay que trasladar, no solo la paleta.
3. El área de trabajo del portal tiene una jerarquía clara —placa principal, señales compactas, evidencia—. El superadmin no tiene equivalente: hoy es un encabezado seguido de paneles sueltos.

## Lo que sí quedó medido y funcionando

No hace falta rehacerlo, pero conviene conservarlo:

- Contraste: 40 textos medidos en las cinco secciones, escritorio y móvil, **0 fallan** WCAG AA.
- Sin desbordamiento horizontal en 1366 ni en 390.
- Barra superior en una sola fila (el portal apila en columna todo `div` hijo de su barra; hay que restituir la fila).
- Lista de clientes: filas de 60 px iguales, tres botones en un renglón.
- Móvil: lateral de 66 px, relleno del área `14px 12px 24px`, igual al portal.

## Trampas que ya encontré y conviene no repetir

1. **El admin del catálogo Romea comparte clases** con el superadmin (`admin-soft-panel`, `simple-admin-table`, `superadmin-shell`). Todo lo mío vive bajo `.nexor-studio` justamente para no romper el catálogo de las empresas. Conservar ese encierro.
2. **`.simple-admin-table` trae `background: #ffffff`** del mundo Romea. Si se pinta texto claro encima sin anularlo, queda blanco sobre blanco. Ya me pasó.
3. **`.project-hub-demo-bar > div`** fuerza `flex-direction: column` a todo div hijo. Rompe cualquier grupo de controles en la barra.
4. **`.project-hub` tiene `transition: grid-template-columns .22s`.** Al medir con el navegador sin componer frames, el valor queda congelado y parece un defecto que no existe.
5. **El build vacía `dist/`**, así que cualquier archivo de prueba puesto ahí desaparece en la siguiente compilación.

## Estado de la base de datos

La migración `20260817160000_project_operational_hierarchy.sql` **ya está aplicada** en staging. Verificado: 7 columnas nuevas, tabla `project_members`, 2 políticas. Agrega:

- `projects`: `objective`, `goal`, `included_scope[]`, `excluded_scope[]`
- `project_solutions`: `weight`
- `project_tasks`: `parent_task_id`, `assignee_profile_id`, `weight`
- `project_members` nueva, con RLS y auditoría
- Disparador que impide un tercer nivel de tareas

Una **Actividad** es una `project_tasks` con `parent_task_id`; una **Tarea** lo tiene nulo.

## Reglas del proyecto que siguen vigentes

- Solo staging. Producción `pyignizeoevafifzfnik` no se toca.
- El avance nunca se captura a mano: se calcula en `src/utils/projectHubModel.js`.
- Color siempre acompañado de palabra. Seis estados globales.
- Máximo rigor interno, mínimo esfuerzo visible.

## Lo que quedó pendiente de decidir

1. ¿El dominio propio es por proyecto o por cliente?
2. ¿El segundo integrante de NEXOR entra como `superadmin` o con un rol acotado a proyectos?
3. ¿Empresas y Métricas siguen en el menú diario o se agrupan en una sección aparte?
4. ¿Se conservan las etiquetas pequeñas sobre los títulos? El portal las usa; el manual de diseño las desaconseja.

## Recomendación para quien retome

No seguir repintando los paneles heredados. Rehacer el contenido del área de trabajo con la gramática del portal del cliente: placa de identidad, señales compactas y listas con estado, en vez de tablas y formularios del admin de catálogo. El armazón ya está bien; lo que falta es que lo de adentro deje de ser Romea.
