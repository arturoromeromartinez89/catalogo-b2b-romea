import { useEffect, useMemo, useState } from "react";
import CartDrawer from "./CartDrawer";
import FilterPanel from "./FilterPanel";
import LanguageToggle from "./LanguageToggle";
import ProductDetail from "./ProductDetail";
import QuickFilters from "./QuickFilters";
import AdvancedSearch from "./AdvancedSearch";
import { useLanguage } from "../i18n/LanguageContext";
import { useCompany } from "../contexts/CompanyContext";
import BrandLogo from "./BrandLogo";
import { supabase } from "../lib/supabaseClient";
import { fetchClientData } from "../services/supabaseCatalog";
import { calculateProductQuotePrice, fetchClientMargins, fetchLines, fetchMetalPrices } from "../services/pricingService";
import { applyFilters, buildFilterOptions, emptyFilters } from "../utils/filters";
import { buildPlaceholderUrl, formatCurrency, formatWeight, shortText } from "../utils/formatters";
import { normalizeText } from "../utils/textNormalizer";

const orderDefaults = {
  es: { concept: "Preorden mayorista", status: "Pendiente" },
  en: { concept: "Wholesale preorder", status: "Pending" },
};

const makeDefaultCustomer = (language = "es") => ({
  serie: "PRE",
  numero: "",
  name: "",
  company: "",
  currency: "MXN",
  seller: "",
  concept: orderDefaults[language]?.concept || orderDefaults.es.concept,
  status: orderDefaults[language]?.status || orderDefaults.es.status,
  phone: "",
  email: "",
  rfc: "",
  notes: "",
});

