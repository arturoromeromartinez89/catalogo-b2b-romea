import AdvancedSearch from "./AdvancedSearch";
import LanguageToggle from "./LanguageToggle";
import { useLanguage } from "../i18n/LanguageContext";

export default function Header({ query, searchChips, products, onQueryChange, onAddChip, onRemoveChip, showing, total, onOpenMenu, onOpenCart }) {
  const { t } = useLanguage();

  return (
    <header className="topbar">
      <div className="topbar-actions">
        <button className="menu-button" type="button" onClick={onOpenMenu}>
          {t("filters")}
        </button>
        <button className="menu-button" type="button" onClick={onOpenCart}>
          {t("preorder")}
        </button>
      </div>
      <div className="topbar-title">
        <p className="eyebrow">{t("brand")}</p>
        <h1>{t("wholesaleCatalog")}</h1>
      </div>
      <div className="topbar-search">
        <AdvancedSearch
          value={query}
          chips={searchChips}
          products={products}
          onChange={onQueryChange}
          onAddChip={onAddChip}
          onRemoveChip={onRemoveChip}
        />
        <span>{t("showing", showing, total)}</span>
      </div>
      <LanguageToggle />
    </header>
  );
}
