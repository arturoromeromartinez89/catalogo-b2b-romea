import { useEffect, useMemo, useState } from "react";
import AdvancedSearch from "./AdvancedSearch";
import BrandLogo from "./BrandLogo";
import ImportPanel from "./ImportPanel";
import CompanySettingsPanel from "./CompanySettingsPanel";
import PricingPanel from "./PricingPanel";
import PreorderList from "./PreorderList";
import { useCompany } from "../contexts/CompanyContext";
import CatalogExportButton from "./CatalogExportButton";
import CartDrawer from "./CartDrawer";
import ExcelTemplateButton from "./ExcelTemplateButton";
import FilterPanel from "./FilterPanel";
import LanguageToggle from "./LanguageToggle";
import ProductDetail from "./ProductDetail";
import ProductFormModal from "./ProductFormModal";
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
const orderDefaults = {
  es: { concept: "Preorden mayorista", status: "Pendiente" },
  en: { concept: "Wholesale preorder", status: "Pending" },
};

const makeBlankCustomer = (language = "es") => ({
  serie: "PRE",
  numero: "",
  name: "",
  company: "",
  branch: "",
  currency: "MXN",
  tipoCambio: "",
  seller: "",
  concept: orderDefaults[language]?.concept || orderDefaults.es.concept,
  status: orderDefaults[language]?.status || orderDefaults.es.status,
  phone: "",
  email: "",
  rfc: "",
  notes: "",
  shipToName: "",
  shipToAddress: "",
  shipToCity: "",
  shipToState: "",
  shipToZip: "",
  shipToCountry: "",
  shipToContact: "",
  shipToPhone: "",
});

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

export default function AdminDashboard() {
  const { t, language } = useLanguage();
  const company = useCompany();
  const [tab, setTab] = useState("catalog");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("");
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
  const [cartItems, setCartItems] = useState([]);
  const [customer, setCustomer] = useState(() => makeBlankCustomer(language));
  const [isCartOpen, setIsCartOpen] = useState(false);

  const load = async () => {
    const nextData = await fetchAdminData();
    setData(nextData);
    setSelectedPriceListId((current) => current || nextData.priceLists[0]?.id || "");
  };

  useEffect(() => {
    load().catch((error) => setStatus(error.message));
  }, []);

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

  const products = data?.products.length ? data.products : sampleProducts;
  const selectedClient = data?.clients.find((client) => client.id === selectedClientId);
  const selectedProduct = products.find((product) => product.codigo === selectedProductCode);
  const filterOptions = useMemo(() => buildFilterOptions(products), [products]);
  const filteredProducts = useMemo(
    () => applyFilters(products, productQuery, filters, quickFilters, searchChips),
    [products, productQuery, filters, quickFilters, searchChips]
  );
  const visibleCount = products.filter((product) => product.visibleWeb).length;
  const preorderPieces = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

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
      await upsertProducts(result.products);
      await load();
      setStatus(t("catalogUploaded", result.products.length));
    } catch (error) {
      setStatus(error.message);
    } finally {
      event.target.value = "";
    }
  };

  const saveProduct = async (product) => {
    await upsertProducts([normalizeProduct(formProductToRow(product))]);
    setProductModal({ open: false, product: null, mode: "create" });
    await load();
  };

  const isClientPriceActive = (priceListId) =>
    data?.clientPriceLists.some((item) => item.client_id === selectedClientId && item.price_list_id === priceListId && item.active);

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
            <div><span>{t("totalLabel")}</span><strong>{products.length}</strong></div>
            <div><span>{t("visible")}</span><strong>{visibleCount}</strong></div>
            <div><span>{t("preorder")}</span><strong>{preorderPieces}</strong></div>
            <div><span>{t("models")}</span><strong>{cartItems.length}</strong></div>
          </div>
          {!data.products.length ? <p className="muted">{t("sampleProductsNotice")}</p> : null}
          <button className="primary-button full compact-action" type="button" onClick={() => setIsCartOpen(true)}>
            {t("openPreorder")}
          </button>
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
            <ImportPanel onImported={load} />
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
              <div className="admin-product-grid">
                {filteredProducts.map((product) => (
                  <article className="admin-product-card enabled" key={product.id || product.codigo}>
                    <button className="admin-product-image" type="button" onClick={() => setSelectedProductCode(product.codigo)}>
                      <img
                        src={product.fotoUrl || buildPlaceholderUrl(t("noPhoto"))}
                        alt={product.descripcion}
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
              <button className="primary-button compact-action" type="button" onClick={async () => { await saveClient(clientForm); setClientForm(blankClient); await load(); }}>
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
          <PricingPanel clients={data.clients} products={products} />
        ) : null}
        {tab === "preorders" ? (
          <PreorderList clients={data.clients} />
        ) : null}

        {tab === "company" ? (
          <CompanySettingsPanel />
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

      <CartDrawer
        isOpen={isCartOpen}
        cartItems={cartItems}
        customer={customer}
        onCustomerChange={setCustomer}
        onQuantityChange={(code, quantity) =>
          setCartItems((items) =>
            items.map((item) =>
              item.product.codigo === code ? { ...item, quantity: Math.max(1, Number(quantity || 1)) } : item
            )
          )
        }
        onRemove={(code) => setCartItems((items) => items.filter((item) => item.product.codigo !== code))}
        onClear={() => setCartItems([])}
        onClose={() => setIsCartOpen(false)}
        onOpen={() => setIsCartOpen(true)}
      />
    </div>
  );
}
