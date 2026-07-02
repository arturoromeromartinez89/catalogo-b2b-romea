import { buildSearchSuggestions } from "../utils/filters";
import { useLanguage } from "../i18n/LanguageContext";

export default function AdvancedSearch({ value, chips, products, onChange, onAddChip, onRemoveChip, placeholder = "" }) {
  const { t } = useLanguage();
  const suggestions = buildSearchSuggestions(products, value, chips);

  const commitChip = (chipValue = value) => {
    const trimmed = chipValue.trim();
    if (!trimmed) return;
    onAddChip(trimmed);
    onChange("");
  };

  return (
    <div className="advanced-search">
      <div className="search-token-box">
        {chips.map((chip) => (
          <button className="search-chip" key={chip} type="button" onClick={() => onRemoveChip(chip)}>
            {chip} ×
          </button>
        ))}
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitChip();
            }
            if (event.key === "Backspace" && !value && chips.length) {
              onRemoveChip(chips[chips.length - 1]);
            }
          }}
          placeholder={chips.length ? t("addAnotherFilter") : placeholder || t("searchPlaceholder")}
        />
      </div>
      {suggestions.length ? (
        <div className="search-suggestions">
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => commitChip(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
