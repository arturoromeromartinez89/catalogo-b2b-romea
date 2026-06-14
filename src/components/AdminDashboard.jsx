import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import ActionNotice from "./ActionNotice";
import BrandLogo from "./BrandLogo";
import CompanySettingsPanel from "./CompanySettingsPanel";
import CatalogPdfPanel from "./CatalogPdfPanel";
import CatalogFilterBar from "./CatalogFilterBar";
import PricingPanel from "./PricingPanel";
import PreorderWorkspace from "./PreorderWorkspace";
import QuoteLinkPanel from "./QuoteLinkPanel";
import SelectedProductsDrawer from "./SelectedProductsDrawer";
import ProductFormModal from "./ProductFormModal";
import LanguageToggle from "./LanguageToggle";
import { useCompany } from "../contexts/CompanyContext";
import { fetchCompanySettings } from "../services/companySettings";
import { fetchTenantFeatures } from "../services/adminModuleService";
// Tabs extraídos — step 1 del refactor progresivo
import TenantsTab from "./tabs/TenantsTab";
import CatalogTab from "./tabs/CatalogTab";
import ClientsTab from "./tabs/ClientsTab";
import ProspectsTab from "./tabs/ProspectsTab";
import DatabaseTab from "./tabs/DatabaseTab";
import ComponentsTab from "./tabs/ComponentsTab";
import RemisionWorkspace from "./RemisionWorkspace";
import GastosTab from "./tabs/GastosTab";
import BalanceTab from "./tabs/BalanceTab";
import InicioFinancieroTab from "./tabs/InicioFinancieroTab";
import CobrosTab from "./tabs/CobrosTab";
import CapitalTab from "./tabs/CapitalTab";
import CentrosCostosTab from "./tabs/CentrosCostosTab";
import CuentasAdminTab from "./tabs/CuentasAdminTab";
import CategoriasGastoTab from "./tabs/CategoriasGastoTab";
import { sampleProducts } from "../data/sampleProducts";
import { useLanguage } from "../i18n/LanguageContext";
import { supabase } from "../lib/supabaseClient";
import { fastSignOut } from "../services/authService";
import {
  deleteProduct,
  deleteTenantProducts,
  fetchAdminData,
  saveClient,
  savePriceItem,
  savePriceList,
  setClientPriceList,
  updateClientAllowedSkus,
  updateClientLaborList,
  upsertProducts,
} from "../services/supabaseCatalog";
import { fetchTenants, makeTenantSlug, saveTenant } from "../services/tenantService";
import { isSuperAdmin } from "../services/tenantUtils";
import { normalizeProduct, parseExcelFile } from "../utils/excelParser";
import { buildConfigurableCatalogProducts, isConfigurableProductGroup } from "../utils/configurableCatalog";
import { applyFilters, buildFilterOptions, emptyFilters } from "../utils/filters";
import { buildPlaceholderUrl, formatCurrency, formatWeight, imageUrlForSize, shortText } from "../utils/formatters";
import { normalizeText } from "../utils/textNormalizer";

const blankClient = { name: "", company: "", email: "", phone: "", rfc: "", ciudad: "", domicilio: "", comentarios: "", type: "cliente", active: true, labor_list_id: null };
const blankProspect = { name: "", company: "", email: "", phone: "", rfc: "", ciudad: "", domicilio: "", comentarios: "", badge_raw: "", obtenido_en: "JCK", type: "prospecto", active: true };
const blankPriceList = { name: "", currency: "MXN", active: true };
const blankPriceItem = { metal: "", kilataje: "", price_per_gram: 0, labor_markup: 0 };
const PRODUCT_RENDER_BATCH = 60;
const baseTabs = ["catalog", "preorders", "clients", "prospects", "prices", "company", "database"];
const configurableOnlyTabs = ["components"];
const adminModuleTabs = ["administracion"];
// Navegación organizada por las preguntas del negocio, no por tablas.
// "Configuración" agrupa los catálogos internos con jerarquía visual menor.
const ADMIN_SUB_TABS = [
  { id: "inicio",     label: "Inicio",               group: "operaciones" },
  { id: "cobros",     label: "Cobros",               group: "operaciones" },
  { id: "remisiones", label: "Ventas / remisiones",  group: "operaciones" },
  { id: "gastos",     label: "Gastos y compras",     group: "operaciones" },
  { id: "capital",    label: "Mi inversión",         group: "operaciones" },
  { id: "cuentas",    label: "Dinero y cuentas",     group: "operaciones" },
  { id: "balance",    label: "Resultados",           group: "operaciones" },
  { id: "estados",    label: "Estados financieros",  group: "operaciones" },
  { id: "categorias", label: "Categorías de gasto",  group: "configuracion" },
  { id: "centros",    label: "Centros de costos",    group: "configuracion" },
];
const tabKeys = {
  tenants:       "tenants",
  catalog:       "catalog",
  preorders:     "preorders",
  clients:       "clients",
  prospects:     "prospects",
  prices:        "priceMenu",
  company:       "company",
  database:      "database",
  components:    "components",
  administracion: "administracion",
};
const titleKeys = {
  tenants:       "tenants",
  catalog:       "adminCatalog",
  preorders:     "preorders",
  clients:       "clients",
  prospects:     "prospects",
  prices:        "priceMenu",
  company:       "company",
  database:      "database",
  components:    "components",
  administracion: "administracion",
};

const formProductToRow = (product) => ({
  codigo: product.codigo,
  modelo: product.modelo,
  descripcion: product.descripcion,
  metal: product.metal,
  kilataje: product.kilataje,
  linea: product.linea,
  familia: product.familia,
  grupo: product.grupo,
  genero: product.genero,
  acabado: product.acabado,
  piedra: product.piedra,
  medida: product.medida,
  estatus: product.estatus,
  peso_promedio: product.pesoPromedio,
  unidad_venta: product.unidadVenta,
  clave_venta: product.claveVenta,
  precio_minimo: product.precioMinimo,
  mano_obra: product.manoObra,
  moneda_precio_min: product.monedaPrecioMin,
  foto_url: product.fotoUrl,
  foto_url_2: product.fotoUrl2,
  foto_url_3: product.fotoUrl3,
  visible_web: product.visibleWeb ? 1 : 0,
  orden_web: product.ordenWeb,
  tags_busqueda: product.tagsBusqueda,
});

// Construye un ítem de preorden con precio base (sin lista de labor ni plata fina).
// El precio final lo aplica PreorderEditor cuando el usuario selecciona una lista.
const buildBaseDraftItem = (product, quantity = 1) => {
  const piezas = Math.max(1, Number(quantity || 1));
  const gramosPorPieza = Number(product.pesoPromedio || 0);
  const precioGramo = Number(product.quotePricePerGram || product.precioMinimo || 0);
  return {
    producto_codigo: product.codigo,
    producto_descripcion: product.descripcion,
    producto_metal: product.metal,
    producto_kilataje: product.kilataje,
    producto_linea: product.linea,
    producto_foto_url: product.fotoUrl,
    piezas,
    gramos_por_pieza: gramosPorPieza,
    gramos_total: piezas * gramosPorPieza,
    labor_mxn: Number(product.quoteLaborPerGram || 0),
    precio_gramo_mxn: precioGramo,
    subtotal_mxn: piezas * gramosPorPieza * precioGramo,
  };
};

