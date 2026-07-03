import { useState } from "react";
import { makeTenantSlug } from "../../services/tenantService";
import { DEFAULT_COMMERCE_SETTINGS, normalizeCommerceSettings } from "../../services/commerceSettingsService";

const PRICING_FLOW_OPTIONS = [
  { key: "both", label: "Gramo y pieza", modes: ["gram", "piece"] },
  { key: "piece", label: "Solo por pieza", modes: ["piece"] },
  { key: "gram", label: "Solo por gramo", modes: ["gram"] },
];

const CURRENCY_FLOW_OPTIONS = [
  { key: "both", label: "MXN y USD", currencies: ["MXN", "USD"] },
  { key: "mxn", label: "Solo MXN", currencies: ["MXN"] },
  { key: "usd", label: "Solo USD", currencies: ["USD"] },
];

const flowKeyFor = (values = [], options, field) => {
  const sorted = [...values].sort().join(",");
  return (
    options.find((option) => [...option[field]].sort().join(",") === sorted)?.key
    || options[0].key
  );
};

export default function TenantsTab({
  tenants,
  tenantId,
  status,
  tenantForm,
  setTenantForm,
  handleTenantSave,
  handleTenantChange,
  setTab,
  commerceByTenant = new Map(),
  onSaveCommerce,
}) {
  const [commerceStatus, setCommerceStatus] = useState("");

  const commerceFor = (id) =>
    normalizeCommerceSettings(commerceByTenant.get(id) || DEFAULT_COMMERCE_SETTINGS);

  const handleCommerceChange = async (tenant, patch) => {
    if (!onSaveCommerce) return;
    setCommerceStatus("");
    try {
      await onSaveCommerce(tenant.id, { ...commerceFor(tenant.id), ...patch });
      setCommerceStatus(`Reglas de comercio de ${tenant.name} actualizadas.`);
    } catch (error) {
      setCommerceStatus(`Error al guardar reglas de comercio: ${error.message}`);
    }
  };

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
                <th>Flujo de precios</th>
                <th>Monedas</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => {
                const commerce = commerceFor(tenant.id);
                return (
                  <tr key={tenant.id}>
                    <td><strong>{tenant.name}</strong></td>
                    <td>{tenant.slug}</td>
                    <td>{tenant.status}</td>
                    <td>
                      <select
                        aria-label={`Flujo de precios de ${tenant.name}`}
                        value={flowKeyFor(commerce.allowed_pricing_modes, PRICING_FLOW_OPTIONS, "modes")}
                        onChange={(event) => {
                          const option = PRICING_FLOW_OPTIONS.find((item) => item.key === event.target.value);
                          if (option) handleCommerceChange(tenant, { allowed_pricing_modes: option.modes });
                        }}
                      >
                        {PRICING_FLOW_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        aria-label={`Monedas de ${tenant.name}`}
                        value={flowKeyFor(commerce.allowed_currencies, CURRENCY_FLOW_OPTIONS, "currencies")}
                        onChange={(event) => {
                          const option = CURRENCY_FLOW_OPTIONS.find((item) => item.key === event.target.value);
                          if (option) handleCommerceChange(tenant, { allowed_currencies: option.currencies });
                        }}
                      >
                        {CURRENCY_FLOW_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>{option.label}</option>
                        ))}
                      </select>
                    </td>
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
                );
              })}
              {!tenants.length ? (
                <tr>
                  <td colSpan="6">Aún no hay empresas. Crea una empresa primero.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {commerceStatus ? <p className="status info">{commerceStatus}</p> : null}
        <p className="muted">
          El flujo de precios controla qué modos de cotización puede usar cada empresa en sus preórdenes
          (se valida también en el servidor). Los cambios aplican de inmediato.
        </p>
      </div>
    </section>
  );
}
