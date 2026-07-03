import { useDeferredValue, useEffect, useMemo, useState } from "react";
import CatalogFilterBar from "./CatalogFilterBar";
import LanguageToggle from "./LanguageToggle";
import ProductDetail from "./ProductDetail";
import PreorderEditor from "./PreorderEditor";
import { useLanguage } from "../i18n/LanguageContext";
import { useCompany } from "../contexts/CompanyContext";
import BrandLogo from "./BrandLogo";
import TenantTopBanner, { SocialIcon } from "./TenantTopBanner";
import { fetchCompanySettings } from "../services/companySettings";
import {
  DEFAULT_INTERFACE_SETTINGS,
  PRODUCT_CARD_FIELDS,
  fetchInterfaceSettings,
  resolveClientPortalConfig,
} from "../services/interfaceSettingsService";
import { supabase } from "../lib/supabaseClient";
import {
  DEFAULT_COMMERCE_SETTINGS,
  fetchCommerceSettings,
} from "../services/commerceSettingsService";
import { fastSignOut } from "../services/authService";
import { fetchClientData } from "../services/supabaseCatalog";
import { fetchClientPreorders, deletePreorder } from "../services/preorderService";
import { fetchLines, fetchMetalPrices, fetchLaborListLines, fetchLaborLists } from "../services/pricingService";
import { applyFilters, buildFilterOptions, emptyFilters, DEFAULT_QUICK_FILTER_DEFINITIONS } from "../utils/filters";
import { fetchCatalogQuickFilters } from "../services/catalogQuickFiltersService";
import { buildPlaceholderUrl, formatCurrency, formatWeight, imageUrlForSize, shortText } from "../utils/formatters";
import { normalizeText } from "../utils/textNormalizer";

const orderDefaults = {
  es: { concept: "Preorden mayorista", status: "Pendiente" },
  en: { concept: "Wholesale preorder", status: "Pending" },
};
const PRODUCT_RENDER_BATCH = 60;

const formatClientLaborLabel = (product, fallbackLabel) => {
  const labor = Number(product.quoteDisplayLaborPerGram ?? product.quoteLaborPerGram ?? product.precioMinimo ?? 0);
  if (!labor) return fallbackLabel;
  const prefix = formatClientPackageLabel(product) ? "" : "MO - ";
  return `${prefix}${formatCurrency(labor, product.quotePricingCurrency || product.monedaPrecioMin || "MXN")}`;
};

const formatClientPackageLabel = (product) => {
  const raw = String(product?.unidadVenta || product?.claveVenta || "").trim();
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return `${raw} piezas`;
  if (raw.length > 34) return "";
  return raw;
};

const toWhatsAppUrl = (config, companyName = "") => {
  if (!config?.whatsapp?.enabled) return "";
  const digits = String(config.whatsapp.number || "").replace(/\D/g, "");
  if (digits.length < 8) return "";
  const normalizedNumber = digits.length === 10 ? `52${digits}` : digits;
  const message = String(config.whatsapp.message || `Hola, quiero apoyo con mi pedido en ${companyName}.`).trim();
  return `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(message)}`;
};

const getListExchangeRate = (list, metalPrices = {}) =>
  Number(list?.tipo_cambio || metalPrices?.tipo_cambio || 0) || 1;

const getClientLaborPrice = ({ product, baseLine, listLine, laborList, metalPrices }) => {
  const currency = String(laborList?.currency || product.monedaPrecioMin || "MXN").toUpperCase();
  const exchangeRate = getListExchangeRate(laborList, metalPrices);

  if (listLine) {
    const displayLabor = Number(
      listLine.final_labor ??
      (currency === "USD" ? listLine.labor_usd : listLine.labor_mxn) ??
      listLine.mo_base ??
      0
    );
    const internalLaborMxn = currency === "USD" ? displayLabor * exchangeRate : displayLabor;
    return { displayLabor, internalLaborMxn, currency };
  }

  const displayLabor = Number(baseLine?.labor_mxn ?? baseLine?.mo_base ?? product.precioMinimo ?? 0);
  return {
    displayLabor,
    internalLaborMxn: displayLabor,
    currency: product.monedaPrecioMin || "MXN",
  };
};

const clientProductFieldValue = (product, fieldKey, fallbackLabel) => {
  if (fieldKey === "codigo") return product.codigo;
  if (fieldKey === "descripcion") return shortText(product.descripcion, 72);
  if (fieldKey === "metal") return product.metal;
  if (fieldKey === "kilataje") return product.kilataje;
  if (fieldKey === "peso") return formatWeight(product.pesoPromedio);
  if (fieldKey === "precio") return formatClientLaborLabel(product, fallbackLabel);
  if (fieldKey === "mano_obra") return formatClientLaborLabel(product, fallbackLabel);
  if (fieldKey === "linea") return product.linea;
  if (fieldKey === "familia") return product.familia;
  if (fieldKey === "grupo") return product.grupo;
  return "";
};

