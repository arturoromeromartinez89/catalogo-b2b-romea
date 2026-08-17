import { useMemo, useState } from "react";
import { makeTenantSlug, saveTenant } from "../../services/tenantService";

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

export default function CompaniesPanel({ tenants, metrics, onRefresh, onManage }) {
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", status: "active" });
  const [status, setStatus] = useState("");

  const overview = useMemo(() => tenants.reduce((summary, tenant) => {
    const tenantMetrics = metrics[tenant.id] || {};
    summary.active += tenant.status === "active" ? 1 : 0;
    summary.products += Number(tenantMetrics.products || 0);
    summary.preorders += Number(tenantMetrics.preorders || 0);
    return summary;
  }, { active: 0, products: 0, preorders: 0 }), [metrics, tenants]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      setStatus("Captura el nombre de la empresa.");
      return;
    }
    try {
      await saveTenant({ ...form, slug: form.slug || makeTenantSlug(form.name) });
      setForm({ name: "", slug: "", status: "active" });
      setStatus("Empresa guardada correctamente.");
      setIsCreating(false);
      onRefresh();
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <section className="studio-overview">
      <div className="studio-signals" aria-label="Resumen de empresas">
        <article><span>Empresas</span><strong>{tenants.length}</strong><small>clientes en NEXOR</small></article>
        <article><span>Activas</span><strong>{overview.active}</strong><small>{tenants.length - overview.active} en pausa</small></article>
        <article><span>Productos</span><strong>{formatNumber(overview.products)}</strong><small>en operación</small></article>
        <article><span>Preórdenes</span><strong>{formatNumber(overview.preorders)}</strong><small>registradas</small></article>
      </div>

      <article className="studio-sheet">
        <header className="studio-sheet__header">
          <div>
            <span className="tool-eyebrow">Directorio</span>
            <h3>Empresas</h3>
            <p>Cada empresa concentra su operación, usuarios y proyectos.</p>
          </div>
          <button className="primary-button compact-action" type="button" onClick={() => setIsCreating((value) => !value)}>
            <span aria-hidden="true">{isCreating ? "×" : "+"}</span>
            {isCreating ? "Cerrar" : "Nueva empresa"}
          </button>
        </header>

        {isCreating ? (
          <div className="studio-create-panel">
            <div className="studio-create-panel__intro">
              <strong>Alta de empresa</strong>
              <span>Crea la cuenta base. Después podrás agregar proyectos y usuarios.</span>
            </div>
            <div className="studio-create-panel__fields">
              <label>
                Nombre
                <input
                  placeholder="Ej. Empresa"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    name: event.target.value,
                    slug: current.slug || makeTenantSlug(event.target.value),
                  }))}
                />
              </label>
              <label>
                Dirección del portal
                <div className="studio-slug-field">
                  <span>nexor.ia/</span>
                  <input
                    aria-label="Dirección del portal"
                    placeholder="empresa"
                    value={form.slug}
                    onChange={(event) => setForm((current) => ({ ...current, slug: makeTenantSlug(event.target.value) }))}
                  />
                </div>
              </label>
              <label>
                Estado
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                  <option value="active">Activa</option>
                  <option value="paused">Pausada</option>
                </select>
              </label>
              <button className="primary-button" type="button" onClick={handleSave}>Guardar empresa</button>
            </div>
          </div>
        ) : null}

        {status ? <p className="status info">{status}</p> : null}

        <div className="studio-entity-list">
          {tenants.map((tenant) => {
            const tenantMetrics = metrics[tenant.id] || {};
            const initials = tenant.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2);
            return (
              <div className={`studio-entity-row${tenant.status !== "active" ? " is-paused" : ""}`} key={tenant.id}>
                <div className="studio-entity-row__identity">
                  <i aria-hidden="true">{initials}</i>
                  <div><strong>{tenant.name}</strong><small>nexor.ia/{tenant.slug}</small></div>
                </div>
                <span className={`studio-state studio-state--${tenant.status === "active" ? "active" : "paused"}`}>
                  {tenant.status === "active" ? "Activa" : "Pausada"}
                </span>
                <div className="studio-entity-row__metrics" aria-label={`Actividad de ${tenant.name}`}>
                  <span><strong>{formatNumber(tenantMetrics.products)}</strong><small>productos</small></span>
                  <span><strong>{formatNumber(tenantMetrics.clients)}</strong><small>clientes</small></span>
                  <span><strong>{formatNumber(tenantMetrics.preorders)}</strong><small>preórdenes</small></span>
                </div>
                <button className="studio-row-action" type="button" onClick={() => onManage(tenant)}>
                  Administrar <span aria-hidden="true">→</span>
                </button>
              </div>
            );
          })}
          {!tenants.length ? <p className="studio-empty">No hay empresas registradas.</p> : null}
        </div>
      </article>
    </section>
  );
}
