import { buildPlaceholderUrl, formatCurrency, formatWeight, imageUrlForSize, shortText } from "../utils/formatters";
import { useLanguage } from "../i18n/LanguageContext";
import { downloadCatalogSelectionExcel } from "../utils/catalogExcel";
import StorageImage from "./StorageImage";

const ProductMiniRow = ({ product, onRemove, mode }) => (
  <article className="selection-drawer-item">
    <StorageImage
      src={product.fotoUrl}
      width={120}
      fallback={imageUrlForSize(product.fotoUrl, 120) || buildPlaceholderUrl()}
      alt={product.descripcion}
      loading="lazy"
      decoding="async"
      onError={(event) => { event.currentTarget.src = buildPlaceholderUrl(); }}
    />
    <div>
      <strong>{product.codigo}</strong>
      <span>{shortText(product.descripcion, 62)}</span>
      <small>
        {mode === "preorder"
          ? `${Number(product.piezas || 1).toLocaleString()} pz / ${formatWeight(Number(product.pesoPromedio || 0) * Number(product.piezas || 1))}`
          : [product.linea, formatWeight(product.pesoPromedio), product.precioMinimo ? formatCurrency(product.precioMinimo, product.monedaPrecioMin) : ""]
              .filter(Boolean)
              .join(" / ")}
      </small>
    </div>
    <button className="table-delete" type="button" onClick={() => onRemove(product.codigo)}>x</button>
  </article>
);

export default function SelectedProductsDrawer({
  preorderProducts = [],
  catalogProducts = [],
  isOpen,
  onOpen,
  onClose,
  onOpenPreorder,
  onRemovePreorder,
  onRemoveCatalog,
  onClearCatalog,
  onCatalogPdf,
  onQuoteLink,
}) {
  const { t } = useLanguage();
  const preorderCount = preorderProducts.length;
  const catalogCount = catalogProducts.length;
  const count = preorderCount + catalogCount;
  if (!count) return null;
  const confirmCatalog = () => {
    if (!catalogCount) return;
    if (window.confirm(`Seleccionaste ${catalogCount.toLocaleString()} productos. ¿Deseas generar el catálogo con esta selección?`)) {
      onCatalogPdf();
    }
  };
  const confirmQuoteLink = () => {
    if (!catalogCount) return;
    if (window.confirm(`Seleccionaste ${catalogCount.toLocaleString()} productos. ¿Deseas generar la liga con esta selección?`)) {
      onQuoteLink();
    }
  };
  const handleDownloadExcel = () => {
    if (!catalogCount) return;
    downloadCatalogSelectionExcel(catalogProducts, `seleccion-${catalogCount}`);
  };

  return (
    <>
      {!isOpen ? (
        <button className="selection-drawer-tab split" type="button" onClick={onOpen}>
          <span>{preorderCount}</span>
          Preorden
          <span>{catalogCount}</span>
          Catálogo
        </button>
      ) : null}

      <aside className={`selection-drawer work-tray ${isOpen ? "open" : ""}`}>
        <header className="selection-drawer-header">
          <div>
            <span className="tool-eyebrow">{t("workTray")}</span>
            <h2>{t("productsInProcess")}</h2>
            <p>{t("workTrayHelp")}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>x</button>
        </header>

        <section className="work-tray-section preorder-zone">
          <div className="work-tray-section-head">
            <div>
            <span className="tool-eyebrow">{t("preorder")}</span>
              <h3>{preorderCount.toLocaleString()} productos</h3>
            </div>
            <button className="action-button preorder" type="button" onClick={onOpenPreorder} disabled={!preorderCount}>
              Abrir preorden
            </button>
          </div>
          <div className="selection-drawer-list compact">
            {preorderProducts.length ? preorderProducts.map((product) => (
              <ProductMiniRow key={product.codigo} product={product} mode="preorder" onRemove={onRemovePreorder} />
            )) : <p className="empty-tray-copy">{t("noPreorderProducts")}</p>}
          </div>
        </section>

        <section className="work-tray-section catalog-zone">
          <div className="work-tray-section-head">
            <div>
              <span className="tool-eyebrow">{t("markedProducts")}</span>
              <h3>{t("catalogSelectedCount", catalogCount.toLocaleString())}</h3>
            </div>
            <button className="tray-action catalog-pdf compact-head" type="button" onClick={confirmCatalog} disabled={!catalogCount}>
              {t("generateCatalogPdf")}
            </button>
          </div>
          <div className="selection-drawer-actions compact-row">
            <button className="tray-action quote-link" type="button" onClick={confirmQuoteLink} disabled={!catalogCount}>
              {t("generateQuoteLinkShort")}
            </button>
            <button
              className="tray-action excel"
              type="button"
              onClick={handleDownloadExcel}
              disabled={!catalogCount}
              title="Descarga la selección en Excel — compatible con carga de catálogo por cliente"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Excel
            </button>
            <button className="tray-action clear" type="button" onClick={onClearCatalog} disabled={!catalogCount}>
              {t("clearSelectionShort")}
            </button>
          </div>
          <div className="selection-drawer-list compact">
            {catalogProducts.length ? catalogProducts.map((product) => (
              <ProductMiniRow key={product.codigo} product={product} mode="catalog" onRemove={onRemoveCatalog} />
            )) : <p className="empty-tray-copy">{t("noCatalogProducts")}</p>}
          </div>
        </section>
      </aside>
    </>
  );
}