const cleanBadgeField = (value) =>
  String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const isReadableBadgeField = (value) => {
  const text = cleanBadgeField(value);
  if (!text) return false;
  const unreadable = text.replace(/[A-Za-z0-9 .,/#&'()_-]/g, "");
  return unreadable.length / text.length < 0.25;
};

const parseBadgeScanReadable = (rawValue) => {
  const raw = String(rawValue || "").trim();
  const controlParts = raw
    .split(/[\u001D\u001E\u001F]+/g)
    .map(cleanBadgeField)
    .filter(Boolean);

  if (controlParts.length >= 4) {
    const [badgeNumber = "", firstName = "", lastName = "", company = "", codeCandidate = ""] = controlParts;
    const badgeCode = isReadableBadgeField(codeCandidate) && /^[A-Za-z0-9 -]{1,12}$/.test(codeCandidate) ? codeCandidate : "";
    return {
      badgeNumber: badgeNumber.replace(/\D/g, "") || badgeNumber,
      badgeCode,
      name: [firstName, lastName].filter(Boolean).join(" "),
      company,
      raw,
    };
  }

  const [, badgeNumber = "", restValue = raw] = raw.match(/^(\d+)(.*)$/) || [];
  const words = cleanBadgeField(restValue)
    .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, "$1 $2")
    .split(" ")
    .filter(Boolean);
  const badgeCode = words.length > 2 && /^[A-Z]{1,4}$/.test(words[words.length - 1]) ? words.pop() : "";
  const nameWords = words.slice(0, Math.min(2, words.length));
  const companyWords = words.slice(nameWords.length);
  return {
    badgeNumber,
    badgeCode,
    name: nameWords.join(" "),
    company: companyWords.join(" "),
    raw,
  };
};

const displayContactEmail = (email) => String(email || "").endsWith("@prospect.local") ? "-" : email || "-";
const isProspectRecord = (client) => {
  // type="cliente" es el criterio definitivo — siempre es cliente, sin importar otros campos
  if ((client.type || "") === "cliente") return false;
  // type="prospecto" explícito → prospecto
  if ((client.type || "") === "prospecto") return true;
  // Sin type (BD antigua sin columna): solo el email fantasy es señal confiable.
  // badge_raw NO se usa aquí — los prospectos convertidos a cliente conservan el badge
  // y se clasificarían mal si lo usáramos como criterio.
  return String(client.email || "").endsWith("@prospect.local");
};
const prospectForForm = (prospect) => ({
  ...blankProspect,
  ...prospect,
  email: String(prospect.email || "").endsWith("@prospect.local") ? "" : prospect.email || "",
  type: "prospecto",
});

export default function AdminDashboard({ profile, tenantOverride = "", supportMode = false, supportTenantName = "", onExitSupport }) {
  const { t, language } = useLanguage();
  const company = useCompany();
  const [tenantCompany, setTenantCompany] = useState(null);
  const [tenantFeatures, setTenantFeatures] = useState(null);
  const superadmin = isSuperAdmin(profile) && !supportMode;
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState(() => localStorage.getItem("catalogo-b2b-selected-tenant") || profile?.tenant_id || profile?.tenantId || "");
  const tenantId = tenantOverride || (superadmin ? selectedTenantId : profile?.tenant_id || profile?.tenantId || "");
  const activeTenant = useMemo(() => tenants.find((tenant) => tenant.id === tenantId), [tenants, tenantId]);
  const activeCompany = tenantId ? (tenantCompany || {}) : company;
  const tabs = superadmin ? ["tenants", ...baseTabs] : [...baseTabs]; // se extiende abajo con extraTabs
  const [tab, setTab] = useState("catalog");
  const [adminSubTab, setAdminSubTab] = useState("inicio");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("");
  const [actionNotice, setActionNotice] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productModal, setProductModal] = useState({ open: false, product: null, mode: "create" });
  const [clientForm, setClientForm] = useState(blankClient);
  const [prospectForm, setProspectForm] = useState(blankProspect);
  const [savingClient, setSavingClient] = useState(false);
  const [savingProspect, setSavingProspect] = useState(false);
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [isProspectFormOpen, setIsProspectFormOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientStatusFilter, setClientStatusFilter] = useState("all");
  const [prospectSearch, setProspectSearch] = useState("");
  const [prospectStatusFilter, setProspectStatusFilter] = useState("all");
  const deferredClientSearch = useDeferredValue(clientSearch);
  const deferredProspectSearch = useDeferredValue(prospectSearch);
  const [badgeScanInput, setBadgeScanInput] = useState("");
  const [badgeComment, setBadgeComment] = useState("");
  const [badgeObtainedIn, setBadgeObtainedIn] = useState("JCK");
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("");
  const [priceListForm, setPriceListForm] = useState(blankPriceList);
  const [priceItemForm, setPriceItemForm] = useState(blankPriceItem);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedPriceListId, setSelectedPriceListId] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [searchChips, setSearchChips] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [quickFilters, setQuickFilters] = useState([]);
  const deferredProductQuery = useDeferredValue(productQuery);
  const deferredSearchChips = useDeferredValue(searchChips);
  const deferredFilters = useDeferredValue(filters);
  const deferredQuickFilters = useDeferredValue(quickFilters);
  const [selectedProductCode, setSelectedProductCode] = useState("");
  const [draftPreorder, setDraftPreorder] = useState(null);
  const [draftStorageReadyKey, setDraftStorageReadyKey] = useState(null);
  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [remisionDraft, setRemisionDraft] = useState(null);
  const [remisionDraftOpen, setRemisionDraftOpen] = useState(false);
  const [tabChangeModal, setTabChangeModal] = useState({ open: false, nextTab: null });
  const [addedCodes, setAddedCodes] = useState([]);
  const [visibleProductLimit, setVisibleProductLimit] = useState(PRODUCT_RENDER_BATCH);
  const [checkedIds, setCheckedIds] = useState(() => new Set());
  const [catalogSelectionIds, setCatalogSelectionIds] = useState(() => new Set());
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [lastActionMessage, setLastActionMessage] = useState("");
  const [catalogPdfOpen, setCatalogPdfOpen] = useState(false);
  const [quoteLinkOpen, setQuoteLinkOpen] = useState(false);
  const [selectionDrawerOpen, setSelectionDrawerOpen] = useState(false);
  const [tenantForm, setTenantForm] = useState({ name: "", slug: "", status: "active" });
  const [preorderClientFilter, setPreorderClientFilter] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const cameraVideoRef = useRef(null);
  const cameraControlsRef = useRef(null);
  const cameraDetectedRef = useRef(false);

  const notifyAction = useCallback((type, title, message) => {
    setActionNotice({ type, title, message });
    setLastActionMessage(message);
  }, []);

  const changeTab = useCallback((nextTab) => {
    setTab((current) => {
      if (current === "preorders" && nextTab !== "preorders" && draftPreorder?.preorder_items?.length) {
        setTabChangeModal({ open: true, nextTab });
        return current;
      }
      return nextTab;
    });
    if (nextTab !== "preorders") setPreorderClientFilter(null);
    setSelectedProductCode("");
  }, [draftPreorder]);

  const handleViewClientPreorders = useCallback((clientId) => {
    setPreorderClientFilter(clientId);
    changeTab("preorders");
  }, [changeTab]);

  const confirmTabChange = useCallback(() => {
    const { nextTab } = tabChangeModal;
    setTabChangeModal({ open: false, nextTab: null });
    setTab(nextTab);
    setSelectedProductCode("");
  }, [tabChangeModal]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fastSignOut(supabase);
    } catch (error) {
      setSigningOut(false);
      notifyAction("error", "No se pudo salir", error.message || "Intenta de nuevo.");
    }
  };

  const load = async () => {
    if (!tenantId) {
      setData({
        products: [],
        clients: [],
        catalogs: [],
        catalogProducts: [],
        priceLists: [],
        priceItems: [],
        clientCatalogs: [],
        clientPriceLists: [],
      });
      setStatus("Sin empresa asignada. Contacta al superadmin para asignarte una empresa.");
      return;
    }
    setLoadingProducts(true);
    setStatus("Cargando catálogo...");
    try {
      const nextData = await fetchAdminData({ ...profile, tenant_id: tenantId });
      setData(nextData);
      setSelectedPriceListId((current) => current || nextData.priceLists[0]?.id || "");
      setStatus("");
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    load().catch((error) => setStatus(error.message));
  }, [tenantId]);

  useEffect(() => {
    if (!superadmin) return;
    fetchTenants()
      .then((items) => {
        setTenants(items);
        setSelectedTenantId((current) => {
          if (current && items.some((tenant) => tenant.id === current)) return current;
          const romea = items.find((tenant) => tenant.slug === "romea");
          const fallback = romea?.id || items[0]?.id || "";
          if (fallback) localStorage.setItem("catalogo-b2b-selected-tenant", fallback);
          return fallback;
        });
      })
      .catch((error) => setStatus(`Error cargando empresas: ${error.message}`));
  }, [superadmin]);

  useEffect(() => {
    if (!tenantId) {
      setTenantCompany(null);
      return;
    }
    fetchCompanySettings(tenantId).then(setTenantCompany).catch(() => setTenantCompany(null));
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) {
      setTenantFeatures(null);
      return;
    }
    fetchTenantFeatures(tenantId).then(setTenantFeatures).catch(() => setTenantFeatures(null));
  }, [tenantId]);

  useEffect(() => {
    const refreshTenantCompany = (event) => {
      if (!tenantId || event.detail?.tenantId !== tenantId) return;
      if (event.detail?.settings) {
        setTenantCompany(event.detail.settings);
        return;
      }
      fetchCompanySettings(tenantId).then(setTenantCompany).catch(() => setTenantCompany(null));
    };
    window.addEventListener("company-settings-updated", refreshTenantCompany);
    return () => window.removeEventListener("company-settings-updated", refreshTenantCompany);
  }, [tenantId]);

  const products = data ? data.products : sampleProducts;
  const selectedClient = useMemo(() => data?.clients.find((client) => client.id === selectedClientId), [data?.clients, selectedClientId]);
  const configurableCatalogEnabled = tenantFeatures?.modulo_configurable === true;
  const adminModuleEnabled = tenantFeatures?.modulo_admin === true;
  const allTabs = [
    ...tabs,
    ...(configurableCatalogEnabled ? configurableOnlyTabs : []),
    ...(adminModuleEnabled ? adminModuleTabs : []),
  ];
  const catalogProducts = useMemo(
    () => configurableCatalogEnabled ? buildConfigurableCatalogProducts(products) : products,
    [configurableCatalogEnabled, products]
  );
  const selectedProduct = useMemo(() => catalogProducts.find((product) => product.codigo === selectedProductCode), [catalogProducts, selectedProductCode]);
  const filterOptions = useMemo(() => buildFilterOptions(products), [products]);
  const filteredProducts = useMemo(
    () => applyFilters(catalogProducts, deferredProductQuery, deferredFilters, deferredQuickFilters, deferredSearchChips),
    [catalogProducts, deferredProductQuery, deferredFilters, deferredQuickFilters, deferredSearchChips]
  );
  const renderedProducts = useMemo(
    () => filteredProducts.slice(0, visibleProductLimit),
    [filteredProducts, visibleProductLimit]
  );
  const { realClients, prospects } = useMemo(() => {
    const realClients = [];
    const prospects = [];
    for (const client of (data?.clients || [])) {
      (isProspectRecord(client) ? prospects : realClients).push(client);
    }
    return { realClients, prospects };
  }, [data?.clients]);

  const filteredClients = useMemo(() => {
    const term = normalizeText(deferredClientSearch);
    return realClients.filter((client) => {
      const activeMatch =
        clientStatusFilter === "all" ||
        (clientStatusFilter === "active" && client.active !== false) ||
        (clientStatusFilter === "inactive" && client.active === false);
      const text = normalizeText([client.name, client.company, client.rfc, client.phone, client.email, client.ciudad].join(" "));
      return activeMatch && (!term || text.includes(term));
    });
  }, [deferredClientSearch, clientStatusFilter, realClients]);

  const filteredProspects = useMemo(() => {
    const term = normalizeText(deferredProspectSearch);
    return prospects.filter((client) => {
      const activeMatch =
        prospectStatusFilter === "all" ||
        (prospectStatusFilter === "active" && client.active !== false) ||
        (prospectStatusFilter === "inactive" && client.active === false);
      const text = normalizeText([client.name, client.company, client.rfc, client.phone, client.email, client.ciudad, client.comentarios, client.badge_raw, client.obtenido_en].join(" "));
      return activeMatch && (!term || text.includes(term));
    });
  }, [deferredProspectSearch, prospectStatusFilter, prospects]);
  const checkedProducts = useMemo(
    () => catalogProducts.filter((product) => checkedIds.has(product.codigo)),
    [catalogProducts, checkedIds]
  );
  const catalogSelectionProducts = useMemo(
    () => products.filter((product) => catalogSelectionIds.has(product.codigo)),
    [products, catalogSelectionIds]
  );
  const preorderProducts = useMemo(
    () => (draftPreorder?.preorder_items || []).map((item) => ({
      codigo: item.producto_codigo,
      descripcion: item.producto_descripcion,
      linea: item.producto_linea,
      fotoUrl: item.producto_foto_url,
      pesoPromedio: item.gramos_por_pieza,
      piezas: item.piezas,
    })),
    [draftPreorder]
  );
  const allRenderedChecked = useMemo(
    () => renderedProducts.length > 0 && renderedProducts.every((product) => checkedIds.has(product.codigo)),
    [renderedProducts, checkedIds]
  );
  const allFilteredChecked = useMemo(
    () => filteredProducts.length > 0 && filteredProducts.every((product) => checkedIds.has(product.codigo)),
    [filteredProducts, checkedIds]
  );
  useEffect(() => {
    setVisibleProductLimit(PRODUCT_RENDER_BATCH);
  }, [deferredProductQuery, deferredSearchChips, deferredFilters, deferredQuickFilters]);

  useEffect(() => {
    if (!catalogSelectionIds.size && !preorderProducts.length) setSelectionDrawerOpen(false);
  }, [catalogSelectionIds, preorderProducts.length]);

  useEffect(() => {
    if (!lastActionMessage) return undefined;
    const timer = window.setTimeout(() => setLastActionMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [lastActionMessage]);

  useEffect(() => {
    if (!actionNotice?.message) return undefined;
    const timer = window.setTimeout(() => setActionNotice(null), actionNotice.type === "error" ? 9000 : 5200);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  // Clave con namespace para evitar mezcla entre tenants/usuarios en el mismo navegador.
  const draftStorageKey = tenantId && profile?.id ? `draft-preorder:${tenantId}:${profile.id}` : null;

  // Carga el borrador desde sessionStorage cuando cambia el tenant o el usuario.
  // Activa draftStorageReadyKey solo DESPUÉS de leer, para que el efecto de guardado
  // no borre lo que acaba de cargar (bug de hidratación).
  useEffect(() => {
    if (!draftStorageKey) {
      setDraftPreorder(null);
      setAddedCodes([]);
      setDraftStorageReadyKey(null);
      return;
    }
    try {
      const saved = sessionStorage.getItem(draftStorageKey);
      const parsed = saved ? JSON.parse(saved) : null;
      setDraftPreorder(parsed);
      setAddedCodes(parsed?.preorder_items?.map((item) => item.producto_codigo).filter(Boolean) || []);
    } catch {
      setDraftPreorder(null);
      setAddedCodes([]);
    } finally {
      setDraftStorageReadyKey(draftStorageKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftStorageKey]);

  // Persiste el borrador solo cuando la hidratación ya terminó para esta clave.
  // Previene que draftPreorder === null borre sessionStorage antes de restaurarse.
  useEffect(() => {
    if (!draftStorageKey || draftStorageReadyKey !== draftStorageKey) return;
    try {
      if (draftPreorder) {
        sessionStorage.setItem(draftStorageKey, JSON.stringify(draftPreorder));
      } else {
        sessionStorage.removeItem(draftStorageKey);
      }
    } catch {
      // sessionStorage puede fallar en modo privado o sin espacio.
    }
  }, [draftPreorder, draftStorageKey, draftStorageReadyKey]);

  const addSearchChip = (chip) => {
    const trimmed = chip.trim();
    if (!trimmed) return;
    setSearchChips((current) =>
      current.some((item) => normalizeText(item) === normalizeText(trimmed)) ? current : [...current, trimmed]
    );
  };

  const handleExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!tenantId) {
      setStatus("Primero selecciona una empresa para cargar el catálogo.");
      event.target.value = "";
      return;
    }
    try {
      setStatus(t("uploadingToSupabase"));
      const result = await parseExcelFile(file);
      await upsertProducts(result.products, tenantId);
      await load();
      setStatus(t("catalogUploaded", result.products.length));
    } catch (error) {
      setStatus(error.message);
    } finally {
      event.target.value = "";
    }
  };

  const handleDeleteCatalog = async () => {
    if (!tenantId) {
      setStatus("Primero selecciona una empresa para borrar su catálogo.");
      return;
    }
    const productCount = data?.products?.length || 0;
    const activeName = activeTenant?.name || "esta empresa";
    const ok = window.confirm(
      `Vas a borrar ${productCount.toLocaleString()} productos de ${activeName}.\n\n` +
      "Esto NO borra clientes, preórdenes ni listas de precios.\n\n" +
      "¿Quieres continuar?"
    );
    if (!ok) return;

    setLoadingProducts(true);
    setStatus("Borrando base de productos...");
    try {
      const deleted = await deleteTenantProducts(tenantId);
      setDraftPreorder(null);
      setAddedCodes([]);
      setCheckedIds(new Set());
      setCatalogSelectionIds(new Set());
      setSelectedProductCode("");
      await load();
      setStatus(`Base de productos borrada correctamente: ${deleted.toLocaleString()} productos eliminados.`);
    } catch (error) {
      setStatus(`Error al borrar catálogo: ${error.message}`);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Handler extraído para ClientsTab — antes era inline en el JSX del checkbox de lista de precios
  const handlePriceListToggle = async (priceListId, active) => {
    setStatus("Actualizando lista de precios...");
    try {
      await setClientPriceList(selectedClientId, priceListId, active);
      setData((current) => {
        if (!current) return current;
        const exists = current.clientPriceLists.some(
          (item) => item.client_id === selectedClientId && item.price_list_id === priceListId
        );
        const clientPriceLists = exists
          ? current.clientPriceLists.map((item) =>
              item.client_id === selectedClientId && item.price_list_id === priceListId
                ? { ...item, active }
                : item
            )
          : [...current.clientPriceLists, { client_id: selectedClientId, price_list_id: priceListId, active }];
        return { ...current, clientPriceLists };
      });
      setStatus("Lista de precios actualizada correctamente.");
      notifyAction("success", "Permiso actualizado", "La lista de precios del cliente quedo actualizada.");
    } catch (error) {
      setStatus(`Error actualizando lista: ${error.message}`);
      notifyAction("error", "No se pudo actualizar", `Error actualizando lista: ${error.message}`);
    }
  };

  // Handler: actualiza los SKUs permitidos para un cliente (catálogo personalizado)
  const handleSaveClientSkus = async (clientId, skus) => {
    try {
      await updateClientAllowedSkus(clientId, skus);
      setData((current) => {
        if (!current) return current;
        const clients = current.clients.map((c) =>
          c.id === clientId
            ? { ...c, allowed_skus: skus?.length ? skus : null }
            : c
        );
        return { ...current, clients };
      });
      notifyAction("success", "Catálogo actualizado", skus?.length
        ? `Se asignaron ${skus.length} SKUs al cliente.`
        : "El cliente ahora ve todos los productos.");
    } catch (error) {
      notifyAction("error", "Error al guardar", error.message);
      throw error;
    }
  };

  // Handler: asigna (o quita) lista de labores a un cliente
  const handleSaveClientLaborList = async (clientId, laborListId) => {
    try {
      await updateClientLaborList(clientId, laborListId);
      setData((current) => {
        if (!current) return current;
        const clients = current.clients.map((c) =>
          c.id === clientId ? { ...c, labor_list_id: laborListId || null } : c
        );
        return { ...current, clients };
      });
      const list = (data?.laborLists || []).find((l) => l.id === laborListId);
      notifyAction("success", "Lista de labores actualizada",
        laborListId
          ? `Lista "${list?.name || laborListId}" asignada al cliente.`
          : "El cliente usará precios base (sin lista de labores).");
    } catch (error) {
      notifyAction("error", "Error al guardar", error.message);
      throw error;
    }
  };

  const saveProduct = async (product) => {
    if (!tenantId) {
      setStatus("Primero selecciona una empresa para guardar productos.");
      notifyAction("warning", "Falta empresa", "Primero selecciona una empresa para guardar productos.");
      return;
    }
    setStatus("Guardando producto...");
    try {
      const saved = await upsertProducts([normalizeProduct(formProductToRow(product))], tenantId);
      setProductModal({ open: false, product: null, mode: "create" });
      setData((current) => {
        if (!current) return current;
        const savedMap = new Map(saved.map((p) => [p.codigo, p]));
        const updated = current.products.map((p) => savedMap.get(p.codigo) || p);
        saved.forEach((p) => { if (!current.products.some((ex) => ex.codigo === p.codigo)) updated.push(p); });
        return { ...current, products: updated };
      });
      setStatus(`Producto ${product.codigo} guardado correctamente.`);
      notifyAction("success", "Producto guardado", `Producto ${product.codigo} guardado correctamente.`);
    } catch (error) {
      setStatus(`Error guardando producto: ${error.message}`);
      notifyAction("error", "No se pudo guardar", `Error guardando producto: ${error.message}`);
    }
  };

  const isClientPriceActive = (priceListId) =>
    data?.clientPriceLists.some((item) => item.client_id === selectedClientId && item.price_list_id === priceListId && item.active);

  const addRealProductToCart = (product, quantity = 1, context = {}) => {
    if (!tenantId) {
      setStatus("Primero selecciona una empresa para crear preórdenes.");
      return;
    }
    const nextItem = { ...buildBaseDraftItem(product, quantity), ...context };
    setDraftPreorder((current) => {
      const preorder = current || { status: "pendiente", tenant_id: tenantId, created_by: profile?.id || "", preorder_items: [] };
      const existing = preorder.preorder_items.find((item) => item.producto_codigo === product.codigo);
      const preorderItems = existing
        ? preorder.preorder_items.map((item) =>
            item.producto_codigo === product.codigo
              ? { ...buildBaseDraftItem(product, Number(item.piezas || 0) + Number(nextItem.piezas || 0)), ...context }
              : item
          )
        : [...preorder.preorder_items, nextItem];
      return { ...preorder, preorder_items: preorderItems };
    });
    setAddedCodes((current) => current.includes(product.codigo) ? current : [...current, product.codigo]);
    setSelectionDrawerOpen(true);
    setLastActionMessage(`Producto ${product.codigo} agregado a pre-orden.`);
    setStatus(`Producto ${product.codigo} agregado a la preorden en proceso.`);
  };

  const addToCart = (product, quantity = 1) => {
    if (isConfigurableProductGroup(product)) {
      addRealProductToCart(product, quantity, {
        producto_descripcion: product.configurableTitle || product.descripcion,
        comentarios: "Pendiente de configurar tipo de pieza",
        _configurable_group: true,
        _configurable_title: product.configurableTitle || product.descripcion,
        _configurable_variants: (product.variants || []).map((variant) => ({
          code: variant.code,
          label: variant.label,
          product: variant.product,
        })),
      });
      return;
    }
    addRealProductToCart(product, quantity);
  };

  const removeFromPreorder = (code) => {
    setDraftPreorder((current) => {
      if (!current) return current;
      const preorderItems = (current.preorder_items || []).filter((item) => item.producto_codigo !== code);
      return preorderItems.length ? { ...current, preorder_items: preorderItems } : null;
    });
    setAddedCodes((current) => current.filter((item) => item !== code));
    setLastActionMessage(`Producto ${code} eliminado de pre-orden.`);
  };

  const handleSaveClient = async () => {
    if (!tenantId) {
      setStatus("Primero selecciona una empresa para crear clientes.");
      notifyAction("warning", "Falta empresa", "Primero selecciona una empresa para crear clientes.");
      return;
    }
    if (!clientForm.name.trim() && !clientForm.company.trim()) {
      notifyAction("warning", "Datos incompletos", "Captura al menos nombre o empresa antes de guardar el cliente.");
      return;
    }
    setSavingClient(true);
    setStatus("Guardando cliente...");
    try {
      const saved = await saveClient({ ...clientForm, type: "cliente" }, tenantId);
      setClientForm(blankClient);
      setIsClientFormOpen(false);
      setData((current) => {
        if (!current) return current;
        const exists = current.clients.some((c) => c.id === saved.id);
        const clients = exists ? current.clients.map((c) => c.id === saved.id ? saved : c) : [...current.clients, saved];
        return { ...current, clients };
      });
      setSelectedClientId(saved.id);
      setStatus("Cliente guardado correctamente.");
      notifyAction(
        "success",
        clientForm.id ? "Cliente actualizado" : "Cliente creado",
        `${saved.company || saved.name || "Cliente"} se guardo correctamente.`
      );
    } catch (error) {
      setStatus(`Error creando cliente: ${error.message}`);
      notifyAction("error", "No se pudo guardar", `Error creando cliente: ${error.message}`);
    } finally {
      setSavingClient(false);
    }
  };

  const handleSaveProspect = async () => {
    if (!tenantId) {
      setStatus("Primero selecciona una empresa para crear prospectos.");
      notifyAction("warning", "Falta empresa", "Primero selecciona una empresa para crear prospectos.");
      return;
    }
    if (!prospectForm.name.trim() && !prospectForm.company.trim()) {
      notifyAction("warning", "Datos incompletos", "Captura al menos nombre o empresa antes de guardar el prospecto.");
      return;
    }
    setSavingProspect(true);
    setStatus("Guardando prospecto...");
    try {
      const saved = await saveClient({ ...prospectForm, type: "prospecto" }, tenantId);
      setProspectForm(blankProspect);
      setIsProspectFormOpen(false);
      setData((current) => {
        if (!current) return current;
        const exists = current.clients.some((c) => c.id === saved.id);
        const clients = exists ? current.clients.map((c) => c.id === saved.id ? saved : c) : [...current.clients, saved];
        return { ...current, clients };
      });
      setStatus("Prospecto guardado correctamente.");
      notifyAction(
        "success",
        prospectForm.id ? "Prospecto actualizado" : "Prospecto creado",
        `${saved.company || saved.name || "Prospecto"} se guardo correctamente.`
      );
    } catch (error) {
      setStatus(`Error creando prospecto: ${error.message}`);
      notifyAction("error", "No se pudo guardar", `Error creando prospecto: ${error.message}`);
    } finally {
      setSavingProspect(false);
    }
  };

  const handleConvertProspectToClient = async (prospect) => {
    if (!window.confirm(`Convertir ${prospect.company || prospect.name || "este prospecto"} a cliente?`)) return;
    setStatus("Convirtiendo prospecto a cliente...");
    try {
      const saved = await saveClient({ ...prospect, type: "cliente" }, tenantId);
      setData((current) => {
        if (!current) return current;
        const clients = current.clients.map((c) => c.id === saved.id ? saved : c);
        return { ...current, clients };
      });
      setStatus("Prospecto convertido a cliente.");
      notifyAction("success", "Convertido a cliente", "El prospecto ahora aparece en el menu Clientes.");
      changeTab("clients");
    } catch (error) {
      setStatus(`Error convirtiendo prospecto: ${error.message}`);
      notifyAction("error", "No se pudo convertir", error.message);
    }
  };

  const handleSaveBadgeProspect = async (scanOverride = "", commentOverride = "") => {
    const scan = String(scanOverride || badgeScanInput).trim();
    const comment = String(commentOverride || badgeComment).trim();
    if (!scan) {
      notifyAction("warning", "Sin lectura", "Escanea o escribe la información del gafete antes de guardar.");
      return;
    }
    if (!tenantId) {
      notifyAction("warning", "Falta empresa", "Primero selecciona una empresa para registrar prospectos.");
      return;
    }
    const parsed = parseBadgeScanReadable(scan);
    if (!parsed.name && !parsed.company) {
      notifyAction("warning", "Lectura no interpretada", "No pude separar nombre o empresa; revisa la lectura del gafete.");
      return;
    }
    setSavingProspect(true);
    setStatus("Guardando prospecto desde gafete...");
    try {
      const notes = [
        comment,
        parsed.badgeNumber ? `Folio gafete: ${parsed.badgeNumber}` : "",
        parsed.badgeCode ? `Código gafete: ${parsed.badgeCode}` : "",
        `Lectura original: ${parsed.raw}`,
      ].filter(Boolean).join("\n");
      const saved = await saveClient({
        ...blankProspect,
        name: parsed.name,
        company: parsed.company,
        comentarios: notes,
        badge_raw: parsed.raw,
        obtenido_en: badgeObtainedIn || "JCK",
      }, tenantId);
      setBadgeScanInput("");
      setBadgeComment("");
      setData((current) => {
        if (!current) return current;
        const exists = current.clients.some((c) => c.id === saved.id);
        const clients = exists ? current.clients.map((c) => c.id === saved.id ? saved : c) : [...current.clients, saved];
        return { ...current, clients };
      });
      setProspectForm(prospectForForm(saved));
      setIsProspectFormOpen(true);
      setStatus("Prospecto guardado con éxito. Completa la ficha si necesitas más datos.");
      notifyAction("success", "Prospecto guardado con éxito", "Se abrió la ficha para completar email, domicilio y comentarios.");
    } catch (error) {
      setStatus(`Error guardando prospecto: ${error.message}`);
      notifyAction("error", "No se pudo guardar", error.message);
    } finally {
      setSavingProspect(false);
    }
  };

  const stopCameraScanner = () => {
    try {
      cameraControlsRef.current?.stop?.();
    } catch {
      // ignore camera cleanup errors
    }
    cameraControlsRef.current = null;
    if (cameraVideoRef.current?.srcObject) {
      cameraVideoRef.current.srcObject.getTracks?.().forEach((track) => track.stop());
      cameraVideoRef.current.srcObject = null;
    }
  };

  const closeCameraScanner = () => {
    stopCameraScanner();
    setCameraScannerOpen(false);
    setCameraStatus("");
  };

  const startCameraScanner = async () => {
    setCameraScannerOpen(true);
    setCameraStatus("Abriendo camara...");
    cameraDetectedRef.current = false;
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      await new Promise((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
      });
      if (!cameraVideoRef.current) throw new Error("No se pudo preparar la vista de camara.");

      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(undefined, cameraVideoRef.current, async (result) => {
        const text = result?.getText?.();
        if (!text || cameraDetectedRef.current) return;
        cameraDetectedRef.current = true;
        setCameraStatus(`Gafete detectado: ${text}`);
        setBadgeScanInput(text);
        stopCameraScanner();
        setCameraScannerOpen(false);
        await handleSaveBadgeProspect(text, badgeComment);
      });
      cameraControlsRef.current = controls;
      setCameraStatus("Apunta la camara al codigo del gafete.");
    } catch (error) {
      stopCameraScanner();
      setCameraStatus(`No se pudo abrir la camara: ${error.message}`);
      notifyAction("error", "Camara no disponible", "Revisa permisos de camara o usa el lector fisico Bluetooth.");
    }
  };

  useEffect(() => () => stopCameraScanner(), []);

  const handleBadgeScanKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    handleSaveBadgeProspect();
  };

  const clearCatalogFilters = () => {
    setProductQuery("");
    setSearchChips([]);
    setFilters(emptyFilters);
    setQuickFilters([]);
    setSelectedProductCode("");
  };

  const toggleProductCheck = (code) => {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleRenderedChecks = () => {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (allRenderedChecked) renderedProducts.forEach((product) => next.delete(product.codigo));
      else renderedProducts.forEach((product) => next.add(product.codigo));
      return next;
    });
  };

  const toggleFilteredChecks = () => {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (allFilteredChecked) filteredProducts.forEach((product) => next.delete(product.codigo));
      else filteredProducts.forEach((product) => next.add(product.codigo));
      return next;
    });
  };

  const getCatalogSelectionCodes = (product) => {
    if (!isConfigurableProductGroup(product)) return product?.codigo ? [product.codigo] : [];
    return (product.variants || []).map((variant) => variant.product?.codigo).filter(Boolean);
  };

  const addToCatalogSelection = (product) => {
    const codes = getCatalogSelectionCodes(product);
    if (!codes.length) return;
    setCatalogSelectionIds((current) => {
      const next = new Set(current);
      codes.forEach((code) => next.add(code));
      return next;
    });
    setSelectionDrawerOpen(true);
    setLastActionMessage(`Producto ${product.codigo} agregado a catálogo.`);
  };

  const removeFromCatalogSelection = (code) => {
    setCatalogSelectionIds((current) => {
      const next = new Set(current);
      next.delete(code);
      return next;
    });
    setLastActionMessage(`Producto ${code} eliminado de catálogo.`);
  };

  const addCheckedToCatalogSelection = () => {
    if (!checkedIds.size) {
      setLastActionMessage("Marca productos primero.");
      notifyAction("warning", "Sin productos marcados", "Marca productos primero para agregarlos al catalogo.");
      return;
    }
    const codesToAdd = checkedProducts.flatMap(getCatalogSelectionCodes);
    const selectedCount = codesToAdd.length;
    setCatalogSelectionIds((current) => {
      const next = new Set(current);
      codesToAdd.forEach((code) => next.add(code));
      return next;
    });
    setCheckedIds(new Set());
    setSelectionDrawerOpen(true);
    setLastActionMessage(`${selectedCount.toLocaleString()} productos agregados a catalogo.`);
    notifyAction("success", "Seleccion agregada", `${selectedCount.toLocaleString()} productos agregados a catalogo.`);
  };

  const addCheckedToPreorder = () => {
    if (!checkedProducts.length) {
      setLastActionMessage("Marca productos primero.");
      notifyAction("warning", "Sin productos marcados", "Marca productos primero para agregarlos a pre-orden.");
      return;
    }
    checkedProducts.forEach((product) => addToCart(product));
    setCheckedIds(new Set());
    setSelectionDrawerOpen(true);
    setLastActionMessage(`${checkedProducts.length.toLocaleString()} productos agregados a pre-orden.`);
    notifyAction("success", "Pre-orden actualizada", `${checkedProducts.length.toLocaleString()} productos agregados a pre-orden.`);
  };

  const openCatalogPdfPanel = () => {
    setQuoteLinkOpen(false);
    setSelectionDrawerOpen(false);
    setCatalogPdfOpen(true);
  };

  const openQuoteLinkPanel = () => {
    setCatalogPdfOpen(false);
    setSelectionDrawerOpen(false);
    setQuoteLinkOpen(true);
  };

  const handleCreateRemisionFromPreorder = (preorder) => {
    // Mapea la preorden al formato que espera RemisionWorkspace/RemisionEditor
    setRemisionDraft({
      estado:            "borrador",
      clienteId:         preorder.client_id || "",
      clienteNombre:     preorder.cliente_nombre || "",
      clienteEmpresa:    preorder.cliente_empresa || "",
      clienteEmail:      preorder.cliente_email || "",
      clienteTelefono:   preorder.cliente_telefono || "",
      clienteRfc:        preorder.cliente_rfc || "",
      moneda:            preorder.moneda || "USD",
      tipoCambioEmision: preorder.tipo_cambio ? String(preorder.tipo_cambio) : "",
      preorderId:        preorder.id || null,
      notas:             preorder.notas || "",
      // Items de la preorden — RemisionEditor los procesa con itemsFromPreorder()
      preorder_items:    preorder.preorder_items || [],
    });
    setRemisionDraftOpen(true);
    changeTab("administracion");
    setAdminSubTab("remisiones");
  };

  const openDraftPreorderWorkspace = () => {
    if (!draftPreorder?.preorder_items?.length) return;
    setCatalogPdfOpen(false);
    setQuoteLinkOpen(false);
    setSelectionDrawerOpen(false);
    setIsDraftOpen(true);
    setTab("preorders");
  };

  const handleTenantChange = (nextTenantId) => {
    setSelectedTenantId(nextTenantId);
    localStorage.setItem("catalogo-b2b-selected-tenant", nextTenantId);
    setSelectedProductCode("");
    setSelectedClientId("");
    setSelectedPriceListId("");
    setDraftPreorder(null);
    setAddedCodes([]);
    setCheckedIds(new Set());
    setCatalogSelectionIds(new Set());
  };

  const handleTenantSave = async () => {
    if (!tenantForm.name.trim()) {
      setStatus("Captura el nombre de la empresa.");
      return;
    }
    try {
      const saved = await saveTenant({ ...tenantForm, slug: tenantForm.slug || makeTenantSlug(tenantForm.name) });
      const nextTenants = await fetchTenants();
      setTenants(nextTenants);
      setTenantForm({ name: "", slug: "", status: "active" });
      handleTenantChange(saved.id);
      setStatus(`Empresa ${saved.name} lista. Ahora puedes cargar su catálogo.`);
      setTab("database");
    } catch (error) {
      setStatus(`Error creando empresa: ${error.message}`);
    }
  };

  if (!data) {
    return (
      <section className="setup-screen">
        <div className="setup-card">
          {status && status !== "Cargando catálogo..." ? (
            <p style={{ color: "var(--romea-danger, #c0392b)", marginBottom: "0.5rem" }}>{status}</p>
          ) : null}
          {t("loadingAdmin")}
        </div>
      </section>
    );
  }

  return (
    <div className={`admin-catalog-shell${tab === "administracion" && adminModuleEnabled ? " has-secondary-sidebar" : ""}`}>
      <aside className="admin-romea-sidebar">
        <div className="brand-block">
          <BrandLogo company={activeCompany} />
          <p>{t("b2bCatalog")}</p>
        </div>

        {superadmin ? (
          <section className="sidebar-section superadmin-tenant-box">
            <h3>Superadmin</h3>
            <label>
              Empresa activa
              <select value={tenantId} onChange={(event) => handleTenantChange(event.target.value)}>
                <option value="">Seleccionar empresa</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name} ({tenant.slug})
                  </option>
                ))}
              </select>
            </label>
            <p className="muted">
              {activeTenant ? `Trabajando en: ${activeTenant.name}` : "Sin empresa seleccionada"}
            </p>
          </section>
        ) : null}

        <section className="sidebar-section sidebar-menu-section">
          <h3>{t("admin")}</h3>
          <div className="admin-nav-list">
            {allTabs.map((id) => (
              <button
                className={tab === id ? "active" : ""}
                key={id}
                type="button"
                onClick={() => changeTab(id)}
              >
                {id === "administracion" ? "Administración" : t(tabKeys[id])}
              </button>
            ))}
          </div>
        </section>

        {supportMode ? (
          <section className="sidebar-support-card" aria-label="Modo soporte">
            <div>
              <strong>Modo soporte</strong>
              <span>Administrando: {supportTenantName || activeTenant?.name || "empresa"}</span>
            </div>
          </section>
        ) : null}

        <div className="sidebar-bottom-actions">
          <button
            className="sidebar-logout"
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {signingOut ? "Saliendo..." : t("logout")}
          </button>
          {supportMode ? (
            <button className="support-exit-button" type="button" onClick={onExitSupport}>
              Superadmin
            </button>
          ) : null}
        </div>
      </aside>

      {/* ── Sidebar secundario: se muestra solo en Administración ── */}
      {tab === "administracion" && adminModuleEnabled ? (
        <aside className="admin-secondary-sidebar">
          {/* Cabecera alineada con la zona del logo del sidebar primario:
              misma altura y misma línea divisoria para que ambas columnas
              queden justificadas de arriba a abajo */}
          <div className="secondary-sidebar-head">
            <h3>Administración</h3>
            <p>Centro financiero</p>
          </div>
          <nav className="secondary-nav">
            <div className="secondary-nav-section-title">Operación</div>
            {ADMIN_SUB_TABS.filter((s) => s.group === "operaciones").map((sub) => (
              <button
                key={sub.id}
                type="button"
                className={`secondary-nav-item${adminSubTab === sub.id ? " active" : ""}`}
                onClick={() => setAdminSubTab(sub.id)}
              >
                {sub.label}
              </button>
            ))}
            <div className="secondary-nav-divider" />
            <div className="secondary-nav-section-title">Configuración</div>
            {ADMIN_SUB_TABS.filter((s) => s.group === "configuracion").map((sub) => (
              <button
                key={sub.id}
                type="button"
                className={`secondary-nav-item secondary-nav-item--config${adminSubTab === sub.id ? " active" : ""}`}
                onClick={() => setAdminSubTab(sub.id)}
              >
                {sub.label}
              </button>
            ))}
          </nav>
        </aside>
      ) : null}

      <main className="admin-catalog-main">
        <header className="admin-catalog-header minimal">
          <div className="admin-header-context">
            {superadmin && activeTenant ? <span>Empresa activa: {activeTenant.name}</span> : null}
            {status && tab !== "catalog" ? <span className="header-status-text">{status}</span> : null}
          </div>
          <div className="admin-header-actions">
            <LanguageToggle />
            <button className="header-logout-button" type="button" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? "Saliendo..." : t("logout")}
            </button>
          </div>
        </header>

        {tab === "tenants" && superadmin ? (
          <TenantsTab
            tenants={tenants}
            tenantId={tenantId}
            status={status}
            tenantForm={tenantForm}
            setTenantForm={setTenantForm}
            handleTenantSave={handleTenantSave}
            handleTenantChange={handleTenantChange}
            setTab={setTab}
          />
        ) : null}

        {tab === "catalog" ? (
          <CatalogTab
            t={t}
            selectedProductCode={selectedProductCode}
            setSelectedProductCode={setSelectedProductCode}
            selectedProduct={selectedProduct}
            filteredProducts={filteredProducts}
            renderedProducts={renderedProducts}
            allRenderedChecked={allRenderedChecked}
            allFilteredChecked={allFilteredChecked}
            addedCodes={addedCodes}
            checkedIds={checkedIds}
            catalogSelectionIds={catalogSelectionIds}
            visibleProductLimit={visibleProductLimit}
            setVisibleProductLimit={setVisibleProductLimit}
            toggleRenderedChecks={toggleRenderedChecks}
            toggleFilteredChecks={toggleFilteredChecks}
            toggleProductCheck={toggleProductCheck}
            addCheckedToCatalogSelection={addCheckedToCatalogSelection}
            addCheckedToPreorder={addCheckedToPreorder}
            addToCart={addToCart}
            removeFromPreorder={removeFromPreorder}
            addToCatalogSelection={addToCatalogSelection}
            removeFromCatalogSelection={removeFromCatalogSelection}
            setProductModal={setProductModal}
            filterBar={!selectedProductCode ? (
              <CatalogFilterBar
                totalCount={products.length}
                filteredCount={productQuery !== deferredProductQuery ? filteredProducts.length : filteredProducts.length}
                loadingProducts={loadingProducts}
                productQuery={productQuery}
                searchChips={searchChips}
                products={products}
                onQueryChange={setProductQuery}
                onAddChip={addSearchChip}
                onRemoveChip={(chip) => setSearchChips((c) => c.filter((item) => item !== chip))}
                filters={filters}
                filterOptions={filterOptions}
                onFiltersChange={setFilters}
                quickFilters={quickFilters}
                onQuickFilterToggle={(id) => setQuickFilters((c) => c.includes(id) ? c.filter((item) => item !== id) : [...c, id])}
                onClear={clearCatalogFilters}
                collapsed={filtersCollapsed}
                onToggleCollapse={() => setFiltersCollapsed((c) => !c)}
              />
            ) : null}
          />
        ) : null}

        {tab === "clients" ? (
          <ClientsTab
            filteredClients={filteredClients}
            allClientsCount={realClients.length}
            clientSearch={clientSearch}
            setClientSearch={setClientSearch}
            clientStatusFilter={clientStatusFilter}
            setClientStatusFilter={setClientStatusFilter}
            priceLists={data.priceLists}
            clientPriceLists={data.clientPriceLists}
            selectedClientId={selectedClientId}
            setSelectedClientId={setSelectedClientId}
            selectedClient={selectedClient}
            isClientPriceActive={isClientPriceActive}
            handlePriceListToggle={handlePriceListToggle}
            isClientFormOpen={isClientFormOpen}
            setIsClientFormOpen={setIsClientFormOpen}
            clientForm={clientForm}
            setClientForm={setClientForm}
            blankClient={blankClient}
            savingClient={savingClient}
            handleSaveClient={handleSaveClient}
            products={products}
            laborLists={data.laborLists || []}
            onSaveClientSkus={handleSaveClientSkus}
            onSaveClientLaborList={handleSaveClientLaborList}
            tenantId={tenantId}
            onViewClientPreorders={handleViewClientPreorders}
          />
        ) : null}

        {tab === "prospects" ? (
          <ProspectsTab
            filteredProspects={filteredProspects}
            allProspectsCount={(data.clients || []).filter(isProspectRecord).length}
            prospectSearch={prospectSearch}
            setProspectSearch={setProspectSearch}
            prospectStatusFilter={prospectStatusFilter}
            setProspectStatusFilter={setProspectStatusFilter}
            badgeObtainedIn={badgeObtainedIn}
            setBadgeObtainedIn={setBadgeObtainedIn}
            badgeScanInput={badgeScanInput}
            setBadgeScanInput={setBadgeScanInput}
            badgeComment={badgeComment}
            setBadgeComment={setBadgeComment}
            handleBadgeScanKeyDown={handleBadgeScanKeyDown}
            handleSaveBadgeProspect={handleSaveBadgeProspect}
            savingProspect={savingProspect}
            cameraScannerOpen={cameraScannerOpen}
            cameraVideoRef={cameraVideoRef}
            cameraStatus={cameraStatus}
            startCameraScanner={startCameraScanner}
            closeCameraScanner={closeCameraScanner}
            isProspectFormOpen={isProspectFormOpen}
            setIsProspectFormOpen={setIsProspectFormOpen}
            prospectForm={prospectForm}
            setProspectForm={setProspectForm}
            blankProspect={blankProspect}
            handleSaveProspect={handleSaveProspect}
            handleConvertProspectToClient={handleConvertProspectToClient}
            prospectForForm={prospectForForm}
          />
        ) : null}

        {tab === "prices" ? (
          <PricingPanel clients={data.clients} products={products} tenantId={tenantId} profile={profile} />
        ) : null}
        {tab === "preorders" ? (
          <PreorderWorkspace
            clients={data.clients}
            products={products}
            profile={profile}
            tenantId={tenantId}
            draftPreorder={draftPreorder}
            isDraftOpen={isDraftOpen}
            onDraftClose={(updatedDraft) => {
              if (updatedDraft) setDraftPreorder(updatedDraft);
              setIsDraftOpen(false);
            }}
            onDraftSaved={() => {
              setDraftPreorder(null);
              setAddedCodes([]);
              setIsDraftOpen(false);
              setStatus("Preorden guardada correctamente. Puedes verla en el menu Preordenes.");
            }}
            onCreateRemision={handleCreateRemisionFromPreorder}
            configurableCatalogEnabled={configurableCatalogEnabled}
            clientFilter={preorderClientFilter}
            onClearClientFilter={() => setPreorderClientFilter(null)}
          />
        ) : null}

        {tab === "company" ? (
          <CompanySettingsPanel tenantId={tenantId} />
        ) : null}

        {tab === "database" ? (
          <DatabaseTab
            t={t}
            language={language}
            products={products}
            rawProducts={data.products}
            tenantId={tenantId}
            status={status}
            loadingProducts={loadingProducts}
            handleExcel={handleExcel}
            handleDeleteCatalog={handleDeleteCatalog}
            setProductModal={setProductModal}
            load={load}
            setStatus={setStatus}
            notifyAction={notifyAction}
          />
        ) : null}

        {tab === "components" && configurableCatalogEnabled ? (
          <ComponentsTab tenantId={tenantId} />
        ) : null}

        {tab === "administracion" && adminModuleEnabled ? (
          <div className="admin-module-content">
            {adminSubTab === "inicio" ? (
              <InicioFinancieroTab tenantId={tenantId} onNavigate={setAdminSubTab} />
            ) : null}
            {adminSubTab === "cobros" ? (
              <CobrosTab tenantId={tenantId} clients={data?.clients || []} notifyAction={notifyAction} setStatus={setStatus} />
            ) : null}
            {adminSubTab === "capital" ? (
              <CapitalTab tenantId={tenantId} notifyAction={notifyAction} setStatus={setStatus} />
            ) : null}
            {adminSubTab === "remisiones" ? (
              <RemisionWorkspace
                clients={data?.clients || []}
                products={products}
                profile={profile}
                tenantId={tenantId}
                initialDraft={remisionDraft}
                isInitialDraftOpen={remisionDraftOpen}
                onInitialDraftClose={() => setRemisionDraftOpen(false)}
                onInitialDraftSaved={() => {
                  setRemisionDraft(null);
                  setRemisionDraftOpen(false);
                }}
              />
            ) : null}
            {adminSubTab === "gastos" ? (
              <GastosTab
                tenantId={tenantId}
                notifyAction={notifyAction}
                setStatus={setStatus}
              />
            ) : null}
            {adminSubTab === "balance" ? (
              <BalanceTab tenantId={tenantId} />
            ) : null}
            {adminSubTab === "estados" ? (
              <div className="admin-placeholder-panel">
                <span className="placeholder-icon">📋</span>
                <h3>Estados financieros</h3>
                <p>En desarrollo: Estado de resultados, Balance general, Posición de plata y Flujo de caja por periodo.</p>
              </div>
            ) : null}
            {adminSubTab === "cuentas" ? (
              <CuentasAdminTab tenantId={tenantId} notifyAction={notifyAction} />
            ) : null}
            {adminSubTab === "categorias" ? (
              <CategoriasGastoTab tenantId={tenantId} notifyAction={notifyAction} />
            ) : null}
            {adminSubTab === "centros" ? (
              <CentrosCostosTab tenantId={tenantId} notifyAction={notifyAction} />
            ) : null}
          </div>
        ) : null}
      </main>

      {productModal.open ? (
        <ProductFormModal
          mode={productModal.mode}
          product={productModal.product}
          products={products}
          onSave={saveProduct}
          onDelete={async (code) => {
            try {
              const product = data.products.find((item) => item.codigo === code);
              if (product) await deleteProduct(product.id, tenantId);
              setProductModal({ open: false, product: null, mode: "create" });
              setData((current) => {
                if (!current) return current;
                return { ...current, products: current.products.filter((p) => p.codigo !== code) };
              });
              setSelectedProductCode((current) => current === code ? "" : current);
              setStatus(`Producto ${code} eliminado correctamente.`);
              notifyAction("success", "Producto eliminado", `Producto ${code} eliminado correctamente.`);
            } catch (error) {
              setStatus(`Error eliminando producto: ${error.message}`);
              notifyAction("error", "No se pudo eliminar", `Error eliminando producto: ${error.message}`);
            }
          }}
          onClose={() => setProductModal({ open: false, product: null, mode: "create" })}
        />
      ) : null}
      {/* El cajón de selección es del flujo de catálogo/preórdenes — no estorba
          en el módulo financiero ni en empresa/base de datos */}
      {tab !== "administracion" && tab !== "company" && tab !== "database" ? (
        <SelectedProductsDrawer
          preorderProducts={preorderProducts}
          catalogProducts={catalogSelectionProducts}
          isOpen={selectionDrawerOpen}
          onOpen={() => setSelectionDrawerOpen(true)}
          onClose={() => setSelectionDrawerOpen(false)}
          onOpenPreorder={openDraftPreorderWorkspace}
          onRemovePreorder={removeFromPreorder}
          onRemoveCatalog={removeFromCatalogSelection}
          onCatalogPdf={openCatalogPdfPanel}
          onQuoteLink={openQuoteLinkPanel}
          onClearCatalog={() => setCatalogSelectionIds(new Set())}
        />
      ) : null}

      {catalogPdfOpen ? (
        <CatalogPdfPanel
          products={catalogSelectionProducts}
          company={activeCompany}
          clients={data.clients || []}
          onClose={() => setCatalogPdfOpen(false)}
        />
      ) : null}

      {quoteLinkOpen ? (
        <QuoteLinkPanel
          products={catalogSelectionProducts}
          clients={data.clients}
          profile={profile}
          tenantId={tenantId}
          onClose={() => setQuoteLinkOpen(false)}
        />
      ) : null}

      {checkedIds.size ? (
        <div className="checked-batch-bar" role="region" aria-label="Productos marcados">
          <strong>{checkedIds.size.toLocaleString()} productos marcados</strong>
          <button className="selection-action preorder" type="button" onClick={addCheckedToPreorder}>
            {t("addMarkedToPreorder")}
          </button>
          <button className="selection-action catalog" type="button" onClick={addCheckedToCatalogSelection}>
            {t("addMarkedToCatalog")}
          </button>
          <button className="secondary-button compact-action" type="button" onClick={() => setCheckedIds(new Set())}>
            {t("clearSelectionShort")}
          </button>
        </div>
      ) : null}

      {lastActionMessage ? (
        <div className="action-toast" role="status">
          {lastActionMessage}
        </div>
      ) : null}

      <ActionNotice notice={actionNotice} onClose={() => setActionNotice(null)} />

      {tabChangeModal.open ? (
        <div className="client-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tab-change-modal-title">
          <section className="client-modal">
            <header>
              <h2 id="tab-change-modal-title">¿Cambiar de menú?</h2>
            </header>
            <div className="client-modal-body">
              <p>Tienes una preorden con productos en proceso. Si cambias de menú sin guardar, los productos permanecerán en el borrador.</p>
              <p className="muted">Puedes volver a Preórdenes cuando quieras para continuar.</p>
            </div>
            <footer>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setTabChangeModal({ open: false, nextTab: null })}
              >
                Quedarme aquí
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={confirmTabChange}
              >
                Sí, cambiar de menú
              </button>
            </footer>
          </section>
        </div>
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
