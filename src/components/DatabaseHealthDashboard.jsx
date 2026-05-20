import { useMemo, useState } from "react";
import { normalizeText } from "../utils/textNormalizer";

const missingText = {
  es: {
    status: "Estatus general",
    productBase: "Base de productos",
    total: "Total",
    active: "Activos",
    inactive: "Inactivos / baja",
    visible: "Visibles web",
    hidden: "Ocultos",
    withPhoto: "Con foto",
    withoutPhoto: "Sin foto",
    lastUpdate: "Ultima actualizacion",
    health: "Salud del catalogo",
    readyTitle: "Productos listos para vender",
    readyDefinition: "Activo + visible + foto + descripcion + peso + linea.",
    ready: "Listos",
    incomplete: "Incompletos",
    recent: "Cambios recientes",
    activity: "Actividad",
    recentCreated: "Productos creados recientemente",
    recentUpdated: "Productos actualizados recientemente",
    noHistory: "Aun no hay historial de cambios disponible.",
    diagnostics: "Diagnostico",
    problemProducts: "Productos con problemas",
    noProblems: "No se detectaron productos incompletos con los criterios actuales.",
    showingProblems: (showing, total) => `Mostrando ${showing} de ${total} productos con problemas.`,
    viewAllProblems: "Ver todos los problemas",
    viewLessProblems: "Ver menos",
    providers: "Proveedores encontrados",
    providerRanking: "Ranking por SKUs",
    providerTotal: "Total de proveedores",
    noProvider: "Sin proveedor asignado",
    sku: "SKU",
    description: "Descripcion",
    provider: "Proveedor",
    productStatus: "Estatus",
    visibleWeb: "Visible web",
    problems: "Problemas detectados",
    totalSkus: "Total SKUs",
    activeSkus: "SKUs activos",
    inactiveSkus: "SKUs baja",
    visibleSkus: "SKUs visibles",
    photoSkus: "Con foto",
    noPhotoSkus: "Sin foto",
    yes: "Si",
    no: "No",
    empty: "-",
    missingPhoto: "Sin foto",
    missingDescription: "Sin descripcion",
    missingWeight: "Sin peso",
    missingLine: "Sin linea",
    missingProvider: "Sin proveedor",
    missingFamily: "Sin familia",
    missingGroup: "Sin grupo",
    missingStatus: "Sin estatus",
    missingVisibility: "Sin visibilidad web",
    notAvailable: "No disponible",
  },
  en: {
    status: "General status",
    productBase: "Product base",
    total: "Total",
    active: "Active",
    inactive: "Inactive / discontinued",
    visible: "Web visible",
    hidden: "Hidden",
    withPhoto: "With photo",
    withoutPhoto: "No photo",
    lastUpdate: "Last update",
    health: "Catalog health",
    readyTitle: "Products ready to sell",
    readyDefinition: "Active + visible + photo + description + weight + line.",
    ready: "Ready",
    incomplete: "Incomplete",
    recent: "Recent changes",
    activity: "Activity",
    recentCreated: "Recently created products",
    recentUpdated: "Recently updated products",
    noHistory: "No change history is available yet.",
    diagnostics: "Diagnostics",
    problemProducts: "Products with issues",
    noProblems: "No incomplete products were detected with the current criteria.",
    showingProblems: (showing, total) => `Showing ${showing} of ${total} products with issues.`,
    viewAllProblems: "View all issues",
    viewLessProblems: "View less",
    providers: "Detected suppliers",
    providerRanking: "SKU ranking",
    providerTotal: "Total suppliers",
    noProvider: "No supplier assigned",
    sku: "SKU",
    description: "Description",
    provider: "Supplier",
    productStatus: "Status",
    visibleWeb: "Web visible",
    problems: "Detected issues",
    totalSkus: "Total SKUs",
    activeSkus: "Active SKUs",
    inactiveSkus: "Discontinued SKUs",
    visibleSkus: "Visible SKUs",
    photoSkus: "With photo",
    noPhotoSkus: "No photo",
    yes: "Yes",
    no: "No",
    empty: "-",
    missingPhoto: "No photo",
    missingDescription: "No description",
    missingWeight: "No weight",
    missingLine: "No line",
    missingProvider: "No supplier",
    missingFamily: "No family",
    missingGroup: "No group",
    missingStatus: "No status",
    missingVisibility: "No web visibility",
    notAvailable: "Not available",
  },
};

const number = (value) => Number(value || 0).toLocaleString();

const isActiveProduct = (product) => {
  const status = normalizeText(product.estatus);
  return !["baja", "inactivo", "inactive", "discontinued"].includes(status);
};

const hasText = (value) => Boolean(String(value || "").trim());
const hasPhoto = (product) => hasText(product.fotoUrl);
const hasWeight = (product) => Number(product.pesoPromedio || 0) > 0;
const getProvider = (product, fallback) =>
  product.proveedor || product.provider || product.supplier || product.nombreProveedor || product.proveedorNombre || fallback;

