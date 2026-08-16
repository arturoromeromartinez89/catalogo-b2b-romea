import { useMemo, useState } from "react";
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

const statusNames = {
  completed: "Completado",
  in_progress: "En curso",
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Requiere ajustes",
};

const sections = [
  { id: "overview", label: "Resumen", icon: "overview" },
  { id: "planning", label: "Actividades", icon: "planning" },
  { id: "approvals", label: "Aprobaciones", icon: "approvals" },
  { id: "files", label: "Archivos", icon: "files" },
  { id: "users", label: "Usuarios", icon: "users" },
];

export default function SolutionWorkspace({ solution, project, tenantId = "", companyName = "", onBack, onReload, onNotice }) {
  const [section, setSection] = useState("overview");

  const solutionProject = useMemo(() => {
    const tasks = (project.tasks || []).filter((task) => task.solutionId === solution.id);
    const objectiveIds = new Set(tasks.map((task) => task.objectiveId).filter(Boolean));
    const objectives = (project.objectives || []).filter((objective) => objectiveIds.has(objective.id));
    return {
      ...project,
      name: solution.name,
      description: solution.description,
      progress: solution.progress,
      phase: solution.phase,
      tasks,
      objectives,
    };
  }, [project, solution]);

  const approvals = solution.approvals || [];
  const files = solution.files || [];
  const users = solution.users || [];
  const pendingApprovals = approvals.filter((item) => item.status === "pending").length;
  const completedTasks = solutionProject.tasks.filter((task) => task.status === "done").length;

  return (
    <section className="solution-workspace" aria-label={`Espacio de trabajo de ${solution.name}`}>
      <button className="solution-workspace__back" type="button" onClick={onBack}>{workspaceIcon("back")}Plan maestro</button>

      <header className="solution-workspace__hero">
        <div>
          <p>Solución · {companyName}</p>
          <div><h1>{solution.name}</h1><span className={`project-status project-status--${solution.status}`}>{statusNames[solution.status] || solution.status}</span></div>
          <span>{solution.description}</span>
        </div>
        <aside>
          <strong>{solution.progress}%</strong>
          <span>Avance general</span>
          <div className="project-progress"><i style={{ width: `${solution.progress}%` }} /></div>
        </aside>
      </header>

      <nav className="solution-workspace__floating-nav" aria-label="Secciones de la solución">
        {sections.map((item) => <button key={item.id} type="button" className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}>{workspaceIcon(item.icon)}<span>{item.label}</span>{item.id === "approvals" && pendingApprovals ? <b>{pendingApprovals}</b> : null}</button>)}
      </nav>

      {section === "overview" ? <div className="solution-workspace__overview">
        <div className="solution-workspace__metrics">
          <article><span>Etapa actual</span><strong>{solution.phase || "Por iniciar"}</strong><small>Trabajo activo</small></article>
          <article><span>Actividades</span><strong>{solutionProject.tasks.length}</strong><small>{completedTasks} {completedTasks === 1 ? "completada" : "completadas"}</small></article>
          <article><span>Aprobaciones</span><strong>{pendingApprovals}</strong><small>{pendingApprovals ? "Pendientes del cliente" : "Todo al día"}</small></article>
          <article><span>Fecha objetivo</span><strong>{solution.targetDate || "Por confirmar"}</strong><small>Siguiente entrega</small></article>
        </div>
        <div className="solution-workspace__overview-grid">
          <article className="solution-sheet-card">
            <header><span>Alcance</span><h2>Qué incluye esta solución</h2></header>
            <div className="solution-sheet-card__scope">{(solution.scope || []).map((item) => <span key={item}>{workspaceIcon("check")}{item}</span>)}</div>
          </article>
          <article className="solution-sheet-card">
            <header><span>Siguiente</span><h2>{solution.nextMilestone || "Próximo hito por definir"}</h2></header>
            <p>Las siguientes actividades están ordenadas por prioridad y fecha.</p>
            <ul>{solutionProject.tasks.filter((task) => task.status !== "done").slice(0, 3).map((task) => <li key={task.id}><i /><span><strong>{task.title}</strong><small>{task.assignee || "Por asignar"} · {task.dueDate || "Sin fecha"}</small></span></li>)}</ul>
            <button type="button" onClick={() => setSection("planning")}>Abrir actividades</button>
          </article>
        </div>
      </div> : null}

      {section === "planning" ? <ProjectWorkboard project={solutionProject} tenantId={tenantId} onReload={onReload} onNotice={onNotice} mode="solution" /> : null}

      {section === "approvals" ? <section className="solution-sheet-page">
        <header><div><span>Aprobaciones</span><h2>Decisiones de la solución</h2><p>Revisa los puntos que necesitan confirmación para que el trabajo pueda avanzar.</p></div></header>
        <div className="solution-approval-list">{approvals.map((approval) => <article key={approval.id || approval.title}><div><span className={`project-status project-status--${approval.status}`}>{statusNames[approval.status] || approval.status}</span><h3>{approval.title}</h3><p>{approval.description}</p><small>Fecha límite · {approval.dueDate || "Por confirmar"}</small></div><button type="button" onClick={() => onNotice?.("La aprobación se habilitará al conectar esta solución con el seguimiento real.")}>{approval.status === "pending" ? "Revisar" : "Ver detalle"}</button></article>)}</div>
        {!approvals.length ? <div className="solution-sheet-empty">No hay aprobaciones pendientes en esta solución.</div> : null}
      </section> : null}

      {section === "files" ? <section className="solution-sheet-page">
        <header><div><span>Archivos</span><h2>Documentos y adjuntos</h2><p>Todo el material compartido para esta solución en un solo lugar.</p></div><button type="button" onClick={() => onNotice?.("La carga de archivos se habilitará para usuarios autorizados.")}>{workspaceIcon("upload")}Adjuntar archivo</button></header>
        <div className="solution-file-list">{files.map((file) => <article key={file.id || file.name}><span>{workspaceIcon("files")}</span><div><strong>{file.name}</strong><small>{file.type || "Documento"} · {file.date || "Sin fecha"}</small></div><button type="button" onClick={() => onNotice?.("Archivo de demostración. Se abrirá al conectar el almacenamiento real.")}>Abrir</button></article>)}</div>
        {!files.length ? <div className="solution-sheet-empty">Aún no hay archivos adjuntos.</div> : null}
      </section> : null}

      {section === "users" ? <section className="solution-sheet-page">
        <header><div><span>Usuarios</span><h2>Personas con acceso</h2><p>Participantes autorizados para consultar o trabajar en esta solución.</p></div><button type="button" onClick={() => onNotice?.("La invitación de usuarios estará disponible para administradores NEXOR.")}>{workspaceIcon("plus")}Agregar usuario</button></header>
        <div className="solution-user-grid">{users.map((user) => <article key={user.id || user.name}><i>{user.initials || user.name?.split(" ").map((part) => part[0]).slice(0, 2).join("")}</i><div><strong>{user.name}</strong><span>{user.role}</span><small>{user.access || "Puede consultar"}</small></div><b>{user.status || "Activo"}</b></article>)}</div>
        {!users.length ? <div className="solution-sheet-empty">No hay usuarios asignados a esta solución.</div> : null}
      </section> : null}
    </section>
  );
}
