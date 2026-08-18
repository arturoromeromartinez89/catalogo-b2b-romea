import { useMemo } from "react";
import { statusLabel } from "../utils/projectHubModel";
import ProjectWorkboard from "./ProjectWorkboard";

const workspaceIcon = (name) => {
  const paths = {
    back: <><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>,
    overview: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></>,
    planning: <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 4v4M15 10v4M11 16v4" /></>,
    approvals: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
    files: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 20h14" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
};

export default function SolutionWorkspace({ solution, project, tenantId = "", companyName = "", initialTaskId = "", onBack, onReload, onNotice }) {
  const solutionProject = useMemo(() => {
    const tasks = (project.tasks || []).filter((task) => task.solutionId === solution.id);
    const objectiveIds = new Set(tasks.map((task) => task.objectiveId).filter(Boolean));
    const objectives = (project.objectives || []).filter((objective) => objectiveIds.has(objective.id));
    const deliverables = (project.deliverables || []).filter((item) => item.solutionId === solution.id);
    return {
      ...project,
      name: solution.name,
      description: solution.description,
      progress: solution.progress,
      tasks,
      objectives,
      deliverables,
      solutionId: solution.id,
    };
  }, [project, solution]);

  const approvals = solution.approvals || [];
  const files = solution.files || [];
  const users = solution.users || [];
  const pendingApprovals = approvals.filter((item) => item.status === "pending").length;
  const deliverables = solutionProject.deliverables || [];
  const acceptedDeliverables = deliverables.filter((item) => ["approved", "accepted"].includes(item.status)).length;
  // Las tareas canceladas siguen siendo visibles, pero no cuentan como trabajo comprometido.
  const activeTasks = solutionProject.tasks.filter((task) => task.status !== "cancelled");
  const completedTasks = activeTasks.filter((task) => task.status === "done").length;

  return (
    <section className="solution-workspace" aria-label={`Espacio de trabajo de ${solution.name}`}>
      <button className="solution-workspace__back" type="button" onClick={onBack}>{workspaceIcon("back")}Volver a Inicio</button>

      <header className="solution-workspace__hero">
        <div>
          <p>Solución · {companyName}</p>
          <div><h1>{solution.name}</h1><span className={`project-status project-status--${solution.visualStatus || solution.status}`}>{statusLabel(solution.status)}</span></div>
          <span>{solution.description}</span>
        </div>
        <aside>
          <strong>{solution.progress}%</strong>
          <span>Avance general</span>
          <div className="project-progress"><i style={{ width: `${solution.progress}%` }} /></div>
        </aside>
      </header>

      <div className="solution-workspace__single-sheet">
        <section className="solution-workspace__overview" aria-label="Resumen de la solución">
          <div className="solution-workspace__metrics">
            <article><span>Tareas</span><strong>{completedTasks} de {activeTasks.length}</strong><small>Completadas</small></article>
            <article><span>Entregables</span><strong>{acceptedDeliverables} de {deliverables.length}</strong><small>Aceptados por el cliente</small></article>
            <article><span>Aprobaciones</span><strong>{pendingApprovals}</strong><small>{pendingApprovals ? "Pendientes del cliente" : "Todo al día"}</small></article>
            <article><span>Fecha objetivo</span><strong>{solution.targetDate || "Por confirmar"}</strong><small>Siguiente entrega</small></article>
          </div>
          <div className="solution-workspace__definition">
            <article><span>Objetivo</span><h2>{solution.objective || solution.brief?.objective || "Definir el resultado operativo de esta solución."}</h2></article>
            <article><span>Meta</span><h2>{solution.goal || solution.nextMilestone || "Meta por definir"}</h2></article>
          </div>
          <div className="solution-workspace__overview-grid">
            <article className="solution-sheet-card">
              <header><span>Alcance</span><h2>Qué incluye esta solución</h2></header>
              <div className="solution-sheet-card__scope">{(solution.scope || []).map((item) => <span key={item}>{workspaceIcon("check")}{item}</span>)}</div>
            </article>
            <article className="solution-sheet-card">
              <header><span>Limitaciones</span><h2>Qué queda fuera o condicionado</h2></header>
              <div className="solution-sheet-card__limits">{(solution.limitations || solution.brief?.excluded_scope || []).map((item) => <span key={item}>{item}</span>)}</div>
            </article>
          </div>
          <article className="solution-sheet-card solution-sheet-card--deliverables">
            <header><span>Entregables</span><h2>Resultados verificables de la solución</h2></header>
            <div>{deliverables.map((item) => <span key={item.id || item.name}><strong>{item.name}</strong><small>{statusLabel(item.status)} · {item.date || "Sin fecha"}</small></span>)}</div>
          </article>
        </section>

        <section id="solution-tasks" className="solution-workspace__sheet-section" aria-label="Tareas de la solución">
          <ProjectWorkboard project={solutionProject} tenantId={tenantId} initialTaskId={initialTaskId} onReload={onReload} onNotice={onNotice} mode="solution" />
        </section>

        <section className="solution-sheet-page solution-workspace__sheet-section">
          <header><div><span>Aprobaciones</span><h2>Decisiones de la solución</h2><p>Revisa los puntos que necesitan confirmación para que el trabajo pueda avanzar.</p></div></header>
          <div className="solution-approval-list">{approvals.map((approval) => <article key={approval.id || approval.title}><div><span className={`project-status project-status--${approval.status}`}>{statusLabel(approval.status)}</span><h3>{approval.title}</h3><p>{approval.description}</p><small>Fecha límite · {approval.dueDate || "Por confirmar"}</small></div><button type="button" onClick={() => onNotice?.("La aprobación se habilitará al conectar esta solución con el seguimiento real.")}>{approval.status === "pending" ? "Revisar" : "Ver detalle"}</button></article>)}</div>
          {!approvals.length ? <div className="solution-sheet-empty">No hay aprobaciones pendientes en esta solución.</div> : null}
        </section>

        <section className="solution-sheet-page solution-workspace__sheet-section">
          <header><div><span>Archivos</span><h2>Documentos y adjuntos</h2><p>Todo el material compartido para esta solución en un solo lugar.</p></div><button type="button" onClick={() => onNotice?.("La carga de archivos se habilitará para usuarios autorizados.")}>{workspaceIcon("upload")}Adjuntar archivo</button></header>
          <div className="solution-file-list">{files.map((file) => <article key={file.id || file.name}><span>{workspaceIcon("files")}</span><div><strong>{file.name}</strong><small>{file.type || "Documento"} · {file.date || "Sin fecha"}</small></div><button type="button" onClick={() => onNotice?.("Archivo de demostración. Se abrirá al conectar el almacenamiento real.")}>Abrir</button></article>)}</div>
          {!files.length ? <div className="solution-sheet-empty">Aún no hay archivos adjuntos.</div> : null}
        </section>

        <section className="solution-sheet-page solution-workspace__sheet-section">
          <header><div><span>Usuarios</span><h2>Personas con acceso</h2><p>Participantes autorizados para consultar o trabajar en esta solución.</p></div><button type="button" onClick={() => onNotice?.("La invitación de usuarios estará disponible para administradores NEXOR.")}>{workspaceIcon("plus")}Agregar usuario</button></header>
          <div className="solution-user-grid">{users.map((user) => <article key={user.id || user.name}><i>{user.initials || user.name?.split(" ").map((part) => part[0]).slice(0, 2).join("")}</i><div><strong>{user.name}</strong><span>{user.role}</span><small>{user.access || "Puede consultar"}</small></div><b>{user.status || "Activo"}</b></article>)}</div>
          {!users.length ? <div className="solution-sheet-empty">No hay usuarios asignados a esta solución.</div> : null}
        </section>
      </div>
    </section>
  );
}
