import { useEffect, useMemo, useState } from "react";
import AdvancedSearch from "./AdvancedSearch";
import BrandLogo from "./BrandLogo";
import ImportPanel from "./ImportPanel";
import CompanySettingsPanel from "./CompanySettingsPanel";
import CatalogPdfPanel from "./CatalogPdfPanel";
import PricingPanel from "./PricingPanel";
import PreorderList from "./PreorderList";
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
import PreorderEditor from "./PreorderEditor";
import QuickFilters from "./QuickFilters";
import UploadExcel from "./UploadExcel";
import { sampleProducts } from "../data/sampleProducts";
import { useLanguage } from "../i18n/LanguageContext";
import { supabase } from "../lib/supabaseClient";
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

export default function AdminDashboard({ profile, tenantOverride = "", supportMode = false }) {
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
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productModal, setProductModal] = useState({ open: false, product: null, mode: "create" });
  const [clientForm, setClientForm] = useState(blankClient);
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
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
  const visibleCount = products.filter((product) => product.visibleWeb).length;

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
      return;
    }
    await upsertProducts([normalizeProduct(formProductToRow(product))], tenantId);
    setProductModal({ open: false, product: null, mode: "create" });
    await load();
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
      return;
    }
    await saveClient(clientForm, tenantId);
    setClientForm(blankClient);
    setIsClientFormOpen(false);
    await load();
    window.alert("Cliente creado. Ahora revisa el menu de precios para confirmar labor por linea y plata fina antes de cotizar.");
    setTab("prices");
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
      return;
    }
    setCatalogSelectionIds((current) => {
      const next = new Set(current);
      checkedIds.forEach((code) => next.add(code));
      return next;
    });
    setCheckedIds(new Set());
    setSelectionDrawerOpen(true);
    setLastActionMessage(`${checkedIds.size.toLocaleString()} productos agregados a catálogo.`);
  };

  const addCheckedToPreorder = () => {
    if (!checkedProducts.length) {
      setLastActionMessage("Marca productos primero.");
      return;
    }
    checkedProducts.forEach((product) => addToCart(product));
    setCheckedIds(new Set());
    setSelectionDrawerOpen(true);
    setLastActionMessage(`${checkedProducts.length.toLocaleString()} productos agregados a pre-orden.`);
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

        <button className="secondary-button full compact-action" type="button" onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }}>
          {t("logout")}
        </button>
      </aside>

      <main className="admin-catalog-main">
        <header className="admin-catalog-header">
          <div>
            <p className="eyebrow">{t("admin")}</p>
            <h1>{t(titleKeys[tab])}</h1>
            <span>
              {superadmin && activeTenant ? `Empresa activa: ${activeTenant.name} · ` : ""}
              {t("adminSubtitle")}
            </span>
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

        {tab === "catalog" && !selectedProductCode ? (
          <div className={`catalog-control-panel ${filtersCollapsed ? "collapsed" : ""}`}>
            <div className="catalog-control-heading">
              <div>
                <span className="tool-eyebrow">{t("catalogControls")}</span>
                <h2>{t("searchAndFilter")}</h2>
                <p>{t("catalogControlsHelp")}</p>
              </div>
              <div className="catalog-control-actions">
                <button className="secondary-button compact-action" type="button" onClick={clearCatalogFilters}>
                  {t("clearFilters")}
                </button>
                <button className="secondary-button compact-action filter-collapse-button" type="button" onClick={() => setFiltersCollapsed((current) => !current)}>
                  {filtersCollapsed ? t("showFilters") : t("hideFilters")}
                </button>
              </div>
            </div>

            {!filtersCollapsed ? (
              <div className="catalog-control-body">
                <div className="catalog-metric-row">
                  <div><span>{t("totalLabel")}</span><strong>{loadingProducts ? "..." : products.length.toLocaleString()}</strong></div>
                  <div><span>{t("visible")}</span><strong>{loadingProducts ? "..." : visibleCount.toLocaleString()}</strong></div>
                  <div><span>{t("filtered")}</span><strong>{filteredProducts.length.toLocaleString()}</strong></div>
                  <div><span>{t("marked")}</span><strong>{checkedIds.size.toLocaleString()}</strong></div>
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

                <div className="catalog-filter-board">
                  <FilterPanel filters={filters} options={filterOptions} onChange={setFilters} />
                  <QuickFilters
                    activeFilters={quickFilters}
                    onToggle={(id) => setQuickFilters((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
                    onRemove={(id) => setQuickFilters((current) => current.filter((item) => item !== id))}
                  />
                </div>

                <div className="catalog-selection-tools">
                  <label className="check-row">
                    <input type="checkbox" checked={allRenderedChecked} onChange={toggleRenderedChecks} />
                    {t("selectVisibleProducts")} ({renderedProducts.length.toLocaleString()})
                  </label>
                  <button className="selection-action catalog" type="button" onClick={addCheckedToCatalogSelection} disabled={!checkedIds.size}>
                    {t("addMarkedToCatalog")}
                  </button>
                  <button className="selection-action preorder" type="button" onClick={addCheckedToPreorder} disabled={!checkedIds.size}>
                    {t("addMarkedToPreorder")}
                  </button>
                  <span>{t("showingFiltered", renderedProducts.length.toLocaleString(), filteredProducts.length.toLocaleString())}</span>
                </div>

                {status ? <p className="status info">{status}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "catalog" ? (
          <section className="admin-workspace">
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
            <div className="admin-soft-panel compact-panel client-command-panel">
              <div>
                <span className="tool-eyebrow">Clientes mayoristas</span>
                <h2>Registro y permisos de cliente</h2>
                <p className="muted">Da de alta el cliente, confirma su correo de acceso y asígnale lista de precios por línea.</p>
              </div>
              <button className="new-client-button" type="button" onClick={() => setIsClientFormOpen((current) => !current)}>
                + Nuevo cliente
              </button>
            </div>

            {isClientFormOpen ? (
            <div className="admin-soft-panel compact-panel client-form-panel">
              <div className="section-title-row">
                <h2>{t("customerCreateTitle")}</h2>
                <span>Campos principales para activar acceso comercial.</span>
              </div>
              <div className="client-form-sections">
                <section>
                  <h3>Identificación</h3>
                  <div className="form-grid">
                    <label>Nombre del contacto<input placeholder="Ej. Arturo Romero" value={clientForm.name} onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })} /></label>
                    <label>Empresa<input placeholder="Ej. Comercial ABC" value={clientForm.company} onChange={(event) => setClientForm({ ...clientForm, company: event.target.value })} /></label>
                    <label>RFC / Tax ID<input placeholder="RFC o Tax ID" value={clientForm.rfc} onChange={(event) => setClientForm({ ...clientForm, rfc: event.target.value })} /></label>
                  </div>
                </section>
                <section>
                  <h3>Acceso y contacto</h3>
                  <div className="form-grid">
                    <label>Correo de acceso<input placeholder="cliente@empresa.com" value={clientForm.email} onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })} /></label>
                    <label>Teléfono<input placeholder="+52..." value={clientForm.phone} onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })} /></label>
                    <label className="switch-row client-active-switch">
                      <input type="checkbox" checked={clientForm.active} onChange={(event) => setClientForm({ ...clientForm, active: event.target.checked })} />
                      <span>Cliente activo</span>
                    </label>
                  </div>
                </section>
              </div>
              <div className="client-form-actions">
                <button className="secondary-button compact-action" type="button" onClick={() => setIsClientFormOpen(false)}>Cancelar</button>
                <button className="new-client-button" type="button" onClick={handleSaveClient}>
                  Guardar cliente
                </button>
              </div>
              <p className="muted">{t("customerAccessNote")}</p>
            </div>
            ) : null}

            <div className="admin-soft-panel compact-panel">
              <h2>{t("customerPricingTitle")}</h2>
              <p className="muted">Selecciona un cliente existente para confirmar qué lista de precios tendrá activa.</p>
              <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
                <option value="">{t("selectClient")}</option>
                {data.clients.map((client) => <option key={client.id} value={client.id}>{client.company || client.name} - {client.email}</option>)}
              </select>
              {selectedClient ? (
                <div className="permission-grid single-permission">
                  <div>
                    <h3>{t("priceMenu")}</h3>
                    {data.priceLists.map((priceList) => (
                      <label className="switch-row" key={priceList.id}>
                        <input type="checkbox" checked={isClientPriceActive(priceList.id)} onChange={async (event) => { await setClientPriceList(selectedClientId, priceList.id, event.target.checked); await load(); }} />
                        <span>{priceList.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : <p className="muted">{t("selectClientForPricing")}</p>}
            </div>
          </section>
        ) : null}

        {tab === "prices" ? (
          <PricingPanel clients={data.clients} products={products} tenantId={tenantId} profile={profile} />
        ) : null}
        {tab === "preorders" ? (
          <PreorderList clients={data.clients} products={products} profile={profile} tenantId={tenantId} />
        ) : null}

        {tab === "company" ? (
          <CompanySettingsPanel tenantId={tenantId} />
        ) : null}

        {tab === "database" ? (
          <section className="admin-workspace database-workspace">
            <div className="admin-soft-panel compact-panel">
              <span className="tool-eyebrow">{t("database")}</span>
              <h2>{t("databaseOperations")}</h2>
              <p className="muted">{t("databaseOperationsHelp")}</p>
              <div className="database-action-grid">
                <UploadExcel onFileSelected={handleExcel} />
                <ExcelTemplateButton />
                <CatalogExportButton products={products} />
                <button className="primary-button compact-action" type="button" onClick={() => setProductModal({ open: true, product: null, mode: "create" })}>
                  {t("newProduct")}
                </button>
                <button className="danger-button compact-action" type="button" onClick={handleDeleteCatalog} disabled={loadingProducts || !products.length}>
                  {t("clearCatalog")}
                </button>
              </div>
              {status ? <p className="status info">{status}</p> : null}
            </div>

            <div className="admin-soft-panel compact-panel">
              <h2>{t("productBase")}</h2>
              <div className="catalog-metric-row database-metrics">
                <div><span>{t("totalLabel")}</span><strong>{loadingProducts ? "..." : products.length.toLocaleString()}</strong></div>
                <div><span>{t("visible")}</span><strong>{loadingProducts ? "..." : visibleCount.toLocaleString()}</strong></div>
                <div><span>{t("preorder")}</span><strong>{draftPreorder?.preorder_items?.reduce((sum, item) => sum + Number(item.piezas || 0), 0) || 0}</strong></div>
                <div><span>{t("models")}</span><strong>{draftPreorder?.preorder_items?.length || 0}</strong></div>
              </div>
              {!data.products.length ? <p className="muted">{t("sampleProductsNotice")}</p> : null}
              {draftPreorder ? (
                <button className="primary-button compact-action" type="button" onClick={() => setIsDraftOpen(true)}>
                  Abrir preorden en proceso
                </button>
              ) : null}
            </div>

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
            const product = data.products.find((item) => item.codigo === code);
            if (product) await deleteProduct(product.id);
            setProductModal({ open: false, product: null, mode: "create" });
            await load();
          }}
          onClose={() => setProductModal({ open: false, product: null, mode: "create" })}
        />
      ) : null}

      {draftPreorder && isDraftOpen ? (
        <PreorderEditor
          preorder={draftPreorder}
          clients={data.clients}
          products={products}
          tenantId={tenantId}
          profile={profile}
          onClose={(updatedDraft) => {
            if (updatedDraft) setDraftPreorder(updatedDraft);
            setIsDraftOpen(false);
          }}
          onSaved={async () => {
            setDraftPreorder(null);
            setAddedCodes([]);
            setIsDraftOpen(false);
            setTab("preorders");
            await load();
            setStatus("Preorden guardada correctamente. Puedes verla en el menú Preórdenes.");
          }}
        />
      ) : null}

      <SelectedProductsDrawer
        preorderProducts={preorderProducts}
        catalogProducts={catalogSelectionProducts}
        isOpen={selectionDrawerOpen}
        onOpen={() => setSelectionDrawerOpen(true)}
        onClose={() => setSelectionDrawerOpen(false)}
        onOpenPreorder={() => setIsDraftOpen(true)}
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
    </div>
  );
}
