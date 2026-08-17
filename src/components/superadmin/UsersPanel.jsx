import { useMemo, useState } from "react";
import { updateProfileAccess } from "../../services/tenantService";

const roles = ["superadmin", "tenant_admin", "admin", "client"];
const roleLabels = {
  superadmin: "Superadmin",
  tenant_admin: "Administrador del cliente",
  admin: "Administrador",
  client: "Cliente",
};

export default function UsersPanel({ profiles, tenants, onRefresh }) {
  const [status, setStatus] = useState("");

  const overview = useMemo(() => ({
    internal: profiles.filter((profile) => profile.role === "superadmin" || profile.role === "admin").length,
    client: profiles.filter((profile) => profile.tenant_id).length,
    unassigned: profiles.filter((profile) => !profile.tenant_id).length,
  }), [profiles]);

  const handleChange = async (profile, changes) => {
    try {
      await updateProfileAccess(profile.id, {
        role: changes.role ?? profile.role,
        tenant_id: Object.prototype.hasOwnProperty.call(changes, "tenant_id") ? changes.tenant_id : profile.tenant_id,
        client_id: profile.client_id || null,
      });
      setStatus("Acceso actualizado.");
      onRefresh();
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <section className="studio-overview">
      <div className="studio-signals" aria-label="Resumen de accesos">
        <article><span>Usuarios</span><strong>{profiles.length}</strong><small>accesos registrados</small></article>
        <article><span>Equipo NEXOR</span><strong>{overview.internal}</strong><small>acceso interno</small></article>
        <article><span>Con empresa</span><strong>{overview.client}</strong><small>portal asignado</small></article>
        <article><span>Sin empresa</span><strong>{overview.unassigned}</strong><small>por revisar</small></article>
      </div>

      <article className="studio-sheet">
        <header className="studio-sheet__header">
          <div>
            <span className="tool-eyebrow">Control de acceso</span>
            <h3>Usuarios</h3>
            <p>Define quién entra, con qué nivel y a qué empresa.</p>
          </div>
          <span className="studio-sheet__note">Los cambios se guardan al seleccionar</span>
        </header>

        {status ? <p className="status info">{status}</p> : null}

        <div className="studio-user-list">
          {profiles.map((profile) => {
            const initials = (profile.email || "U").split("@")[0].split(/[._-]/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
            const created = profile.created_at ? new Date(profile.created_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "Sin fecha";
            return (
              <div className="studio-user-row" key={profile.id}>
                <div className="studio-user-row__identity">
                  <i aria-hidden="true">{initials}</i>
                  <div>
                    <strong>{profile.email}</strong>
                    <small>{roleLabels[profile.role] || profile.role} · Alta {created}</small>
                  </div>
                </div>
                <label className="studio-inline-control">
                  <span>Rol</span>
                  <select value={profile.role} onChange={(event) => handleChange(profile, { role: event.target.value })}>
                    {roles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
                  </select>
                </label>
                <label className="studio-inline-control">
                  <span>Empresa</span>
                  <select value={profile.tenant_id || ""} onChange={(event) => handleChange(profile, { tenant_id: event.target.value || null })}>
                    <option value="">Sin empresa</option>
                    {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
                  </select>
                </label>
                <span className={`studio-state ${profile.tenant_id ? "studio-state--active" : "studio-state--neutral"}`}>
                  {profile.tenant_id ? "Asignado" : "Interno"}
                </span>
              </div>
            );
          })}
          {!profiles.length ? <p className="studio-empty">No hay usuarios para mostrar.</p> : null}
        </div>
      </article>
    </section>
  );
}
