import { makeTenantSlug } from "../../services/tenantService";

export default function TenantsTab({
  tenants,
  tenantId,
  status,
  tenantForm,
  setTenantForm,
  handleTenantSave,
  handleTenantChange,
  setTab,
}) {
  return (
    <section className="admin-workspace superadmin-workspace">
      <div className="admin-soft-panel compact-panel">
        <span className="tool-eyebrow">Control global</span>
        <h2>Empresas del sistema</h2>
        <p className="muted">
          Desde aquí creas empresas independientes. Después seleccionas una empresa activa y cargas su catálogo, clientes, precios y configuración.
        </p>

        <div className="form-grid">
          <label>
            Nombre de empresa
            <input
              placeholder="Ej. Empresa"
              value={tenantForm.name}
              onChange={(event) => setTenantForm((current) => ({
                ...current,
                name: event.target.value,
                slug: current.slug || makeTenantSlug(event.target.value),
              }))}
            />
          </label>
          <label>
            Slug interno
            <input
              placeholder="romea"
              value={tenantForm.slug}
              onChange={(event) => setTenantForm((current) => ({ ...current, slug: makeTenantSlug(event.target.value) }))}
            />
          </label>
          <label>
            Estatus
            <select value={tenantForm.status} onChange={(event) => setTenantForm((current) => ({ ...current, status: event.target.value }))}>
              <option value="active">Activa</option>
              <option value="paused">Pausada</option>
            </select>
          </label>
        </div>

        <button className="primary-button compact-action" type="button" onClick={handleTenantSave}>
          Crear / actualizar empresa
        </button>
        {status ? <p className="status info">{status}</p> : null}
      </div>

      <div className="admin-soft-panel compact-panel">
        <h2>Empresas disponibles</h2>
        <div className="responsive-table">
          <table className="simple-admin-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Slug</th>
                <th>Estatus</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td><strong>{tenant.name}</strong></td>
                  <td>{tenant.slug}</td>
                  <td>{tenant.status}</td>
                  <td>
                    <button
                      className="secondary-button compact-action"
                      type="button"
                      onClick={() => {
                        handleTenantChange(tenant.id);
                        setTab("catalog");
                      }}
                    >
                      Trabajar aquí
                    </button>
                  </td>
                </tr>
              ))}
              {!tenants.length ? (
                <tr>
                  <td colSpan="4">Aún no hay empresas. Crea una empresa primero.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
