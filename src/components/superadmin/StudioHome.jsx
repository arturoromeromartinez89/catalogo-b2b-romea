import { useMemo } from "react";
import { confirmedProgress } from "../../utils/projectHubModel";

const activeProjectStatuses = new Set(["active", "on_hold"]);
const activeSolutionStatuses = new Set(["in_progress", "waiting", "needs_changes"]);

const formatDate = (value) => value
  ? new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`))
  : "Sin fecha";

const healthLabel = (project) => {
  if (project.health === "red") return "En riesgo";
  if (project.health === "yellow" || project.status === "on_hold") return "Atención";
  return "En tiempo";
};

export default function StudioHome({ tenants = [], projectsByTenant = {}, onOpenClient, onOpenProject }) {
  const data = useMemo(() => {
    const projects = tenants.flatMap((tenant) => (projectsByTenant[tenant.id] || []).map((project) => ({ ...project, tenant })));
    const activeProjects = projects.filter((project) => activeProjectStatuses.has(project.status));
    const solutions = projects.flatMap((project) => (project.project_solutions || []).map((solution) => ({ ...solution, project })));
    const approvals = projects.flatMap((project) => (project.project_approvals || []).map((approval) => ({ ...approval, project })));
    const attention = [...activeProjects].sort((a, b) => {
      const healthOrder = { red: 0, yellow: 1, green: 2 };
      return (healthOrder[a.health] ?? 2) - (healthOrder[b.health] ?? 2)
        || String(a.estimated_end_date || "9999").localeCompare(String(b.estimated_end_date || "9999"));
    });
    return {
      projects,
      activeProjects,
      activeSolutions: solutions.filter((solution) => activeSolutionStatuses.has(solution.status)),
      pendingApprovals: approvals.filter((approval) => approval.status === "pending"),
      attention,
    };
  }, [projectsByTenant, tenants]);

  return (
    <section className="studio-overview studio-home">
      <div className="studio-signals" aria-label="Estado general de NEXOR">
        <article><span>Clientes activos</span><strong>{tenants.filter((tenant) => tenant.status === "active").length}</strong><small>cuentas atendidas</small></article>
        <article><span>Proyectos activos</span><strong>{data.activeProjects.length}</strong><small>{data.projects.length} proyectos totales</small></article>
        <article><span>Soluciones en curso</span><strong>{data.activeSolutions.length}</strong><small>trabajo en ejecución</small></article>
        <article><span>Decisiones pendientes</span><strong>{data.pendingApprovals.length}</strong><small>requieren respuesta</small></article>
      </div>

      <article className="studio-sheet">
        <header className="studio-sheet__header">
          <div>
            <span className="tool-eyebrow">Control de entrega</span>
            <h3>Proyectos que requieren seguimiento</h3>
            <p>Prioridad, avance confirmado y siguiente fecha comprometida.</p>
          </div>
          <button className="studio-row-action" type="button" onClick={() => onOpenClient()}>Ver todos los clientes <span aria-hidden="true">→</span></button>
        </header>

        <div className="studio-project-list">
          {data.attention.map((project) => {
            const progress = confirmedProgress(project.project_deliverables);
            const pending = (project.project_approvals || []).filter((approval) => approval.status === "pending").length;
            const health = healthLabel(project);
            return (
              <button className="studio-project-row" type="button" key={project.id} onClick={() => onOpenProject(project.tenant.id, project.id)}>
                <div className="studio-project-row__identity">
                  <strong>{project.name}</strong>
                  <small>{project.tenant.name} · {project.current_phase_name || "Etapa por definir"}</small>
                </div>
                <span className={`studio-state studio-state--${health === "En tiempo" ? "active" : health === "En riesgo" ? "risk" : "paused"}`}>{health}</span>
                <div className="studio-project-row__progress">
                  <div><span style={{ width: `${progress}%` }} /></div>
                  <small>{progress}% confirmado</small>
                </div>
                <div className="studio-project-row__signal">
                  <strong>{pending}</strong><small>decisiones</small>
                </div>
                <div className="studio-project-row__date">
                  <strong>{formatDate(project.estimated_end_date)}</strong><small>fecha objetivo</small>
                </div>
                <span className="studio-project-row__arrow" aria-hidden="true">→</span>
              </button>
            );
          })}
          {!data.attention.length ? <p className="studio-empty">No hay proyectos activos. Abre Clientes para crear el primero.</p> : null}
        </div>
      </article>

      <div className="studio-home__lower">
        <article className="studio-sheet studio-home__clients">
          <header className="studio-sheet__header"><div><span className="tool-eyebrow">Cartera</span><h3>Clientes</h3><p>Estado de la relación y sus proyectos.</p></div></header>
          <div className="studio-home__client-list">
            {tenants.map((tenant) => {
              const projects = projectsByTenant[tenant.id] || [];
              const active = projects.filter((project) => activeProjectStatuses.has(project.status)).length;
              return <button type="button" key={tenant.id} onClick={() => onOpenClient(tenant.id)}><span><strong>{tenant.name}</strong><small>{active} activos de {projects.length}</small></span><span aria-hidden="true">→</span></button>;
            })}
          </div>
        </article>

        <article className="studio-sheet studio-home__decisions">
          <header className="studio-sheet__header"><div><span className="tool-eyebrow">Cliente</span><h3>Decisiones pendientes</h3><p>Bloqueos que esperan respuesta.</p></div></header>
          <div className="studio-home__decision-list">
            {data.pendingApprovals.slice(0, 4).map((approval) => <div key={approval.id}><span><strong>{approval.title || "Decisión sin título"}</strong><small>{approval.project.tenant.name} · {approval.project.name}</small></span><span className="studio-state studio-state--paused">Pendiente</span></div>)}
            {!data.pendingApprovals.length ? <p className="studio-empty">No hay decisiones pendientes.</p> : null}
          </div>
        </article>
      </div>
    </section>
  );
}
