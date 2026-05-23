import { useEffect, useMemo, useState } from "react";
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
import { buildPlaceholderUrl, formatCurrency, formatWeight, shortText } from "../utils/formatters";
import { normalizeText } from "../utils/textNormalizer";

const blankClient = { name: "", company: "", email: "", phone: "", rfc: "", active: true };
const blankPriceList = { name: "", currency: "MXN", active: true };
const blankPriceItem = { metal: "", kilataje: "", price_per_gram: 0, labor_markup: 0 };
const PRODUCT_RENDER_BATCH = 120;
const baseTabs = ["catalog", "preorders", "clients", "prices", "company", "database"];
const tabKeys = {
  tenants: "tenants",
  catalog: "catalog",
  preorders: "preorders",
  clients: "clients",
  prices: "priceMenu",
  company: "company",
  database: "database",
};
const titleKeys = {
  tenants: "tenants",
  catalog: "adminCatalog",
  preorders: "preorders",
  clients: "clients",
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

const productToPreorderItem = (product, quantity = 1) => {
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

export default function AdminDashboard({ profile, tenantOverride = "", supportMode = false, supportTenantName = "", onExitSupport }) {
  const { t, language } = useLanguage();
  const company = useCompany();
  const [tenantCompany, setTenantCompany] = useState(null);
  const superadmin = isSuperAdmin(profile) && !supportMode;
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState(() => localStorage.getItem("catalogo-b2b-selected-tenant") || profile?.tenant_id || profile?.tenantId || "");
  const tenantId = tenantOverride || (superadmin ? selectedTenantId : profile?.tenant_id || profile?.tenantId || "");
  const activeTenant = tenants.find((tenant) => tenant.id === tenantId);
  const activeCompany = tenantId ? (tenantCompany || {}) : company;
  const tabs = superadmin ? ["tenants", ...baseTabs] : baseTabs;
  const [tab, setTab] = useState("catalog");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("");
  const [actionNotice, setActionNotice] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productModal, setProductModal] = useState({ open: false, product: null, mode: "create" });
  const [clientForm, setClientForm] = useState(blankClient);
  const [savingClient, setSavingClient] = useState(false);
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientStatusFilter, setClientStatusFilter] = useState("all");
  const [priceListForm, setPriceListForm] = useState(blankPriceList);
  const [priceItemForm, setPriceItemForm] = useState(blankPriceItem);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedPriceListId, setSelectedPriceListId] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [searchChips, setSearchChips] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [quickFilters, setQuickFilters] = useState([]);
  const [selectedProductCode, setSelectedProductCode] = useState("");
  const [draftPreorder, setDraftPreorder] = useState(null);
  const [isDraftOpen, setIsDraftOpen] = useState(false);
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

  const notifyAction = (type, title, message) => {
    setActionNotice({ type, title, message });
    setLastActionMessage(message);
  };

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
  const selectedClient = data?.clients.find((client) => client.id === selectedClientId);
  const selectedProduct = products.find((product) => product.codigo === selectedProductCode);
  const filterOptions = useMemo(() => buildFilterOptions(products), [products]);
  const filteredProducts = useMemo(
    () => applyFilters(products, productQuery, filters, quickFilters, searchChips),
    [products, productQuery, filters, quickFilters, searchChips]
  );
  const renderedProducts = useMemo(
    () => filteredProducts.slice(0, visibleProductLimit),
    [filteredProducts, visibleProductLimit]
  );
  const filteredClients = useMemo(() => {
    const term = normalizeText(clientSearch);
    return (data?.clients || []).filter((client) => {
      const activeMatch =
        clientStatusFilter === "all" ||
        (clientStatusFilter === "active" && client.active !== false) ||
        (clientStatusFilter === "inactive" && client.active === false);
      const text = normalizeText([client.name, client.company, client.rfc, client.phone, client.email].join(" "));
      return activeMatch && (!term || text.includes(term));
    });
  }, [clientSearch, clientStatusFilter, data?.clients]);
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
  const allRenderedChecked = renderedProducts.length > 0 && renderedProducts.every((product) => checkedIds.has(product.codigo));
  const allFilteredChecked = filteredProducts.length > 0 && filteredProducts.every((product) => checkedIds.has(product.codigo));
  useEffect(() => {
    setVisibleProductLimit(PRODUCT_RENDER_BATCH);
  }, [productQuery, searchChips, filters, quickFilters]);

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
      await upsertProducts([normalizeProduct(formProductToRow(product))], tenantId);
      setProductModal({ open: false, product: null, mode: "create" });
      await load();
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
    const nextItem = productToPreorderItem(product, quantity);
    setDraftPreorder((current) => {
      const preorder = current || { status: "pendiente", tenant_id: tenantId, created_by: profile?.id || "", preorder_items: [] };
      const existing = preorder.preorder_items.find((item) => item.producto_codigo === product.codigo);
      const preorderItems = existing
        ? preorder.preorder_items.map((item) =>
            item.producto_codigo === product.codigo
              ? productToPreorderItem(product, Number(item.piezas || 0) + Number(nextItem.piezas || 0))
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
      const saved = await saveClient(clientForm, tenantId);
      setClientForm(blankClient);
      setIsClientFormOpen(false);
      await load();
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
    return <section className="setup-screen"><div className="setup-card">{t("loadingAdmin")}</div></section>;
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
              <button className={tab === id ? "active" : ""} key={id} type="button" onClick={() => {
                setTab(id);
                setSelectedProductCode("");
              }}>
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
                  <div><span>Filtrados</span><strong>{filteredProducts.length.toLocaleString()}</strong></div>
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
          <LanguageToggle />
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
                        src={product.fotoUrl || buildPlaceholderUrl(t("noPhoto"))}
                        alt={product.descripcion}
                        loading="lazy"
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
                <span aria-hidden="true">?</span>
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
                          <td>{client.email || "-"}</td>
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
                          setStatus("Actualizando lista de precios...");
                          try {
                            await setClientPriceList(selectedClientId, priceList.id, event.target.checked);
                            await load();
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
                    <button className="icon-button" type="button" onClick={() => setIsClientFormOpen(false)}>x</button>
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
            onDraftSaved={async () => {
              setDraftPreorder(null);
              setAddedCodes([]);
              setIsDraftOpen(false);
              await load();
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
              if (product) await deleteProduct(product.id);
              setProductModal({ open: false, product: null, mode: "create" });
              await load();
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
        <CatalogPdfPanel products={catalogSelectionProducts} company={activeCompany} onClose={() => setCatalogPdfOpen(false)} />
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
