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
    reportByMissing: "Reporte por dato faltante",
    selectMissingField: "Selecciona dato faltante",
    downloadExcel: "Descargar Excel",
    showingReport: (showing, total) => `Mostrando ${showing} de ${total} productos.`,
    noReportRows: "No hay productos en este reporte.",
    allIssues: "Todos los problemas",
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
    reportByMissing: "Report by missing field",
    selectMissingField: "Select missing field",
    downloadExcel: "Download Excel",
    showingReport: (showing, total) => `Showing ${showing} of ${total} products.`,
    noReportRows: "There are no products in this report.",
    allIssues: "All issues",
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

const getIssueDefinitions = (t) => [
  { key: "all", label: t.allIssues, predicate: (product) => getProblems(product, t).length > 0 },
  { key: "missingPhoto", label: t.missingPhoto, predicate: (product) => !hasPhoto(product) },
  { key: "missingProvider", label: t.missingProvider, predicate: (product) => !hasText(getProvider(product, "")) },
  { key: "missingLine", label: t.missingLine, predicate: (product) => !hasText(product.linea) },
  { key: "missingWeight", label: t.missingWeight, predicate: (product) => !hasWeight(product) },
  { key: "missingDescription", label: t.missingDescription, predicate: (product) => !hasText(product.descripcion) },
  { key: "missingFamily", label: t.missingFamily, predicate: (product) => !hasText(product.familia) },
  { key: "missingGroup", label: t.missingGroup, predicate: (product) => !hasText(product.grupo) },
  { key: "missingStatus", label: t.missingStatus, predicate: (product) => !hasText(product.estatus) },
  {
    key: "missingVisibility",
    label: t.missingVisibility,
    predicate: (product) => product.visibleWeb === null || product.visibleWeb === undefined || product.visibleWeb === "",
  },
];

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

  const activeProducts = products.filter(isActiveProduct);
  const issueDefinitions = getIssueDefinitions(t);
  const problemCounts = issueDefinitions
    .filter((issue) => issue.key !== "all")
    .map((issue) => ({ key: issue.key, label: issue.label, count: activeProducts.filter(issue.predicate).length }));
  const problemReports = issueDefinitions.map((issue) => ({
    ...issue,
    products: activeProducts.filter((product) => issue.predicate(product)),
  }));

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
    problemCounts,
    problemReports,
    providers: Array.from(providerMap.values()).sort((a, b) => b.total - a.total),
    lastUpdate: lastUpdate ? formatDate(lastUpdate, language) : "",
    createdRecent,
    updatedRecent,
  };
};

export default function DatabaseHealthDashboard({ products = [], language = "es", loading = false }) {
  const t = missingText[language] || missingText.es;
  const [selectedReportKey, setSelectedReportKey] = useState("missingPhoto");
  const stats = useMemo(() => buildStats(products, language), [products, language]);
  const selectedReport = stats.problemReports.find((report) => report.key === selectedReportKey) || stats.problemReports[0];
  const reportRows = selectedReport?.products || [];
  const previewRows = reportRows.slice(0, 25);
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

  const exportReport = async () => {
    const XLSX = await import("xlsx");
    const rows = reportRows.map((product) => ({
      codigo: product.codigo || "",
      descripcion: product.descripcion || "",
      proveedor: getProvider(product, t.empty) || t.empty,
      linea: product.linea || "",
      familia: product.familia || "",
      grupo: product.grupo || "",
      estatus: product.estatus || "",
      visible_web: product.visibleWeb ? t.yes : t.no,
      peso_promedio: Number(product.pesoPromedio || 0),
      foto_url: product.fotoUrl || "",
      problemas_detectados: getProblems(product, t).join(", "),
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [
        "codigo",
        "descripcion",
        "proveedor",
        "linea",
        "familia",
        "grupo",
        "estatus",
        "visible_web",
        "peso_promedio",
        "foto_url",
        "problemas_detectados",
      ],
    });
    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 42 },
      { wch: 26 },
      { wch: 14 },
      { wch: 22 },
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 46 },
      { wch: 42 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, language === "en" ? "Missing_Data_Report" : "Reporte_Faltantes");
    const safeLabel = normalizeText(selectedReport?.label || "reporte").replace(/\s+/g, "_");
    XLSX.writeFile(workbook, `reporte_productos_${safeLabel}.xlsx`);
  };

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
          <div className="database-card-header">
            <h2>{t.problemProducts}</h2>
            <span className="database-badge database-badge--warn">{number(stats.incomplete)} SKUs</span>
          </div>
          {stats.problemCounts.some((item) => item.count > 0) ? (
            <div className="problem-summary-grid">
              {stats.problemCounts.map((item) => (
                <div
                  key={item.key}
                  className={`problem-summary-item${item.count === 0 ? " problem-summary-item--ok" : ""}`}
                >
                  <strong>{item.count === 0 ? "✓" : number(item.count)}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">{t.noProblems}</p>
          )}

          <div className="missing-report-panel">
            <div className="missing-report-toolbar">
              <label>
                <span>{t.reportByMissing}</span>
                <select value={selectedReportKey} onChange={(event) => setSelectedReportKey(event.target.value)}>
                  {stats.problemReports.map((report) => (
                    <option key={report.key} value={report.key}>
                      {report.label} ({number(report.products.length)})
                    </option>
                  ))}
                </select>
              </label>
              <button className="secondary-button compact-action" type="button" onClick={exportReport} disabled={!reportRows.length}>
                {t.downloadExcel}
              </button>
            </div>
            <p className="muted">{t.showingReport(number(previewRows.length), number(reportRows.length))}</p>
            <div className="database-table-wrap">
              <table className="database-health-table missing-report-table">
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
                  {previewRows.length ? previewRows.map((product) => {
                    const problems = getProblems(product, t);
                    return (
                      <tr key={product.id || product.codigo}>
                        <td><strong>{product.codigo || t.empty}</strong></td>
                        <td>{product.descripcion || t.empty}</td>
                        <td>{getProvider(product, t.noProvider) || t.noProvider}</td>
                        <td>{product.estatus || t.empty}</td>
                        <td>{product.visibleWeb ? t.yes : t.no}</td>
                        <td>
                          {problems.map((problem) => <span className="issue-tag" key={`${product.codigo}-${problem}`}>{problem}</span>)}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan="6" className="empty-row">{t.noReportRows}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </article>

        <article className="database-health-card">
          <span className="tool-eyebrow">{t.providers}</span>
          <div className="database-card-header">
            <h2>{t.providerRanking}</h2>
            <span className="database-badge">{number(stats.providers.length)} {language === "en" ? "suppliers" : "proveedores"}</span>
          </div>
          <div className="database-table-wrap">
            <table className="database-health-table provider-table">
              <thead>
                <tr>
                  <th>{t.provider}</th>
                  <th>{t.totalSkus}</th>
                  <th>{t.activeSkus}</th>
                  <th>{t.noPhotoSkus}</th>
                </tr>
              </thead>
              <tbody>
                {stats.providers.length ? stats.providers.slice(0, 15).map((provider) => (
                  <tr key={provider.provider}>
                    <td><strong>{provider.provider}</strong></td>
                    <td>{number(provider.total)}</td>
                    <td>{number(provider.active)}</td>
                    <td className={provider.withoutPhoto > 0 ? "warn-cell" : ""}>{number(provider.withoutPhoto)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="4" className="empty-row">{t.noHistory}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
