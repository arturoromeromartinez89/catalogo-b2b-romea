import { useLanguage } from "../i18n/LanguageContext";

export default function UploadExcel({ onFileSelected, label = "", className = "", icon = "" }) {
  const { t } = useLanguage();

  return (
    <label className={`primary-button full upload-button ${className}`.trim()}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {label || t("uploadExcel")}
      <input type="file" accept=".xlsx,.xls" onChange={onFileSelected} />
    </label>
  );
}
