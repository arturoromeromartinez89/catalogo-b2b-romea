import { useEffect, useMemo, useState } from "react";
import { deleteProjectChild, fetchProjectsForTenant, saveProject, saveProjectChild } from "../../services/projectHubService";

const emptyProject = { name: "", description: "", status: "draft", health: "green", progress_percentage: 0, current_phase_name: "", start_date: "", estimated_end_date: "", internal_owner_name: "Equipo NEXOR IA", published: false };
const sections = [
  { id: "project_phases", label: "Roadmap" },
  { id: "project_updates", label: "Avances" },
  { id: "project_deliverables", label: "Entregables" },
  { id: "project_documents", label: "Documentos" },
  { id: "project_approvals", label: "Aprobaciones" },
];
const emptyChild = {
  project_phases: { name: "", description: "", status: "pending", progress_percentage: 0, sort_order: 10, estimated_end_date: "" },
  project_updates: { title: "", description: "", update_type: "progress", visible_to_client: true },
  project_deliverables: { name: "", description: "", status: "pending", estimated_delivery_date: "", external_url: "", visible_to_client: true },
  project_documents: { name: "", description: "", document_type: "scope", external_url: "", visible_to_client: true },
  project_approvals: { title: "", description: "", status: "pending", due_date: "", visible_to_client: true, client_comment: "" },
};
const statusLabel = { draft: "Borrador", active: "Activo", on_hold: "En pausa", completed: "Completado", cancelled: "Cancelado", pending: "Pendiente", in_progress: "En curso", blocked: "Bloqueado", delivered: "Entregado", approved: "Aprobado", rejected: "Rechazado", resolved: "Resuelto" };
const childTitle = (item) => item.name || item.title || "Registro";

export default function ProjectHubManager({ tenants = [], profile }) {
  const portalTenants = useMemo(() => tenants.filter((item) => ["vanguardia-joyera", "estuches-chavez", "romea"].includes(item.slug)), [tenants]);
  const [tenantId, setTenantId] = useState("");
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [projectDraft, setProjectDraft] = useState(emptyProject);
  const [section, setSection] = useState("project_phases");
  const [childDraft, setChildDraft] = useState(emptyChild.project_phases);
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
          {projects.map((project) => <button className={selectedId === project.id ? "active" : ""} type="button" key={project.id} onClick={() => selectProject(project)}><strong>{project.name}</strong><span>{statusLabel[project.status]} · {project.progress_percentage}%</span><small>{project.published ? "Visible para cliente" : "Borrador interno"}</small></button>)}
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
              <label>Avance (%)<input type="number" min="0" max="100" value={projectDraft.progress_percentage ?? 0} onChange={(event) => setProjectDraft((current) => ({ ...current, progress_percentage: event.target.value }))} /></label>
              <label>Etapa actual<input value={projectDraft.current_phase_name || ""} onChange={(event) => setProjectDraft((current) => ({ ...current, current_phase_name: event.target.value }))} /></label>
              <label>Fecha de inicio<input type="date" value={projectDraft.start_date || ""} onChange={(event) => setProjectDraft((current) => ({ ...current, start_date: event.target.value }))} /></label>
              <label>Entrega estimada<input type="date" value={projectDraft.estimated_end_date || ""} onChange={(event) => setProjectDraft((current) => ({ ...current, estimated_end_date: event.target.value }))} /></label>
              <label className="ph-manager__span-2">Responsable interno<input value={projectDraft.internal_owner_name || ""} onChange={(event) => setProjectDraft((current) => ({ ...current, internal_owner_name: event.target.value }))} /></label>
            </div>
            <div className="ph-manager__actions"><button className="primary-button" type="button" disabled={saving} onClick={handleProjectSave}>{saving ? "Guardando..." : "Guardar proyecto"}</button></div>
          </article>
          {selectedProject ? <article className="ph-manager__card">
            <nav className="ph-manager__section-tabs">{sections.map((item) => <button type="button" className={section === item.id ? "active" : ""} key={item.id} onClick={() => setSection(item.id)}>{item.label}<span>{selectedProject[item.id]?.length || 0}</span></button>)}</nav>
            <div className="ph-manager__child-layout"><div className="ph-manager__child-list">{items.map((item) => <div className="ph-manager__child-item" key={item.id}><div><strong>{childTitle(item)}</strong><span>{statusLabel[item.status] || item.update_type || item.document_type}</span>{item.visible_to_client === false ? <small>Solo interno</small> : null}</div><div><button type="button" onClick={() => setChildDraft({ ...item })}>Editar</button><button type="button" className="danger" disabled={saving} onClick={() => removeChild(item)}>Eliminar</button></div></div>)}{!items.length ? <p className="muted">Aún no hay información en esta sección.</p> : null}</div><ChildForm table={section} draft={childDraft} setDraft={setChildDraft} saving={saving} onSave={handleChildSave} onCancel={() => setChildDraft({ ...emptyChild[section] })} /></div>
          </article> : null}
        </div>
      </div>
    </section>
  );
}

