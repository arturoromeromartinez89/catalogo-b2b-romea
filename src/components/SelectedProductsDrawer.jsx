import { buildPlaceholderUrl, formatCurrency, formatWeight, shortText } from "../utils/formatters";
import { useLanguage } from "../i18n/LanguageContext";

export default function SelectedProductsDrawer({
  products,
  isOpen,
  onOpen,
  onClose,
  onRemove,
  onClear,
  onCatalogPdf,
  onQuoteLink,
}) {
  const { t } = useLanguage();
  const count = products.length;
  if (!count) return null;

  return (
    <>
      {!isOpen ? (
        <button className="selection-drawer-tab" type="button" onClick={onOpen}>
          <span>{count}</span>
          {t("selection")}
        </button>
      ) : null}

      <aside className={`selection-drawer ${isOpen ? "open" : ""}`}>
        <header className="selection-drawer-header">
          <div>
            <span className="tool-eyebrow">{t("markedProducts")}</span>
            <h2>{t("currentSelection")}</h2>
            <p>{t("readyForCatalogOrLink", count.toLocaleString())}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>x</button>
        </header>

        <div className="selection-drawer-actions">
          <button className="primary-button compact-action" type="button" onClick={onCatalogPdf}>
            {t("generateCatalogPdf")}
          </button>
          <button className="secondary-button compact-action" type="button" onClick={onQuoteLink}>
            {t("generateQuoteLinkShort")}
          </button>
          <button className="secondary-button compact-action" type="button" onClick={onClear}>
            {t("clearSelectionShort")}
          </button>
        </div>

        <div className="selection-drawer-list">
          {products.map((product) => (
            <article className="selection-drawer-item" key={product.codigo}>
              <img
                src={product.fotoUrl || buildPlaceholderUrl()}
                alt={product.descripcion}
                onError={(event) => { event.currentTarget.src = buildPlaceholderUrl(); }}
              />
              <div>
                <strong>{product.codigo}</strong>
                <span>{shortText(product.descripcion, 62)}</span>
                <small>
                  {[product.linea, formatWeight(product.pesoPromedio), product.precioMinimo ? formatCurrency(product.precioMinimo, product.monedaPrecioMin) : ""]
                    .filter(Boolean)
                    .join(" / ")}
                </small>
              </div>
              <button className="table-delete" type="button" onClick={() => onRemove(product.codigo)}>x</button>
            </article>
          ))}
        </div>
      </aside>
    </>
  );
}
