import { useEffect, useMemo, useState } from "react";
import FilterPanel from "./FilterPanel";
import LanguageToggle from "./LanguageToggle";
import ProductDetail from "./ProductDetail";
import PreorderEditor from "./PreorderEditor";
import QuickFilters from "./QuickFilters";
import AdvancedSearch from "./AdvancedSearch";
import { useLanguage } from "../i18n/LanguageContext";
import { useCompany } from "../contexts/CompanyContext";
import BrandLogo from "./BrandLogo";
import { fetchCompanySettings } from "../services/companySettings";
import { supabase } from "../lib/supabaseClient";
import { fastSignOut } from "../services/authService";
import { fetchClientData } from "../services/supabaseCatalog";
import { calculateProductQuotePrice, fetchLines, fetchMetalPrices } from "../services/pricingService";
import { applyFilters, buildFilterOptions, emptyFilters } from "../utils/filters";
import { buildPlaceholderUrl, formatCurrency, formatWeight, shortText } from "../utils/formatters";
import { normalizeText } from "../utils/textNormalizer";

const orderDefaults = {
  es: { concept: "Preorden mayorista", status: "Pendiente" },
  en: { concept: "Wholesale preorder", status: "Pending" },
};
const PRODUCT_RENDER_BATCH = 120;

const makeDefaultCustomer = (language = "es") => ({
  serie: "PRE",
  numero: "",
  name: "",
  company: "",
  currency: "MXN",
  tipoCambio: "",
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
  const [tenantCompany, setTenantCompany] = useState(null);
  const [products, setProducts] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [clientData, setClientData] = useState(null);
  const [customer, setCustomer] = useState(() => makeDefaultCustomer(language));
  const [query, setQuery] = useState("");
  const [searchChips, setSearchChips] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [quickFilters, setQuickFilters] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [addedCodes, setAddedCodes] = useState([]);
  const [visibleProductLimit, setVisibleProductLimit] = useState(PRODUCT_RENDER_BATCH);
  const [signingOut, setSigningOut] = useState(false);
  const tenantId = profile?.tenant_id || profile?.tenantId || "";
  const activeCompany = tenantId ? (tenantCompany || {}) : company;

  useEffect(() => {
    setStatus(t("loadingCatalog"));
    Promise.all([
      fetchClientData(profile),
      fetchLines(tenantId).catch(() => []),
      fetchMetalPrices(tenantId).catch(() => ({})),
    ])
      .then(([result, lines, metalPrices]) => {
        setProducts(
          result.products.map((product) => {
            const quote = calculateProductQuotePrice(product, { lines, metalPrices });
            return {
              ...product,
              precioMinimo: quote.pricePerGram,
              quotePricePerGram: quote.pricePerGram,
              quoteLaborPerGram: quote.laborPerGram,
              quotePricingStatus: quote.status,
            };
          })
        );
        if (result.client) {
          setClientData(result.client);
          setCustomer((current) => ({
            ...current,
            name: result.client.name || "",
            company: result.client.company || "",
            email: result.client.email || "",
            phone: result.client.phone || "",
            rfc: result.client.rfc || "",
            tipoCambio: metalPrices?.tipo_cambio || current.tipoCambio || "",
          }));
        }
        setStatus("");
      })
      .catch((error) => setStatus(error.message));
  }, [profile, tenantId]);

  useEffect(() => {
    if (!tenantId) {
      setTenantCompany(null);
      return;
    }
    fetchCompanySettings(tenantId).then(setTenantCompany).catch(() => setTenantCompany(null));
  }, [tenantId]);

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
  const renderedProducts = useMemo(
    () => filteredProducts.slice(0, visibleProductLimit),
    [filteredProducts, visibleProductLimit]
  );
  const selectedProduct = products.find((product) => product.codigo === selectedCode);
  const preorderPieces = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  useEffect(() => {
    setVisibleProductLimit(PRODUCT_RENDER_BATCH);
  }, [query, searchChips, filters, quickFilters]);

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
    setAddedCodes((current) => current.includes(product.codigo) ? current : [...current, product.codigo]);
    setStatus(`${product.codigo} agregado a tu preorden.`);
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fastSignOut(supabase);
    } catch (error) {
      setStatus(`No se pudo salir: ${error.message}`);
      setSigningOut(false);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setSearchChips([]);
    setFilters(emptyFilters);
    setQuickFilters([]);
    setSelectedCode("");
  };

  const cartToPreorder = () => ({
    status: "pendiente",
    tenant_id: tenantId,
    created_by: profile.id,
    client_id: profile.client_id,
    cliente_nombre: customer.name,
    cliente_empresa: customer.company,
    cliente_email: customer.email,
    cliente_telefono: customer.phone,
    cliente_rfc: customer.rfc,
    tipo_cambio: Number(customer.tipoCambio || 0),
    moneda: customer.currency || "MXN",
    notas: customer.notes,
    preorder_items: cartItems.map((item, idx) => {
      const product = item.product;
      const piezas = Number(item.quantity || 1);
      const gramos = Number(product.pesoPromedio || 0);
      const precio = Number(product.quotePricePerGram || product.precioMinimo || 0);
      return {
        producto_codigo: product.codigo,
        producto_descripcion: product.descripcion,
        producto_metal: product.metal,
        producto_kilataje: product.kilataje,
        producto_linea: product.linea,
        producto_foto_url: product.fotoUrl,
        piezas,
        gramos_por_pieza: gramos,
        gramos_total: piezas * gramos,
        labor_mxn: Number(product.quoteLaborPerGram || 0),
        precio_gramo_mxn: precio,
        subtotal_mxn: piezas * gramos * precio,
        sort_order: idx,
      };
    }),
  });

  return (
    <div className="admin-catalog-shell">
      <aside className="admin-romea-sidebar">
        <div className="brand-block">
          <BrandLogo company={activeCompany} />
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
          disabled={signingOut}
        >
          {signingOut ? "Saliendo..." : t("logout")}
        </button>
      </aside>

      <main className="admin-catalog-main">
        <header className="admin-catalog-header">
          <div>
            <p className="eyebrow">{t("b2bCatalog")}</p>
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
            <>
            <div className="admin-product-grid">
              {renderedProducts.map((product) => (
                <article className={`admin-product-card enabled ${addedCodes.includes(product.codigo) ? "in-preorder" : ""}`} key={product.id || product.codigo}>
                  {addedCodes.includes(product.codigo) ? <span className="preorder-added-badge">✓ En preorden</span> : null}
                  <button
                    className="admin-product-image"
                    type="button"
                    onClick={() => setSelectedCode(product.codigo)}
                  >
                    <img
                      src={product.fotoUrl || buildPlaceholderUrl(t("noPhoto"))}
                      alt={product.descripcion}
                      loading="lazy"
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
            {filteredProducts.length > renderedProducts.length ? (
              <div className="load-more-row">
                <button className="secondary-button compact-action" type="button" onClick={() => setVisibleProductLimit((current) => current + PRODUCT_RENDER_BATCH)}>
                  Mostrar más productos ({renderedProducts.length.toLocaleString()} de {filteredProducts.length.toLocaleString()})
                </button>
              </div>
            ) : null}
            </>
          ) : (
            <div className="empty-state">
              <h2>{t("noProducts")}</h2>
              <p>{t("noProductsHelp")}</p>
            </div>
          )}
        </section>
      </main>

      {isCartOpen ? (
        <PreorderEditor
          preorder={cartToPreorder()}
          clients={clientData ? [clientData] : []}
          tenantId={tenantId}
          profile={profile}
          pricingLocked
          onClose={(updatedDraft) => {
            if (updatedDraft?.preorder_items) {
              setCartItems(updatedDraft.preorder_items.map((item) => ({
                quantity: Number(item.piezas || 1),
                product: {
                  codigo: item.producto_codigo,
                  descripcion: item.producto_descripcion,
                  metal: item.producto_metal,
                  kilataje: item.producto_kilataje,
                  linea: item.producto_linea,
                  fotoUrl: item.producto_foto_url,
                  pesoPromedio: Number(item.gramos_por_pieza || 0),
                  precioMinimo: Number(item.precio_gramo_mxn || 0),
                  quotePricePerGram: Number(item.precio_gramo_mxn || 0),
                  quoteLaborPerGram: Number(item.labor_mxn || 0),
                },
              })));
            }
            setIsCartOpen(false);
          }}
          onSaved={() => {
            setCartItems([]);
            setAddedCodes([]);
            setIsCartOpen(false);
            setStatus("Preorden guardada. El administrador ya puede verla en el menu Preordenes.");
          }}
        />
      ) : null}
      {signingOut ? (
        <div className="signout-overlay" role="status" aria-live="assertive">
          <div className="signout-card">
            <span className="loading-spinner" aria-hidden="true" />
            <strong>Saliendo...</strong>
            <p>Cerrando la sesión de forma segura.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
