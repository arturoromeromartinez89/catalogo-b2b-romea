import { useEffect, useMemo, useState } from "react";
import { fetchProjectsForTenant, removeProjectMember, saveProject, saveProjectMember } from "../../services/projectHubService";
import { makeTenantSlug, saveTenant } from "../../services/tenantService";
import { confirmedProgress } from "../../utils/projectHubModel";

// Alta interna de clientes y proyectos. Máximo rigor debajo, recorrido hipersimple arriba:
// Clientes → Proyectos, y en cada nivel solo lo que hace falta para operar.

const emptyClient = { id: null, name: "", slug: "", status: "active" };

const emptyProject = {
  name: "",
  description: "",
  objective: "",
  goal: "",
  included_scope: [],
  excluded_scope: [],
  status: "draft",
  health: "green",
  current_phase_name: "",
  start_date: "",
  estimated_end_date: "",
  internal_owner_name: "Equipo NEXOR IA",
  published: false,
};

const projectStatusOptions = [
  { value: "draft", label: "Borrador" },
  { value: "active", label: "Activo" },
  { value: "on_hold", label: "En pausa" },
  { value: "completed", label: "Terminado" },
  { value: "cancelled", label: "Cancelado" },
];

const healthOptions = [
  { value: "green", label: "En tiempo" },
  { value: "yellow", label: "Requiere atención" },
  { value: "red", label: "En riesgo" },
];

const memberRoleOptions = [
  { value: "responsable", label: "Responsable" },
  { value: "colaborador", label: "Colaborador" },
  { value: "revisor", label: "Revisor" },
];

const clientStatusLabel = (status) => (status === "active" ? "Activo" : "Pausado");
const projectStatusLabel = (status) => projectStatusOptions.find((item) => item.value === status)?.label || "Borrador";
const projectHealthLabel = { green: "En tiempo", yellow: "Atención", red: "En riesgo" };
const personName = (profile) => (profile?.email || "").split("@")[0].replace(/[._-]+/g, " ") || "Sin nombre";
const listToText = (value) => (Array.isArray(value) ? value.join("\n") : String(value || ""));
const formatDate = (value) => (value ? new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : "Sin fecha");

