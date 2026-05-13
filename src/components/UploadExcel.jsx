import { useLanguage } from "../i18n/LanguageContext";

export default function UploadExcel({ onFileSelected }) {
  const { t } = useLanguage();

  return (
    <label className="primary-button full upload-button">
      {t("uploadExcel")}
      <input type="file" accept=".xlsx,.xls" onChange={onFileSelected} />
    </label>
  );
}
