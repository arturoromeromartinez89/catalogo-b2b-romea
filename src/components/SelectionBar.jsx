import { useLanguage } from "../i18n/LanguageContext";

export default function SelectionBar({
  count,
  onCatalogPdf,
  onQuoteLink,
  onClear,
}) {
  const { t } = useLanguage();
  if (!count) return null;

  return (
    <div className="selection-bar">
      <strong>{t("selectedProducts", count.toLocaleString())}</strong>
      <div>
        <button className="primary-button compact-action" type="button" onClick={onCatalogPdf}>
          {t("generateCatalogPdf")}
        </button>
        <button className="secondary-button compact-action" type="button" onClick={onQuoteLink}>
          {t("generateQuoteLink")}
        </button>
        <button className="secondary-button compact-action" type="button" onClick={onClear}>
          {t("clearSelection")}
        </button>
      </div>
    </div>
  );
}
