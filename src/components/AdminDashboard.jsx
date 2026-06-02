import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import ActionNotice from "./ActionNotice";
import AdvancedSearch from "./AdvancedSearch";
import BrandLogo from "./BrandLogo";
import ImportPanel from "./ImportPanel";
import CompanySettingsPanel from "./CompanySettingsPanel";
import CatalogPdfPanel from "./CatalogPdfPanel";
import DatabaseHealthDashboard from "./DatabaseHealthDashboard";
import PricingPanel from "./PricingPanel";
import PreorderWorkspace from "./PreorderWorkspace";
import QuoteLinkPanel from "./QuoteLinkPanel";
import SelectedProductsDrawer from "./SelectedProductsDrawer";
import { useCompany } from "../contexts/CompanyContext";
import { fetchCompanySettings } from "../services/companySettings";
import CatalogExportButton from "./CatalogExportButton";
import ExcelTemplateButton from "./ExcelTemplateButton";
import FilterPanel from "./FilterPanel";
import LanguageToggle from "./LanguageToggle";
import ProductDetail from "./ProductDetail";
import ProductFormModal from "./ProductFormModal";
import ProductImageImportPanel from "./ProductImageImportPanel";
import QuickFilters from "./QuickFilters";
import UploadExcel from "./UploadExcel";
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
  upsertProducts,
} from "../services/supabaseCatalog";
import { fetchTenants, makeTenantSlug, saveTenant } from "../services/tenantService";
import { isSuperAdmin } from "../services/tenantUtils";
import { normalizeProduct, parseExcelFile } from "../utils/excelParser";
import { applyFilters, buildFilterOptions, emptyFilters } from "../utils/filters";
import { buildPlaceholderUrl, formatCurrency, formatWeight, imageUrlForSize, shortText } from "../utils/formatters";
import { normalizeText } from "../utils/textNormalizer";

