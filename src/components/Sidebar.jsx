import CatalogExportButton from "./CatalogExportButton";
import ExcelTemplateButton from "./ExcelTemplateButton";
import FilterPanel from "./FilterPanel";
import QuickFilters from "./QuickFilters";
import UploadExcel from "./UploadExcel";
import BrandLogo from "./BrandLogo";
import { useLanguage } from "../i18n/LanguageContext";
import { calculateCartTotals } from "../utils/filters";
import { formatCurrency, formatWeight } from "../utils/formatters";

export default function Sidebar({
  isOpen,
  status,
  products,
  filters,
  filterOptions,
  quickFilters,
  cartItems,
  onFileSelected,
  onNewProduct,
  onClearCatalog,
  onFiltersChange,
  onQuickFilterToggle,
  onQuickFilterRemove,
  onClearAllFilters,
  onOpenCart,
  onClose,
}) {
  const { t } = useLanguage();
  const totals = calculateCartTotals(cartItems);

  return (
    <>
      {isOpen ? <button className="sidebar-backdrop" type="button" aria-label={t("closeMenu")} onClick={onClose} /> : null}
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="brand-block">
          <BrandLogo />
          <p>{t("b2bCatalog")}</p>
        </div>

        <section className="sidebar-section">
          <h3>{t("catalog")}</h3>
          <div className="sidebar-actions">
            <UploadExcel onFileSelected={onFileSelected} />
            <ExcelTemplateButton />
            <CatalogExportButton products={products} />
            <button className="primary-button full" type="button" onClick={onNewProduct}>
              {t("newProduct")}
            </button>
            <button className="secondary-button full" type="button" onClick={onClearCatalog}>
              {t("clearCatalog")}
            </button>
          </div>
          {status?.message ? <p className={`status ${status.type}`}>{status.message}</p> : null}
        </section>

        <FilterPanel filters={filters} options={filterOptions} onChange={onFiltersChange} />
        <QuickFilters activeFilters={quickFilters} onToggle={onQuickFilterToggle} onRemove={onQuickFilterRemove} />

        <button className="link-button clear-all" type="button" onClick={onClearAllFilters}>
          {t("clearFilters")}
        </button>

        <section className="sidebar-section preorder-mini">
          <h3>{t("preorder")}</h3>
          <div className="mini-summary">
            <div><span>{t("models")}</span><strong>{totals.models}</strong></div>
            <div><span>{t("pieces")}</span><strong>{totals.pieces}</strong></div>
            <div><span>{t("weight")}</span><strong>{formatWeight(totals.weight)}</strong></div>
            <div><span>{t("amount")}</span><strong>{totals.amount ? formatCurrency(totals.amount, cartItems[0]?.product.monedaPrecioMin) : "-"}</strong></div>
          </div>
          <button className="primary-button full" type="button" onClick={onOpenCart}>
            {t("openPreorder")}
          </button>
        </section>
      </aside>
    </>
  );
}
