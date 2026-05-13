import { useEffect, useMemo, useState } from "react";
import CartDrawer from "./CartDrawer";
import Header from "./Header";
import ProductDetail from "./ProductDetail";
import ProductGrid from "./ProductGrid";
import { useLanguage } from "../i18n/LanguageContext";
import { supabase } from "../lib/supabaseClient";
import { fetchClientData } from "../services/supabaseCatalog";
import { applyFilters, emptyFilters, quickFilterDefinitions } from "../utils/filters";
import { calculateClientPrice } from "../utils/pricing";
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
  const [products, setProducts] = useState([]);
  const [priceItems, setPriceItems] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [customer, setCustomer] = useState(() => makeDefaultCustomer(language));
  const [query, setQuery] = useState("");
  const [searchChips, setSearchChips] = useState([]);
  const [filters] = useState(emptyFilters);
  const [quickFilters, setQuickFilters] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setStatus(t("loadingCatalog"));
    fetchClientData(profile)
      .then((result) => {
        setPriceItems(result.priceItems);
        setProducts(
          result.products.map((product) => ({
            ...product,
            precioMinimo: calculateClientPrice(product, result.priceItems),
          }))
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

  const filteredProducts = useMemo(
    () => applyFilters(products, query, filters, quickFilters, searchChips),
    [products, query, filters, quickFilters, searchChips]
  );
  const selectedProduct = products.find((product) => product.codigo === selectedCode);

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
          item.product.codigo === product.codigo ? { ...item, quantity: Number(item.quantity || 0) + amount } : item
        );
      }
      return [...current, { product, quantity: amount }];
    });
    setIsCartOpen(true);
  };

  const labelForQuickFilter = (filter) => filter.labels?.[language] || filter.id;

  return (
    <div className="client-shell">
      <main className="main-content">
        <Header
          query={query}
          searchChips={searchChips}
          products={products}
          onQueryChange={setQuery}
          onAddChip={(chip) => {
            addSearchChip(chip);
            setQuery("");
          }}
          onRemoveChip={(chip) => setSearchChips((current) => current.filter((item) => item !== chip))}
          showing={filteredProducts.length}
          total={products.length}
          onOpenMenu={() => {}}
          onOpenCart={() => setIsCartOpen(true)}
        />
        <div className="client-bar">
          <span>{status || t("catalogAssigned")}</span>
          <div className="quick-filter-list">
            {quickFilterDefinitions.map((filter) => (
              <button
                className={`quick-filter ${quickFilters.includes(filter.id) ? "active" : ""}`}
                key={filter.id}
                type="button"
                onClick={() => setQuickFilters((current) => current.includes(filter.id) ? current.filter((item) => item !== filter.id) : [...current, filter.id])}
              >
                {labelForQuickFilter(filter)}
              </button>
            ))}
          </div>
          <button className="secondary-button" type="button" onClick={() => supabase.auth.signOut()}>{t("logout")}</button>
        </div>
        <div className="content-area">
          {selectedCode ? (
            <ProductDetail product={selectedProduct} onBack={() => setSelectedCode("")} onAdd={addToCart} />
          ) : (
            <ProductGrid products={filteredProducts} onAdd={addToCart} onOpenDetail={setSelectedCode} />
          )}
        </div>
      </main>
      <CartDrawer
        isOpen={isCartOpen}
        cartItems={cartItems}
        customer={customer}
        onCustomerChange={setCustomer}
        onQuantityChange={(code, quantity) =>
          setCartItems((items) => items.map((item) => item.product.codigo === code ? { ...item, quantity: Math.max(1, Number(quantity || 1)) } : item))
        }
        onRemove={(code) => setCartItems((items) => items.filter((item) => item.product.codigo !== code))}
        onClear={() => setCartItems([])}
        onClose={() => setIsCartOpen(false)}
        onOpen={() => setIsCartOpen(true)}
      />
    </div>
  );
}