const getClientRenderedFields = (product, fieldKeys = [], fallbackLabel = "") => {
  const safeFieldKeys = Array.isArray(fieldKeys) && fieldKeys.length
    ? fieldKeys
    : ["codigo", "descripcion", "metal", "kilataje", "peso", "precio"];
  const dedupedKeys = safeFieldKeys.filter((fieldKey) =>
    !(fieldKey === "mano_obra" && safeFieldKeys.includes("precio"))
  );
  const renderedFields = dedupedKeys
    .map((fieldKey) => ({
      key: fieldKey,
      label: PRODUCT_CARD_FIELDS.find((field) => field.key === fieldKey)?.label || fieldKey,
      value: clientProductFieldValue(product, fieldKey, fallbackLabel),
    }))
    .filter((field) => field.value);
  return renderedFields.length
    ? renderedFields
    : [{ key: "codigo", label: "Codigo", value: product.codigo }];
};

// Estatus de preorden visibles para el cliente (etiqueta + color).
const ORDER_STATUS = {
  pendiente:  { label: "Recibida",     cls: "is-amber" },
  revision:   { label: "En revisión",  cls: "is-blue" },
  confirmada: { label: "Confirmada ✓", cls: "is-green" },
  cancelada:  { label: "Cancelada",    cls: "is-red" },
};

const ClientHomeCard = ({ label, value, hint, tone = "blue", onClick }) => (
  <button type="button" className={`client-home-card client-home-card--${tone}`} onClick={onClick}>
    <span className="client-home-card__label">{label}</span>
    <strong>{value}</strong>
    <span className="client-home-card__hint">{hint}</span>
  </button>
);

const ClientPortalAnnouncement = ({ config, dismissed, onDismiss }) => {
  const text = String(config?.announcement?.text || "").trim();
  if (!config?.announcement?.enabled || !text || dismissed) return null;
  return (
    <div className="client-portal-announcement" role="status">
      <span>{text}</span>
      {config.announcement.dismissible ? (
        <button type="button" onClick={onDismiss} aria-label="Cerrar anuncio">Cerrar</button>
      ) : null}
    </div>
  );
};

