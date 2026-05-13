import { downloadCurrentCatalog } from "../utils/excelTemplateGenerator";
import { useLanguage } from "../i18n/LanguageContext";

export default function CatalogExportButton({ products }) {
  const { language, t } = useLanguage();

  return (
    <button className="secondary-button full" type="button" onClick={() => downloadCurrentCatalog(products, language)}>
      {t("downloadCatalog")}
    </button>
  );
}