const formatDate = (value, language) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(language === "en" ? "en-US" : "es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const getProblems = (product, t) => {
  const problems = [];
  if (!hasPhoto(product)) problems.push(t.missingPhoto);
  if (!hasText(product.descripcion)) problems.push(t.missingDescription);
  if (!hasWeight(product)) problems.push(t.missingWeight);
  if (!hasText(product.linea)) problems.push(t.missingLine);
  if (!hasText(getProvider(product, ""))) problems.push(t.missingProvider);
  if (!hasText(product.familia)) problems.push(t.missingFamily);
  if (!hasText(product.grupo)) problems.push(t.missingGroup);
  if (!hasText(product.estatus)) problems.push(t.missingStatus);
  if (product.visibleWeb === null || product.visibleWeb === undefined || product.visibleWeb === "") problems.push(t.missingVisibility);
  return problems;
};

const buildStats = (products, language) => {
  const t = missingText[language] || missingText.es;
  const total = products.length;
  const active = products.filter(isActiveProduct).length;
  const visible = products.filter((product) => product.visibleWeb).length;
  const withPhoto = products.filter(hasPhoto).length;
  const readyProducts = products.filter(
    (product) =>
      isActiveProduct(product) &&
      product.visibleWeb &&
      hasPhoto(product) &&
      hasText(product.descripcion) &&
      hasWeight(product) &&
      hasText(product.linea)
  );
  const problemProducts = products
    .map((product) => ({ product, problems: getProblems(product, t) }))
    .filter(({ product, problems }) => (isActiveProduct(product) || product.visibleWeb) && problems.length);

  const lastUpdate = products
    .map((product) => product.updatedAt || product.createdAt)
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const providerMap = new Map();
  products.forEach((product) => {
    const provider = getProvider(product, t.noProvider) || t.noProvider;
    const current = providerMap.get(provider) || {
      provider,
      total: 0,
      active: 0,
      inactive: 0,
      visible: 0,
      withPhoto: 0,
      withoutPhoto: 0,
    };
    current.total += 1;
    if (isActiveProduct(product)) current.active += 1;
    else current.inactive += 1;
    if (product.visibleWeb) current.visible += 1;
    if (hasPhoto(product)) current.withPhoto += 1;
    else current.withoutPhoto += 1;
    providerMap.set(provider, current);
  });

  const createdRecent = products
    .filter((product) => product.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);
  const updatedRecent = products
    .filter((product) => product.updatedAt)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 3);

  return {
    total,
    active,
    inactive: total - active,
    visible,
    hidden: total - visible,
    withPhoto,
    withoutPhoto: total - withPhoto,
    ready: readyProducts.length,
    incomplete: problemProducts.length,
    health: total ? Math.round((readyProducts.length / total) * 100) : 0,
    problemProducts,
    providers: Array.from(providerMap.values()).sort((a, b) => b.total - a.total),
    lastUpdate: lastUpdate ? formatDate(lastUpdate, language) : "",
    createdRecent,
    updatedRecent,
  };
};