function ChildForm({ table, draft, setDraft, saving, onSave, onCancel }) {
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const hasTitle = ["project_updates", "project_approvals"].includes(table);
  return <div className="ph-manager__child-form"><h4>{draft.id ? "Editar registro" : "Agregar registro"}</h4>
    <label>{hasTitle ? "Título" : "Nombre"}<input value={(hasTitle ? draft.title : draft.name) || ""} onChange={(event) => update(hasTitle ? "title" : "name", event.target.value)} /></label>
    <label>Descripción<textarea value={draft.description || ""} onChange={(event) => update("description", event.target.value)} /></label>
    {table === "project_phases" ? <><label>Estado<select value={draft.status} onChange={(event) => update("status", event.target.value)}><option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="completed">Completado</option><option value="blocked">Bloqueado</option></select></label><div className="ph-manager__inline"><label>Orden<input type="number" value={draft.sort_order ?? 0} onChange={(event) => update("sort_order", Number(event.target.value))} /></label><label>Avance<input type="number" min="0" max="100" value={draft.progress_percentage ?? 0} onChange={(event) => update("progress_percentage", Number(event.target.value))} /></label></div><label>Fecha estimada<input type="date" value={draft.estimated_end_date || ""} onChange={(event) => update("estimated_end_date", event.target.value)} /></label></> : null}
    {table === "project_updates" ? <label>Tipo<select value={draft.update_type} onChange={(event) => update("update_type", event.target.value)}><option value="progress">Avance</option><option value="milestone">Hito</option><option value="information">Información</option><option value="warning">Advertencia</option></select></label> : null}
    {table === "project_deliverables" ? <><label>Estado<select value={draft.status} onChange={(event) => update("status", event.target.value)}><option value="pending">Pendiente</option><option value="in_progress">En curso</option><option value="delivered">Entregado</option><option value="approved">Aprobado</option></select></label><label>Fecha estimada<input type="date" value={draft.estimated_delivery_date || ""} onChange={(event) => update("estimated_delivery_date", event.target.value)} /></label><label>Enlace opcional<input type="url" value={draft.external_url || ""} onChange={(event) => update("external_url", event.target.value)} /></label></> : null}
    {table === "project_documents" ? <><label>Tipo<select value={draft.document_type} onChange={(event) => update("document_type", event.target.value)}><option value="contract">Contrato</option><option value="proposal">Propuesta</option><option value="scope">Alcance</option><option value="nda">NDA</option><option value="manual">Manual</option><option value="technical">Técnico</option><option value="other">Otro</option></select></label><label>Enlace al documento<input type="url" value={draft.external_url || ""} onChange={(event) => update("external_url", event.target.value)} /></label></> : null}
    {table === "project_approvals" ? <><label>Estado<select value={draft.status} onChange={(event) => update("status", event.target.value)}><option value="pending">Pendiente</option><option value="approved">Aprobado</option><option value="rejected">Rechazado</option><option value="resolved">Resuelto</option></select></label><label>Fecha límite<input type="date" value={draft.due_date || ""} onChange={(event) => update("due_date", event.target.value)} /></label></> : null}
    {table !== "project_phases" ? <label className="ph-manager__check"><input type="checkbox" checked={draft.visible_to_client !== false} onChange={(event) => update("visible_to_client", event.target.checked)} /><span>Visible para el cliente</span></label> : null}
    <div className="ph-manager__actions"><button className="secondary-button" type="button" onClick={onCancel}>Limpiar</button><button className="primary-button" type="button" disabled={saving} onClick={onSave}>{saving ? "Guardando..." : "Guardar"}</button></div>
  </div>;
}