const blankClient = { name: "", company: "", email: "", phone: "", rfc: "", ciudad: "", domicilio: "", comentarios: "", type: "cliente", active: true };
const blankProspect = { name: "", company: "", email: "", phone: "", rfc: "", ciudad: "", domicilio: "", comentarios: "", badge_raw: "", obtenido_en: "JCK", type: "prospecto", active: true };
const blankPriceList = { name: "", currency: "MXN", active: true };
const blankPriceItem = { metal: "", kilataje: "", price_per_gram: 0, labor_markup: 0 };
const PRODUCT_RENDER_BATCH = 60;
const baseTabs = ["catalog", "preorders", "clients", "prospects", "prices", "company", "database"];
const tabKeys = {
  tenants: "tenants",
  catalog: "catalog",
  preorders: "preorders",
  clients: "clients",
  prospects: "prospects",
  prices: "priceMenu",
  company: "company",
  database: "database",
};
const titleKeys = {
  tenants: "tenants",
  catalog: "adminCatalog",
  preorders: "preorders",
  clients: "clients",
  prospects: "prospects",
  prices: "priceMenu",
  company: "company",
  database: "database",
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
const isProspectRecord = (client) =>
  (client.type || "") === "prospecto" ||
  String(client.email || "").endsWith("@prospect.local") ||
  Boolean(client.badge_raw);
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
  const superadmin = isSuperAdmin(profile) && !supportMode;
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState(() => localStorage.getItem("catalogo-b2b-selected-tenant") || profile?.tenant_id || profile?.tenantId || "");
  const tenantId = tenantOverride || (superadmin ? selectedTenantId : profile?.tenant_id || profile?.tenantId || "");
  const activeTenant = useMemo(() => tenants.find((tenant) => tenant.id === tenantId), [tenants, tenantId]);
  const activeCompany = tenantId ? (tenantCompany || {}) : company;
  const tabs = superadmin ? ["tenants", ...baseTabs] : baseTabs;
  const [tab, setTab] = useState("catalog");
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
        return current; // espera confirmación del modal
      }
      return nextTab;
    });
    setSelectedProductCode("");
  }, [draftPreorder]);

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
  const selectedProduct = useMemo(() => products.find((product) => product.codigo === selectedProductCode), [products, selectedProductCode]);
  const filterOptions = useMemo(() => buildFilterOptions(products), [products]);
  const filteredProducts = useMemo(
    () => applyFilters(products, deferredProductQuery, deferredFilters, deferredQuickFilters, deferredSearchChips),
    [products, deferredProductQuery, deferredFilters, deferredQuickFilters, deferredSearchChips]
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
    () => products.filter((product) => checkedIds.has(product.codigo)),
    [products, checkedIds]
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

  const addToCart = (product, quantity = 1) => {
    if (!tenantId) {
      setStatus("Primero selecciona una empresa para crear preórdenes.");
      return;
    }
    const nextItem = buildBaseDraftItem(product, quantity);
    setDraftPreorder((current) => {
      const preorder = current || { status: "pendiente", tenant_id: tenantId, created_by: profile?.id || "", preorder_items: [] };
      const existing = preorder.preorder_items.find((item) => item.producto_codigo === product.codigo);
      const preorderItems = existing
        ? preorder.preorder_items.map((item) =>
            item.producto_codigo === product.codigo
              ? buildBaseDraftItem(product, Number(item.piezas || 0) + Number(nextItem.piezas || 0))
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

  const addToCatalogSelection = (product) => {
    setCatalogSelectionIds((current) => {
      const next = new Set(current);
      next.add(product.codigo);
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
    const selectedCount = checkedIds.size;
    setCatalogSelectionIds((current) => {
      const next = new Set(current);
      checkedIds.forEach((code) => next.add(code));
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
    <div className="admin-catalog-shell">
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
            {tabs.map((id) => (
              <button className={tab === id ? "active" : ""} key={id} type="button" onClick={() => changeTab(id)}>
                {t(tabKeys[id])}
              </button>
            ))}
          </div>
        </section>

        {tab === "catalog" && !selectedProductCode ? (
          <section className={`sidebar-section sidebar-catalog-tools ${filtersCollapsed ? "collapsed" : ""}`}>
            <div className="sidebar-tool-heading">
              <h3>Filtros</h3>
              <button className="link-button sidebar-collapse-link" type="button" onClick={() => setFiltersCollapsed((current) => !current)}>
                {filtersCollapsed ? "Mostrar" : "Ocultar"}
              </button>
            </div>
            {!filtersCollapsed ? (
              <div className="sidebar-filter-stack">
                <div className="sidebar-mini-metrics">
                  <div><span>Total</span><strong>{loadingProducts ? "..." : products.length.toLocaleString()}</strong></div>
                  <div><span>Filtrados</span><strong>{productQuery !== deferredProductQuery ? "…" : filteredProducts.length.toLocaleString()}</strong></div>
                </div>
                <AdvancedSearch
                  value={productQuery}
                  chips={searchChips}
                  products={products}
                  onChange={setProductQuery}
                  onAddChip={(chip) => {
                    addSearchChip(chip);
                    setProductQuery("");
                  }}
                  onRemoveChip={(chip) => setSearchChips((current) => current.filter((item) => item !== chip))}
                />
                <FilterPanel filters={filters} options={filterOptions} onChange={setFilters} />
                <QuickFilters
                  activeFilters={quickFilters}
                  onToggle={(id) => setQuickFilters((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                  onRemove={(id) => setQuickFilters((current) => current.filter((item) => item !== id))}
                />
                <button className="secondary-button compact-action full" type="button" onClick={clearCatalogFilters}>
                  {t("clearFilters")}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

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
          <section className="admin-workspace superadmin-workspace">
            <div className="admin-soft-panel compact-panel">
              <span className="tool-eyebrow">Control global</span>
              <h2>Empresas del sistema</h2>
              <p className="muted">
                Desde aquí creas empresas independientes. Después seleccionas una empresa activa y cargas su catálogo, clientes, precios y configuración.
              </p>

              <div className="form-grid">
                <label>
                  Nombre de empresa
                  <input
                    placeholder="Ej. Empresa"
                    value={tenantForm.name}
                    onChange={(event) => setTenantForm((current) => ({
                      ...current,
                      name: event.target.value,
                      slug: current.slug || makeTenantSlug(event.target.value),
                    }))}
                  />
                </label>
                <label>
                  Slug interno
                  <input
                    placeholder="romea"
                    value={tenantForm.slug}
                    onChange={(event) => setTenantForm((current) => ({ ...current, slug: makeTenantSlug(event.target.value) }))}
                  />
                </label>
                <label>
                  Estatus
                  <select value={tenantForm.status} onChange={(event) => setTenantForm((current) => ({ ...current, status: event.target.value }))}>
                    <option value="active">Activa</option>
                    <option value="paused">Pausada</option>
                  </select>
                </label>
              </div>

              <button className="primary-button compact-action" type="button" onClick={handleTenantSave}>
                Crear / actualizar empresa
              </button>
              {status ? <p className="status info">{status}</p> : null}
            </div>

            <div className="admin-soft-panel compact-panel">
              <h2>Empresas disponibles</h2>
              <div className="responsive-table">
                <table className="simple-admin-table">
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Slug</th>
                      <th>Estatus</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((tenant) => (
                      <tr key={tenant.id}>
                        <td><strong>{tenant.name}</strong></td>
                        <td>{tenant.slug}</td>
                        <td>{tenant.status}</td>
                        <td>
                          <button className="secondary-button compact-action" type="button" onClick={() => {
                            handleTenantChange(tenant.id);
                            setTab("catalog");
                          }}>
                            Trabajar aquí
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!tenants.length ? (
                      <tr>
                        <td colSpan="4">Aún no hay empresas. Crea una empresa primero.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "catalog" ? (
          <section className="admin-workspace">
            {!selectedProductCode ? (
              <div className="catalog-page-topbar">
                <div>
                  <span className="tool-eyebrow">Catálogo</span>
                  <h2>Catálogo administrador</h2>
                  <p>{t("showingFiltered", renderedProducts.length.toLocaleString(), filteredProducts.length.toLocaleString())}</p>
                </div>
                <div className="catalog-topbar-actions">
                  <label className="check-row catalog-select-visible">
                    <input type="checkbox" checked={allRenderedChecked} onChange={toggleRenderedChecks} />
                    Seleccionar pantalla ({renderedProducts.length.toLocaleString()})
                  </label>
                  {filteredProducts.length > renderedProducts.length ? (
                    <button className={`selection-action all-filtered ${allFilteredChecked ? "selected" : ""}`} type="button" onClick={toggleFilteredChecks}>
                      {allFilteredChecked ? "Quitar todos filtrados" : `Seleccionar todos filtrados (${filteredProducts.length.toLocaleString()})`}
                    </button>
                  ) : null}
                  <button className="selection-action catalog" type="button" onClick={addCheckedToCatalogSelection} disabled={!checkedIds.size}>
                    + Catálogo
                  </button>
                  <button className="selection-action preorder" type="button" onClick={addCheckedToPreorder} disabled={!checkedIds.size}>
                    + Pre-orden
                  </button>
                </div>
              </div>
            ) : null}
            {selectedProductCode ? (
              <ProductDetail
                product={selectedProduct}
                onBack={() => setSelectedProductCode("")}
                onAdd={addToCart}
                onRemovePreorder={removeFromPreorder}
                onAddToCatalog={addToCatalogSelection}
                onRemoveFromCatalog={removeFromCatalogSelection}
                inPreorder={addedCodes.includes(selectedProduct?.codigo)}
                inCatalogSelection={catalogSelectionIds.has(selectedProduct?.codigo)}
                onEdit={(product) => setProductModal({ open: true, product, mode: "edit" })}
                onDuplicate={(product) => setProductModal({ open: true, product, mode: "duplicate" })}
              />
            ) : filteredProducts.length ? (
              <>
              <div className="admin-product-grid">
                {renderedProducts.map((product) => (
                  <article className={`admin-product-card enabled ${addedCodes.includes(product.codigo) ? "in-preorder" : ""}`} key={product.id || product.codigo}>
                    <label className="product-select-check" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checkedIds.has(product.codigo)}
                        onChange={() => toggleProductCheck(product.codigo)}
                      />
                    </label>
                    {addedCodes.includes(product.codigo) ? <span className="preorder-added-badge">✓ En preorden</span> : null}
                    {catalogSelectionIds.has(product.codigo) ? <span className="catalog-added-badge">✓ Catálogo</span> : null}
                    <button className="admin-product-image" type="button" onClick={() => setSelectedProductCode(product.codigo)}>
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
                      <p>{[product.metal, product.kilataje, formatWeight(product.pesoPromedio)].filter(Boolean).join(" / ")}</p>
                      <span>{product.precioMinimo ? formatCurrency(product.precioMinimo, product.monedaPrecioMin) : t("priceToConfirm")} · MO {formatCurrency(product.manoObra || 0, product.monedaPrecioMin)}</span>
                    </div>
                    <div className="admin-product-actions product-action-layout">
                      <div className="product-action-admin">
                        <button className="secondary-button compact-action" type="button" onClick={() => setSelectedProductCode(product.codigo)}>
                          {t("viewDetail")}
                        </button>
                        <button className="secondary-button compact-action" type="button" onClick={() => setProductModal({ open: true, product, mode: "edit" })}>
                          {t("editProduct")}
                        </button>
                      </div>
                      <div className="product-action-client">
                        <button
                          className={`action-button preorder ${addedCodes.includes(product.codigo) ? "done" : ""}`}
                          type="button"
                          onClick={() => addToCart(product)}
                          disabled={addedCodes.includes(product.codigo)}
                        >
                          {t("addPreorderShort")}
                        </button>
                        {addedCodes.includes(product.codigo) ? (
                          <button className="action-button undo" type="button" onClick={() => removeFromPreorder(product.codigo)}>
                            {t("undo")}
                          </button>
                        ) : null}
                        <button
                          className={`action-button catalog ${catalogSelectionIds.has(product.codigo) ? "done" : ""}`}
                          type="button"
                          onClick={() => addToCatalogSelection(product)}
                          disabled={catalogSelectionIds.has(product.codigo)}
                        >
                          {t("addCatalogShort")}
                        </button>
                        {catalogSelectionIds.has(product.codigo) ? (
                          <button className="action-button undo" type="button" onClick={() => removeFromCatalogSelection(product.codigo)}>
                            {t("undo")}
                          </button>
                        ) : null}
                      </div>
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
        ) : null}

        {tab === "clients" ? (
          <section className="admin-workspace clients-workspace">
            <div className="clients-page-header">
              <div>
                <h2>Clientes</h2>
                <p>{filteredClients.length.toLocaleString()} de {(data.clients || []).length.toLocaleString()} clientes</p>
              </div>
              <button
                className="new-client-button"
                type="button"
                onClick={() => {
                  setClientForm(blankClient);
                  setIsClientFormOpen(true);
                }}
              >
                + Nuevo cliente
              </button>
            </div>

            <div className="clients-filter-card">
              <div className="client-search-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                  placeholder="Buscar por nombre, empresa, RFC, celular o email..."
                />
              </div>
              <select value={clientStatusFilter} onChange={(event) => setClientStatusFilter(event.target.value)}>
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>

            <div className="clients-table-card">
              <div className="responsive-table">
                <table className="simple-admin-table clients-directory-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>RFC</th>
                      <th>Celular</th>
                      <th>Email</th>
                      <th>Lista de precios</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.length ? filteredClients.map((client) => {
                      const assignedPriceList = data.clientPriceLists.find((item) => item.client_id === client.id);
                      const priceList = data.priceLists.find((item) => item.id === assignedPriceList?.price_list_id);
                      const initials = (client.company || client.name || "?").trim().slice(0, 1).toUpperCase();
                      return (
                        <tr key={client.id}>
                          <td>
                            <div className="client-name-cell">
                              <span>{initials}</span>
                              <strong>{client.company || client.name || "Sin nombre"}</strong>
                              {client.company && client.name ? <small>{client.name}</small> : null}
                            </div>
                          </td>
                          <td>{client.rfc || "-"}</td>
                          <td>{client.phone || "-"}</td>
                          <td>{displayContactEmail(client.email)}</td>
                          <td>{priceList?.name || "Sin lista"}</td>
                          <td><span className={`client-status-pill ${client.active === false ? "inactive" : "active"}`}>{client.active === false ? "Inactivo" : "Activo"}</span></td>
                          <td>
                            <div className="client-action-row">
                              <button
                                className="secondary-button compact-action"
                                type="button"
                                onClick={() => {
                                  setClientForm({ ...blankClient, ...client });
                                  setIsClientFormOpen(true);
                                }}
                              >
                                Editar
                              </button>
                              <button
                                className="secondary-button compact-action"
                                type="button"
                                onClick={() => setSelectedClientId(client.id)}
                              >
                                Precios
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan="7" className="empty-row">No hay clientes con esos filtros.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedClient ? (
              <div className="clients-pricing-panel">
                <div>
                  <span className="tool-eyebrow">Lista de precios</span>
                  <h3>{selectedClient.company || selectedClient.name}</h3>
                  <p>Selecciona la lista activa para este cliente.</p>
                </div>
                <div className="client-price-list-options">
                  {data.priceLists.map((priceList) => (
                    <label className="switch-row" key={priceList.id}>
                      <input
                        type="checkbox"
                        checked={isClientPriceActive(priceList.id)}
                        onChange={async (event) => {
                          const active = event.target.checked;
                          setStatus("Actualizando lista de precios...");
                          try {
                            await setClientPriceList(selectedClientId, priceList.id, active);
                            setData((current) => {
                              if (!current) return current;
                              const exists = current.clientPriceLists.some(
                                (item) => item.client_id === selectedClientId && item.price_list_id === priceList.id
                              );
                              const clientPriceLists = exists
                                ? current.clientPriceLists.map((item) =>
                                    item.client_id === selectedClientId && item.price_list_id === priceList.id
                                      ? { ...item, active }
                                      : item
                                  )
                                : [...current.clientPriceLists, { client_id: selectedClientId, price_list_id: priceList.id, active }];
                              return { ...current, clientPriceLists };
                            });
                            setStatus("Lista de precios actualizada correctamente.");
                            notifyAction("success", "Permiso actualizado", "La lista de precios del cliente quedo actualizada.");
                          } catch (error) {
                            setStatus(`Error actualizando lista: ${error.message}`);
                            notifyAction("error", "No se pudo actualizar", `Error actualizando lista: ${error.message}`);
                          }
                        }}
                      />
                      <span>{priceList.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {isClientFormOpen ? (
              <div className="client-modal-backdrop">
                <section className="client-modal">
                  <header>
                    <h2>{clientForm.id ? "Editar cliente" : "Nuevo cliente"}</h2>
                    <button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setIsClientFormOpen(false)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  </header>
                  <div className="client-modal-body">
                    <label className="wide-field">Nombre <span>*</span><input value={clientForm.name} onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })} /></label>
                    <label>RFC<input value={clientForm.rfc} onChange={(event) => setClientForm({ ...clientForm, rfc: event.target.value })} /></label>
                    <label>Celular<input value={clientForm.phone} onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })} /></label>
                    <label className="wide-field">Empresa<input value={clientForm.company} onChange={(event) => setClientForm({ ...clientForm, company: event.target.value })} /></label>
                    <label className="wide-field">Email<input value={clientForm.email} onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })} /></label>
                    <label className="wide-field">Estado
                      <select value={clientForm.active === false ? "inactive" : "active"} onChange={(event) => setClientForm({ ...clientForm, active: event.target.value === "active" })}>
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                      </select>
                    </label>
                  </div>
                  <footer>
                    <button className="secondary-button" type="button" onClick={() => setIsClientFormOpen(false)}>Cancelar</button>
                    <button className="new-client-button" type="button" onClick={handleSaveClient} disabled={savingClient}>
                      {savingClient ? "Guardando..." : "Guardar"}
                    </button>
                  </footer>
                </section>
              </div>
            ) : null}
          </section>
        ) : null}

        {tab === "prospects" ? (
          <section className="admin-workspace clients-workspace prospects-workspace">
            <div className="clients-page-header">
              <div>
                <h2>Prospectos</h2>
                <p>{filteredProspects.length.toLocaleString()} de {(data.clients || []).filter(isProspectRecord).length.toLocaleString()} prospectos</p>
              </div>
              <button
                className="new-client-button"
                type="button"
                onClick={() => {
                  setProspectForm(blankProspect);
                  setIsProspectFormOpen(true);
                }}
              >
                + Nuevo prospecto
              </button>
            </div>

            <div className="clients-filter-card">
              <div className="client-search-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  value={prospectSearch}
                  onChange={(event) => setProspectSearch(event.target.value)}
                  placeholder="Buscar por nombre, empresa, ciudad, gafete, celular o email..."
                />
              </div>
              <select value={prospectStatusFilter} onChange={(event) => setProspectStatusFilter(event.target.value)}>
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>

            <section className="prospect-scan-card">
              <div className="prospect-scan-head">
                <div>
                  <span className="tool-eyebrow">Registro rápido de feria</span>
                  <h3>Escanear gafete</h3>
                  <p>Coloca el cursor aquí y lee el gafete. El lector enviará Enter y se guardará como prospecto.</p>
                </div>
                <label>
                  Obtenido en
                  <input value={badgeObtainedIn} onChange={(event) => setBadgeObtainedIn(event.target.value)} placeholder="JCK" />
                </label>
                <button className="secondary-button camera-scan-button" type="button" onClick={startCameraScanner}>
                  Escanear con camara
                </button>
              </div>
              <input
                className="prospect-scan-input"
                value={badgeScanInput}
                onChange={(event) => setBadgeScanInput(event.target.value)}
                onKeyDown={handleBadgeScanKeyDown}
                placeholder="Escanear gafete aquí. Ej. 9477926915224ArturoRomeroRapana JewelersPF"
                autoComplete="off"
              />
              <div className="prospect-scan-bottom">
                <textarea
                  value={badgeComment}
                  onChange={(event) => setBadgeComment(event.target.value)}
                  placeholder='Comentarios. Ej. "Enviar información de vírgenes"'
                />
                <button className="new-client-button prospect-save-button" type="button" onClick={handleSaveBadgeProspect} disabled={savingProspect}>
                  {savingProspect ? "Guardando..." : "+ Registrar prospecto"}
                </button>
              </div>
            </section>

            {cameraScannerOpen ? (
              <div className="camera-scanner-backdrop">
                <section className="camera-scanner-modal">
                  <header>
                    <div>
                      <span className="tool-eyebrow">Camara iPad</span>
                      <h2>Escanear gafete</h2>
                      <p>Permite el acceso a la camara y apunta al codigo del gafete.</p>
                    </div>
                    <button className="icon-button" type="button" aria-label="Cerrar" onClick={closeCameraScanner}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  </header>
                  <div className="camera-scanner-frame">
                    <video ref={cameraVideoRef} className="camera-scanner-video" muted playsInline autoPlay />
                    <div className="camera-scanner-guide" aria-hidden="true" />
                  </div>
                  <p className="camera-scanner-status">{cameraStatus || "Preparando camara..."}</p>
                  <footer>
                    <button className="secondary-button" type="button" onClick={closeCameraScanner}>
                      Cerrar camara
                    </button>
                  </footer>
                </section>
              </div>
            ) : null}

            <div className="clients-table-card">
              <div className="responsive-table">
                <table className="simple-admin-table clients-directory-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Ciudad</th>
                      <th>Celular</th>
                      <th>Email</th>
                      <th>Obtenido en</th>
                      <th>Comentarios</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProspects.length ? filteredProspects.map((prospect) => {
                      const initials = (prospect.company || prospect.name || "?").trim().slice(0, 1).toUpperCase();
                      return (
                        <tr key={prospect.id}>
                          <td>
                            <div className="client-name-cell">
                              <span>{initials}</span>
                              <strong>{prospect.company || prospect.name || "Sin nombre"}</strong>
                              {prospect.company && prospect.name ? <small>{prospect.name}</small> : null}
                            </div>
                          </td>
                          <td>{prospect.ciudad || "-"}</td>
                          <td>{prospect.phone || "-"}</td>
                          <td>{displayContactEmail(prospect.email)}</td>
                          <td>{prospect.obtenido_en || "JCK"}</td>
                          <td>{prospect.comentarios || "-"}</td>
                          <td><span className={`client-status-pill ${prospect.active === false ? "inactive" : "active"}`}>{prospect.active === false ? "Inactivo" : "Activo"}</span></td>
                          <td>
                            <div className="client-action-row">
                              <button
                                className="secondary-button compact-action"
                                type="button"
                                onClick={() => {
                                  setProspectForm(prospectForForm(prospect));
                                  setIsProspectFormOpen(true);
                                }}
                              >
                                Editar
                              </button>
                              <button
                                className="primary-button compact-action success-action"
                                type="button"
                                onClick={() => handleConvertProspectToClient(prospect)}
                              >
                                Convertir
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan="8" className="empty-row">No hay prospectos con esos filtros.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {isProspectFormOpen ? (
              <div className="client-modal-backdrop">
                <section className="client-modal">
                  <header>
                    <h2>{prospectForm.id ? "Editar prospecto" : "Nuevo prospecto"}</h2>
                    <button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setIsProspectFormOpen(false)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                  </header>
                  <div className="client-modal-body">
                    <label className="wide-field">Nombre <span>*</span><input value={prospectForm.name} onChange={(event) => setProspectForm({ ...prospectForm, name: event.target.value })} /></label>
                    <label>RFC / Tax ID<input value={prospectForm.rfc} onChange={(event) => setProspectForm({ ...prospectForm, rfc: event.target.value })} /></label>
                    <label>Celular<input value={prospectForm.phone} onChange={(event) => setProspectForm({ ...prospectForm, phone: event.target.value })} /></label>
                    <label className="wide-field">Empresa<input value={prospectForm.company} onChange={(event) => setProspectForm({ ...prospectForm, company: event.target.value })} /></label>
                    <label className="wide-field">Email<input value={prospectForm.email} onChange={(event) => setProspectForm({ ...prospectForm, email: event.target.value })} /></label>
                    <label>Ciudad<input value={prospectForm.ciudad || ""} onChange={(event) => setProspectForm({ ...prospectForm, ciudad: event.target.value })} /></label>
                    <label>Obtenido en<input value={prospectForm.obtenido_en || "JCK"} onChange={(event) => setProspectForm({ ...prospectForm, obtenido_en: event.target.value })} /></label>
                    <label className="wide-field">Domicilio<input value={prospectForm.domicilio || ""} onChange={(event) => setProspectForm({ ...prospectForm, domicilio: event.target.value })} placeholder="Dirección, ciudad, estado, país" /></label>
                    <label className="wide-field">Lectura de gafete<input value={prospectForm.badge_raw || ""} onChange={(event) => setProspectForm({ ...prospectForm, badge_raw: event.target.value })} /></label>
                    <label>Estado
                      <select value={prospectForm.active === false ? "inactive" : "active"} onChange={(event) => setProspectForm({ ...prospectForm, active: event.target.value === "active" })}>
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                      </select>
                    </label>
                    <label className="wide-field">Comentarios / datos del gafete
                      <textarea value={prospectForm.comentarios || ""} onChange={(event) => setProspectForm({ ...prospectForm, comentarios: event.target.value })} placeholder="Aquí podremos guardar datos leídos del gafete." />
                    </label>
                  </div>
                  <footer>
                    <button className="secondary-button" type="button" onClick={() => setIsProspectFormOpen(false)}>Cancelar</button>
                    <button className="new-client-button" type="button" onClick={handleSaveProspect} disabled={savingProspect}>
                      {savingProspect ? "Guardando..." : "Guardar prospecto"}
                    </button>
                  </footer>
                </section>
              </div>
            ) : null}
          </section>
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
          />
        ) : null}

        {tab === "company" ? (
          <CompanySettingsPanel tenantId={tenantId} />
        ) : null}

        {tab === "database" ? (
          <section className="admin-workspace database-workspace">
            <div className="database-admin-row">
              <div className="admin-soft-panel compact-panel database-admin-card">
                <span className="tool-eyebrow">{t("database")}</span>
                <h2>{language === "en" ? "Database administration" : "Administración de base de datos"}</h2>
                <p className="muted">{t("databaseOperationsHelp")}</p>
                <div className="database-action-grid">
                  <UploadExcel onFileSelected={handleExcel} icon="↑" className="database-upload-action" />
                  <ExcelTemplateButton />
                  <CatalogExportButton products={products} />
                  <button className="secondary-button compact-action database-new-product" type="button" onClick={() => setProductModal({ open: true, product: null, mode: "create" })}>
                    + {t("newProduct")}
                  </button>
                  <button className="danger-button compact-action" type="button" onClick={handleDeleteCatalog} disabled={loadingProducts || !products.length}>
                    {t("clearCatalog")}
                  </button>
                </div>
                {status ? <p className="status info">{status}</p> : null}
              </div>

              <ProductImageImportPanel
                products={data.products}
                tenantId={tenantId}
                onCompleted={load}
                onStatus={setStatus}
                onNotice={notifyAction}
              />
            </div>

            <DatabaseHealthDashboard products={data.products} language={language} loading={loadingProducts} />

            <ImportPanel onImported={load} tenantId={tenantId} />
          </section>
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
