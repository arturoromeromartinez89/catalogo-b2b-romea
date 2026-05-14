import { useEffect, useMemo, useState } from "react";
import AdvancedSearch from "./AdvancedSearch";
import BrandLogo from "./BrandLogo";
import ImportPanel from "./ImportPanel";
import CompanySettingsPanel from "./CompanySettingsPanel";
import PricingPanel from "./PricingPanel";
import PreorderList from "./PreorderList";
import { useCompany } from "../contexts/CompanyContext";
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
  fetchAdminData,
  saveClient,
  savePriceItem,
  savePriceList,
  setClientPriceList,
  upsertProducts,
} from "../services/supabaseCatalog";
import { normalizeProduct, parseExcelFile } from "../utils/excelParser";
import { applyFilters, buildFilterOptions, emptyFilters } from "../utils/filters";
import { buildPlaceholderUrl, formatCurrency, formatWeight, shortText } from "../utils/formatters";
import { normalizeText } from "../utils/textNormalizer";

const blankClient = { name: "", company: "", email: "", phone: "", rfc: "", active: true };
const blankPriceList = { name: "", currency: "MXN", active: true };
const blankPriceItem = { metal: "", kilataje: "", price_per_gram: 0, labor_markup: 0 };
const PRODUCT_RENDER_BATCH = 120;
const tabs = ["catalog", "preorders", "clients", "prices", "company"];
const tabKeys = {
  catalog: "catalog",
  preorders: "preorders",
  clients: "clients",
  prices: "priceMenu",
  company: "company",
};
const titleKeys = {
  catalog: "adminCatalog",
  preorders: "preorders",
  clients: "clients",
  prices: "priceMenu",
  company: "company",
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

export default function AdminDashboard({ profile }) {
  const { t, language } = useLanguage();
  const company = useCompany();
  const tenantId = profile?.tenant_id || profile?.tenantId || "";
  const [tab, setTab] = useState("catalog");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productModal, setProductModal] = useState({ open: false, product: null, mode: "create" });
  const [clientForm, setClientForm] = useState(blankClient);
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

  const load = async () => {
    setLoadingProducts(true);
    setStatus("Cargando catálogo...");
    try {
      const nextData = await fetchAdminData(profile);
      setData(nextData);
      setSelectedPriceListId((current) => current || nextData.priceLists[0]?.id || "");
      setStatus("");
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    load().catch((error) => setStatus(error.message));
  }, []);

  const products = data?.products.length ? data.products : sampleProducts;
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
  const visibleCount = products.filter((product) => product.visibleWeb).length;

  useEffect(() => {
    setVisibleProductLimit(PRODUCT_RENDER_BATCH);
  }, [productQuery, searchChips, filters, quickFilters]);
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

  const saveProduct = async (product) => {
    await upsertProducts([normalizeProduct(formProductToRow(product))], tenantId);
    setProductModal({ open: false, product: null, mode: "create" });
    await load();
  };

  const isClientPriceActive = (priceListId) =>
    data?.clientPriceLists.some((item) => item.client_id === selectedClientId && item.price_list_id === priceListId && item.active);

  const addToCart = (product, quantity = 1) => {
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
    setStatus(`Producto ${product.codigo} agregado a la preorden en proceso.`);
  };

  const handleSaveClient = async () => {
    await saveClient(clientForm, tenantId);
    setClientForm(blankClient);
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

  if (!data) {
    return <section className="setup-screen"><div className="setup-card">{t("loadingAdmin")}</div></section>;
  }

  return (
    <div className="admin-catalog-shell">
      <aside className="admin-romea-sidebar">
        <div className="brand-block">
          <BrandLogo />
          <p>{t("b2bCatalog")}</p>
        </div>

        <section className="sidebar-section">
          <h3>{t("operation")}</h3>
          <div className="sidebar-actions admin-sidebar-actions">
            <UploadExcel onFileSelected={handleExcel} />
            <ExcelTemplateButton />
            <CatalogExportButton products={products} />
            <button className="primary-button full compact-action" type="button" onClick={() => setProductModal({ open: true, product: null, mode: "create" })}>
              {t("newProduct")}
            </button>
          </div>
          {status ? <p className="status info">{status}</p> : null}
        </section>

        <section className="sidebar-section">
          <h3>{t("productBase")}</h3>
          <div className="mini-summary">
            <div><span>{t("totalLabel")}</span><strong>{loadingProducts ? "..." : products.length.toLocaleString()}</strong></div>
            <div><span>{t("visible")}</span><strong>{loadingProducts ? "..." : visibleCount.toLocaleString()}</strong></div>
            <div><span>{t("preorder")}</span><strong>{draftPreorder?.preorder_items?.reduce((sum, item) => sum + Number(item.piezas || 0), 0) || 0}</strong></div>
            <div><span>{t("models")}</span><strong>{draftPreorder?.preorder_items?.length || 0}</strong></div>
          </div>
          {!data.products.length ? <p className="muted">{t("sampleProductsNotice")}</p> : null}
          {draftPreorder ? (
            <button className="primary-button full compact-action" type="button" onClick={() => setIsDraftOpen(true)}>
              Abrir preorden en proceso
            </button>
          ) : null}
        </section>

        <FilterPanel filters={filters} options={filterOptions} onChange={setFilters} />

        <QuickFilters
          activeFilters={quickFilters}
          onToggle={(id) => setQuickFilters((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
          onRemove={(id) => setQuickFilters((current) => current.filter((item) => item !== id))}
        />

        <button className="secondary-button full compact-action" type="button" onClick={clearCatalogFilters}>
          {t("clearFilters")}
        </button>

        <section className="sidebar-section">
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
            <p className="eyebrow">{company.brand_name || "Mi Catálogo"}</p>
            <h1>{t(titleKeys[tab])}</h1>
            <span>{t("adminSubtitle")}</span>
          </div>
          <LanguageToggle />
        </header>

        {tab === "catalog" ? (
          <section className="admin-workspace">
            <ImportPanel onImported={load} tenantId={tenantId} />
            <div className="admin-toolbar one-input">
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
            </div>

            {selectedProductCode ? (
              <ProductDetail
                product={selectedProduct}
                onBack={() => setSelectedProductCode("")}
                onAdd={addToCart}
                onEdit={(product) => setProductModal({ open: true, product, mode: "edit" })}
                onDuplicate={(product) => setProductModal({ open: true, product, mode: "duplicate" })}
              />
            ) : filteredProducts.length ? (
              <>
              <div className="admin-product-grid">
                {renderedProducts.map((product) => (
                  <article className={`admin-product-card enabled ${addedCodes.includes(product.codigo) ? "in-preorder" : ""}`} key={product.id || product.codigo}>
                    {addedCodes.includes(product.codigo) ? <span className="preorder-added-badge">✓ En preorden</span> : null}
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
                    <div className="admin-product-actions triple-action">
                      <button className="secondary-button compact-action" type="button" onClick={() => setSelectedProductCode(product.codigo)}>
                        {t("viewDetail")}
                      </button>
                      <button className="primary-button compact-action" type="button" onClick={() => addToCart(product)}>
                        {t("addToPreorder")}
                      </button>
                      <button className="secondary-button compact-action" type="button" onClick={() => setProductModal({ open: true, product, mode: "edit" })}>
                        {t("editProduct")}
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
        ) : null}

        {tab === "clients" ? (
          <section className="admin-workspace two-column-admin">
            <div className="admin-soft-panel compact-panel">
              <h2>{t("customerCreateTitle")}</h2>
              <div className="form-grid">
                <input placeholder={t("customerName")} value={clientForm.name} onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })} />
                <input placeholder={t("company")} value={clientForm.company} onChange={(event) => setClientForm({ ...clientForm, company: event.target.value })} />
                <input placeholder={t("email")} value={clientForm.email} onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })} />
                <input placeholder={t("phone")} value={clientForm.phone} onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })} />
                <input placeholder={t("rfc")} value={clientForm.rfc} onChange={(event) => setClientForm({ ...clientForm, rfc: event.target.value })} />
              </div>
              <button className="primary-button compact-action" type="button" onClick={handleSaveClient}>
                {t("saveClient")}
              </button>
              <p className="muted">{t("customerAccessNote")}</p>
            </div>

            <div className="admin-soft-panel compact-panel">
              <h2>{t("customerPricingTitle")}</h2>
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
          <PreorderList clients={data.clients} products={products} profile={profile} />
        ) : null}

        {tab === "company" ? (
          <CompanySettingsPanel tenantId={tenantId} />
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
    </div>
  );
}
