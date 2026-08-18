import { useEffect, useState } from "react";
import UsersPanel from "./UsersPanel";
import ProjectHubManager from "./ProjectHubManager";
import ProjectStudio from "./ProjectStudio";
import StudioHome from "./StudioHome";
import nexorLockupUrl from "../../assets/nexor-ia_lockup_dark-on-transparent.svg";
import { supabase } from "../../lib/supabaseClient";
import { fastSignOut } from "../../services/authService";
import { fetchProfiles, fetchTenants } from "../../services/tenantService";
import { fetchProjectsForTenant } from "../../services/projectHubService";

const studioIcon = (name) => {
  const paths = {
    home: <><path d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v4H4zM14 15h6v4h-6z" /></>,
    projects: <><path d="M4 6h16v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M9 3h6v3H9zM8 11h8M8 15h5" /></>,
    companies: <><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21v-6h6v6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>,
    advanced: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="11" cy="18" r="2" /></>,
    metrics: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
};

const tabs = [
  { id: "home", label: "Inicio", icon: "home", title: "Centro de control", eyebrow: "NEXOR IA", lead: "Clientes, proyectos y decisiones que requieren atención." },
  { id: "clients", label: "Clientes", icon: "companies", title: "Clientes", eyebrow: "Cartera", lead: "Cada cliente y los proyectos que NEXOR desarrolla para su operación." },
  { id: "team", label: "Equipo", icon: "users", title: "Equipo", eyebrow: "Accesos", lead: "Personas que trabajan en NEXOR y usuarios asignados a cada cliente." },
];

// demoData permite abrir la misma pantalla con información sintética y sin sesión,
// únicamente en staging, para poder revisar y corregir el diseño de verdad.
export default function SuperAdminDashboard({ profile, demoData = null }) {
  const [tab, setTab] = useState("home");
  const [tenants, setTenants] = useState(demoData?.tenants || []);
  const [profiles, setProfiles] = useState(demoData?.profiles || []);
  const [projectsByTenant, setProjectsByTenant] = useState(demoData?.projectsByTenant || {});
  const [initialClientId, setInitialClientId] = useState("");
  const [workspace, setWorkspace] = useState(null);
  const [status, setStatus] = useState(demoData ? "" : "Cargando panel SaaS...");
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) return;
    if (demoData) {
      window.location.assign(`${import.meta.env.BASE_URL}demo/project-hub`);
      return;
    }
    setSigningOut(true);
    try {
      await fastSignOut(supabase);
    } catch (error) {
      setStatus(`Error al salir: ${error.message}`);
      setSigningOut(false);
    }
  };

  const load = async () => {
    if (demoData) return;
    try {
      setStatus("Cargando panel SaaS...");
      const nextTenants = await fetchTenants();
      const [nextProfiles, projectEntries] = await Promise.all([
        fetchProfiles(),
        Promise.all(nextTenants.map(async (tenant) => [tenant.id, await fetchProjectsForTenant(tenant.id)])),
      ]);
      setTenants(nextTenants);
      setProfiles(nextProfiles);
      setProjectsByTenant(Object.fromEntries(projectEntries));
      setStatus("");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeTab = tabs.find((item) => item.id === tab) || tabs[0];
  const workspaceProject = workspace
    ? (projectsByTenant[workspace.tenantId] || []).find((project) => project.id === workspace.projectId)
    : null;
  const workspaceTenant = workspace ? tenants.find((tenant) => tenant.id === workspace.tenantId) : null;
  const activePage = workspace ? {
    eyebrow: `${workspaceTenant?.name || "Cliente"} · Proyecto`,
    title: workspaceProject?.name || "Espacio de trabajo",
    lead: "Soluciones, entregables, decisiones y actividad del proyecto.",
  } : activeTab;

  const openClients = (tenantId = "") => {
    setWorkspace(null);
    setInitialClientId(tenantId);
    setTab("clients");
  };

  const openWorkspace = (tenantId, projectId) => {
    setWorkspace({ tenantId, projectId });
    setTab("clients");
  };

  const navigate = (nextTab) => {
    setWorkspace(null);
    setInitialClientId("");
    setTab(nextTab);
  };

  return (
    <div className="project-hub-demo-shell project-hub-demo-shell--light nexor-studio-shell">
      <header className="project-hub-demo-bar">
        <img className="project-hub-demo-logo" src={nexorLockupUrl} alt="NEXOR IA" />
        <div className="project-hub-demo-bar__context">
          <div className="nexor-workplace nexor-workplace--admin" aria-label="Superadmin">
            <i aria-hidden="true" />
            <strong>Superadmin</strong>
          </div>
          {!demoData ? <button className="secondary-button compact-action" type="button" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? "Saliendo..." : "Salir"}
          </button> : null}
        </div>
      </header>

      <section className="project-hub project-hub--light nexor-studio" aria-label="NEXOR Studio">
        <aside className="project-hub__sidebar">
          <div className="project-hub__sidebar-head">
            <div><strong>Studio</strong></div>
          </div>
          <nav className="project-hub__nav" aria-label="Secciones de NEXOR Studio">
            {tabs.map((item) => (
              <button aria-label={item.label} className={tab === item.id ? "active" : ""} key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} onClick={() => navigate(item.id)}>
                {studioIcon(item.icon)}
                <span className="project-hub__nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
          <footer><i /><span>Sistema interno</span></footer>
        </aside>

        <main className="project-hub__workspace">
        <section className="project-section-page nexor-studio__page">
          {!workspace ? <header>
            <p>{activePage.eyebrow}</p>
            <h2>{activePage.title}</h2>
            <span>{activePage.lead}</span>
          </header> : null}
          {status ? <p className="status info">{status}</p> : null}
          {tab === "home" ? (
            <StudioHome tenants={tenants} projectsByTenant={projectsByTenant} onOpenClient={openClients} onOpenProject={openWorkspace} />
          ) : null}
          {tab === "team" ? (
            <UsersPanel profiles={profiles} tenants={tenants} onRefresh={load} />
          ) : null}
          {tab === "clients" && !workspace ? (
            <ProjectStudio tenants={tenants} profiles={profiles} profile={profile} initialClientId={initialClientId} projectsByTenant={projectsByTenant} demoMode={Boolean(demoData)} onRefreshTenants={load} onOpenWorkspace={openWorkspace} />
          ) : null}
          {tab === "clients" && workspace ? (
            <ProjectHubManager key={`${workspace.tenantId}-${workspace.projectId}`} tenants={tenants} profile={profile} demoMode={Boolean(demoData)} demoProjectsByTenant={projectsByTenant} initialTenantId={workspace.tenantId} initialProjectId={workspace.projectId} onBack={() => openClients(workspace.tenantId)} />
          ) : null}
        </section>
        </main>
      </section>
      {signingOut ? (
        <div className="signout-overlay nexor-studio-signout" role="status" aria-live="assertive">
          <div className="signout-card">
            <span className="loading-spinner" aria-hidden="true" />
            <strong>Saliendo...</strong>
            <p>Cerrando la sesión de forma segura.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