const studioIcon = (name) => {
  const paths = {
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    back: <><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    client: <><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21v-6h6v6" /></>,
    project: <><path d="M4 6h16v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M9 3h6v3H9zM8 11h8M8 15h5" /></>,
    preview: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M9 10h12" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
};

export default function ProjectStudio({ tenants = [], profiles = [], profile, initialClientId = "", projectsByTenant = {}, demoMode = false, onRefreshTenants, onOpenWorkspace, onOpenClientView }) {
  const [clientId, setClientId] = useState(initialClientId);
  const [clientDraft, setClientDraft] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectDraft, setProjectDraft] = useState({ ...emptyProject });
  const [editorOpen, setEditorOpen] = useState(false);
  const [newMember, setNewMember] = useState({ profileId: "", projectRole: "colaborador" });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeClient = useMemo(() => tenants.find((item) => item.id === clientId) || null, [tenants, clientId]);
  const selectedProject = useMemo(() => projects.find((item) => item.id === selectedProjectId) || null, [projects, selectedProjectId]);
  // El equipo interno de NEXOR: quien administra el sistema, no los usuarios del cliente.
  const staff = useMemo(() => profiles.filter((item) => ["superadmin", "admin"].includes(item.role)), [profiles]);

  const loadProjects = async (tenantId, keepProjectId = "") => {
    if (!tenantId) return;
    setLoading(true);
    setStatus("");
    try {
      const next = demoMode ? (projectsByTenant[tenantId] || []) : await fetchProjectsForTenant(tenantId);
      setProjects(next);
      const keep = next.find((item) => item.id === keepProjectId);
      setSelectedProjectId(keep?.id || "");
      setProjectDraft(keep ? { ...keep, included_scope: keep.included_scope || [], excluded_scope: keep.excluded_scope || [] } : { ...emptyProject });
    } catch (error) {
      setStatus(`No se pudieron cargar los proyectos: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (clientId) loadProjects(clientId); }, [clientId]);

  const openClient = (tenant) => {
    setClientDraft(null);
    setProjects([]);
    setSelectedProjectId("");
    setProjectDraft({ ...emptyProject });
    setClientId(tenant.id);
  };

  const backToClients = () => {
    setClientId("");
    setClientDraft(null);
    setEditorOpen(false);
    setStatus("");
  };

  const persistClient = async (draft) => {
    if (demoMode) { setStatus("Vista previa: conecta el cliente real para guardar cambios."); return; }
    if (!String(draft.name || "").trim()) { setStatus("Escribe el nombre del cliente."); return; }
    setSaving(true);
    try {
      const saved = await saveTenant({
        ...(draft.id ? { id: draft.id } : {}),
        name: draft.name.trim(),
        slug: draft.slug || makeTenantSlug(draft.name),
        status: draft.status || "active",
      });
      await onRefreshTenants?.();
      setClientDraft(null);
      setStatus(`Cliente ${saved.name} guardado.`);
    } catch (error) {
      setStatus(`No se pudo guardar el cliente: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleClientStatus = async (tenant) => {
    if (demoMode) { setStatus("Vista previa: conecta el cliente real para cambiar su estado."); return; }
    setSaving(true);
    try {
      await saveTenant({ id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status === "active" ? "paused" : "active" });
      await onRefreshTenants?.();
      setStatus(tenant.status === "active"
        ? `${tenant.name} quedó pausado. Su información se conserva completa.`
        : `${tenant.name} está activo otra vez.`);
    } catch (error) {
      setStatus(`No se pudo cambiar el estado: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const selectProject = (project) => {
    setSelectedProjectId(project.id);
    setProjectDraft({ ...project, included_scope: project.included_scope || [], excluded_scope: project.excluded_scope || [] });
    setNewMember({ profileId: "", projectRole: "colaborador" });
    setEditorOpen(true);
  };

  const startNewProject = () => {
    setSelectedProjectId("");
    setProjectDraft({ ...emptyProject });
    setEditorOpen(true);
  };

  const persistProject = async () => {
    if (demoMode) { setStatus("Vista previa: conecta el proyecto real para guardar cambios."); return; }
    if (!clientId) return;
    if (!String(projectDraft.name || "").trim()) { setStatus("El proyecto necesita un nombre."); return; }
    setSaving(true);
    try {
      const saved = await saveProject(projectDraft, clientId, profile?.id);
      await loadProjects(clientId, saved.id);
      setEditorOpen(false);
      setStatus(saved.published
        ? "Proyecto guardado y visible para el cliente."
        : "Proyecto guardado como borrador interno: el cliente todavía no lo ve.");
    } catch (error) {
      setStatus(`No se pudo guardar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const addMember = async () => {
    if (demoMode) { setStatus("Vista previa: conecta el proyecto real para modificar el equipo."); return; }
    if (!selectedProject || !newMember.profileId) { setStatus("Elige a la persona que quieres agregar."); return; }
    setSaving(true);
    try {
      await saveProjectMember({ tenantId: clientId, projectId: selectedProject.id, profileId: newMember.profileId, projectRole: newMember.projectRole });
      setNewMember({ profileId: "", projectRole: "colaborador" });
      await loadProjects(clientId, selectedProject.id);
      setStatus("Integrante agregado al proyecto.");
    } catch (error) {
      setStatus(`No se pudo agregar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const dropMember = async (member) => {
    if (demoMode) { setStatus("Vista previa: conecta el proyecto real para modificar el equipo."); return; }
    setSaving(true);
    try {
      await removeProjectMember(member.id);
      await loadProjects(clientId, selectedProject?.id);
      setStatus("Integrante retirado del proyecto.");
    } catch (error) {
      setStatus(`No se pudo retirar: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const update = (key, value) => setProjectDraft((current) => ({ ...current, [key]: value }));
  const members = selectedProject?.project_members || [];
  const availableStaff = staff.filter((person) => !members.some((member) => member.profile_id === person.id));

  if (!clientId) {
    return <section className="ph-manager ph-studio ph-studio--directory">
      <header className="ph-manager__header ph-studio__toolbar">
        <button className="primary-button" type="button" onClick={() => setClientDraft({ ...emptyClient })}>{studioIcon("plus")}Nuevo cliente</button>
      </header>
      {status ? <p className="status info">{status}</p> : null}

      {clientDraft ? <ClientForm
        draft={clientDraft}
        saving={saving}
        onChange={setClientDraft}
        onSave={() => persistClient(clientDraft)}
        onCancel={() => setClientDraft(null)}
      /> : null}

      <div className="ph-studio__clients">
        {tenants.map((tenant) => <article className={`ph-studio__client ph-studio__client--${tenant.status === "active" ? "active" : "paused"}`} key={tenant.id}>
          <div className="ph-studio__client-id">
            <strong>{tenant.name}</strong>
            <small>{tenant.slug}</small>
          </div>
          <div className="ph-studio__client-projects"><strong>{(projectsByTenant[tenant.id] || []).length}</strong><small>proyectos</small></div>
          <span className={`project-status project-status--${tenant.status === "active" ? "in_progress" : "waiting"}`}>{clientStatusLabel(tenant.status)}</span>
          <div className="ph-studio__client-actions">
            <button className="secondary-button compact-action" type="button" onClick={() => onOpenClientView?.(tenant)}>{studioIcon("preview")}Vista cliente</button>
            <button className="secondary-button compact-action" type="button" onClick={() => setClientDraft({ id: tenant.id, name: tenant.name, slug: tenant.slug, status: tenant.status })}>Editar</button>
            <button className="secondary-button compact-action" type="button" disabled={saving} title={tenant.status === "active" ? "Deja de operarse. Conserva toda su información." : "Vuelve a operarse."} onClick={() => toggleClientStatus(tenant)}>{tenant.status === "active" ? "Pausar" : "Activar"}</button>
            <button className="primary-button compact-action" type="button" onClick={() => openClient(tenant)}>Abrir proyectos{studioIcon("arrow")}</button>
          </div>
        </article>)}
        {!tenants.length ? <p className="muted">Todavía no hay clientes registrados. Crea el primero para empezar a operar sus proyectos.</p> : null}
      </div>
    </section>;
  }

  return <section className="ph-manager ph-studio ph-studio--projects">
    <header className="ph-studio-projects__bar">
      <button className="ph-studio__back" type="button" onClick={backToClients}>{studioIcon("back")}Clientes</button>
      <div><strong>{activeClient?.name}</strong><span>{projects.length} {projects.length === 1 ? "proyecto" : "proyectos"}</span></div>
      <button className="primary-button" type="button" onClick={startNewProject}>{studioIcon("plus")}Nuevo proyecto</button>
    </header>
    {status ? <p className="status info">{status}</p> : null}
    <div className="ph-studio-projects" aria-label={`Proyectos de ${activeClient?.name || "cliente"}`}>
      {loading ? <p className="muted">Cargando...</p> : null}
      {projects.map((project) => <article className="ph-studio-project-row" key={project.id}>
        <button className="ph-studio-project-row__main" type="button" onClick={() => onOpenWorkspace?.(clientId, project.id)}>
          <div><strong>{project.name}</strong><small>{project.current_phase_name || "Etapa por definir"}</small></div>
          <span className={`project-status project-status--${project.health === "red" ? "blocked" : project.health === "yellow" ? "waiting" : "in_progress"}`}>{projectHealthLabel[project.health] || projectStatusLabel(project.status)}</span>
          <div className="ph-studio-project-row__progress"><i><b style={{ width: `${confirmedProgress(project.project_deliverables)}%` }} /></i><small>{confirmedProgress(project.project_deliverables)}% confirmado</small></div>
          <time>{formatDate(project.estimated_end_date)}</time>
          <em>{project.published ? "Portal activo" : "Solo interno"}</em>
        </button>
        <div className="ph-studio-project-row__actions"><button className="secondary-button compact-action" type="button" onClick={() => onOpenClientView?.(activeClient)}>{studioIcon("preview")}Vista cliente</button><button className="secondary-button compact-action" type="button" onClick={() => selectProject(project)}>Editar</button><button className="primary-button compact-action" type="button" onClick={() => onOpenWorkspace?.(clientId, project.id)}>Abrir{studioIcon("arrow")}</button></div>
      </article>)}
      {!loading && !projects.length ? <div className="ph-studio-projects__empty">Este cliente todavía no tiene proyectos.<button className="primary-button" type="button" onClick={startNewProject}>Crear proyecto</button></div> : null}
    </div>

    {editorOpen ? <><button className="ph-studio-project-editor__scrim" type="button" aria-label="Cerrar editor" onClick={() => setEditorOpen(false)} /><aside className="ph-studio-project-editor" role="dialog" aria-modal="true" aria-label={selectedProjectId ? "Editar proyecto" : "Nuevo proyecto"}>
      <header><div><small>{activeClient?.name}</small><h3>{selectedProjectId ? "Editar proyecto" : "Nuevo proyecto"}</h3></div><button type="button" aria-label="Cerrar" onClick={() => setEditorOpen(false)}>×</button></header>
      <div className="ph-studio-project-editor__body">
        <label className="ph-manager__publish"><input type="checkbox" checked={Boolean(projectDraft.published)} onChange={(event) => update("published", event.target.checked)} /><span>{projectDraft.published ? "Visible para el cliente" : "Solo interno"}</span></label>
        <div className="ph-manager__form-grid">
          <label className="ph-manager__span-2">Nombre<input value={projectDraft.name || ""} onChange={(event) => update("name", event.target.value)} placeholder="Ej. Digitalización de operaciones" /></label>
          <label className="ph-manager__span-2">Descripción<textarea value={projectDraft.description || ""} onChange={(event) => update("description", event.target.value)} /></label>
          <label className="ph-manager__span-2">Objetivo<textarea value={projectDraft.objective || ""} onChange={(event) => update("objective", event.target.value)} /></label>
          <label className="ph-manager__span-2">Meta<textarea value={projectDraft.goal || ""} onChange={(event) => update("goal", event.target.value)} /></label>
          <label>Inicio<input type="date" value={projectDraft.start_date || ""} onChange={(event) => update("start_date", event.target.value)} /></label>
          <label>Fecha objetivo<input type="date" value={projectDraft.estimated_end_date || ""} onChange={(event) => update("estimated_end_date", event.target.value)} /></label>
          <label>Etapa actual<input value={projectDraft.current_phase_name || ""} onChange={(event) => update("current_phase_name", event.target.value)} /></label>
          <label>Estado<select value={projectDraft.status || "draft"} onChange={(event) => update("status", event.target.value)}>{projectStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Salud<select value={projectDraft.health || "green"} onChange={(event) => update("health", event.target.value)}>{healthOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>Responsable<input value={projectDraft.internal_owner_name || ""} onChange={(event) => update("internal_owner_name", event.target.value)} /></label>
          <label className="ph-manager__span-2">Alcance incluido<textarea className="ph-studio__list-field" value={listToText(projectDraft.included_scope)} onChange={(event) => update("included_scope", event.target.value.split("\n"))} /></label>
          <label className="ph-manager__span-2">Exclusiones<textarea className="ph-studio__list-field" value={listToText(projectDraft.excluded_scope)} onChange={(event) => update("excluded_scope", event.target.value.split("\n"))} /></label>
        </div>
        {selectedProject ? <section className="ph-studio-project-editor__team"><h4>Equipo</h4><div className="ph-studio__team">{members.map((member) => { const person = profiles.find((item) => item.id === member.profile_id); return <div className="ph-studio__member" key={member.id}><i>{personName(person).slice(0, 2).toUpperCase()}</i><div><strong>{personName(person)}</strong><small>{person?.email || "Cuenta retirada"}</small></div><span>{memberRoleOptions.find((item) => item.value === member.project_role)?.label || member.project_role}</span><button type="button" className="danger" disabled={saving} onClick={() => dropMember(member)}>Retirar</button></div>; })}{!members.length ? <p className="muted">Nadie asignado todavía.</p> : null}</div><div className="ph-studio__team-add"><label>Agregar a<select value={newMember.profileId} onChange={(event) => setNewMember((current) => ({ ...current, profileId: event.target.value }))}><option value="">Seleccionar persona</option>{availableStaff.map((person) => <option key={person.id} value={person.id}>{personName(person)} · {person.email}</option>)}</select></label><label>Papel<select value={newMember.projectRole} onChange={(event) => setNewMember((current) => ({ ...current, projectRole: event.target.value }))}>{memberRoleOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button className="secondary-button compact-action" type="button" disabled={saving || !newMember.profileId} onClick={addMember}>Agregar</button></div></section> : null}
      </div>
      <footer>{selectedProject ? <button className="secondary-button" type="button" onClick={() => onOpenWorkspace?.(clientId, selectedProject.id)}>Abrir espacio</button> : <span />}<button className="primary-button" type="button" disabled={saving} onClick={persistProject}>{saving ? "Guardando..." : selectedProjectId ? "Guardar cambios" : "Crear proyecto"}</button></footer>
    </aside></> : null}
  </section>;
}

function ClientForm({ draft, saving, onChange, onSave, onCancel }) {
  const update = (key, value) => onChange({ ...draft, [key]: value });
  return <article className="ph-manager__card ph-studio__client-form">
    <div className="ph-manager__card-head"><div><span>{draft.id ? "Editar cliente" : "Cliente nuevo"}</span><h3>{draft.name || "Sin nombre todavía"}</h3></div></div>
    <div className="ph-manager__form-grid">
      <label className="ph-manager__span-2">Nombre del cliente<input value={draft.name || ""} onChange={(event) => update("name", event.target.value)} placeholder="Ej. Estuches Chávez" /></label>
      <label>Identificador<input value={draft.slug || (draft.name.trim() ? makeTenantSlug(draft.name) : "")} disabled={Boolean(draft.id)} placeholder="Se genera del nombre" onChange={(event) => update("slug", makeTenantSlug(event.target.value))} /><small>{draft.id ? "No cambia: es la dirección del cliente." : "Puedes ajustarlo antes de crear."}</small></label>
      <label>Estado<select value={draft.status || "active"} onChange={(event) => update("status", event.target.value)}><option value="active">Activo</option><option value="paused">Pausado</option></select></label>
    </div>
    <div className="ph-manager__actions">
      <button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button>
      <button className="primary-button" type="button" disabled={saving} onClick={onSave}>{saving ? "Guardando..." : draft.id ? "Guardar cliente" : "Crear cliente"}</button>
    </div>
  </article>;
}