export default function ClientCatalogApp({ profile }) {
  const { t, language } = useLanguage();
  const company = useCompany();
  const [products, setProducts] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [customer, setCustomer] = useState(() => makeDefaultCustomer(language));
  const [query, setQuery] = useState("");
  const [searchChips, setSearchChips] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [quickFilters, setQuickFilters] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setStatus(t("loadingCatalog"));
    Promise.all([
      fetchClientData(profile),
      fetchLines().catch(() => []),
      fetchMetalPrices().catch(() => ({})),
      fetchClientMargins(profile?.client_id).catch(() => []),
    ])
      .then(([result, lines, metalPrices, margins]) => {
        setProducts(
          result.products.map((product) => {
            const quote = calculateProductQuotePrice(product, { lines, metalPrices, margins });
            return {
              ...product,
              precioMinimo: quote.pricePerGram,
              quotePricePerGram: quote.pricePerGram,
              quoteLaborPerGram: quote.laborPerGram,
              quotePricingStatus: quote.status,
            };
          })
        );
        setStatus("");
      })
      .catch((error) => setStatus(error.message));
  }, [profile, language]);

  useEffect(() => {
    setCustomer((current) => {
      const allDefaults = Object.values(orderDefaults);
      const conceptIsDefault = allDefaults.some((item) => item.concept === current.concept);
      const statusIsDefault = allDefaults.some((item) => item.status === current.status);
      const nextDefaults = orderDefaults[language] || orderDefaults.es;
      return {
        ...current,
        concept: conceptIsDefault ? nextDefaults.concept : current.concept,
        status: statusIsDefault ? nextDefaults.status : current.status,
      };
    });
  }, [language]);

  const filterOptions = useMemo(() => buildFilterOptions(products), [products]);
  const filteredProducts = useMemo(
    () => applyFilters(products, query, filters, quickFilters, searchChips),
    [products, query, filters, quickFilters, searchChips]
  );
  const selectedProduct = products.find((product) => product.codigo === selectedCode);
  const preorderPieces = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const addSearchChip = (chip) => {
    const trimmed = chip.trim();
    if (!trimmed) return;
    setSearchChips((current) =>
      current.some((item) => normalizeText(item) === normalizeText(trimmed)) ? current : [...current, trimmed]
    );
  };

  const addToCart = (product, quantity = 1) => {
    const amount = Math.max(1, Number(quantity || 1));
    setCartItems((current) => {
      const exists = current.find((item) => item.product.codigo === product.codigo);
      if (exists) {
        return current.map((item) =>
          item.product.codigo === product.codigo
            ? { ...item, quantity: Number(item.quantity || 0) + amount }
            : item
        );
      }
      return [...current, { product, quantity: amount }];
    });
    setIsCartOpen(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const clearFilters = () => {
    setQuery("");
    setSearchChips([]);
    setFilters(emptyFilters);
    setQuickFilters([]);
    setSelectedCode("");
  };

  return (
    <div className="admin-catalog-shell">
      <aside className="admin-romea-sidebar">
        <div className="brand-block">
          <BrandLogo />
          <p>{t("b2bCatalog")}</p>
        </div>

        <section className="sidebar-section">
          <h3>{t("productBase")}</h3>
          <div className="mini-summary">
            <div><span>{t("totalLabel")}</span><strong>{products.length}</strong></div>
            <div><span>Filtrados</span><strong>{filteredProducts.length}</strong></div>
            <div><span>{t("preorder")}</span><strong>{preorderPieces}</strong></div>
            <div><span>{t("models")}</span><strong>{cartItems.length}</strong></div>
          </div>
          {status ? <p className="status info">{status}</p> : null}
          <button
            className="primary-button full compact-action"
            type="button"
            onClick={() => setIsCartOpen(true)}
          >
            {t("openPreorder")}
          </button>
        </section>

        <FilterPanel filters={filters} options={filterOptions} onChange={setFilters} />

        <QuickFilters
          activeFilters={quickFilters}
          onToggle={(id) =>
            setQuickFilters((current) =>
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
            )
          }
          onRemove={(id) => setQuickFilters((current) => current.filter((item) => item !== id))}
        />

        <button className="secondary-button full compact-action" type="button" onClick={clearFilters}>
          {t("clearFilters")}
        </button>

        <button
          className="secondary-button full compact-action"
          type="button"
          onClick={handleSignOut}
        >
          {t("logout")}
        </button>
      </aside>

      <main className="admin-catalog-main">
        <header className="admin-catalog-header">
          <div>
            <p className="eyebrow">{company.brand_name || "Catálogo B2B"}</p>
            <h1>Catálogo mayorista</h1>
            <span>{profile?.email}</span>
          </div>
          <LanguageToggle />
        </header>

        <section className="admin-workspace">
          <div className="admin-toolbar one-input">
            <AdvancedSearch
              value={query}
              chips={searchChips}
              products={products}
              onChange={setQuery}
              onAddChip={(chip) => {
                addSearchChip(chip);
                setQuery("");
              }}
              onRemoveChip={(chip) =>
                setSearchChips((current) => current.filter((item) => item !== chip))
              }
            />
          </div>

          {selectedCode ? (
            <ProductDetail
              product={selectedProduct}
              onBack={() => setSelectedCode("")}
              onAdd={addToCart}
            />
          ) : filteredProducts.length ? (
            <div className="admin-product-grid">
              {filteredProducts.map((product) => (
                <article className="admin-product-card enabled" key={product.id || product.codigo}>
                  <button
                    className="admin-product-image"
                    type="button"
                    onClick={() => setSelectedCode(product.codigo)}
                  >
                    <img
                      src={product.fotoUrl || buildPlaceholderUrl(t("noPhoto"))}
                      alt={product.descripcion}
                      onError={(event) => {
                        event.currentTarget.src = buildPlaceholderUrl(t("noPhoto"));
                      }}
                    />
                  </button>
                  <div className="admin-product-info">
                    <strong>{product.codigo}</strong>
                    <h3>{shortText(product.descripcion, 72)}</h3>
                    <p>
                      {[product.metal, product.kilataje, formatWeight(product.pesoPromedio)]
                        .filter(Boolean)
                        .join(" / ")}
                    </p>
                    <span>
                      {product.precioMinimo
                        ? formatCurrency(product.precioMinimo, product.monedaPrecioMin)
                        : t("priceToConfirm")}
                    </span>
                  </div>
                  <div className="admin-product-actions">
                    <button
                      className="secondary-button compact-action"
                      type="button"
                      onClick={() => setSelectedCode(product.codigo)}
                    >
                      {t("viewDetail")}
                    </button>
                    <button
                      className="primary-button compact-action"
                      type="button"
                      onClick={() => addToCart(product)}
                    >
                      {t("addToPreorder")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>{t("noProducts")}</h2>
              <p>{t("noProductsHelp")}</p>
            </div>
          )}
        </section>
      </main>

      <CartDrawer
        isOpen={isCartOpen}
        cartItems={cartItems}
        customer={customer}
        onCustomerChange={setCustomer}
        onQuantityChange={(code, quantity) =>
          setCartItems((items) =>
            items.map((item) =>
              item.product.codigo === code
                ? { ...item, quantity: Math.max(1, Number(quantity || 1)) }
                : item
            )
          )
        }
        onRemove={(code) =>
          setCartItems((items) => items.filter((item) => item.product.codigo !== code))
        }
        onClear={() => setCartItems([])}
        onClose={() => setIsCartOpen(false)}
        onOpen={() => setIsCartOpen(true)}
      />
    </div>
  );
}
