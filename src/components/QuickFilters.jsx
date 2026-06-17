import { useLanguage } from "../i18n/LanguageContext";
import { DEFAULT_QUICK_FILTER_DEFINITIONS } from "../utils/filters";

export default function QuickFilters({ activeFilters, onToggle, onRemove, definitions = DEFAULT_QUICK_FILTER_DEFINITIONS }) {
  const { t, language } = useLanguage();
  const quickFilterDefinitions = definitions;
  const activeDefinitions = quickFilterDefinitions.filter((filter) => activeFilters.includes(filter.id));
  const label = (filter) => filter.labels?.[language] || filter.label || filter.id;

  return (
    <section className="sidebar-section">
      <h3>{t("quickFilters")}</h3>
      <div className="quick-filter-list">
        {quickFilterDefinitions.map((filter) => (
          <button
            className={`quick-filter ${activeFilters.includes(filter.id) ? "active" : ""}`}
            key={filter.id}
            type="button"
            onClick={() => onToggle(filter.id)}
          >
            {label(filter)}
          </button>
        ))}
      </div>
      {activeDefinitions.length ? (
        <div className="active-chips" aria-label={t("quickFilters")}>
          {activeDefinitions.map((filter) => (
            <button className="chip" key={filter.id} type="button" onClick={() => onRemove(filter.id)}>
              {label(filter)} ×
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
