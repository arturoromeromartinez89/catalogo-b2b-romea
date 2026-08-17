import { useEffect, useState } from "react";
import LanguageToggle from "../LanguageToggle";
import CompaniesPanel from "./CompaniesPanel";
import MetricsPanel from "./MetricsPanel";
import UsersPanel from "./UsersPanel";
import ProjectHubManager from "./ProjectHubManager";
import ProjectStudio from "./ProjectStudio";
import nexorLockupUrl from "../../assets/nexor-ia_lockup_dark-on-transparent.svg";
import { supabase } from "../../lib/supabaseClient";
import { fastSignOut } from "../../services/authService";
import { fetchProfiles, fetchTenantMetrics, fetchTenants } from "../../services/tenantService";
import { useImpersonation } from "../../contexts/ImpersonationContext";

const studioIcon = (name) => {
  const paths = {
    projects: <><path d="M4 6h16v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M9 3h6v3H9zM8 11h8M8 15h5" /></>,
    companies: <><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21v-6h6v6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /></>,
    advanced: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="11" cy="18" r="2" /></>,
    metrics: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
};

const tabs = [
  { id: "projects", label: "Proyectos", icon: "projects", title: "Proyectos", eyebrow: "Sistema de proyectos", lead: "Clientes, proyectos y su avance verificable." },
  { id: "companies", label: "Empresas", icon: "companies", title: "Empresas", eyebrow: "Plataforma", lead: "Cuentas que operan un catálogo dentro de NEXOR IA." },
  { id: "users", label: "Usuarios", icon: "users", title: "Usuarios", eyebrow: "Accesos", lead: "Quién entra, con qué papel y a qué empresa." },
  { id: "projectHub", label: "Detalle avanzado", icon: "advanced", title: "Detalle avanzado", eyebrow: "Registros", lead: "Captura fina de cada registro del proyecto." },
  { id: "metrics", label: "Métricas", icon: "metrics", title: "Métricas", eyebrow: "Operación", lead: "Volumen y uso por empresa." },
];

// demoData permite abrir la misma pantalla con información sintética y sin sesión,
// únicamente en staging, para poder revisar y corregir el diseño de verdad.
export default function SuperAdminDashboard({ profile, demoData = null }) {
  const impersonation = useImpersonation();
  const [tab, setTab] = useState("projects");
  const [tenants, setTenants] = useState(demoData?.tenants || []);
  const [profiles, setProfiles] = useState(demoData?.profiles || []);
  const [metrics, setMetrics] = useState(demoData?.metrics || {});
  const [status, setStatus] = useState(demoData ? "" : "Cargando panel SaaS...");
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut || demoData) return;
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
      const [nextProfiles, nextMetrics] = await Promise.all([
        fetchProfiles(),
        fetchTenantMetrics(nextTenants),
      ]);
      setTenants(nextTenants);
      setProfiles(nextProfiles);
      setMetrics(nextMetrics);
      setStatus("");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeTab = tabs.find((item) => item.id === tab) || tabs[0];

  return (
    <div className="project-hub-demo-shell project-hub-demo-shell--light nexor-studio-shell">
      <header className="project-hub-demo-bar">
        <img className="project-hub-demo-logo" src={nexorLockupUrl} alt="NEXOR IA" />
        <div className="project-hub-demo-bar__context">
          <LanguageToggle />
          <div className="nexor-studio__identity"><strong>{profile?.email}</strong><small>Superadmin</small></div>
          <button className="secondary-button compact-action" type="button" onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? "Saliendo..." : "Salir"}
          </button>
        </div>
      </header>

      <section className="project-hub project-hub--light nexor-studio" aria-label="NEXOR Studio">
        <aside className="project-hub__sidebar">
          <div className="project-hub__sidebar-head">
            <div><strong>Studio</strong></div>
          </div>
          <nav className="project-hub__nav" aria-label="Secciones de NEXOR Studio">
            {tabs.map((item) => (
              <button aria-label={item.label} className={tab === item.id ? "active" : ""} key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}>
                {studioIcon(item.icon)}
                <span className="project-hub__nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
          <footer><i /><span>Sistema interno</span></footer>
        </aside>

        <main className="project-hub__workspace">
        <section className="project-section-page nexor-studio__page">
          <header>
            <p>{activeTab.eyebrow}</p>
            <h2>{activeTab.title}</h2>
            <span>{activeTab.lead}</span>
          </header>
          {status ? <p className="status info">{status}</p> : null}
          {tab === "companies" ? (
            <CompaniesPanel
              tenants={tenants}
              metrics={metrics}
              onRefresh={load}
              onManage={(tenant) => impersonation.startImpersonation(tenant)}
            />
          ) : null}
          {tab === "users" ? (
            <UsersPanel profiles={profiles} tenants={tenants} onRefresh={load} />
          ) : null}
          {tab === "metrics" ? (
            <MetricsPanel tenants={tenants} metrics={metrics} />
          ) : null}
          {tab === "projects" ? (
            <ProjectStudio tenants={tenants} profiles={profiles} profile={profile} onRefreshTenants={load} />
          ) : null}
          {tab === "projectHub" ? (
            <ProjectHubManager tenants={tenants} profile={profile} />
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
