export default function MetricsPanel({ tenants, metrics }) {
  const totals = tenants.reduce((sum, tenant) => {
    const item = metrics[tenant.id] || {};
    return {
      products: sum.products + Number(item.products || 0),
      clients: sum.clients + Number(item.clients || 0),
      preorders: sum.preorders + Number(item.preorders || 0),
    };
  }, { products: 0, clients: 0, preorders: 0 });

  return (
    <section className="superadmin-panel-grid">
      <div className="admin-soft-panel compact-panel">
        <span className="tool-eyebrow">Resumen SaaS</span>
        <h2>Métricas globales</h2>
        <div className="catalog-metric-row">
          <div><span>Empresas</span><strong>{tenants.length.toLocaleString()}</strong></div>
          <div><span>Productos</span><strong>{totals.products.toLocaleString()}</strong></div>
          <div><span>Clientes</span><strong>{totals.clients.toLocaleString()}</strong></div>
          <div><span>Preórdenes</span><strong>{totals.preorders.toLocaleString()}</strong></div>
        </div>
      </div>

      <div className="admin-soft-panel compact-panel">
        <span className="tool-eyebrow">Por empresa</span>
        <h2>Actividad por tenant</h2>
        <div className="responsive-table">
          <table className="simple-admin-table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Productos</th>
                <th>Clientes</th>
                <th>Preórdenes</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => {
                const item = metrics[tenant.id] || {};
                return (
                  <tr key={tenant.id}>
                    <td><strong>{tenant.name}</strong></td>
                    <td>{Number(item.products || 0).toLocaleString()}</td>
                    <td>{Number(item.clients || 0).toLocaleString()}</td>
                    <td>{Number(item.preorders || 0).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