const ClientPortalCarousel = ({ config }) => {
  const slides = config?.banner?.enabled ? config.banner.slides || [] : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = slides[activeIndex] || slides[0];
  const hasMultiple = slides.length > 1;

  useEffect(() => {
    if (!hasMultiple || !config.banner.autoplay) return undefined;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, config.banner.interval_ms || 5200);
    return () => window.clearInterval(interval);
  }, [config?.banner?.autoplay, config?.banner?.interval_ms, hasMultiple, slides.length]);

  useEffect(() => {
    if (activeIndex >= slides.length) setActiveIndex(0);
  }, [activeIndex, slides.length]);

  if (!activeSlide) return null;

  const go = (direction) => {
    if (!hasMultiple) return;
    setActiveIndex((current) => (current + direction + slides.length) % slides.length);
  };

  const image = (
    <img src={activeSlide.image_url} alt={activeSlide.alt || activeSlide.title || "Banner del portal cliente"} />
  );

  return (
    <section className="client-portal-carousel" aria-label="Banner de inicio">
      {activeSlide.link ? (
        <a className="client-portal-carousel__media" href={activeSlide.link} target="_blank" rel="noreferrer">
          {image}
        </a>
      ) : (
        <div className="client-portal-carousel__media">{image}</div>
      )}
      {activeSlide.title || activeSlide.subtitle ? (
        <div className="client-portal-carousel__caption">
          {activeSlide.title ? <strong>{activeSlide.title}</strong> : null}
          {activeSlide.subtitle ? <span>{activeSlide.subtitle}</span> : null}
        </div>
      ) : null}
      {hasMultiple ? (
        <>
          <button className="client-carousel-arrow client-carousel-arrow--prev" type="button" onClick={() => go(-1)} aria-label="Banner anterior">
            {"<"}
          </button>
          <button className="client-carousel-arrow client-carousel-arrow--next" type="button" onClick={() => go(1)} aria-label="Siguiente banner">
            {">"}
          </button>
          <div className="client-carousel-dots" aria-hidden="true">
            {slides.map((slide, index) => (
              <button
                key={slide.id || slide.image_url}
                type="button"
                className={index === activeIndex ? "active" : ""}
                onClick={() => setActiveIndex(index)}
                tabIndex={-1}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
};

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
  const [interfaceSettings, setInterfaceSettings] = useState(DEFAULT_INTERFACE_SETTINGS);
  const [commerceSettings, setCommerceSettings] = useState(DEFAULT_COMMERCE_SETTINGS);
  const [products, setProducts] = useState([]);
  const [clientData, setClientData] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [cartStorageReadyKey, setCartStorageReadyKey] = useState(null);
  const [customer, setCustomer] = useState(() => makeDefaultCustomer(language));
  const [query, setQuery] = useState("");
  const [searchChips, setSearchChips] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [quickFilters, setQuickFilters] = useState([]);
  const [quickFilterDefs, setQuickFilterDefs] = useState(DEFAULT_QUICK_FILTER_DEFINITIONS);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const deferredSearchChips = useDeferredValue(searchChips);
  const deferredFilters = useDeferredValue(filters);
  const deferredQuickFilters = useDeferredValue(quickFilters);
  const [selectedCode, setSelectedCode] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);   // preorden existente abierta para ver/editar
  const [status, setStatus] = useState("");
  const [addedCodes, setAddedCodes] = useState([]);
  const [visibleProductLimit, setVisibleProductLimit] = useState(PRODUCT_RENDER_BATCH);
  const [signingOut, setSigningOut] = useState(false);
  const [orders, setOrders] = useState([]);
  const [showOrders, setShowOrders] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [clientTab, setClientTab] = useState("home");
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const tenantId = profile?.tenant_id || profile?.tenantId || "";

  const loadOrders = () => {
    if (!profile?.client_id) return;
    setOrdersLoading(true);
    fetchClientPreorders(profile.client_id)
      .then((rows) => setOrders(rows || []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  };
  useEffect(() => { loadOrders(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [profile?.client_id]);
  const confirmadasCount = useMemo(() => orders.filter((o) => o.status === "confirmada").length, [orders]);
  const pendientesCount = useMemo(() => orders.filter((o) => o.status === "pendiente").length, [orders]);
  const revisionCount = useMemo(() => orders.filter((o) => o.status === "revision").length, [orders]);
  // Preórdenes a las que el cliente puede AÑADIR su selección (editables).
  const editableOrders = useMemo(
    () => orders.filter((o) => o.status === "revision" || o.status === "pendiente"),
    [orders]
  );

  const handleDeleteOrder = async (order) => {
    if (!window.confirm(t("cpConfirmDeleteOrder", order.folio || ""))) return;
    try {
      await deletePreorder(order.id);
      setStatus(t("cpPreorderDeleted"));
      loadOrders();
    } catch (e) {
      setStatus(t("cpCouldNotDelete", e.message));
    }
  };
  const activeCompany = tenantId ? (tenantCompany || {}) : company;
  const companyName = activeCompany?.brand_name || activeCompany?.legal_name || activeCompany?.name || activeCompany?.nombre || t("b2bCatalog");
  const clientPortalConfig = useMemo(
    () => resolveClientPortalConfig(interfaceSettings?.client_portal_config, {
      profile,
      companyName,
      phone: activeCompany?.phone,
      email: activeCompany?.email,
    }),
    [interfaceSettings?.client_portal_config, profile?.email, companyName, activeCompany?.phone, activeCompany?.email]
  );
  const interfaceThemeClass = `tenant-theme-${interfaceSettings?.visual_theme_key || "ejecutivo"}`;
  const whatsappUrl = useMemo(
    () => toWhatsAppUrl(clientPortalConfig, companyName),
    [clientPortalConfig, companyName]
  );
  const announcementKey = useMemo(
    () => `client-announcement:${tenantId}:${clientPortalConfig.announcement.text}`,
    [tenantId, clientPortalConfig.announcement.text]
  );

  useEffect(() => {
    if (!clientPortalConfig.announcement.text) {
      setAnnouncementDismissed(false);
      return;
    }
    try {
      setAnnouncementDismissed(sessionStorage.getItem(announcementKey) === "dismissed");
    } catch {
      setAnnouncementDismissed(false);
    }
  }, [announcementKey, clientPortalConfig.announcement.text]);

  const dismissAnnouncement = () => {
    setAnnouncementDismissed(true);
    try {
      sessionStorage.setItem(announcementKey, "dismissed");
    } catch {
      /* sessionStorage puede no estar disponible en modo privado. */
    }
  };

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus(t("loadingCatalog"));
      try {
        const [result, baseLines, metalPrices] = await Promise.all([
          fetchClientData(profile),
          fetchLines(tenantId).catch(() => []),
          fetchMetalPrices(tenantId).catch(() => ({})),
        ]);

        // Mano de obra según la lista asignada al cliente por el admin.
        // Si tiene lista, sus valores por línea sobreescriben los base.
        let selectedLaborList = null;
        let listLines = [];
        const laborListId = result.client?.labor_list_id;
        if (laborListId) {
          try {
            const [laborLists, fetchedListLines] = await Promise.all([
              fetchLaborLists(tenantId).catch(() => []),
              fetchLaborListLines(laborListId),
            ]);
            selectedLaborList = (laborLists || []).find((list) => list.id === laborListId) || null;
            listLines = fetchedListLines || [];
          } catch { /* si falla, se usan las líneas base */ }
        }
        if (cancelled) return;

        // El cliente ve SOLO la mano de obra (la plata fina la agrega el taller),
        // así que no dependemos del precio de la plata para mostrar precios.
        const baseLineByCode = new Map(
          (baseLines || []).map((line) => [normalizeText(String(line.codigo || "")), line])
        );
        const listLineByCode = new Map(
          (listLines || []).map((line) => [normalizeText(String(line.line_codigo || "")), line])
        );
        setProducts(
          result.products.map((product) => {
            const lineCode = normalizeText(String(product.linea || ""));
            const price = getClientLaborPrice({
              product,
              baseLine: baseLineByCode.get(lineCode),
              listLine: listLineByCode.get(lineCode),
              laborList: selectedLaborList,
              metalPrices,
            });
            return {
              ...product,
              monedaPrecioMin: price.currency,
              precioMinimo: price.displayLabor,
              quotePricePerGram: price.displayLabor,
              quoteLaborPerGram: price.displayLabor,
              quoteDisplayPricePerGram: price.displayLabor,
              quoteDisplayLaborPerGram: price.displayLabor,
              quotePricePerGramMxn: price.internalLaborMxn,
              quoteLaborPerGramMxn: price.internalLaborMxn,
              quotePricingCurrency: price.currency,
              quotePricingStatus: price.displayLabor > 0 ? "configured" : "missing-line",
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
            currency:   selectedLaborList?.currency || current.currency || "MXN",
            tipoCambio: selectedLaborList?.tipo_cambio || metalPrices?.tipo_cambio || current.tipoCambio || "",
          }));
        }
        setStatus("");
      } catch (error) {
        if (!cancelled) setStatus(error.message);
      }
    })();
    return () => { cancelled = true; };
  }, [profile, tenantId]);

  useEffect(() => {
    if (!tenantId) { setTenantCompany(null); return; }
    fetchCompanySettings(tenantId).then(setTenantCompany).catch(() => setTenantCompany(null));
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) { setInterfaceSettings(DEFAULT_INTERFACE_SETTINGS); return; }
    fetchInterfaceSettings(tenantId).then(setInterfaceSettings).catch(() => setInterfaceSettings(DEFAULT_INTERFACE_SETTINGS));
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) { setCommerceSettings(DEFAULT_COMMERCE_SETTINGS); return; }
    fetchCommerceSettings(tenantId).then(setCommerceSettings).catch(() => setCommerceSettings(DEFAULT_COMMERCE_SETTINGS));
  }, [tenantId]);

  // Botones rápidos configurados por el tenant (con fallback joyero)
  useEffect(() => {
    let alive = true;
    fetchCatalogQuickFilters(tenantId).then((defs) => { if (alive) setQuickFilterDefs(defs); });
    return () => { alive = false; };
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
    () => applyFilters(baseProducts, deferredQuery, deferredFilters, deferredQuickFilters, deferredSearchChips, quickFilterDefs),
    [baseProducts, deferredQuery, deferredFilters, deferredQuickFilters, deferredSearchChips, quickFilterDefs]
  );
  const renderedProducts = useMemo(
    () => filteredProducts.slice(0, visibleProductLimit),
    [filteredProducts, visibleProductLimit]
  );

  useEffect(() => { setVisibleProductLimit(PRODUCT_RENDER_BATCH); },
    [deferredQuery, deferredSearchChips, deferredFilters, deferredQuickFilters]);

  const selectedProduct  = baseProducts.find((p) => p.codigo === selectedCode);
  const preorderPieces   = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const recentOrders = useMemo(() => orders.slice(0, 4), [orders]);

  const openOrdersView = () => {
    setShowOrders(true);
    setSelectedCode("");
    setIsCartOpen(false);
    setEditingOrder(null);
    loadOrders();
  };

  const goClientHome = () => {
    setClientTab("home");
    setSelectedCode("");
    setShowOrders(false);
    setIsCartOpen(false);
    setEditingOrder(null);
  };

  const goClientCatalog = () => {
    setClientTab("catalog");
    setSelectedCode("");
    setShowOrders(false);
    setIsCartOpen(false);
    setEditingOrder(null);
  };

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
    setStatus(t("cpAdded", product.codigo));
  };

  const removeFromCart = (codigo) => {
    setCartItems((c) => c.filter((it) => it.product.codigo !== codigo));
    setAddedCodes((c) => c.filter((x) => x !== codigo));
  };
  const toggleCart = (product) => {
    if (addedCodes.includes(product.codigo)) removeFromCart(product.codigo);
    else addToCart(product);
  };
  const selectAllProducts = (list) => {
    if (!list.length) return;
    setCartItems((current) => {
      const byCode = new Map(current.map((it) => [it.product.codigo, it]));
      list.forEach((p) => { if (!byCode.has(p.codigo)) byCode.set(p.codigo, { product: p, quantity: 1 }); });
      return [...byCode.values()];
    });
    setAddedCodes((current) => {
      const s = new Set(current);
      list.forEach((p) => s.add(p.codigo));
      return [...s];
    });
    setStatus(t("cpAddedN", list.length));
  };
  const clearSelection = () => { setCartItems([]); setAddedCodes([]); setStatus(t("cpSelectionEmpty")); };

  // Manda la selección actual a una preorden existente (la abre con los nuevos
  // productos ya añadidos) o a una nueva.
  const sendSelectionToNew = () => setIsCartOpen(true);
  const sendSelectionToOrder = (order) => {
    const sel = cartToPreorder().preorder_items || [];
    const existing = order.preorder_items || [];
    const merged = [...existing, ...sel].map((it, idx) => ({ ...it, sort_order: idx }));
    setEditingOrder({ ...order, preorder_items: merged });
    clearSelection();
  };
  const origenLabel = (o) => ((o.created_by || o.createdBy) === profile.id ? t("cpOwnerYou") : t("cpOwnerAdmin"));
  const isOwnOrder = (o) => (o.created_by || o.createdBy) === profile.id;
  const orderStatusMeta = {
    pendiente:  { label: t("cpStatusReceived"),  cls: "is-amber" },
    revision:   { label: t("cpStatusReview"),     cls: "is-blue" },
    confirmada: { label: t("cpStatusConfirmed"),  cls: "is-green" },
    cancelada:  { label: t("cpStatusCancelled"),  cls: "is-red" },
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

  // Tenants solo-pieza (p. ej. Estuches Chávez): la preorden del cliente nace
  // en modo pieza con precio unitario, sin campos de gramo/labor.
  const pieceOnlyTenant =
    commerceSettings.allowed_pricing_modes.length === 1
    && commerceSettings.allowed_pricing_modes[0] === "piece";

  const cartToPreorder = () => ({
    status: "revision",   // las preórdenes del cliente entran "en revisión" para que el taller agregue plata fina
    tenant_id: tenantId,
    created_by: profile.id,
    client_id: profile.client_id,
    ...(pieceOnlyTenant ? { pricing_mode: "piece" } : {}),
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
      const labor   = Number(product.quoteLaborPerGramMxn ?? product.quoteLaborPerGram ?? 0);
      const precio  = Number(product.quotePricePerGramMxn ?? product.quotePricePerGram ?? product.precioMinimo ?? 0);
      if (pieceOnlyTenant) {
        const precioPieza = Number(product.precioMinimo || 0);
        return {
          producto_codigo:      product.codigo,
          producto_descripcion: product.descripcion,
          producto_metal:       product.metal,
          producto_kilataje:    product.kilataje,
          producto_linea:       product.linea,
          producto_foto_url:    product.fotoUrl,
          piezas,
          pricing_mode:     "piece",
          gramos_por_pieza: 0,
          gramos_total:     0,
          labor_mxn:        0,
          precio_gramo_mxn: 0,
          precio_pieza_mxn: precioPieza,
          subtotal_mxn:     piezas * precioPieza,
          sort_order:       idx,
        };
      }
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
        labor_mxn:        labor,
        precio_gramo_mxn: precio,
        subtotal_mxn:     piezas * gramos * precio,
        sort_order:       idx,
      };
    }),
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`admin-catalog-shell client-catalog-shell ${interfaceThemeClass}`}>

      {/* ── Sidebar: solo métricas + botón preorden ── */}
      <aside className="admin-romea-sidebar">
        <div className="brand-block">
          <BrandLogo size="lg" company={activeCompany} />
        </div>

        <div className="client-sidebar-scroll">
          <section className="sidebar-section">
            <h3>CLIENTE</h3>
            <nav className="client-nav">
              <button
                type="button"
                className={clientTab === "home" ? "active" : ""}
                onClick={goClientHome}
              >
                Inicio
              </button>
              <button
                type="button"
                className={clientTab === "catalog" ? "active" : ""}
                onClick={goClientCatalog}
              >
                Catalogo
              </button>
              <button type="button" onClick={openOrdersView}>
                Mis preordenes
              </button>
            </nav>
          </section>

          <section className="sidebar-section">
            <h3>{t("productBase")}</h3>
            <div className="mini-summary">
              <div><span>{t("totalLabel")}</span><strong>{baseProducts.length}</strong></div>
              <div><span>{t("cpFiltered")}</span><strong>{filteredProducts.length}</strong></div>
              <div><span>{t("preorder")}</span><strong>{preorderPieces}</strong></div>
              <div><span>{t("models")}</span><strong>{cartItems.length}</strong></div>
            </div>
            {status ? <p className="status info">{status}</p> : null}

            {/* Enviar la selección a una preorden — el usuario elige a CUÁL va */}
            {cartItems.length > 0 ? (
              <div className="client-send-block">
                <label className="client-send-label">{t("cpSendSelectionTo", cartItems.length)}</label>
                <select
                  className="client-labor-select"
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__new__") sendSelectionToNew();
                    else { const o = editableOrders.find((x) => x.id === v); if (o) sendSelectionToOrder(o); }
                  }}
                >
                  <option value="">{t("cpChooseDestination")}</option>
                  <option value="__new__">{t("cpNewPreorder")}</option>
                  {editableOrders.map((o) => (
                    <option key={o.id} value={o.id}>{o.folio || t("preorder")} · {origenLabel(o)}</option>
                  ))}
                </select>
                <button className="secondary-button full compact-action" type="button" onClick={clearSelection}>
                  {t("cpClearSelection")}
                </button>
              </div>
            ) : null}

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
            {signingOut ? t("cpSigningOut") : t("logout")}
          </button>
        </div>
      </aside>

      {/* ── Contenido principal ── */}
      <main className="admin-catalog-main">
        <TenantTopBanner config={clientPortalConfig} />
        <header className="admin-catalog-header">
          <div>
            <p className="eyebrow">Portal de cliente</p>
            <h1>{clientTab === "home" ? "Inicio" : t("wholesaleCatalog")}</h1>
            <span>{profile?.email}</span>
          </div>
          <div className="admin-header-actions">
            {whatsappUrl ? (
              <a
                className="client-whatsapp-header"
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                title="WhatsApp"
                aria-label="WhatsApp"
              >
                <SocialIcon name="whatsapp" />
              </a>
            ) : null}
            <LanguageToggle />
            <button
              className="header-logout-button"
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? t("cpSigningOut") : t("logout")}
            </button>
          </div>
        </header>

        {/* ── Barra de filtros compacta — misma que admin ── */}
        {clientTab === "catalog" ? (
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
            quickFilterDefinitions={quickFilterDefs}
            onQuickFilterToggle={(id) =>
              setQuickFilters((c) => c.includes(id) ? c.filter((item) => item !== id) : [...c, id])
            }
            onClear={clearFilters}
            collapsed={filtersCollapsed}
            onToggleCollapse={() => setFiltersCollapsed((c) => !c)}
          />
        ) : null}

        <section className="admin-workspace">
          {clientTab === "home" ? (
            <div className="client-home">
              <ClientPortalCarousel config={clientPortalConfig} />
              <section className="client-home-hero">
                <div>
                  <p className="eyebrow">{activeCompany?.name || activeCompany?.nombre || t("b2bCatalog")}</p>
                  <h2>Hola, {customer.name || customer.company || "bienvenido"}</h2>
                  <span>Bienvenido a tu sistema. Revisa tu seleccion, preordenes y catalogo desde un solo lugar.</span>
                </div>
                <div className="client-home-actions">
                  <button type="button" className="primary-button compact-action" onClick={goClientCatalog}>
                    Ver catalogo
                  </button>
                  <button type="button" className="secondary-button compact-action" onClick={openOrdersView}>
                    Mis preordenes
                  </button>
                </div>
              </section>

              <div className="client-home-grid">
                <ClientHomeCard
                  label="Catalogo disponible"
                  value={baseProducts.length.toLocaleString()}
                  hint="Modelos autorizados para tu cuenta"
                  tone="blue"
                  onClick={goClientCatalog}
                />
                <ClientHomeCard
                  label="En tu seleccion"
                  value={cartItems.length.toLocaleString()}
                  hint={`${preorderPieces.toLocaleString()} pieza${preorderPieces !== 1 ? "s" : ""} listas para enviar`}
                  tone="green"
                  onClick={goClientCatalog}
                />
                <ClientHomeCard
                  label="Preordenes en revision"
                  value={revisionCount.toLocaleString()}
                  hint="Pendientes de validacion"
                  tone="amber"
                  onClick={openOrdersView}
                />
                <ClientHomeCard
                  label="Confirmadas"
                  value={confirmadasCount.toLocaleString()}
                  hint="Listas o activas como orden"
                  tone="green"
                  onClick={openOrdersView}
                />
              </div>

              <div className="client-home-columns">
                <section className="client-home-panel">
                  <div className="client-home-panel__head">
                    <div>
                      <p className="eyebrow">Actividad</p>
                      <h3>Preordenes recientes</h3>
                    </div>
                    <button type="button" className="secondary-button compact-action" onClick={openOrdersView}>
                      Ver todas
                    </button>
                  </div>
                  {recentOrders.length ? (
                    <div className="client-home-order-list">
                      {recentOrders.map((order) => {
                        const meta = orderStatusMeta[order.status] || { label: order.status || "Pendiente", cls: "is-gray" };
                        return (
                          <button
                            type="button"
                            className="client-home-order"
                            key={order.id}
                            onClick={() => setEditingOrder(order)}
                          >
                            <span>
                              <strong>{order.folio || "Preorden"}</strong>
                              <small>{new Date(order.created_at || Date.now()).toLocaleDateString(language === "en" ? "en-US" : "es-MX")}</small>
                            </span>
                            <em className={`client-order-status ${meta.cls}`}>{meta.label}</em>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="client-home-empty">Aun no tienes preordenes registradas.</p>
                  )}
                </section>

                <section className="client-home-panel">
                  <div className="client-home-panel__head">
                    <div>
                      <p className="eyebrow">Pendientes</p>
                      <h3>Lo que requiere tu atencion</h3>
                    </div>
                  </div>
                  <div className="client-home-tasks">
                    {cartItems.length ? (
                      <button type="button" onClick={sendSelectionToNew}>
                        <strong>Enviar seleccion a preorden</strong>
                        <span>{cartItems.length} modelo{cartItems.length !== 1 ? "s" : ""} seleccionado{cartItems.length !== 1 ? "s" : ""}</span>
                      </button>
                    ) : null}
                    {pendientesCount ? (
                      <button type="button" onClick={openOrdersView}>
                        <strong>Revisar preordenes recibidas</strong>
                        <span>{pendientesCount} pendiente{pendientesCount !== 1 ? "s" : ""}</span>
                      </button>
                    ) : null}
                    {!cartItems.length && !pendientesCount ? (
                      <p className="client-home-empty">Todo al dia. No tienes pendientes por ahora.</p>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>
          ) : selectedCode ? (
            <ProductDetail
              product={selectedProduct}
              onBack={() => setSelectedCode("")}
              onAdd={addToCart}
            />
          ) : filteredProducts.length ? (
            <>
              <div className="client-bulk-bar">
                <span className="client-bulk-count">{t("cpInSelection", cartItems.length)}</span>
                <button type="button" className="secondary-button compact-action" onClick={() => selectAllProducts(renderedProducts)}>
                  {t("cpSelectScreen", renderedProducts.length)}
                </button>
                <button type="button" className="secondary-button compact-action" onClick={() => selectAllProducts(filteredProducts)}>
                  {t("cpSelectAllFiltered", filteredProducts.length)}
                </button>
                <button type="button" className="secondary-button compact-action" onClick={clearSelection} disabled={!cartItems.length}>
                  {t("cpClearSelection")}
                </button>
              </div>
              <div className="admin-product-grid">
                {renderedProducts.map((product) => {
                  const renderedFields = getClientRenderedFields(
                    product,
                    interfaceSettings?.admin_product_card_config?.fields,
                    t("priceToConfirm")
                  );
                  return (
                  <article
                    className={`admin-product-card enabled${interfaceSettings?.hasCustomSettings ? ` tenant-theme-${interfaceSettings.visual_theme_key || "ejecutivo"}` : ""}${addedCodes.includes(product.codigo) ? " in-preorder" : ""}${product.fotoUrl ? "" : " no-photo"}`}
                    key={product.id || product.codigo}
                  >
                    {addedCodes.includes(product.codigo)
                      ? <span className="preorder-added-badge">✓ En preorden</span>
                      : null}
                    {product.fotoUrl ? (
                      <button
                        className="admin-product-image"
                        type="button"
                        onClick={() => setSelectedCode(product.codigo)}
                      >
                        <img
                          src={imageUrlForSize(product.fotoUrl, 360)}
                          alt={product.descripcion}
                          loading="lazy"
                          decoding="async"
                          fetchPriority="low"
                          onError={(event) => { event.currentTarget.src = buildPlaceholderUrl(t("noPhoto")); }}
                        />
                      </button>
                    ) : null}
                    <div className="admin-product-info">
                      {renderedFields.map((field, index) => {
                        if (index === 0) return <strong key={field.key}>{field.value}</strong>;
                        if (index === 1) return <h3 key={field.key}>{field.value}</h3>;
                        return (
                          <p className="custom-product-field" key={field.key}>
                            <span>{field.label}</span>
                            <strong>{field.value}</strong>
                          </p>
                        );
                      })}
                      {formatClientPackageLabel(product) ? (
                        <small className="client-product-package">{formatClientPackageLabel(product)}</small>
                      ) : null}
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
                        className={`compact-action ${addedCodes.includes(product.codigo) ? "secondary-button" : "primary-button"}`}
                        type="button"
                        onClick={() => toggleCart(product)}
                      >
                        {addedCodes.includes(product.codigo) ? t("cpRemove") : t("addToPreorder")}
                      </button>
                    </div>
                  </article>
                  );
                })}
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
      {isCartOpen || editingOrder ? (
        <div className="client-editor-overlay">

          {/* Barra de navegación — siempre visible, siempre accesible */}
          <div className="client-editor-topbar">
            <button
              type="button"
              className="client-editor-back"
              onClick={() => { setIsCartOpen(false); setEditingOrder(null); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              {t("cpBackToCatalog")}
            </button>
            <span className="client-editor-cart-info">
              {editingOrder
                ? (editingOrder.folio || "Preorden")
                : `${cartItems.length} modelo${cartItems.length !== 1 ? "s" : ""} · ${preorderPieces} pieza${preorderPieces !== 1 ? "s" : ""}`}
            </span>
          </div>

          <PreorderEditor
            key={editingOrder?.id || "cart"}
            preorder={editingOrder || cartToPreorder()}
            clients={clientData ? [clientData] : []}
            products={baseProducts}
            tenantId={tenantId}
            profile={profile}
            allowedPricingModes={commerceSettings.allowed_pricing_modes}
            allowedCurrencies={commerceSettings.allowed_currencies}
            pricingLocked
            onClose={(updatedDraft) => {
              if (editingOrder) { setEditingOrder(null); return; }
              if (updatedDraft?.preorder_items) {
                const draftCurrency = updatedDraft.moneda || customer.currency || "MXN";
                const draftExchangeRate = Number(updatedDraft.tipo_cambio || customer.tipoCambio || 0) || 1;
                const toDisplayMoney = (value) =>
                  draftCurrency === "USD" ? Number(value || 0) / draftExchangeRate : Number(value || 0);
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
                    monedaPrecioMin:  draftCurrency,
                    precioMinimo:    toDisplayMoney(item.precio_gramo_mxn),
                    quotePricePerGram: toDisplayMoney(item.precio_gramo_mxn),
                    quoteLaborPerGram: toDisplayMoney(item.labor_mxn),
                    quoteDisplayPricePerGram: toDisplayMoney(item.precio_gramo_mxn),
                    quoteDisplayLaborPerGram: toDisplayMoney(item.labor_mxn),
                    quotePricePerGramMxn: Number(item.precio_gramo_mxn || 0),
                    quoteLaborPerGramMxn: Number(item.labor_mxn || 0),
                    quotePricingCurrency: draftCurrency,
                  },
                })));
              }
              setIsCartOpen(false);
            }}
            onSaved={() => {
              if (editingOrder) {
                setEditingOrder(null);
                setStatus(t("cpChangesSaved"));
                loadOrders();
                return;
              }
              setCartItems([]);
              setAddedCodes([]);
              setIsCartOpen(false);
              setStatus(t("cpPreorderSent"));
              loadOrders();
            }}
          />
        </div>
      ) : null}

      {/* ── Mis preórdenes — vista completa (formato admin), no flotante ── */}
      {showOrders ? (
        <div className="client-editor-overlay">
          <div className="client-editor-topbar">
            <button type="button" className="client-editor-back" onClick={() => setShowOrders(false)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              {t("cpBackToCatalog")}
            </button>
            <span className="client-editor-cart-info">{t("cpMyPreorders")}</span>
          </div>
          <div className="client-orders-view">
            {ordersLoading ? (
              <p className="status info">{t("cpLoadingMyPreorders")}</p>
            ) : orders.length === 0 ? (
              <p className="status info">{t("cpNoPreorders")}</p>
            ) : (
              <div className="rem-table-wrap">
                <table className="rem-table">
                  <thead>
                    <tr>
                      <th>{t("cpColFolio")}</th><th>{t("cpColDate")}</th><th className="right">{t("cpColPieces")}</th>
                      <th>{t("cpColStatus")}</th><th>{t("cpColOrigin")}</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => {
                      const st = orderStatusMeta[o.status] || { label: o.status || "—", cls: "is-gray" };
                      const piezas = (o.preorder_items || []).reduce((s, it) => s + Number(it.piezas || 0), 0);
                      return (
                        <tr key={o.id} className={o.status === "confirmada" ? "is-confirmed" : ""}>
                          <td><strong>{o.folio || "Preorden"}</strong></td>
                          <td>{o.created_at ? new Date(o.created_at).toLocaleDateString("es-MX") : "—"}</td>
                          <td className="right">{piezas}</td>
                          <td><span className={`client-order-status ${st.cls}`}>{st.label}</span></td>
                          <td><span className={`client-origen-tag${isOwnOrder(o) ? " is-own" : ""}`}>{origenLabel(o)}</span></td>
                          <td className="rem-row-actions">
                            <button type="button" className="link-button" onClick={() => { setEditingOrder(o); setShowOrders(false); }}>{t("cpOpen")}</button>
                            {isOwnOrder(o) ? (
                              <button type="button" className="link-button link-button--danger" onClick={() => handleDeleteOrder(o)}>{t("cpDelete")}</button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {confirmadasCount > 0 ? (
              <p className="client-orders-note">{t("cpConfirmedNote", confirmadasCount)}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Overlay de cierre de sesión */}
      {signingOut ? (
        <div className="signout-overlay" role="status" aria-live="assertive">
          <div className="signout-card">
            <span className="loading-spinner" aria-hidden="true" />
            <strong>{t("cpSigningOut")}</strong>
            <p>{t("cpSigningOutDetail")}</p>
          </div>
        </div>
      ) : null}

      {whatsappUrl ? (
        <a
          className="client-whatsapp-fab"
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          title="Enviar WhatsApp"
          aria-label="Enviar WhatsApp"
        >
          <SocialIcon name="whatsapp" size={20} />
        </a>
      ) : null}
    </div>
  );
}
