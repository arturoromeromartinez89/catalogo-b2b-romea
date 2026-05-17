import { useState } from "react";
import { makeTenantSlug, saveTenant } from "../../services/tenantService";

export default function CompaniesPanel({ tenants, metrics, onRefresh, onManage }) {
  const [form, setForm] = useState({ name: "", slug: "", status: "active" });
  const [status, setStatus] = useState("");

  const handleSave = async () => {
    if (!form.name.trim()) {
      setStatus("Captura el nombre de la empresa.");
      return;
    }
    try {
      await saveTenant({ ...form, slug: form.slug || makeTenantSlug(form.name) });
      setForm({ name: "", slug: "", status: "active" });
      setStatus("Empresa guardada correctamente.");
      onRefresh();
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <section className="superadmin-panel-grid">
      <div className="admin-soft-panel compact-panel">
        <span className="tool-eyebrow">Alta de empresa</span>
        <h2>Crear empresa SaaS</h2>
        <p className="muted">Crea ROMEA, Vanguardia u otra empresa. Cada una tendra su propia base operativa.</p>
        <div className="form-grid">
          <label>
            Nombre
            <input
              placeholder="Ej. ROMEA"
              value={form.name}
              onChange={(event) => setForm((current) => ({
                ...current,
                name: event.target.value,
                slug: current.slug || makeTenantSlug(event.target.value),
              }))}
            />
          </label>
          <label>
            Slug
            <input
              placeholder="romea"
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: makeTenantSlug(event.target.value) }))}
            />
          </label>
          <label>
            Estado
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
              <option value="active">Activa</option>
              <option value="paused">Pausada</option>
            </select>
          </label>
        </div>
        <button className="primary-button compact-action" type="button" onClick={handleSave}>
          Crear / actualizar empresa
        </button>
        {status ? <p className="status info">{status}</p> : null}
      </div>

      <div className="admin-soft-panel compact-panel">
        <span className="tool-eyebrow">Empresas</span>
        <h2>Clientes SaaS</h2>
        <div className="responsive-table">
          <table className="simple-admin-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Slug</th>
                <th>Estado</th>
                <th>Productos</th>
                <th>Clientes</th>
                <th>Preordenes</th>
                <th>Accion</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => {
                const tenantMetrics = metrics[tenant.id] || {};
                return (
                  <tr key={tenant.id}>
                    <td><strong>{tenant.name}</strong></td>
                    <td>{tenant.slug}</td>
                    <td>{tenant.status}</td>
                    <td>{Number(tenantMetrics.products || 0).toLocaleString()}</td>
                    <td>{Number(tenantMetrics.clients || 0).toLocaleString()}</td>
                    <td>{Number(tenantMetrics.preorders || 0).toLocaleString()}</td>
                    <td>
                      <button className="secondary-button compact-action" type="button" onClick={() => onManage(tenant)}>
                        Administrar empresa
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!tenants.length ? (
                <tr><td colSpan="7">No hay empresas registradas.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
