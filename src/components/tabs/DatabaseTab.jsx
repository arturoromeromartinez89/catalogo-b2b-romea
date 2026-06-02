import CatalogExportButton from "../CatalogExportButton";
import DatabaseHealthDashboard from "../DatabaseHealthDashboard";
import ExcelTemplateButton from "../ExcelTemplateButton";
import ImportPanel from "../ImportPanel";
import ProductImageImportPanel from "../ProductImageImportPanel";
import UploadExcel from "../UploadExcel";

export default function DatabaseTab({
  t,
  language,
  products,
  rawProducts,
  tenantId,
  status,
  loadingProducts,
  handleExcel,
  handleDeleteCatalog,
  setProductModal,
  load,
  setStatus,
  notifyAction,
}) {
  return (
    <section className="admin-workspace database-workspace">
      <div className="database-admin-row">
        <div className="admin-soft-panel compact-panel database-admin-card">
          <span className="tool-eyebrow">{t("database")}</span>
          <h2>{language === "en" ? "Database administration" : "Administración de base de datos"}</h2>
          <p className="muted">{t("databaseOperationsHelp")}</p>
          <div className="database-action-grid">
            <UploadExcel onFileSelected={handleExcel} icon="↑" className="database-upload-action" />
            <ExcelTemplateButton />
            <CatalogExportButton products={products} />
            <button
              className="secondary-button compact-action database-new-product"
              type="button"
              onClick={() => setProductModal({ open: true, product: null, mode: "create" })}
            >
              + {t("newProduct")}
            </button>
            <button
              className="danger-button compact-action"
              type="button"
              onClick={handleDeleteCatalog}
              disabled={loadingProducts || !products.length}
            >
              {t("clearCatalog")}
            </button>
          </div>
          {status ? <p className="status info">{status}</p> : null}
        </div>

        <ProductImageImportPanel
          products={rawProducts}
          tenantId={tenantId}
          onCompleted={load}
          onStatus={setStatus}
          onNotice={notifyAction}
        />
      </div>

      <DatabaseHealthDashboard products={rawProducts} language={language} loading={loadingProducts} />

      <ImportPanel onImported={load} tenantId={tenantId} />
    </section>
  );
}
