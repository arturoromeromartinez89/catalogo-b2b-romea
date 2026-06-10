import { useDeferredValue, useEffect, useMemo, useState } from "react";
import CatalogFilterBar from "./CatalogFilterBar";
import LanguageToggle from "./LanguageToggle";
import ProductDetail from "./ProductDetail";
import PreorderEditor from "./PreorderEditor";
import { useLanguage } from "../i18n/LanguageContext";
import { useCompany } from "../contexts/CompanyContext";
import BrandLogo from "./BrandLogo";
import { fetchCompanySettings } from "../services/companySettings";
import { supabase } from "../lib/supabaseClient";
import { fastSignOut } from "../services/authService";
import { fetchClientData } from "../services/supabaseCatalog";
import { calculateProductQuotePrice, fetchLines, fetchMetalPrices } from "../services/pricingService";
import { applyFilters, buildFilterOptions, emptyFilters } from "../utils/filters";
import { buildPlaceholderUrl, formatCurrency, formatWeight, imageUrlForSize, shortText } from "../utils/formatters";
import { normalizeText } from "../utils/textNormalizer";

const orderDefaults = {
  es: { concept: "Preorden mayorista", status: "Pendiente" },
  en: { concept: "Wholesale preorder", status: "Pending" },
};
const PRODUCT_RENDER_BATCH = 60;

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
  const [clientData, setClientData] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [cartStorageReadyKey, setCartStorageReadyKey] = useState(null);
  const [customer, setCustomer] = useState(() => makeDefaultCustomer(language));
  const [query, setQuery] = useState("");
  const [searchChips, setSearchChips] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [quickFilters, setQuickFilters] = useState([]);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const deferredSearchChips = useDeferredValue(searchChips);
  const deferredFilters = useDeferredValue(filters);
  const deferredQuickFilters = useDeferredValue(quickFilters);
  const [selectedCode, setSelectedCode] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [addedCodes, setAddedCodes] = useState([]);
  const [visibleProductLimit, setVisibleProductLimit] = useState(PRODUCT_RENDER_BATCH);
  const [signingOut, setSigningOut] = useState(false);
  const tenantId = profile?.tenant_id || profile?.tenantId || "";
  const activeCompany = tenantId ? (tenantCompany || {}) : company;

  // ── Carga inicial ──────────────────────────────────────────────────────────
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
            name:       result.client.name    || "",
            company:    result.client.company || "",
            email:      result.client.email   || "",
            phone:      result.client.phone   || "",
            rfc:        result.client.rfc     || "",
            tipoCambio: metalPrices?.tipo_cambio || current.tipoCambio || "",
          }));
        }
        setStatus("");
      })
      .catch((error) => setStatus(error.message));
  }, [profile, tenantId]);

  useEffect(() => {
    if (!tenantId) { setTenantCompany(null); return; }
    fetchCompanySettings(tenantId).then(setTenantCompany).catch(() => setTenantCompany(null));
  }, [tenantId]);

  useEffect(() => {
    setCustomer((current) => {
      const allDefaults = Object.values(orderDefaults);
      const conceptIsDefault = allDefaults.some((item) => item.concept === current.concept);
      const statusIsDefault  = allDefaults.some((item) => item.status  === current.status);
      const nextDefaults = orderDefaults[language] || orderDefaults.es;
      return {
        ...current,
        concept: conceptIsDefault ? nextDefaults.concept : current.concept,
        status:  statusIsDefault  ? nextDefaults.status  : current.status,
      };
    });
  }, [language]);

  // ── SKU restriction — si el cliente tiene allowed_skus, filtrar la base ───
  const baseProducts = useMemo(() => {
    const allowed = clientData?.allowed_skus;
    if (!allowed || allowed.length === 0) return products;
    const set = new Set(allowed);
    return products.filter((p) => set.has(p.codigo));
  }, [products, clientData]);

  // ── Filtros y búsqueda ────────────────────────────────────────────────────
  const filterOptions   = useMemo(() => buildFilterOptions(baseProducts), [baseProducts]);
  const filteredProducts = useMemo(
    () => applyFilters(baseProducts, deferredQuery, deferredFilters, deferredQuickFilters, deferredSearchChips),
    [baseProducts, deferredQuery, deferredFilters, deferredQuickFilters, deferredSearchChips]
  );
  const renderedProducts = useMemo(
    () => filteredProducts.slice(0, visibleProductLimit),
    [filteredProducts, visibleProductLimit]
  );

  useEffect(() => { setVisibleProductLimit(PRODUCT_RENDER_BATCH); },
    [deferredQuery, deferredSearchChips, deferredFilters, deferredQuickFilters]);

  const selectedProduct  = baseProducts.find((p) => p.codigo === selectedCode);
  const preorderPieces   = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  // ── Carrito — sessionStorage ───────────────────────────────────────────────
  const cartStorageKey = tenantId && profile?.id
    ? `client-cart-items:${tenantId}:${profile.id}`
    : null;

  useEffect(() => {
    if (!cartStorageKey) { setCartItems([]); setAddedCodes([]); setCartStorageReadyKey(null); return; }
    try {
      const saved  = sessionStorage.getItem(cartStorageKey);
      const parsed = saved ? JSON.parse(saved) : [];
      setCartItems(parsed);
      setAddedCodes(parsed.map((item) => item.product?.codigo).filter(Boolean));
    } catch {
      setCartItems([]); setAddedCodes([]);
    } finally {
      setCartStorageReadyKey(cartStorageKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartStorageKey]);

  useEffect(() => {
    if (!cartStorageKey || cartStorageReadyKey !== cartStorageKey) return;
    try {
      if (cartItems.length > 0) sessionStorage.setItem(cartStorageKey, JSON.stringify(cartItems));
      else sessionStorage.removeItem(cartStorageKey);
    } catch { /* sessionStorage puede fallar en modo privado */ }
  }, [cartItems, cartStorageKey, cartStorageReadyKey]);

  // ── Handlers ──────────────────────────────────────────────────────────────
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
    try { await fastSignOut(supabase); }
    catch (error) { setStatus(`No se pudo salir: ${error.message}`); setSigningOut(false); }
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
    cliente_nombre:   customer.name,
    cliente_empresa:  customer.company,
    cliente_email:    customer.email,
    cliente_telefono: customer.phone,
    cliente_rfc:      customer.rfc,
    tipo_cambio:      Number(customer.tipoCambio || 0),
    moneda:           customer.currency || "MXN",
    notas:            customer.notes,
    // Lista de labores asignada por el admin al cliente:
    // PreorderEditor la auto-aplica vía initial?.labor_list_id
    labor_list_id: clientData?.labor_list_id || "",
    preorder_items: cartItems.map((item, idx) => {
      const product = item.product;
      const piezas  = Number(item.quantity || 1);
      const gramos  = Number(product.pesoPromedio || 0);
      const precio  = Number(product.quotePricePerGram || product.precioMinimo || 0);
      return {
        producto_codigo:      product.codigo,
        producto_descripcion: product.descripcion,
        producto_metal:       product.metal,
        producto_kilataje:    product.kilataje,
        producto_linea:       product.linea,
        producto_foto_url:    product.fotoUrl,
        piezas,
        gramos_por_pieza: gramos,
        gramos_total:     piezas * gramos,
        labor_mxn:        Number(product.quoteLaborPerGram || 0),
        precio_gramo_mxn: precio,
        subtotal_mxn:     piezas * gramos * precio,
        sort_order:       idx,
      };
    }),
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="admin-catalog-shell">

      {/* ── Sidebar: solo métricas + botón preorden ── */}
      <aside className="admin-romea-sidebar">
        <div className="brand-block">
          <BrandLogo company={activeCompany} />
          <p>{t("b2bCatalog")}</p>
        </div>

        <div className="client-sidebar-scroll">
          <section className="sidebar-section">
            <h3>{t("productBase")}</h3>
            <div className="mini-summary">
              <div><span>{t("totalLabel")}</span><strong>{baseProducts.length}</strong></div>
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
          {/* Filtros y búsqueda movidos a CatalogFilterBar en el contenido principal */}
        </div>

        <div className="sidebar-bottom-actions client-sidebar-actions">
          <button
            className="sidebar-logout"
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? "Saliendo..." : t("logout")}
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <main className="admin-catalog-main">
        <header className="admin-catalog-header">
          <div>
            <p className="eyebrow">{t("b2bCatalog")}</p>
            <h1>Catálogo mayorista</h1>
            <span>{profile?.email}</span>
          </div>
          <div className="admin-header-actions">
            <LanguageToggle />
            <button
              className="header-logout-button"
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? "Saliendo..." : t("logout")}
            </button>
          </div>
        </header>

        {/* ── Barra de filtros compacta — misma que admin ── */}
        <CatalogFilterBar
          totalCount={baseProducts.length}
          filteredCount={filteredProducts.length}
          loadingProducts={baseProducts.length === 0 && !!status}
          productQuery={query}
          searchChips={searchChips}
          products={baseProducts}
          onQueryChange={setQuery}
          onAddChip={addSearchChip}
          onRemoveChip={(chip) => setSearchChips((c) => c.filter((item) => item !== chip))}
          filters={filters}
          filterOptions={filterOptions}
          onFiltersChange={setFilters}
          quickFilters={quickFilters}
          onQuickFilterToggle={(id) =>
            setQuickFilters((c) => c.includes(id) ? c.filter((item) => item !== id) : [...c, id])
          }
          onClear={clearFilters}
          collapsed={filtersCollapsed}
          onToggleCollapse={() => setFiltersCollapsed((c) => !c)}
        />

        <section className="admin-workspace">
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
                  <article
                    className={`admin-product-card enabled${addedCodes.includes(product.codigo) ? " in-preorder" : ""}`}
                    key={product.id || product.codigo}
                  >
                    {addedCodes.includes(product.codigo)
                      ? <span className="preorder-added-badge">✓ En preorden</span>
                      : null}
                    <button
                      className="admin-product-image"
                      type="button"
                      onClick={() => setSelectedCode(product.codigo)}
                    >
                      <img
                        src={imageUrlForSize(product.fotoUrl, 360) || buildPlaceholderUrl(t("noPhoto"))}
                        alt={product.descripcion}
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                        onError={(event) => { event.currentTarget.src = buildPlaceholderUrl(t("noPhoto")); }}
                      />
                    </button>
                    <div className="admin-product-info">
                      <strong>{product.codigo}</strong>
                      <h3>{shortText(product.descripcion, 72)}</h3>
                      <p>
                        {[product.metal, product.kilataje, formatWeight(product.pesoPromedio)]
                          .filter(Boolean).join(" / ")}
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
                  <button
                    className="secondary-button compact-action"
                    type="button"
                    onClick={() => setVisibleProductLimit((c) => c + PRODUCT_RENDER_BATCH)}
                  >
                    Mostrar más ({renderedProducts.length.toLocaleString()} de {filteredProducts.length.toLocaleString()})
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

      {/* ── PreorderEditor: overlay fixed que arranca en left:270px ──
          El sidebar (270px) queda siempre visible para que el usuario nunca
          pierda el contexto. La barra superior ofrece regreso explícito. */}
      {isCartOpen ? (
        <div className="client-editor-overlay">

          {/* Barra de navegación — siempre visible, siempre accesible */}
          <div className="client-editor-topbar">
            <button
              type="button"
              className="client-editor-back"
              onClick={() => setIsCartOpen(false)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Volver al catálogo
            </button>
            <span className="client-editor-cart-info">
              {cartItems.length} modelo{cartItems.length !== 1 ? "s" : ""} · {preorderPieces} pieza{preorderPieces !== 1 ? "s" : ""}
            </span>
          </div>

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
                    codigo:          item.producto_codigo,
                    descripcion:     item.producto_descripcion,
                    metal:           item.producto_metal,
                    kilataje:        item.producto_kilataje,
                    linea:           item.producto_linea,
                    fotoUrl:         item.producto_foto_url,
                    pesoPromedio:    Number(item.gramos_por_pieza || 0),
                    precioMinimo:    Number(item.precio_gramo_mxn || 0),
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
              setStatus("Preorden guardada. El administrador ya puede verla en el menú Preórdenes.");
            }}
          />
        </div>
      ) : null}

      {/* Overlay de cierre de sesión */}
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
