function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

export default function MetricsPanel({ tenants, metrics }) {
  const totals = tenants.reduce((sum, tenant) => {
    const item = metrics[tenant.id] || {};
    return {
      products: sum.products + Number(item.products || 0),
      clients: sum.clients + Number(item.clients || 0),
      preorders: sum.preorders + Number(item.preorders || 0),
    };
  }, { products: 0, clients: 0, preorders: 0 });

  const maxProducts = Math.max(1, ...tenants.map((tenant) => Number(metrics[tenant.id]?.products || 0)));

  return (
    <section className="studio-overview">
      <div className="studio-signals studio-signals--hero" aria-label="Resumen de la operación">
        <article><span>Empresas</span><strong>{formatNumber(tenants.length)}</strong><small>{tenants.filter((tenant) => tenant.status === "active").length} activas</small></article>
        <article><span>Productos</span><strong>{formatNumber(totals.products)}</strong><small>publicados en catálogos</small></article>
        <article><span>Clientes</span><strong>{formatNumber(totals.clients)}</strong><small>cuentas comerciales</small></article>
        <article><span>Preórdenes</span><strong>{formatNumber(totals.preorders)}</strong><small>movimientos registrados</small></article>
      </div>

      <article className="studio-sheet">
        <header className="studio-sheet__header">
          <div>
            <span className="tool-eyebrow">Actividad</span>
            <h3>Operación por empresa</h3>
            <p>Una lectura simple del volumen que vive hoy en cada cuenta.</p>
          </div>
          <span className="studio-sheet__note">Datos acumulados</span>
        </header>

        <div className="studio-activity-list">
          {tenants.map((tenant) => {
            const item = metrics[tenant.id] || {};
            const products = Number(item.products || 0);
            const progress = products ? Math.max(4, (products / maxProducts) * 100) : 0;
            return (
              <div className={`studio-activity-row${tenant.status !== "active" ? " is-paused" : ""}`} key={tenant.id}>
                <div className="studio-activity-row__heading">
                  <div>
                    <strong>{tenant.name}</strong>
                    <small>nexor.ia/{tenant.slug}</small>
                  </div>
                  <span className={`studio-state studio-state--${tenant.status === "active" ? "active" : "paused"}`}>
                    {tenant.status === "active" ? "Activa" : "Pausada"}
                  </span>
                </div>
                <div className="studio-volume-bar" aria-label={`${formatNumber(products)} productos`}>
                  <span style={{ width: `${progress}%` }} />
                </div>
                <div className="studio-activity-row__metrics">
                  <span><strong>{formatNumber(products)}</strong><small>productos</small></span>
                  <span><strong>{formatNumber(item.clients)}</strong><small>clientes</small></span>
                  <span><strong>{formatNumber(item.preorders)}</strong><small>preórdenes</small></span>
                </div>
              </div>
            );
          })}
          {!tenants.length ? <p className="studio-empty">Aún no hay actividad para mostrar.</p> : null}
        </div>
      </article>
    </section>
  );
}
