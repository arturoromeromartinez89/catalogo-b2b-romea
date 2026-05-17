import { useState } from "react";
import { updateProfileAccess } from "../../services/tenantService";

const roles = ["superadmin", "tenant_admin", "admin", "client"];

export default function UsersPanel({ profiles, tenants, onRefresh }) {
  const [status, setStatus] = useState("");

  const handleChange = async (profile, changes) => {
    try {
      await updateProfileAccess(profile.id, {
        role: changes.role ?? profile.role,
        tenant_id: changes.tenant_id ?? profile.tenant_id,
        client_id: profile.client_id || null,
      });
      setStatus("Usuario actualizado.");
      onRefresh();
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  const tenantName = (tenantId) => tenants.find((tenant) => tenant.id === tenantId)?.name || "Sin empresa";

  return (
    <section className="admin-soft-panel compact-panel">
      <span className="tool-eyebrow">Accesos</span>
      <h2>Usuarios y permisos</h2>
      <p className="muted">Asigna cada usuario a su empresa. El superadmin puede quedar sin empresa.</p>
      {status ? <p className="status info">{status}</p> : null}
      <div className="responsive-table">
        <table className="simple-admin-table">
          <thead>
            <tr>
              <th>Correo</th>
              <th>Rol</th>
              <th>Empresa asignada</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id}>
                <td><strong>{profile.email}</strong></td>
                <td>
                  <select value={profile.role} onChange={(event) => handleChange(profile, { role: event.target.value })}>
                    {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </td>
                <td>
                  <select value={profile.tenant_id || ""} onChange={(event) => handleChange(profile, { tenant_id: event.target.value || null })}>
                    <option value="">Sin empresa</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                    ))}
                  </select>
                  <small>{tenantName(profile.tenant_id)}</small>
                </td>
                <td>{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
            {!profiles.length ? <tr><td colSpan="4">No hay usuarios para mostrar.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
