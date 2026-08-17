import { useEffect, useMemo, useState } from "react";
import { deleteProjectChild, fetchProjectsForTenant, saveProject, saveProjectChild } from "../../services/projectHubService";
import { confirmedProgress, statusLabel } from "../../utils/projectHubModel";

const emptyProject = { name: "", description: "", status: "draft", health: "green", progress_percentage: 0, current_phase_name: "", start_date: "", estimated_end_date: "", internal_owner_name: "Equipo NEXOR IA", published: false };
const sections = [
  { id: "project_solutions", label: "Soluciones" },
  { id: "project_solution_brief_versions", label: "Ficha de solución" },
  { id: "project_deliverables", label: "Entregables" },
  { id: "project_acceptance_criteria", label: "Criterios" },
  { id: "project_tasks", label: "Tareas" },
  { id: "project_time_entries", label: "Horas" },
  { id: "project_development_activity", label: "Código" },
  { id: "project_phases", label: "Etapas" },
  { id: "project_approvals", label: "Decisiones" },
  { id: "project_documents", label: "Documentos" },
  { id: "project_updates", label: "Actualizaciones" },
  { id: "project_objectives", label: "Periodos" },
];
const emptyChild = {
  project_solutions: { name: "", description: "", phase_id: "", status: "draft", stage_name: "", current_phase_name: "", next_milestone: "", scope_items: [], start_date: "", estimated_end_date: "", sort_order: 10, visible_to_client: true },
  project_solution_brief_versions: { solution_id: "", version_number: 1, status: "draft", problem: "", objective: "", current_process: "", proposed_process: "", included_scope: [], excluded_scope: [], users_and_permissions: "", impacts: "", assumptions_and_risks: "", summary_pdf_url: "", visible_to_client: false },
  project_acceptance_criteria: { solution_id: "", deliverable_id: "", description: "", status: "pending", sort_order: 10, visible_to_client: true },
  project_time_entries: { solution_id: "", task_id: "", work_date: "", minutes: 60, description: "", contributor_name: "", visible_to_client: true },
  project_development_activity: { solution_id: "", activity_date: "", repository_label: "", lines_added: 0, lines_deleted: 0, commits_count: 0, source: "manual", visible_to_client: true },
  project_objectives: { title: "", description: "", period_label: "", period_start: "", period_end: "", status: "planned", progress_percentage: 0, sort_order: 10, visible_to_client: true },
  project_tasks: { title: "", description: "", solution_id: "", deliverable_id: "", objective_id: "", phase_id: "", status: "todo", priority: "medium", start_date: "", due_date: "", estimated_hours: "", progress_percentage: 0, assignee_name: "", sort_order: 10, visible_to_client: true, client_can_comment: true, client_can_upload: true, client_can_move: true },
  project_phases: { name: "", description: "", status: "pending", progress_percentage: 0, sort_order: 10, estimated_end_date: "" },
  project_updates: { title: "", description: "", update_type: "progress", visible_to_client: true },
  project_deliverables: { name: "", description: "", solution_id: "", weight: 1, status: "pending", estimated_delivery_date: "", external_url: "", visible_to_client: true },
  project_documents: { name: "", description: "", solution_id: "", document_type: "scope", external_url: "", visible_to_client: true },
  project_approvals: { title: "", description: "", solution_id: "", deliverable_id: "", decision_type: "general", status: "pending", due_date: "", visible_to_client: true, client_comment: "" },
};
const updateTypeLabel = { progress: "Avance", milestone: "Hito", information: "Información", warning: "Advertencia" };
const documentTypeLabel = { contract: "Contrato", proposal: "Propuesta", scope: "Alcance", nda: "NDA", manual: "Manual", technical: "Técnico", other: "Otro" };
// La ficha se nombra siempre "Ficha de solución"; la versión viaja como metadato secundario.
const childTitle = (item, table) => {
  if (table === "project_solution_brief_versions") return "Ficha de solución";
  return item.name || item.title || item.description
    || (item.minutes ? `${item.minutes} min · ${item.work_date}` : "")
    || (item.activity_date ? `${item.lines_added} líneas · ${item.activity_date}` : "")
    || "Registro sin nombre";
};
const childMeta = (item, table) => [
  statusLabel(item.status) || updateTypeLabel[item.update_type] || documentTypeLabel[item.document_type] || "",
  table === "project_solution_brief_versions" ? `Versión ${item.version_number || 1}` : "",
].filter(Boolean).join(" · ");
// El avance confirmado usa la misma regla que el portal del cliente (src/utils/projectHubModel.js).
const projectConfirmedProgress = (project) => confirmedProgress(project?.project_deliverables);

