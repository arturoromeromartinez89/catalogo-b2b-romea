import { useLanguage } from "../i18n/LanguageContext";

const labelKeys = {
  metal: "metal",
  kilataje: "karat",
  linea: "line",
  familia: "family",
  grupo: "group",
};

export default function FilterPanel({ filters, options, onChange, terminology = {} }) {
  const { t } = useLanguage();
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <section className="sidebar-section">
      <h3>{t("filters")}</h3>
      <div className="side-filter-list">
        {Object.keys(labelKeys).map((key) => (
          <label key={key}>
            {terminology[key] || t(labelKeys[key])}
            <select value={filters[key]} onChange={(event) => update(key, event.target.value)}>
              <option value="">{t("all")}</option>
              {(options[key] || []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}

        <div className="range-grid">
          <label>
            {terminology.minWeight || t("minWeight")}
            <input type="number" min="0" step="0.01" value={filters.minWeight} onChange={(event) => update("minWeight", event.target.value)} />
          </label>
          <label>
            {terminology.maxWeight || t("maxWeight")}
            <input type="number" min="0" step="0.01" value={filters.maxWeight} onChange={(event) => update("maxWeight", event.target.value)} />
          </label>
          <label>
            {t("minPrice")}
            <input type="number" min="0" step="0.01" value={filters.minPrice} onChange={(event) => update("minPrice", event.target.value)} />
          </label>
          <label>
            {t("maxPrice")}
            <input type="number" min="0" step="0.01" value={filters.maxPrice} onChange={(event) => update("maxPrice", event.target.value)} />
          </label>
        </div>
      </div>
    </section>
  );
}
