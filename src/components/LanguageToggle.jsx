import { useLanguage } from "../i18n/LanguageContext";

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="language-toggle" aria-label="Language selector">
      <button className={language === "es" ? "active" : ""} type="button" onClick={() => setLanguage("es")}>
        ES
      </button>
      <button className={language === "en" ? "active" : ""} type="button" onClick={() => setLanguage("en")}>
        EN
      </button>
    </div>
  );
}