export default function ProjectHubManager({ tenants = [], profile }) {
  const portalTenants = useMemo(() => tenants.filter((item) => ["vanguardia-joyera", "estuches-chavez", "romea"].includes(item.slug)), [tenants]);
  const [tenantId, setTenantId] = useState("");
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [projectDraft, setProjectDraft] = useState(emptyProject);
  const [section, setSection] = useState("project_solutions");
  const [childDraft, setChildDraft] = useState(emptyChild.project_solutions);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedProject = useMemo(() => projects.find((item) => item.id === selectedId) || null, [projects, selectedId]);
  const activeTenant = portalTenants.find((item) => item.id === tenantId);

  const load = async (nextTenantId = tenantId, keepSelected = selectedId) => {
    if (!nextTenantId) return;
    setStatus("Cargando proyectos...");
    try {
      const next = await fetchProjectsForTenant(nextTenantId);
      setProjects(next);
      const nextSelected = next.find((item) => item.id === keepSelected) || next[0] || null;
      setSelectedId(nextSelected?.id || "");
      setProjectDraft(nextSelected || emptyProject);
      setStatus("");
    } catch (error) { setStatus(`Error: ${error.message}`); }
  };

  useEffect(() => {
    if (!tenantId && portalTenants.length) {
      const estuches = portalTenants.find((item) => item.slug === "estuches-chavez");
      setTenantId(estuches?.id || portalTenants[0].id);
    }
  }, [portalTenants, tenantId]);
  useEffect(() => { if (tenantId) load(tenantId, ""); }, [tenantId]);
  useEffect(() => { setChildDraft({ ...emptyChild[section] }); }, [section, selectedId]);

  const selectProject = (project) => { setSelectedId(project.id); setProjectDraft(project); };
  const newProject = () => { setSelectedId(""); setProjectDraft({ ...emptyProject }); };

  const handleProjectSave = async () => {
    if (!tenantId || !projectDraft.name.trim()) { setStatus("Selecciona una empresa y captura el nombre del proyecto."); return; }
    setSaving(true);
    try {
      const saved = await saveProject(projectDraft, tenantId, profile?.id);
      await load(tenantId, saved.id);
      setStatus(saved.published ? "Proyecto guardado y visible para el cliente." : "Proyecto guardado como borrador interno.");
    } catch (error) { setStatus(`No se pudo guardar: ${error.message}`); }
    finally { setSaving(false); }
  };

  const handleChildSave = async () => {
    if (!selectedProject) return;
    setSaving(true);
    try {
      await saveProjectChild(section, childDraft, tenantId, selectedProject.id, profile?.id);
      setChildDraft({ ...emptyChild[section] });
      await load(tenantId, selectedProject.id);
      setStatus("Información del portal actualizada.");
    } catch (error) { setStatus(`No se pudo guardar: ${error.message}`); }
    finally { setSaving(false); }
  };

  const removeChild = async (item) => {
    setSaving(true);
    try { await deleteProjectChild(section, item.id); await load(tenantId, selectedProject.id); setStatus("Registro eliminado."); }
    catch (error) { setStatus(`No se pudo eliminar: ${error.message}`); }
    finally { setSaving(false); }
  };

  const items = selectedProject?.[section] || [];
  return (
    <section className="ph-manager">
      <header className="ph-manager__header">
        <div><p className="eyebrow">NEXOR Studio</p><h2>Project Hub</h2><span>Publica el avance que verá cada empresa en su Client Portal.</span></div>
        <label>Empresa<select value={tenantId} onChange={(event) => setTenantId(event.target.value)}><option value="">Seleccionar</option>{portalTenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></label>
      </header>
      {status ? <p className="status info">{status}</p> : null}
      <div className="ph-manager__layout">
        <aside className="ph-manager__projects">
          <div className="ph-manager__aside-head"><strong>Proyectos</strong><button className="secondary-button compact-action" type="button" onClick={newProject}>Nuevo</button></div>
          {projects.map((project) => <button className={selectedId === project.id ? "active" : ""} type="button" key={project.id} onClick={() => selectProject(project)}><strong>{project.name}</strong><span>{statusLabel(project.status)} · {projectConfirmedProgress(project)}% confirmado</span><small>{project.published ? "Visible para cliente" : "Borrador interno"}</small></button>)}
          {!projects.length ? <p className="muted">Aún no hay proyectos para {activeTenant?.name || "esta empresa"}.</p> : null}
        </aside>
        <div className="ph-manager__content">
          <article className="ph-manager__card">
            <div className="ph-manager__card-head"><div><span>Información principal</span><h3>{selectedId ? "Editar proyecto" : "Nuevo proyecto"}</h3></div><label className="ph-manager__publish"><input type="checkbox" checked={Boolean(projectDraft.published)} onChange={(event) => setProjectDraft((current) => ({ ...current, published: event.target.checked }))} /><span>{projectDraft.published ? "Publicado" : "Borrador"}</span></label></div>
            <div className="ph-manager__form-grid">
              <label className="ph-manager__span-2">Nombre<input value={projectDraft.name || ""} onChange={(event) => setProjectDraft((current) => ({ ...current, name: event.target.value }))} /></label>
              <label className="ph-manager__span-2">Descripción<textarea value={projectDraft.description || ""} onChange={(event) => setProjectDraft((current) => ({ ...current, description: event.target.value }))} /></label>
              <label>Estado<select value={projectDraft.status || "draft"} onChange={(event) => setProjectDraft((current) => ({ ...current, status: event.target.value }))}><option value="draft">Borrador</option><option value="active">Activo</option><option value="on_hold">En pausa</option><option value="completed">Completado</option><option value="cancelled">Cancelado</option></select></label>
              <label>Salud<select value={projectDraft.health || "green"} onChange={(event) => setProjectDraft((current) => ({ ...current, health: event.target.value }))}><option value="green">En tiempo</option><option value="yellow">Requiere atención</option><option value="red">En riesgo</option></select></label>
              <label>Avance confirmado<input value={`${projectConfirmedProgress(projectDraft)}% · calculado por entregables aceptados`} disabled /></label>
              <label>Etapa actual<input value={projectDraft.current_phase_name || ""} onChange={(event) => setProjectDraft((current) => ({ ...current, current_phase_name: event.target.value }))} /></label>
              <label>Fecha de inicio<input type="date" value={projectDraft.start_date || ""} onChange={(event) => setProjectDraft((current) => ({ ...current, start_date: event.target.value }))} /></label>
              <label>Entrega estimada<input type="date" value={projectDraft.estimated_end_date || ""} onChange={(event) => setProjectDraft((current) => ({ ...current, estimated_end_date: event.target.value }))} /></label>
              <label className="ph-manager__span-2">Responsable interno<input value={projectDraft.internal_owner_name || ""} onChange={(event) => setProjectDraft((current) => ({ ...current, internal_owner_name: event.target.value }))} /></label>
            </div>
            <div className="ph-manager__actions"><button className="primary-button" type="button" disabled={saving} onClick={handleProjectSave}>{saving ? "Guardando..." : "Guardar proyecto"}</button></div>
          </article>
          {selectedProject ? <article className="ph-manager__card">
            <nav className="ph-manager__section-tabs">{sections.map((item) => <button type="button" className={section === item.id ? "active" : ""} key={item.id} onClick={() => setSection(item.id)}>{item.label}<span>{selectedProject[item.id]?.length || 0}</span></button>)}</nav>
            <div className="ph-manager__child-layout"><div className="ph-manager__child-list">{items.map((item) => <div className="ph-manager__child-item" key={item.id}><div><strong>{childTitle(item, section)}</strong><span>{childMeta(item, section)}</span>{item.visible_to_client === false ? <small>Solo interno</small> : null}</div><div><button type="button" onClick={() => setChildDraft({ ...item })}>Editar</button><button type="button" className="danger" disabled={saving} onClick={() => removeChild(item)}>Eliminar</button></div></div>)}{!items.length ? <p className="muted">Aún no hay información en esta sección.</p> : null}</div><ChildForm table={section} draft={childDraft} setDraft={setChildDraft} project={selectedProject} saving={saving} onSave={handleChildSave} onCancel={() => setChildDraft({ ...emptyChild[section] })} /></div>
          </article> : null}
        </div>
      </div>
    </section>
  );
}

function ChildForm({ table, draft, setDraft, project, saving, onSave, onCancel }) {
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const hasTitle = ["project_updates", "project_approvals", "project_objectives", "project_tasks"].includes(table);
  const hasName = ["project_solutions", "project_phases", "project_deliverables", "project_documents"].includes(table);
  const solutions = project?.project_solutions || [];
  const deliverables = (project?.project_deliverables || []).filter((item) => !draft.solution_id || item.solution_id === draft.solution_id);
  const tasks = (project?.project_tasks || []).filter((item) => !draft.solution_id || item.solution_id === draft.solution_id);
  return <div className="ph-manager__child-form"><h4>{draft.id ? "Editar registro" : "Agregar registro"}</h4>
    {hasTitle || hasName ? <label>{hasTitle ? "Título" : "Nombre"}<input value={(hasTitle ? draft.title : draft.name) || ""} onChange={(event) => update(hasTitle ? "title" : "name", event.target.value)} /></label> : null}
    {!["project_solution_brief_versions", "project_development_activity", "project_acceptance_criteria"].includes(table) ? <label>{table === "project_time_entries" ? "Trabajo realizado" : "Descripción"}<textarea value={draft.description || ""} onChange={(event) => update("description", event.target.value)} /></label> : null}
    {table === "project_acceptance_criteria" ? <label>Criterio de aceptación<textarea value={draft.description || ""} onChange={(event) => update("description", event.target.value)} /></label> : null}
    {table === "project_solutions" ? <><label>Etapa<select value={draft.phase_id || ""} onChange={(event) => update("phase_id", event.target.value)}><option value="">Sin etapa</option>{(project?.project_phases || []).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Estado<select value={draft.status} onChange={(event) => update("status", event.target.value)}><option value="draft">Borrador</option><option value="planned">Por iniciar</option><option value="in_progress">En proceso</option><option value="waiting">En espera</option><option value="needs_changes">Requiere cambios</option><option value="completed">Terminada</option><option value="cancelled">Cancelada</option></select></label><label>Bloque o etapa visible<input value={draft.stage_name || ""} onChange={(event) => update("stage_name", event.target.value)} /></label><label>Trabajo actual<input value={draft.current_phase_name || ""} onChange={(event) => update("current_phase_name", event.target.value)} /></label><label>Siguiente hito<input value={draft.next_milestone || ""} onChange={(event) => update("next_milestone", event.target.value)} /></label><label>Incluye (separado por comas)<textarea value={(draft.scope_items || []).join(", ")} onChange={(event) => update("scope_items", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label><div className="ph-manager__inline"><label>Inicio<input type="date" value={draft.start_date || ""} onChange={(event) => update("start_date", event.target.value)} /></label><label>Entrega<input type="date" value={draft.estimated_end_date || ""} onChange={(event) => update("estimated_end_date", event.target.value)} /></label></div><label>Orden<input type="number" value={draft.sort_order ?? 0} onChange={(event) => update("sort_order", Number(event.target.value))} /></label></> : null}
    {table === "project_solution_brief_versions" ? <><label>Solución<select value={draft.solution_id || ""} onChange={(event) => update("solution_id", event.target.value)}><option value="">Seleccionar</option>{solutions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="ph-manager__inline"><label>Versión<input type="number" min="1" value={draft.version_number || 1} onChange={(event) => update("version_number", Number(event.target.value))} /></label><label>Estado<select value={draft.status} onChange={(event) => update("status", event.target.value)}><option value="draft">Borrador</option><option value="pending">Pendiente de cliente</option><option value="approved">Aprobada</option><option value="needs_changes">Requiere cambios</option><option value="superseded">Reemplazada</option></select></label></div><label>Problema<textarea value={draft.problem || ""} onChange={(event) => update("problem", event.target.value)} /></label><label>Objetivo<textarea value={draft.objective || ""} onChange={(event) => update("objective", event.target.value)} /></label><label>Proceso actual<textarea value={draft.current_process || ""} onChange={(event) => update("current_process", event.target.value)} /></label><label>Proceso propuesto<textarea value={draft.proposed_process || ""} onChange={(event) => update("proposed_process", event.target.value)} /></label><label>Incluye (separado por comas)<textarea value={(draft.included_scope || []).join(", ")} onChange={(event) => update("included_scope", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label><label>No incluye (separado por comas)<textarea value={(draft.excluded_scope || []).join(", ")} onChange={(event) => update("excluded_scope", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label><label>Usuarios y permisos<textarea value={draft.users_and_permissions || ""} onChange={(event) => update("users_and_permissions", event.target.value)} /></label><label>Afectaciones<textarea value={draft.impacts || ""} onChange={(event) => update("impacts", event.target.value)} /></label><label>Supuestos y riesgos<textarea value={draft.assumptions_and_risks || ""} onChange={(event) => update("assumptions_and_risks", event.target.value)} /></label><label>PDF resumen de una hoja<input type="url" value={draft.summary_pdf_url || ""} onChange={(event) => update("summary_pdf_url", event.target.value)} /></label></> : null}
    {table === "project_acceptance_criteria" ? <><label>Solución<select value={draft.solution_id || ""} onChange={(event) => { update("solution_id", event.target.value); update("deliverable_id", ""); }}><option value="">Seleccionar</option>{solutions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Entregable<select value={draft.deliverable_id || ""} onChange={(event) => update("deliverable_id", event.target.value)}><option value="">Criterio general de la solución</option>{deliverables.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="ph-manager__inline"><label>Estado<select value={draft.status} onChange={(event) => update("status", event.target.value)}><option value="pending">Pendiente</option><option value="accepted">Aceptado</option><option value="needs_changes">Requiere cambios</option><option value="not_applicable">No aplica</option></select></label><label>Orden<input type="number" value={draft.sort_order ?? 0} onChange={(event) => update("sort_order", Number(event.target.value))} /></label></div></> : null}
    {table === "project_time_entries" ? <><label>Solución<select value={draft.solution_id || ""} onChange={(event) => { update("solution_id", event.target.value); update("task_id", ""); }}><option value="">Proyecto general</option>{solutions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Tarea<select value={draft.task_id || ""} onChange={(event) => update("task_id", event.target.value)}><option value="">Sin tarea específica</option>{tasks.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><div className="ph-manager__inline"><label>Fecha<input type="date" value={draft.work_date || ""} onChange={(event) => update("work_date", event.target.value)} /></label><label>Minutos<input type="number" min="1" max="1440" value={draft.minutes || 60} onChange={(event) => update("minutes", Number(event.target.value))} /></label></div><label>Persona<input value={draft.contributor_name || ""} onChange={(event) => update("contributor_name", event.target.value)} /></label></> : null}
    {table === "project_development_activity" ? <><label>Solución<select value={draft.solution_id || ""} onChange={(event) => update("solution_id", event.target.value)}><option value="">Proyecto general</option>{solutions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="ph-manager__inline"><label>Fecha<input type="date" value={draft.activity_date || ""} onChange={(event) => update("activity_date", event.target.value)} /></label><label>Repositorio<input value={draft.repository_label || ""} onChange={(event) => update("repository_label", event.target.value)} /></label></div><div className="ph-manager__inline"><label>Líneas agregadas<input type="number" min="0" value={draft.lines_added ?? 0} onChange={(event) => update("lines_added", Number(event.target.value))} /></label><label>Líneas eliminadas<input type="number" min="0" value={draft.lines_deleted ?? 0} onChange={(event) => update("lines_deleted", Number(event.target.value))} /></label></div><label>Cambios registrados<input type="number" min="0" value={draft.commits_count ?? 0} onChange={(event) => update("commits_count", Number(event.target.value))} /></label></> : null}
    {table === "project_objectives" ? <><label>Nombre del periodo<input value={draft.period_label || ""} placeholder="Ej. 10–21 agosto" onChange={(event) => update("period_label", event.target.value)} /></label><div className="ph-manager__inline"><label>Inicio<input type="date" value={draft.period_start || ""} onChange={(event) => update("period_start", event.target.value)} /></label><label>Fin<input type="date" value={draft.period_end || ""} onChange={(event) => update("period_end", event.target.value)} /></label></div><label>Estado<select value={draft.status} onChange={(event) => update("status", event.target.value)}><option value="planned">Por iniciar</option><option value="active">En curso</option><option value="completed">Completado</option><option value="at_risk">Atrasado</option></select></label><label>Orden<input type="number" value={draft.sort_order ?? 0} onChange={(event) => update("sort_order", Number(event.target.value))} /></label></> : null}
    {table === "project_tasks" ? <><label>Solución<select value={draft.solution_id || ""} onChange={(event) => { update("solution_id", event.target.value); update("deliverable_id", ""); }}><option value="">Seleccionar</option>{solutions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Entregable<select value={draft.deliverable_id || ""} onChange={(event) => update("deliverable_id", event.target.value)}><option value="">Sin entregable</option>{deliverables.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Periodo<select value={draft.objective_id || ""} onChange={(event) => update("objective_id", event.target.value)}><option value="">Sin periodo</option>{(project?.project_objectives || []).map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><label>Etapa<select value={draft.phase_id || ""} onChange={(event) => update("phase_id", event.target.value)}><option value="">Sin etapa</option>{(project?.project_phases || []).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="ph-manager__inline"><label>Estado<select value={draft.status} onChange={(event) => update("status", event.target.value)}><option value="backlog">Por iniciar</option><option value="todo">Por hacer</option><option value="in_progress">En proceso</option><option value="review">En revisión</option><option value="blocked">En espera</option><option value="done">Terminada</option><option value="cancelled">Cancelada</option></select></label><label>Prioridad<select value={draft.priority} onChange={(event) => update("priority", event.target.value)}><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label></div><div className="ph-manager__inline"><label>Inicio<input type="date" value={draft.start_date || ""} onChange={(event) => update("start_date", event.target.value)} /></label><label>Entrega<input type="date" value={draft.due_date || ""} onChange={(event) => update("due_date", event.target.value)} /></label></div><label>Responsable<input value={draft.assignee_name || ""} onChange={(event) => update("assignee_name", event.target.value)} /></label><div className="ph-manager__inline"><label>Orden<input type="number" value={draft.sort_order ?? 0} onChange={(event) => update("sort_order", Number(event.target.value))} /></label><label>Horas estimadas<input type="number" min="0" step="0.5" value={draft.estimated_hours ?? ""} onChange={(event) => update("estimated_hours", event.target.value === "" ? null : Number(event.target.value))} /></label></div><label className="ph-manager__check"><input type="checkbox" checked={draft.client_can_move !== false} onChange={(event) => update("client_can_move", event.target.checked)} /><span>El cliente puede mover esta tarjeta</span></label><label className="ph-manager__check"><input type="checkbox" checked={draft.client_can_comment !== false} onChange={(event) => update("client_can_comment", event.target.checked)} /><span>El cliente puede comentar</span></label><label className="ph-manager__check"><input type="checkbox" checked={draft.client_can_upload !== false} onChange={(event) => update("client_can_upload", event.target.checked)} /><span>El cliente puede adjuntar archivos</span></label></> : null}
    {table === "project_phases" ? <><label>Estado<select value={draft.status} onChange={(event) => update("status", event.target.value)}><option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="completed">Completado</option><option value="blocked">Bloqueado</option></select></label><div className="ph-manager__inline"><label>Orden<input type="number" value={draft.sort_order ?? 0} onChange={(event) => update("sort_order", Number(event.target.value))} /></label><label>Avance<input type="number" min="0" max="100" value={draft.progress_percentage ?? 0} onChange={(event) => update("progress_percentage", Number(event.target.value))} /></label></div><label>Fecha estimada<input type="date" value={draft.estimated_end_date || ""} onChange={(event) => update("estimated_end_date", event.target.value)} /></label></> : null}
    {table === "project_updates" ? <label>Tipo<select value={draft.update_type} onChange={(event) => update("update_type", event.target.value)}><option value="progress">Avance</option><option value="milestone">Hito</option><option value="information">Información</option><option value="warning">Advertencia</option></select></label> : null}
    {table === "project_deliverables" ? <><label>Solución<select value={draft.solution_id || ""} onChange={(event) => update("solution_id", event.target.value)}><option value="">Seleccionar</option>{solutions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="ph-manager__inline"><label>Estado<select value={draft.status} onChange={(event) => update("status", event.target.value)}><option value="pending">Pendiente</option><option value="in_progress">En proceso</option><option value="delivered">Entregado</option><option value="approved">Aceptado</option></select></label><label>Peso<input type="number" min="0.01" step="0.25" value={draft.weight || 1} onChange={(event) => update("weight", Number(event.target.value))} /></label></div><label>Fecha estimada<input type="date" value={draft.estimated_delivery_date || ""} onChange={(event) => update("estimated_delivery_date", event.target.value)} /></label><label>Enlace opcional<input type="url" value={draft.external_url || ""} onChange={(event) => update("external_url", event.target.value)} /></label></> : null}
    {table === "project_documents" ? <><label>Solución opcional<select value={draft.solution_id || ""} onChange={(event) => update("solution_id", event.target.value)}><option value="">Documento del proyecto</option>{solutions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Tipo<select value={draft.document_type} onChange={(event) => update("document_type", event.target.value)}><option value="contract">Contrato</option><option value="proposal">Propuesta</option><option value="scope">Alcance</option><option value="nda">NDA</option><option value="manual">Manual</option><option value="technical">Técnico</option><option value="other">Otro</option></select></label><label>Enlace al documento<input type="url" value={draft.external_url || ""} onChange={(event) => update("external_url", event.target.value)} /></label></> : null}
    {table === "project_approvals" ? <><label>Solución<select value={draft.solution_id || ""} onChange={(event) => { update("solution_id", event.target.value); update("deliverable_id", ""); }}><option value="">Decisión general</option>{solutions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Entregable<select value={draft.deliverable_id || ""} onChange={(event) => update("deliverable_id", event.target.value)}><option value="">Sin entregable</option>{deliverables.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Tipo<select value={draft.decision_type || "general"} onChange={(event) => update("decision_type", event.target.value)}><option value="general">General</option><option value="solution_brief">Ficha de solución</option><option value="deliverable_acceptance">Aceptación de entregable</option><option value="scope_change">Cambio de alcance</option></select></label><label>Estado<select value={draft.status} onChange={(event) => update("status", event.target.value)}><option value="pending">Pendiente</option><option value="approved">Aprobado</option><option value="rejected">Requiere cambios</option><option value="resolved">Resuelto</option></select></label><label>Fecha límite<input type="date" value={draft.due_date || ""} onChange={(event) => update("due_date", event.target.value)} /></label></> : null}
    {table !== "project_phases" ? <label className="ph-manager__check"><input type="checkbox" checked={draft.visible_to_client !== false} onChange={(event) => update("visible_to_client", event.target.checked)} /><span>Visible para el cliente</span></label> : null}
    <div className="ph-manager__actions"><button className="secondary-button" type="button" onClick={onCancel}>Limpiar</button><button className="primary-button" type="button" disabled={saving} onClick={onSave}>{saving ? "Guardando..." : "Guardar"}</button></div>
  </div>;
}