export default function DatabaseHealthDashboard({ products = [], language = "es", loading = false }) {
  const t = missingText[language] || missingText.es;
  const [showAllProblems, setShowAllProblems] = useState(false);
  const stats = useMemo(() => buildStats(products, language), [products, language]);
  const visibleProblems = showAllProblems ? stats.problemProducts : stats.problemProducts.slice(0, 12);
  const ringStyle = { background: `conic-gradient(var(--color-success) 0 ${stats.health}%, #e8edf5 ${stats.health}% 100%)` };
  const readyWidth = { width: `${Math.min(stats.health, 100)}%` };
  const incompleteWidth = { width: `${stats.total ? Math.min(Math.round((stats.incomplete / stats.total) * 100), 100) : 0}%` };
  const hasHistory = stats.createdRecent.length || stats.updatedRecent.length || stats.lastUpdate;

  if (loading) {
    return (
      <section className="database-health-dashboard">
        <div className="database-health-card">
          <span className="tool-eyebrow">{t.status}</span>
          <h2>{t.productBase}</h2>
          <p className="muted">Cargando indicadores del catalogo...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="database-health-dashboard" aria-label={t.status}>
      <div className="database-executive-row">
        <article className="database-health-card">
          <span className="tool-eyebrow">{t.status}</span>
          <h2>{t.productBase}</h2>
          <div className="database-metric-grid">
            <div><span>{t.total}</span><strong>{number(stats.total)}</strong></div>
            <div><span>{t.active}</span><strong>{number(stats.active)}</strong></div>
            <div><span>{t.inactive}</span><strong>{number(stats.inactive)}</strong></div>
            <div><span>{t.visible}</span><strong>{number(stats.visible)}</strong></div>
            <div><span>{t.hidden}</span><strong>{number(stats.hidden)}</strong></div>
            <div><span>{t.withPhoto}</span><strong>{number(stats.withPhoto)}</strong></div>
            <div><span>{t.withoutPhoto}</span><strong className="warning-number">{number(stats.withoutPhoto)}</strong></div>
            <div><span>{t.lastUpdate}</span><strong className="date-number">{stats.lastUpdate || t.notAvailable}</strong></div>
          </div>
        </article>

        <article className="database-health-card database-health-summary">
          <div className="health-ring" style={ringStyle}>
            <div>
              <strong>{stats.health}%</strong>
              <span>{t.health}</span>
            </div>
          </div>
          <div>
            <span className="tool-eyebrow">{t.health}</span>
            <h2>{t.readyTitle}</h2>
            <p className="muted">{t.readyDefinition}</p>
            <div className="database-bar-list">
              <div className="database-bar-row">
                <span>{t.ready}</span>
                <div><i style={readyWidth} /></div>
                <strong>{number(stats.ready)}</strong>
              </div>
              <div className="database-bar-row">
                <span>{t.incomplete}</span>
                <div><i className="warn" style={incompleteWidth} /></div>
                <strong>{number(stats.incomplete)}</strong>
              </div>
            </div>
          </div>
        </article>

        <article className="database-health-card">
          <span className="tool-eyebrow">{t.recent}</span>
          <h2>{t.activity}</h2>
          {hasHistory ? (
            <div className="database-timeline">
              {stats.lastUpdate ? (
                <div><strong>{t.lastUpdate}</strong><span>{stats.lastUpdate}</span></div>
              ) : null}
              {stats.createdRecent.length ? (
                <div><strong>{t.recentCreated}</strong><span>{stats.createdRecent.slice(0, 2).map((item) => item.codigo).join(", ")}</span></div>
              ) : null}
              {stats.updatedRecent.length ? (
                <div><strong>{t.recentUpdated}</strong><span>{stats.updatedRecent.slice(0, 2).map((item) => item.codigo).join(", ")}</span></div>
              ) : null}
            </div>
          ) : (
            <p className="muted">{t.noHistory}</p>
          )}
        </article>
      </div>

      <div className="database-table-row">
        <article className="database-health-card">
          <span className="tool-eyebrow">{t.diagnostics}</span>
          <h2>{t.problemProducts}</h2>
          <div className="table-card-heading">
            <p className="muted">{t.showingProblems(visibleProblems.length, stats.problemProducts.length)}</p>
            {stats.problemProducts.length > 12 ? (
              <button className="secondary-button compact-action" type="button" onClick={() => setShowAllProblems((current) => !current)}>
                {showAllProblems ? t.viewLessProblems : t.viewAllProblems}
              </button>
            ) : null}
          </div>
          <div className="database-table-wrap">
            <table className="database-health-table">
              <thead>
                <tr>
                  <th>{t.sku}</th>
                  <th>{t.description}</th>
                  <th>{t.provider}</th>
                  <th>{t.productStatus}</th>
                  <th>{t.visibleWeb}</th>
                  <th>{t.problems}</th>
                </tr>
              </thead>
              <tbody>
                {visibleProblems.length ? visibleProblems.map(({ product, problems }) => (
                  <tr key={product.id || product.codigo}>
                    <td><strong>{product.codigo || t.empty}</strong></td>
                    <td>{product.descripcion || t.empty}</td>
                    <td>{getProvider(product, t.noProvider)}</td>
                    <td>{product.estatus || t.empty}</td>
                    <td>{product.visibleWeb ? t.yes : t.no}</td>
                    <td>
                      {problems.map((problem) => <span className="issue-tag" key={`${product.codigo}-${problem}`}>{problem}</span>)}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" className="empty-row">{t.noProblems}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="database-health-card">
          <span className="tool-eyebrow">{t.providers}</span>
          <h2>{t.providerRanking}</h2>
          <p className="muted">{t.providerTotal}: {number(stats.providers.length)}</p>
          <div className="database-table-wrap">
            <table className="database-health-table provider-table">
              <thead>
                <tr>
                  <th>{t.provider}</th>
                  <th>{t.totalSkus}</th>
                  <th>{t.activeSkus}</th>
                  <th>{t.inactiveSkus}</th>
                  <th>{t.visibleSkus}</th>
                  <th>{t.photoSkus}</th>
                  <th>{t.noPhotoSkus}</th>
                </tr>
              </thead>
              <tbody>
                {stats.providers.length ? stats.providers.slice(0, 10).map((provider) => (
                  <tr key={provider.provider}>
                    <td><strong>{provider.provider}</strong></td>
                    <td>{number(provider.total)}</td>
                    <td>{number(provider.active)}</td>
                    <td>{number(provider.inactive)}</td>
                    <td>{number(provider.visible)}</td>
                    <td>{number(provider.withPhoto)}</td>
                    <td>{number(provider.withoutPhoto)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" className="empty-row">{t.noHistory}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
