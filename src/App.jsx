import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import ProductGrid from "./components/ProductGrid";
import ProductDetail from "./components/ProductDetail";
import CartDrawer from "./components/CartDrawer";
import ProductFormModal from "./components/ProductFormModal";
import AuthGate from "./components/AuthGate";
import AdminDashboard from "./components/AdminDashboard";
import ClientCatalogApp from "./components/ClientCatalogApp";
import QuotePage from "./pages/QuotePage";
import { LanguageProvider } from "./i18n/LanguageContext";
import { makeTranslator } from "./i18n/translations";
import { isAdminRole } from "./services/tenantUtils";
import { sampleProducts } from "./data/sampleProducts";
import { normalizeProduct, parseExcelFile, sortProducts } from "./utils/excelParser";
import { applyFilters, buildFilterOptions, emptyFilters } from "./utils/filters";
import { normalizeText } from "./utils/textNormalizer";

const storageKeys = {
  products: "catalogo-b2b-products",
  cart: "catalogo-b2b-cart",
  customer: "catalogo-b2b-customer",
  language: "catalogo-b2b-language",
};

const defaultCustomer = {
  serie: "PRE",
  numero: "",
  name: "",
  company: "",
  branch: "",
  currency: "MXN",
  seller: "",
  concept: "Preorden mayorista",
  status: "Pendiente",
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
};

const readStorage = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed : fallback;
    if (fallback && typeof fallback === "object") {
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { ...fallback, ...parsed } : fallback;
    }
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
  return true;
};

