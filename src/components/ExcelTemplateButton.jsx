import { downloadExcelTemplate } from "../utils/excelTemplateGenerator";
import { useLanguage } from "../i18n/LanguageContext";

export default function ExcelTemplateButton() {
  const { language, t } = useLanguage();

  return (
    <button className="secondary-button full" type="button" onClick={() => downloadExcelTemplate(language)}>
      {t("downloadTemplate")}
    </button>
  );
}
