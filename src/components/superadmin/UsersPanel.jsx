import { useState } from "react";
import { setAdminPassword, updateProfileAccess } from "../../services/tenantService";

const roles = ["superadmin", "tenant_admin", "admin", "client"];
const adminRoles = ["tenant_admin", "admin"];

const emptyForm = {
  email: "",
  password: "",
  tenantId: "",
  role: "tenant_admin",
};

export default function UsersPanel({ profiles, tenants, onRefresh }) {
  const [status, setStatus] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

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

  const handleCreateAdmin = async (event) => {
    event.preventDefault();
    setStatus("");
    if (!form.email.trim() || !form.password.trim() || !form.tenantId) {
      setStatus("Error: completa correo, contrasena y empresa.");
      return;
    }
    setSaving(true);
    try {
      await setAdminPassword({
        email: form.email,
        password: form.password,
        tenantId: form.tenantId,
        role: form.role,
      });
      setStatus("Usuario administrador creado. Ya puede iniciar sesion.");
      setForm(emptyForm);
      onRefresh();
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const tenantName = (tenantId) => tenants.find((tenant) => tenant.id === tenantId)?.name || "Sin empresa";

  return (
    <section className="admin-soft-panel compact-panel">
      <span className="tool-eyebrow">Accesos</span>
      <h2>Usuarios y permisos</h2>
      <p className="muted">Asigna cada usuario a su empresa. El superadmin puede quedar sin empresa.</p>
      {status ? <p className="status info">{status}</p> : null}
      <form className="admin-user-create-panel" onSubmit={handleCreateAdmin}>
        <div>
          <strong>Crear admin de empresa</strong>
          <p className="muted">Usa este acceso para Paco o cualquier cliente que administrara su catalogo.</p>
        </div>
        <label>
          <span>Correo</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setField("email", event.target.value)}
            placeholder="admin@empresa.com"
            required
          />
        </label>
        <label>
          <span>Contrasena temporal</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => setField("password", event.target.value)}
            minLength={6}
            required
          />
        </label>
        <label>
          <span>Empresa</span>
          <select value={form.tenantId} onChange={(event) => setField("tenantId", event.target.value)} required>
            <option value="">Selecciona empresa</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Rol</span>
          <select value={form.role} onChange={(event) => setField("role", event.target.value)}>
            {adminRoles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? "Creando..." : "Crear acceso admin"}
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
