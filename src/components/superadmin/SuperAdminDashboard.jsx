import { useEffect, useState } from "react";
import LanguageToggle from "../LanguageToggle";
import CompaniesPanel from "./CompaniesPanel";
import MetricsPanel from "./MetricsPanel";
import UsersPanel from "./UsersPanel";
import { supabase } from "../../lib/supabaseClient";
import { fetchProfiles, fetchTenantMetrics, fetchTenants } from "../../services/tenantService";
import { useImpersonation } from "../../contexts/ImpersonationContext";

const tabs = [
  { id: "companies", label: "Empresas" },
  { id: "users", label: "Usuarios" },
  { id: "metrics", label: "Métricas" },
];

export default function SuperAdminDashboard({ profile }) {
  const impersonation = useImpersonation();
  const [tab, setTab] = useState("companies");
  const [tenants, setTenants] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [status, setStatus] = useState("Cargando panel SaaS...");

  const load = async () => {
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

  return (
    <div className="superadmin-shell">
      <aside className="superadmin-sidebar">
        <div className="brand-block">
          <div className="saas-mark" aria-hidden="true">SaaS</div>
          <p>Panel SaaS</p>
        </div>
        <section className="sidebar-section sidebar-menu-section">
          <h3>Superadmin</h3>
          <div className="admin-nav-list">
            {tabs.map((item) => (
              <button className={tab === item.id ? "active" : ""} key={item.id} type="button" onClick={() => setTab(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </section>
        <button className="secondary-button full compact-action" type="button" onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}>
          Salir
        </button>
      </aside>

      <main className="superadmin-main">
        <header className="admin-catalog-header">
          <div>
            <p className="eyebrow">Plataforma SaaS</p>
            <h1>Administración global</h1>
            <span>{profile?.email} · no estás operando ningún catálogo de empresa.</span>
          </div>
          <LanguageToggle />
        </header>

        <section className="admin-workspace">
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
        </section>
      </main>
    </div>
  );
}
