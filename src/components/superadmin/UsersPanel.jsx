import { useState } from "react";
import { createAdminUser, updateProfileAccess } from "../../services/tenantService";

const roles = ["superadmin", "tenant_admin", "admin", "client"];

export default function UsersPanel({ profiles, tenants, onRefresh }) {
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "tenant_admin",
    tenant_id: "",
  });

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

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      await createAdminUser(form);
      setStatus("Usuario creado o actualizado.");
      setForm({ email: "", password: "", role: "tenant_admin", tenant_id: "" });
      onRefresh();
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const tenantName = (tenantId) => tenants.find((tenant) => tenant.id === tenantId)?.name || "Sin empresa";
  const needsTenant = form.role !== "superadmin";

  return (
    <section className="admin-soft-panel compact-panel">
      <span className="tool-eyebrow">Accesos</span>
      <h2>Usuarios y permisos</h2>
      <p className="muted">Asigna cada usuario a su empresa. El superadmin puede quedar sin empresa.</p>
      {status ? <p className="status info">{status}</p> : null}
      <form className="tenant-form user-create-form" onSubmit={handleCreate}>
        <label>
          Correo
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="correo@empresa.com"
            required
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            minLength={10}
            placeholder="Min. 10, con mayúscula/número/símbolo"
            required
          />
          <small>Evita contraseñas obvias como nombre + año.</small>
        </label>
        <label>
          Rol
          <select
            value={form.role}
            onChange={(event) => setForm((current) => ({
              ...current,
              role: event.target.value,
              tenant_id: event.target.value === "superadmin" ? "" : current.tenant_id,
            }))}
          >
            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>
        <label>
          Empresa
          <select
            value={form.tenant_id}
            onChange={(event) => setForm((current) => ({ ...current, tenant_id: event.target.value }))}
            disabled={!needsTenant}
            required={needsTenant}
          >
            <option value="">{needsTenant ? "Selecciona empresa" : "Sin empresa"}</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={saving}>
          {saving ? "Creando..." : "Crear / actualizar usuario"}
        </button>
      </form>
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