const codeFromPath = () => {
  const match = window.location.pathname.match(/\/producto\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};

const formProductToExcelRow = (product) => ({
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
  moneda_precio_min: product.monedaPrecioMin,
  foto_url: product.fotoUrl,
  foto_url_2: product.fotoUrl2,
  foto_url_3: product.fotoUrl3,
  visible_web: product.visibleWeb ? 1 : 0,
  orden_web: product.ordenWeb,
  tags_busqueda: product.tagsBusqueda,
});

export default function App() {
  const [products, setProducts] = useState(() => readStorage(storageKeys.products, sampleProducts));
  const [cartItems, setCartItems] = useState(() => readStorage(storageKeys.cart, []));
  const [customer, setCustomer] = useState(() => readStorage(storageKeys.customer, defaultCustomer));
  const [query, setQuery] = useState("");
  const [searchChips, setSearchChips] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [quickFilters, setQuickFilters] = useState([]);
  const [selectedCode, setSelectedCode] = useState(codeFromPath);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [productModal, setProductModal] = useState({ open: false, mode: "create", product: null });
  const [language, setLanguageState] = useState(() => readStorage(storageKeys.language, "es"));
  const [status, setStatus] = useState({
    type: "info",
    messageKey: "demoStatus",
  });

  const t = makeTranslator(language);
  const setLanguage = (nextLanguage) => {
    setLanguageState(nextLanguage);
    writeStorage(storageKeys.language, nextLanguage);
  };
  const statusMessage =
    status.message || (status.messageKey ? t(status.messageKey, ...(status.args || [])) : "");
  const isPublicQuoteRoute = window.location.pathname.startsWith("/cotizacion/");

  useEffect(() => {
    const onPopState = () => setSelectedCode(codeFromPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const saved = writeStorage(storageKeys.cart, cartItems);
    if (!saved) setStatus({ type: "error", messageKey: "cartStorageError" });
  }, [cartItems]);

  useEffect(() => {
    const saved = writeStorage(storageKeys.customer, customer);
    if (!saved) setStatus({ type: "error", messageKey: "customerStorageError" });
  }, [customer]);

  const filterOptions = useMemo(() => buildFilterOptions(products), [products]);
  const filteredProducts = useMemo(
    () => applyFilters(products, query, filters, quickFilters, searchChips),
    [products, query, filters, quickFilters, searchChips]
  );
  const selectedProduct = useMemo(
    () => products.find((product) => product.codigo === selectedCode),
    [products, selectedCode]
  );

  const openDetail = (code) => {
    window.history.pushState({}, "", `/producto/${encodeURIComponent(code)}`);
    setSelectedCode(code);
  };

  const backToCatalog = () => {
    window.history.pushState({}, "", "/");
    setSelectedCode("");
  };

  const addSearchChip = (chip) => {
    const trimmed = chip.trim();
    if (!trimmed) return;
    setSearchChips((current) => {
      if (current.some((item) => normalizeText(item) === normalizeText(trimmed))) return current;
      return [...current, trimmed];
    });
  };

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setStatus({ type: "info", messageKey: "readingExcel" });
      const result = await parseExcelFile(file);
      setProducts(result.products);
      setFilters(emptyFilters);
      setQuickFilters([]);
      setSearchChips([]);
      setQuery("");
      backToCatalog();

      const saved = writeStorage(storageKeys.products, result.products);
      const exclusionText = result.excludedRows ? t("excludedRows", result.excludedRows) : "";
      setStatus({
        type: saved ? "success" : "warning",
        message: saved
          ? t("excelLoaded", result.products.length, exclusionText)
          : t("excelLoadedNoStorage", result.products.length, exclusionText),
      });
    } catch (error) {
      setStatus({ type: "error", message: error.message || t("excelReadError") });
    } finally {
      event.target.value = "";
    }
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

  const updateQuantity = (code, quantity) => {
    const parsed = Math.max(1, Number(quantity || 1));
    setCartItems((current) =>
      current.map((item) => (item.product.codigo === code ? { ...item, quantity: parsed } : item))
    );
  };

  const removeFromCart = (code) => {
    setCartItems((current) => current.filter((item) => item.product.codigo !== code));
  };

  const clearCatalog = () => {
    setProducts(sampleProducts);
    localStorage.removeItem(storageKeys.products);
    backToCatalog();
    setStatus({ type: "info", messageKey: "catalogCleared" });
  };

  const saveProduct = (formProduct) => {
    const normalized = normalizeProduct(formProductToExcelRow(formProduct));
    const previousCode = productModal.product?.codigo;
    const nextProducts = sortProducts([
      ...products.filter((item) => item.codigo !== previousCode && item.codigo !== normalized.codigo),
      normalized,
    ]);
    setProducts(nextProducts);
    setCartItems((items) =>
      items.map((item) =>
        item.product.codigo === previousCode || item.product.codigo === normalized.codigo
          ? { ...item, product: normalized }
          : item
      )
    );
    writeStorage(storageKeys.products, nextProducts);
    setProductModal({ open: false, mode: "create", product: null });
    openDetail(normalized.codigo);
    setStatus({ type: "success", message: t("productSaved", normalized.codigo) });
  };

  const deleteProduct = (code) => {
    const nextProducts = products.filter((product) => product.codigo !== code);
    setProducts(nextProducts);
    setCartItems((items) => items.filter((item) => item.product.codigo !== code));
    writeStorage(storageKeys.products, nextProducts);
    setProductModal({ open: false, mode: "create", product: null });
    if (selectedCode === code) backToCatalog();
    setStatus({ type: "info", message: t("productDeleted", code) });
  };

  const toggleQuickFilter = (filterId) => {
    setQuickFilters((current) =>
      current.includes(filterId) ? current.filter((item) => item !== filterId) : [...current, filterId]
    );
  };

  const clearAllFilters = () => {
    setFilters(emptyFilters);
    setQuickFilters([]);
    setSearchChips([]);
    setQuery("");
  };

  return (
    <LanguageProvider language={language} setLanguage={setLanguage}>
    {isPublicQuoteRoute ? (
      <QuotePage />
    ) : (
    <AuthGate>
      {({ profile }) => (isAdminRole(profile?.role) ? <AdminDashboard profile={profile} /> : <ClientCatalogApp profile={profile} />)}
    </AuthGate>
    )}
    </LanguageProvider>
  );

  return (
    <LanguageProvider language={language} setLanguage={setLanguage}>
    <div className="app-shell">
      <Sidebar
        isOpen={isMenuOpen}
        status={{ ...status, message: statusMessage }}
        products={products}
        filters={filters}
        filterOptions={filterOptions}
        quickFilters={quickFilters}
        cartItems={cartItems}
        onFileSelected={handleFileSelected}
        onNewProduct={() => setProductModal({ open: true, mode: "create", product: null })}
        onClearCatalog={clearCatalog}
        onFiltersChange={setFilters}
        onQuickFilterToggle={toggleQuickFilter}
        onQuickFilterRemove={(filterId) => setQuickFilters((current) => current.filter((item) => item !== filterId))}
        onClearAllFilters={clearAllFilters}
        onOpenCart={() => setIsCartOpen(true)}
        onClose={() => setIsMenuOpen(false)}
      />

      <main className="main-content">
        <Header
          query={query}
          searchChips={searchChips}
          products={products}
          onQueryChange={setQuery}
          onAddChip={addSearchChip}
          onRemoveChip={(chip) => setSearchChips((current) => current.filter((item) => item !== chip))}
          showing={filteredProducts.length}
          total={products.length}
          onOpenMenu={() => setIsMenuOpen(true)}
          onOpenCart={() => setIsCartOpen(true)}
        />

        <div className="content-area">
          {selectedCode ? (
            <ProductDetail
              key={selectedCode}
              product={selectedProduct}
              onBack={backToCatalog}
              onAdd={addToCart}
              onEdit={(product) => setProductModal({ open: true, mode: "edit", product })}
              onDuplicate={(product) => setProductModal({ open: true, mode: "duplicate", product })}
            />
          ) : (
            <ProductGrid products={filteredProducts} onAdd={addToCart} onOpenDetail={openDetail} />
          )}
        </div>
      </main>

      <CartDrawer
        isOpen={isCartOpen}
        cartItems={cartItems}
        customer={customer}
        onCustomerChange={setCustomer}
        onQuantityChange={updateQuantity}
        onRemove={removeFromCart}
        onClear={() => setCartItems([])}
        onClose={() => setIsCartOpen(false)}
        onOpen={() => setIsCartOpen(true)}
      />

      {productModal.open ? (
        <ProductFormModal
          mode={productModal.mode}
          product={productModal.product}
          products={products}
          onSave={saveProduct}
          onDelete={deleteProduct}
          onClose={() => setProductModal({ open: false, mode: "create", product: null })}
        />
      ) : null}
    </div>
    </LanguageProvider>
  );
}
