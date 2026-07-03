import { useEffect, useMemo, useRef, useState } from "react";
import { useCompany } from "../contexts/CompanyContext";
import { fetchCompanySettings } from "../services/companySettings";
import { fetchLines, fetchMetalPrices, calcPrecioGramo, getSilverFinePrice, fetchLaborLists, fetchLaborListLines, fetchPiecePriceLists, fetchPiecePriceListItems, roundUp2 } from "../services/pricingService";
import { fetchProductComponents, groupProductComponents } from "../services/productComponentsService";
import { saveClient } from "../services/supabaseCatalog";
import { savePreorder, deletePreorder, fetchAllPreorders } from "../services/preorderService";
import { confirmPreorderAsOrder } from "../services/salesOrderService";
import { generatePdf } from "../utils/pdfGenerator";
import { useLanguage } from "../i18n/LanguageContext";
import { buildPlaceholderUrl, imageUrlForSize, shortText } from "../utils/formatters";
import { normalizeText } from "../utils/textNormalizer";
import { buildPreorderItemFromProduct } from "../utils/preorderUtils";
import { buildConfigurableCatalogProducts, hasConfigurableCatalogProducts, isConfigurableProductGroup } from "../utils/configurableCatalog";

const STATUS = {
  pendiente: { label: "Pendiente", tone: "amber" },
  revision: { label: "En revisión", tone: "blue" },
  confirmada: { label: "Confirmada", tone: "green" },
  cancelada: { label: "Cancelada", tone: "red" },
};

const fmt = (value) =>
  Number(value || 0)
    ? `$${Number(value || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "-";

const IVA_RATE = 0.16;
const PROSPECT_CLIENT_VALUE = "__new_prospect__";
const CUSTOM_PRICE_LIST_VALUE = "__custom_price_list__";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const friendlyPreorderError = (error) => {
  const message = String(error?.message || error || "");
  if (/PRICING_MODE_NOT_ALLOWED/i.test(message)) {
    return "Esta empresa solo cotiza por pieza. Cambia la preorden a modo por pieza e intenta guardar nuevamente.";
  }
  if (/PRICING_CURRENCY_NOT_ALLOWED/i.test(message)) {
    return "Esta empresa no permite esa moneda para preordenes. Revisa la moneda seleccionada e intenta guardar nuevamente.";
  }
  return message;
};
// ---------------------------------------------------------------------------
// Tipos de pieza — selector lógico, NO es un componente con peso.
// Determina qué componentes físicos se activan (broche, diseño de placa).
// ---------------------------------------------------------------------------
const PIECE_TYPES = [
  { codigo: "CADENA",          nombre: "Cadena",                 metadata: { excluye_placa_militar: true } },
  { codigo: "PULSO",           nombre: "Pulso",                  metadata: { excluye_placa_militar: true } },
  { codigo: "ESCLAVA-MEDIO",   nombre: "Esclava placa en medio", metadata: { excluye_placa_militar: true, requiere_diseño_placa: true } },
  { codigo: "ESCLAVA-MILITAR", nombre: "Esclava placa militar",  metadata: { fuerza_placa_militar: true,  requiere_diseño_placa: true } },
];

// Mapeo de código de variante de SKU → tipo de pieza
const VARIANT_TO_PIECE_TYPE = {
  CHN: "CADENA",
  BRC: "PULSO",
  IDB: "ESCLAVA-MEDIO",
  IDL: "ESCLAVA-MILITAR",
};

// Pasos del configurador (broche, diseño_placa, largo, terminado)
// tipo_pieza es un selector aparte que activa/desactiva los demás.
const CONFIGURABLE_COMPONENT_STEPS = [
  { key: "broche",       label: "Broche",          required: true,  conditional: false },
  { key: "diseño_placa", label: "Diseño de placa",  required: false, conditional: true  },
  { key: "largo",        label: "Largo",            required: true,  conditional: false },
  { key: "terminado",    label: "Terminado",        required: true,  conditional: false },
];

// Helpers de reglas — leen metadata del tipo_pieza seleccionado
const tipoPiezaExcluyePlacaMilitar = (item) =>
  Boolean(item?._configurable_selections?.tipo_pieza?.metadata?.excluye_placa_militar);

const tipoPiezaFuerzaPlacaMilitar = (item) =>
  Boolean(item?._configurable_selections?.tipo_pieza?.metadata?.fuerza_placa_militar);

const tipoPiezaRequiereDiseñoPlaca = (item) =>
  Boolean(item?._configurable_selections?.tipo_pieza?.metadata?.requiere_diseño_placa);

const isRingSizeConfigurableItem = (item) => item?._configurable_type === "ring_size";
const PREORDER_EXCEL_COLUMNS = [
  { key: "codigo", aliases: ["codigo", "sku", "code", "modelo"] },
  { key: "cantidad", aliases: ["cantidad", "piezas", "qty", "quantity"] },
  { key: "precio", aliases: ["precio", "precio pieza", "precio_pieza", "precio unitario", "precio_unitario", "unit price", "unit_price", "price", "precio mxn", "precio usd", "precio_pieza_mxn", "precio_pieza_usd"] },
  { key: "comentarios", aliases: ["comentarios", "comentario", "notas", "nota", "observaciones"] },
];

const calcItem = (item) => {
  const piezas = Number(item.piezas || 0);
  const gPieza = Number(item.gramos_por_pieza || 0);
  const gTotal = item._gt_manual != null ? Number(item._gt_manual) : piezas * gPieza;
  if ((item.pricing_mode || "gram") === "piece") {
    const pPieza = Number(item.precio_pieza_mxn || 0);
    return { ...item, gramos_total: gTotal, subtotal_mxn: piezas * pPieza };
  }
  const pGramo = Number(item.precio_gramo_mxn || 0);
  return { ...item, gramos_total: gTotal, subtotal_mxn: gTotal * pGramo };
};

const buildConfigurablePreorderItem = (product, quantity = 1) => {
  const piezas = Math.max(1, Number(quantity || 1));
  const isRingSizeGroup = product.configurableType === "ring_size";
  // SKU base = solo el código de tejido + tamaño, ej: "CHI-10MM"
  // product.codigo puede ser "CFG-001-CHI-10MM" → quitamos el prefijo "CFG-XXX-"
  const baseCodigo = isRingSizeGroup
    ? product.configurableBaseCode || product.configurableKey || String(product.codigo || "").replace(/^RING-/, "")
    : String(product.codigo || "").replace(/^CFG-[^-]+-/, "");
  return {
    producto_codigo: product.codigo,
    producto_descripcion: product.configurableTitle || product.descripcion,
    producto_metal: product.metal,
    producto_kilataje: product.kilataje,
    producto_linea: product.linea,
    producto_foto_url: product.fotoUrl || "",
    piezas,
    gramos_por_pieza: Number(product.pesoPromedio || 0),
    gramos_total: piezas * Number(product.pesoPromedio || 0),
    labor_mxn: 0,
    precio_gramo_mxn: 0,
    subtotal_mxn: 0,
    comentarios: isRingSizeGroup ? "Pendiente de seleccionar talla" : "Pendiente de configurar tipo de pieza",
    _configurable_group: true,
    _configurable_type: product.configurableType || "components",
    _configurable_base_code: baseCodigo,
    _configurable_title: product.configurableTitle || product.descripcion,
    _configurable_base_description: product.configurableTitle || product.descripcion,
    _configurable_base_foto_url: product.fotoUrl || "",
    _configurable_base_weight: Number(product.pesoPromedio || 0),
    _configurable_selections: {},
    _configurable_variants: (product.variants || []).map((variant) => ({
      code: variant.code,
      label: variant.label,
      size: variant.size || "",
      product: variant.product,
    })),
  };
};

const isConfigurableItemComplete = (item) => {
  if (!item?._configurable_group) return true;
  if (isRingSizeConfigurableItem(item)) return Boolean(item._configurable_variant_code);
  const selections = item._configurable_selections || {};
  return CONFIGURABLE_COMPONENT_STEPS.every((step) => {
    if (step.key === "diseño_placa") {
      // Solo requerido si el tipo de pieza seleccionado exige placa
      return !tipoPiezaRequiereDiseñoPlaca(item) || selections.diseño_placa?.codigo;
    }
    return !step.required || selections[step.key]?.codigo;
  });
};

const hasUnconfiguredItems = (items = []) => items.some((item) => !isConfigurableItemComplete(item));

const hasSortOrder = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));

const orderPreorderItems = (items = []) =>
  [...items].sort((a, b) => {
    const hasA = hasSortOrder(a?.sort_order);
    const hasB = hasSortOrder(b?.sort_order);
    if (hasA && hasB) return Number(a.sort_order) - Number(b.sort_order);
    if (hasA) return -1;
    if (hasB) return 1;
    return 0;
  });

const withPreorderSortOrder = (items = []) =>
  items.map((item, index) => ({ ...item, sort_order: index }));

const componentLabel = (component) => component?.nombre || component?.label || component?.codigo || "";

const buildConfiguredDescription = (item, selections = {}) => {
  const base = item?._configurable_base_description || item?._configurable_title || item?.producto_descripcion || "";
  if (isRingSizeConfigurableItem(item)) {
    const size = selections.ring_size?.size || selections.ring_size?.label || selections.ring_size?.nombre || "";
    return [base, size ? `Talla ${String(size).replace(/^Talla\s+/i, "")}` : ""].filter(Boolean).join(" - ");
  }
  const type = componentLabel(selections.tipo_pieza);
  const broche = componentLabel(selections.broche);
  const largo = componentLabel(selections.largo);
  const terminado = componentLabel(selections.terminado);
  return [
    type ? `${type} ${base}` : base,
    broche,
    largo ? `${largo} largo` : "",
    terminado ? `terminado ${terminado}` : "",
  ].filter(Boolean).join(", ");
};

const configuredWeight = (item, selections = {}) => {
  const baseWeight = Number(item?._configurable_base_weight ?? item?.gramos_por_pieza ?? 0);
  const extras = Object.values(selections || {}).reduce((sum, component) => {
    const unit = component?.unidad || "g";
    return unit === "g" ? sum + Number(component?.peso || 0) : sum;
  }, 0);
  return roundUp2(baseWeight + extras);
};

const Field = ({ label, children }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 400, color: "var(--color-text-secondary)" }}>
    {label}
    {children}
  </label>
);

const normalizeHeader = (value) => normalizeText(String(value || "").replace(/_/g, " ")).trim();

const readFirstColumn = (row, aliases) => {
  const normalized = Object.entries(row || {}).reduce((map, [key, value]) => {
    map.set(normalizeHeader(key), value);
    return map;
  }, new Map());
  for (const alias of aliases) {
    const value = normalized.get(normalizeHeader(alias));
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
};

const parseExcelNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const cleaned = String(value)
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .trim();
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
};

const parsePreorderExcel = async (file) => {
  if (!file) return [];
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El archivo Excel no tiene hojas.");
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
  if (!rows.length) throw new Error("El Excel no tiene filas.");

  const parsed = rows.map((row) => {
    const item = {};
    PREORDER_EXCEL_COLUMNS.forEach((column) => {
      item[column.key] = readFirstColumn(row, column.aliases);
    });
    return {
      codigo: String(item.codigo || "").trim(),
      cantidad: Math.max(1, Number(String(item.cantidad || "1").replace(/,/g, "").trim()) || 1),
      precio: parseExcelNumber(item.precio),
      comentarios: String(item.comentarios || "").trim(),
    };
  }).filter((item) => item.codigo);

  if (!parsed.length) throw new Error("El Excel debe incluir al menos una columna codigo/sku.");
  return parsed;
};

const safeFilePart = (value) =>
  String(value || "borrador")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "borrador";

const downloadWorkbook = (XLSX, workbook, fileName) => {
  const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ─── Modal: importar desde preorden (solo modo remisión) ────────────────────────
function ImportarPreordenModal({ tenantId, profile, onSelect, onClose }) {
  const [preorders, setPreorders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchAllPreorders({ ...profile, tenant_id: tenantId })
      .then((data) => setPreorders((data || []).filter((p) => p.status !== "cancelada")))
      .catch(() => setPreorders([]))
      .finally(() => setLoading(false));
  }, [tenantId, profile]);

  const filtered = useMemo(() => {
    if (!search) return preorders;
    const q = normalizeText(search);
    return preorders.filter((p) =>
      normalizeText([p.folio, p.cliente_empresa, p.cliente_nombre].join(" ")).includes(q)
    );
  }, [preorders, search]);

  return (
    <div className="client-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="client-modal">
        <header>
          <h2>Importar desde preorden</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("pedAriaCerrar")}>×</button>
        </header>
        <div className="rem-modal__body">
          <input
            className="rem-search"
            style={{ marginBottom: 12 }}
            placeholder={t("pedPhBuscarFolio")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {loading ? (
            <div className="rem-loading">Cargando preórdenes...</div>
          ) : filtered.length === 0 ? (
            <div className="rem-empty">Sin preórdenes disponibles.</div>
          ) : (
            <div className="rem-table-wrap">
              <table className="rem-table">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Cliente</th>
                    <th>Fecha</th>
                    <th className="right">Gramos</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((po) => (
                    <tr key={po.id}>
                      <td><strong>{po.folio || "—"}</strong></td>
                      <td>{po.cliente_empresa || po.cliente_nombre || "—"}</td>
                      <td>{new Date(po.created_at).toLocaleDateString(language === "en" ? "en-US" : "es-MX")}</td>
                      <td className="right">{Number(po.total_gramos || 0).toFixed(2)} g</td>
                      <td>
                        <button className="primary-button compact-action" type="button" onClick={() => onSelect(po)}>
                          Importar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <footer>
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
        </footer>
      </div>
    </div>
  );
}

function PreorderEditorContent({ preorder: initial, clients, products = [], onClose, onSaved, onDirty, onCreateRemision, onOrderConfirmed, pricingLocked = false, tenantId = "", profile, configurableCatalogEnabled = false,
  // Reglas de comercio del tenant (tenant_commerce_settings). Cuando solo hay
  // un modo/moneda permitido, el selector se oculta y el valor se fuerza.
  allowedPricingModes = null,
  allowedCurrencies = null,
  // ── Modo documento ────────────────────────────────────────────────────────
  // documentType="preorden" (default) deja la Preorden 100% idéntica.
  // documentType="remision" reutiliza el mismo editor como Remisión.
  documentType = "preorden",
  statusMap = null,             // mapa de estados (default: STATUS de preorden)
  saveDocument = null,          // override de guardado: async (po, items) => { id, folio, updatedAt }
  enableImportFromPreorder = false, // muestra botón + modal "Importar preorden"
  labels = null,                // { eyebrowNew, sheetTitle, notesPlaceholder }
  defaultStatusKey = null,      // estatus por defecto al crear (si no, el 1er key)
}) {
  const { language, t } = useLanguage();
  const company = useCompany();
  const hasSavedInitialId = UUID_RE.test(String(initial?.id || ""));
  const isNew = !hasSavedInitialId;
  const resolvedTenantId = tenantId || initial?.tenant_id || initial?.tenantId || profile?.tenant_id || "";

  const isRemision = documentType === "remision";
  const commercePricingModes = Array.isArray(allowedPricingModes) && allowedPricingModes.length
    ? allowedPricingModes
    : ["gram", "piece"];
  const commerceCurrencies = Array.isArray(allowedCurrencies) && allowedCurrencies.length
    ? allowedCurrencies
    : ["MXN", "USD"];
  const singlePricingMode = commercePricingModes.length === 1 ? commercePricingModes[0] : "";
  const singleCurrency = commerceCurrencies.length === 1 ? commerceCurrencies[0] : "";
  const statusConfig = statusMap || STATUS;
  const docLabels = labels || {};
  const defaultStatus = defaultStatusKey || Object.keys(statusConfig)[0] || "pendiente";
  // Traduce las etiquetas de estatus (preorden y remisión) por su clave.
  const STATUS_LABEL_KEYS = {
    pendiente: "pedStatusPendiente", revision: "pedStatusRevision", confirmada: "pedStatusConfirmada",
    cancelada: "pedStatusCancelada", activa: "pedStatusActiva", borrador: "pedStatusBorrador",
  };
  const statusLabel = (key, fallback) => (STATUS_LABEL_KEYS[key] ? t(STATUS_LABEL_KEYS[key]) : fallback);

  const blank = {
    folio: "",
    status: defaultStatus,
    tenant_id: resolvedTenantId,
    created_by: profile?.id || "",
    client_id: "",
    cliente_nombre: "",
    cliente_empresa: "",
    cliente_email: "",
    cliente_telefono: "",
    cliente_rfc: "",
    tipo_cambio: "",
    moneda: singleCurrency || "MXN",
    notas: "",
    pricing_mode: initial?.pricing_mode || singlePricingMode || "gram",
    pf_mode: "manual",
    kitco_usd_oz: "",
    premio_pct: 0,
    aplicar_iva: false,
    mostrar_desglose: true,
  };

  const [po, setPo] = useState({ ...blank, ...(initial || {}) });
  const [items, setItems] = useState(() => withPreorderSortOrder(orderPreorderItems(initial?.preorder_items || [])));
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState(null);
  const preorderItemsScrollRef = useRef(null);
  const preorderAutoScrollRef = useRef({ frameId: null, target: null, velocity: 0 });
  const [lines, setLines] = useState([]);
  const [laborLists, setLaborLists] = useState([]);
  const [piecePriceLists, setPiecePriceLists] = useState([]);
  const [selectedLaborListId, setSelectedLaborListId] = useState(initial?.labor_list_id || "");
  const [selectedPiecePriceListId, setSelectedPiecePriceListId] = useState(initial?.piece_price_list_id || "");
  const [piecePriceItems, setPiecePriceItems] = useState([]);
  const [productComponents, setProductComponents] = useState([]);
  const [pricingDirty, setPricingDirty] = useState(false);
  const [metalPrices, setMetalPrices] = useState({});
  const [plataFinaMxn, setPlataFinaMxn] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedAt, setSavedAt] = useState(null);            // timestamp del último guardado exitoso
  const [loadedAt, setLoadedAt] = useState(() => initial?.updated_at || null); // versión que tenemos en memoria
  const [saveConflict, setSaveConflict] = useState(null);  // { dbUpdatedAt } cuando otra sesión guardó primero
  const [msg, setMsg] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productStatus, setProductStatus] = useState({ type: "info", text: t("pedStInicial") });
  const [importingPreorderExcel, setImportingPreorderExcel] = useState(false);
  const [prospectForm, setProspectForm] = useState({ name: "", company: "", email: "", phone: "", rfc: "", active: true });
  const [tenantCompany, setTenantCompany] = useState(null);
  const scannerInputRef = useRef(null);
  const bottomScannerRef = useRef(null);       // barra de búsqueda inferior (misma lógica, distinto ref)
  const activeScannerRef = useRef("top");      // "top" | "bottom" — cuál barra usó el usuario por última vez
  const [pendingDuplicate, setPendingDuplicate] = useState(null); // { product, nextItem } esperando confirmación
  const [showImportPreorder, setShowImportPreorder] = useState(false); // modal "Importar preorden" (modo remisión)
  const [showCreateRem, setShowCreateRem] = useState(false);           // confirmación "Crear remisión"
  const [showConfirmOrder, setShowConfirmOrder] = useState(false);
  const [confirmingOrder, setConfirmingOrder] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [orderConfirmForm, setOrderConfirmForm] = useState({
    anticipo_mxn: "",
    comprobante_url: "",
    terms_text: "El cliente confirma que reviso productos, cantidades, precios y condiciones de compra. La orden queda sujeta a disponibilidad, tiempos de produccion y validacion de pago.",
    terms_accepted: false,
    accepted_by_name: "",
    accepted_by_email: "",
    notas: "",
  });
  // ── Modo consulta vs edición ──────────────────────────────────────────────
  // Al abrir una nota guardada se ve en SOLO LECTURA; hay que pulsar "Editar"
  // para activarla. Una nota nueva arranca ya en edición (hay que capturarla).
  const [editMode, setEditMode] = useState(isNew);
  const editSnapshotRef = useRef(null);
  // pricingLocked = vista de cliente (siempre bloqueada, sin botón Editar).
  // adminViewOnly = admin abrió una nota y aún no activó la edición.
  const adminViewOnly = !pricingLocked && !editMode;
  const inputsLocked = pricingLocked || adminViewOnly;
  const activeCompany = resolvedTenantId ? (tenantCompany || {}) : company;
  const markEdited = () => {
    onDirty?.();
    setSaved(false);
  };

  // Entra a edición: guarda una "foto" del estado para poder cancelar.
  const enterEditMode = () => {
    editSnapshotRef.current = {
      po,
      items,
      plataFinaMxn,
      selectedLaborListId,
      selectedPiecePriceListId,
    };
    setEditMode(true);
  };
  // Cancela edición: restaura la foto y vuelve a solo lectura.
  const cancelEditMode = () => {
    const snap = editSnapshotRef.current;
    if (snap) {
      setPo(snap.po);
      setItems(snap.items);
      setPlataFinaMxn(snap.plataFinaMxn);
      setSelectedLaborListId(snap.selectedLaborListId);
      setSelectedPiecePriceListId(snap.selectedPiecePriceListId);
    }
    editSnapshotRef.current = null;
    setMsg("");
    setEditMode(false);
  };

  const stopPreorderAutoScroll = () => {
    const frameId = preorderAutoScrollRef.current.frameId;
    if (frameId) window.cancelAnimationFrame(frameId);
    preorderAutoScrollRef.current = { frameId: null, target: null, velocity: 0 };
  };

  const getPreorderScrollTarget = () => {
    let node = preorderItemsScrollRef.current?.parentElement || null;
    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);
      const canScrollY = /auto|scroll|overlay/i.test(style.overflowY);
      if (canScrollY && node.scrollHeight > node.clientHeight + 2) return node;
      node = node.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  };

  const tickPreorderAutoScroll = () => {
    const { target, velocity } = preorderAutoScrollRef.current;
    if (target && Math.abs(velocity) > 0.2) target.scrollTop += velocity;
    preorderAutoScrollRef.current.frameId = window.requestAnimationFrame(tickPreorderAutoScroll);
  };

  const updatePreorderAutoScroll = (clientY) => {
    const target = getPreorderScrollTarget();
    const isDocumentTarget = target === document.scrollingElement || target === document.documentElement;
    const rect = isDocumentTarget
      ? { top: 0, bottom: window.innerHeight, height: window.innerHeight }
      : target.getBoundingClientRect();
    const edgeSize = Math.max(72, Math.min(128, rect.height * 0.28));
    const upperPressure = Math.max(0, Math.min(1, (edgeSize - (clientY - rect.top)) / edgeSize));
    const lowerPressure = Math.max(0, Math.min(1, (edgeSize - (rect.bottom - clientY)) / edgeSize));
    const direction = lowerPressure > upperPressure ? 1 : upperPressure > lowerPressure ? -1 : 0;
    const pressure = Math.max(upperPressure, lowerPressure);
    const velocity = direction && pressure > 0.02
      ? direction * (1.5 + 14 * Math.pow(pressure, 1.7))
      : 0;

    preorderAutoScrollRef.current.target = target;
    preorderAutoScrollRef.current.velocity = velocity;
    if (!preorderAutoScrollRef.current.frameId && velocity) {
      preorderAutoScrollRef.current.frameId = window.requestAnimationFrame(tickPreorderAutoScroll);
    }
    if (!velocity) stopPreorderAutoScroll();
  };

  useEffect(() => {
    if (resolvedTenantId) fetchCompanySettings(resolvedTenantId).then(setTenantCompany).catch(() => setTenantCompany(null));
    else setTenantCompany(null);
    fetchLines(resolvedTenantId).then(setLines).catch((error) => setMsg(t("pedMsgError", error.message)));
    fetchLaborLists(resolvedTenantId).then(setLaborLists).catch(() => setLaborLists([]));
    fetchProductComponents(resolvedTenantId).then(setProductComponents).catch(() => setProductComponents([]));
    fetchPiecePriceLists(resolvedTenantId)
      .then(setPiecePriceLists)
      .catch((error) => {
        if (/piece_price_lists|schema cache|does not exist/i.test(error.message || "")) setPiecePriceLists([]);
        else setMsg(t("pedMsgError", error.message));
      });
    fetchMetalPrices(resolvedTenantId)
      .then((prices) => {
        setMetalPrices(prices);
        setPlataFinaMxn(getSilverFinePrice(prices));
        setPo((current) => ({
          ...current,
          tipo_cambio: current.tipo_cambio || prices.tipo_cambio || "",
          kitco_usd_oz: current.kitco_usd_oz || prices.kitco_usd_oz || "",
          premio_pct: current.premio_pct ?? prices.premio_pct ?? 0,
        }));
      })
      .catch((error) => setMsg(t("pedMsgError", error.message)));
  }, [resolvedTenantId]);

  useEffect(() => {
    const client = (clients || []).find((item) => item.id === po.client_id);
    if (!client) return;
    setPo((current) => ({
      ...current,
      cliente_nombre: client.name || "",
      cliente_empresa: client.company || "",
      cliente_email: client.email || "",
      cliente_telefono: client.phone || "",
      cliente_rfc: client.rfc || "",
    }));
  }, [po.client_id, clients]);

  useEffect(() => {
    if (!pricingLocked) window.setTimeout(() => scannerInputRef.current?.focus(), 120);
  }, [pricingLocked]);

  const exchangeRate = Number(po.tipo_cambio || metalPrices.tipo_cambio || 0);
  const useUsd = po.moneda === "USD" && exchangeRate > 0;
  const moneyLabel = po.moneda === "USD" ? "USD" : "MXN";
  const pricingMode = po.pricing_mode || "gram";
  // Tenants con un solo modo/moneda no ven controles de joyeria (gramo, USD,
  // tipo de cambio). Si un documento legacy trae otro modo, se muestra igual.
  const hidePricingModeSelector = Boolean(singlePricingMode && pricingMode === singlePricingMode);
  const hideCurrencySelector = Boolean(singleCurrency && (po.moneda || "MXN") === singleCurrency);
  const hideExchangeRate = singleCurrency === "MXN" && (po.moneda || "MXN") === "MXN";
  const isPieceMode = pricingMode === "piece";

  useEffect(() => {
    const currentList = laborLists.find((list) => list.id === selectedLaborListId);
    if (!isPieceMode && currentList && (currentList.currency || "MXN") !== po.moneda) {
      setSelectedLaborListId("");
      setPo((current) => ({ ...current, labor_list_id: "" }));
      fetchLines(resolvedTenantId)
        .then((baseLines) => {
          setLines(baseLines);
          setItems((current) => current.map((item) => priceItemFromLines(item, baseLines, null, plataFinaMxn)));
        })
        .catch(() => {});
      setMsg(t("pedMsgListaRemovedMoneda", po.moneda));
    }
    const currentPieceList = piecePriceLists.find((list) => list.id === selectedPiecePriceListId);
    if (isPieceMode && currentPieceList && (currentPieceList.currency || "MXN") !== po.moneda) {
      setSelectedPiecePriceListId("");
      setPiecePriceItems([]);
      setPo((current) => ({ ...current, piece_price_list_id: "" }));
      setItems((current) => current.map((item) => calcItem({ ...item, precio_pieza_mxn: 0 })));
      setMsg(t("pedMsgListaPiezaRemovedMoneda", po.moneda));
    }
  }, [po.moneda, laborLists, selectedLaborListId, piecePriceLists, selectedPiecePriceListId, isPieceMode]);

  const compatibleLaborLists = laborLists.filter((list) => (list.currency || "MXN") === po.moneda && (list.status || "borrador") === "activa");
  const compatiblePiecePriceLists = piecePriceLists.filter((list) => (list.currency || "MXN") === po.moneda && (list.status || "borrador") === "activa");
  const toDisplayMoney = (value) => (useUsd ? Number(value || 0) / exchangeRate : Number(value || 0));
  const fromDisplayMoney = (value) => (useUsd ? Number(value || 0) * exchangeRate : Number(value || 0));
  const displayFineSilver = roundUp2(toDisplayMoney(plataFinaMxn));
  const markCustomPricing = () => {
    if (inputsLocked) return;
    setPricingDirty(true);
    if (isPieceMode) {
      setSelectedPiecePriceListId(CUSTOM_PRICE_LIST_VALUE);
      setPo((current) => ({ ...current, piece_price_list_id: "" }));
    } else {
      setSelectedLaborListId(CUSTOM_PRICE_LIST_VALUE);
      setPo((current) => ({ ...current, labor_list_id: "" }));
    }
  };
  const set = (key, options = {}) => (event) => {
    if (inputsLocked) return;
    markEdited();
    if (options.pricing) markCustomPricing();
    setPo((current) => ({ ...current, [key]: event.target.value }));
  };
  const setChecked = (key) => (event) => {
    if (inputsLocked) return;
    markEdited();
    setPo((current) => ({ ...current, [key]: event.target.checked }));
  };
  const inp = { width: "100%", boxSizing: "border-box" };
  const isProspectMode = po.client_id === PROSPECT_CLIENT_VALUE;

  const recalcWithPrice = (item, laborMxn = item.labor_mxn, silverMxn = plataFinaMxn) =>
    calcItem({ ...item, labor_mxn: Number(laborMxn || 0), precio_gramo_mxn: Number(laborMxn || 0) + Number(silverMxn || 0) });

  const pricePieceItemFromList = (item, listItems = piecePriceItems, list = null) => {
    const match = listItems.find((row) => normalizeText(row.codigo) === normalizeText(item.producto_codigo));
    if (!match) {
      return calcItem({
        ...item,
        pricing_mode: "piece",
        piece_price_list_id: list?.id || selectedPiecePriceListId || "",
        precio_pieza_mxn: Number(item.precio_pieza_mxn || 0),
        precio_gramo_mxn: 0,
        labor_mxn: 0,
      });
    }
    return calcItem({
      ...item,
      pricing_mode: "piece",
      piece_price_list_id: list?.id || selectedPiecePriceListId || "",
      precio_pieza_mxn: Number(match.unit_price_mxn || 0),
      costo_pieza_mxn: Number(match.cost_mxn || 0),
      margen_pieza_pct: Number(match.margin_pct || 0),
      precio_gramo_mxn: 0,
      labor_mxn: 0,
    });
  };

  const getListSilverMxn = (list) => {
    if (!list) return plataFinaMxn;
    const value = Number(list.plata_fina_value || 0);
    if ((list.currency || "MXN") === "USD") {
      return value * (Number(list.tipo_cambio || po.tipo_cambio || 0) || 1);
    }
    return value;
  };

  const priceItemFromLines = (item, sourceLines = lines, list = null, silverMxn = plataFinaMxn) => {
    const line = sourceLines.find((lineItem) => normalizeText(lineItem.codigo) === normalizeText(item.producto_linea));
    if (!line) return calcItem(item);

    if (list && line._priceListLine?.integrated_price) {
      const factor = (list?.currency || "MXN") === "USD"
        ? Number(list?.tipo_cambio || po.tipo_cambio || 0) || 1
        : 1;
      return calcItem({
        ...item,
        labor_mxn: Number(line._priceListLine.final_labor || 0) * factor,
        precio_gramo_mxn: Number(line._priceListLine.integrated_price || 0) * factor,
      });
    }

    const precio = calcPrecioGramo({ mo_base: line.mo_base, plata_fina_mxn: silverMxn });
    return calcItem({ ...item, labor_mxn: precio.mo_visible, precio_gramo_mxn: precio.integrado });
  };

  const setItem = (idx, key, value) => {
    if (adminViewOnly) return;
    if (pricingLocked && key !== "piezas") return;
    markEdited();
    if (key === "precio_pieza_mxn") markCustomPricing();
    setItems((current) => {
      const next = [...current];
      const updated = { ...next[idx], [key]: value };
      if (key === "piezas" || key === "gramos_por_pieza") delete updated._gt_manual;
      next[idx] = calcItem(updated);
      return next;
    });
  };

  const setGTotal = (idx, value) => {
    if (inputsLocked) return;
    markEdited();
    setItems((current) => {
      const next = [...current];
      const item = { ...next[idx], _gt_manual: value };
      item.gramos_total = Number(value || 0);
      item.subtotal_mxn = Number(value || 0) * Number(item.precio_gramo_mxn || 0);
      next[idx] = item;
      return next;
    });
  };

  const setLabor = (idx, value) => {
    if (inputsLocked) return;
    markEdited();
    markCustomPricing();
    setItems((current) => {
      const next = [...current];
      next[idx] = recalcWithPrice(next[idx], fromDisplayMoney(value), plataFinaMxn);
      return next;
    });
  };

  const setSilverFine = (value) => {
    if (inputsLocked) return;
    markEdited();
    markCustomPricing();
    const nextSilver = fromDisplayMoney(value);
    setPlataFinaMxn(nextSilver);
    setItems((current) => current.map((item) => recalcWithPrice(item, item.labor_mxn, nextSilver)));
  };

  const calculateSilverFineByKitco = () => {
    if (inputsLocked) return;
    const nextSilver = getSilverFinePrice({
      kitco_usd_oz: po.kitco_usd_oz,
      tipo_cambio: po.tipo_cambio || metalPrices.tipo_cambio,
      premio_pct: po.premio_pct || 0,
    });
    if (!nextSilver) {
      setMsg(t("pedMsgKitcoRequerido"));
      return;
    }
    setPlataFinaMxn(nextSilver);
    setItems((current) => current.map((item) => recalcWithPrice(item, item.labor_mxn, nextSilver)));
    setMsg(t("pedMsgPlataActualizada"));
    markCustomPricing();
  };

  const applyLaborList = async (listId, currentLines) => {
    markEdited();
    if (!listId || listId === CUSTOM_PRICE_LIST_VALUE) {
      // Reset to base product_lines mo_base
      const baseLines = await fetchLines(resolvedTenantId);
      setLines(baseLines);
      setSelectedLaborListId("");
      setPricingDirty(false);
      setPo((current) => ({ ...current, labor_list_id: "" }));
      setItems((current) => current.map((item) => priceItemFromLines(item, baseLines, null, plataFinaMxn)));
      setMsg(t("pedMsgLaborRemovida"));
      return;
    }
    try {
      const selectedList = laborLists.find((l) => l.id === listId);
      const listLines = await fetchLaborListLines(listId);
      const lineMap = new Map(listLines.map((l) => [l.line_codigo, Number(l.mo_base || 0)]));
      const lineDetailMap = new Map(listLines.map((l) => [l.line_codigo, l]));
      const merged = (currentLines || lines).map((line) => ({
        ...line,
        mo_base: lineMap.has(line.codigo) ? lineMap.get(line.codigo) : line.mo_base,
        _priceListLine: lineDetailMap.get(line.codigo) || null,
      }));
      setLines(merged);
      setSelectedLaborListId(listId);
      setPricingDirty(false);
      let nextSilverMxn = plataFinaMxn;
      if (selectedList) {
        const nextSilverDisplay = Number(selectedList.plata_fina_value || 0);
        nextSilverMxn = selectedList.currency === "USD"
          ? nextSilverDisplay * Number(selectedList.tipo_cambio || po.tipo_cambio || 0)
          : nextSilverDisplay;
        setPlataFinaMxn(nextSilverMxn);
        setPo((current) => ({
          ...current,
          labor_list_id: listId,
          tipo_cambio: selectedList.tipo_cambio || current.tipo_cambio,
          pf_mode: selectedList.pf_mode || current.pf_mode,
          kitco_usd_oz: selectedList.kitco_usd_oz || current.kitco_usd_oz,
          premio_pct: selectedList.premio_pct ?? current.premio_pct,
        }));
      } else {
        setPo((current) => ({ ...current, labor_list_id: listId }));
      }
      setItems((current) => current.map((item) => priceItemFromLines(item, merged, selectedList, nextSilverMxn)));
      const listName = selectedList?.name || listId;
      setMsg(t("pedMsgListaAplicada", listName));
    } catch (err) {
      setMsg(t("pedMsgListaError", err.message));
    }
  };

  const applyPiecePriceList = async (listId) => {
    markEdited();
    if (!listId || listId === CUSTOM_PRICE_LIST_VALUE) {
      setSelectedPiecePriceListId("");
      setPiecePriceItems([]);
      setPricingDirty(false);
      setPo((current) => ({ ...current, piece_price_list_id: "" }));
      setItems((current) => current.map((item) => calcItem({ ...item, pricing_mode: "piece", precio_pieza_mxn: Number(item.precio_pieza_mxn || 0) })));
      setMsg(t("pedMsgListaPiezaRemovida"));
      return;
    }
    try {
      const selectedList = piecePriceLists.find((list) => list.id === listId);
      const listItems = await fetchPiecePriceListItems(listId);
      setSelectedPiecePriceListId(listId);
      setPiecePriceItems(listItems);
      setPricingDirty(false);
      setPo((current) => ({
        ...current,
        pricing_mode: "piece",
        piece_price_list_id: listId,
        tipo_cambio: selectedList?.tipo_cambio || current.tipo_cambio,
      }));
      setItems((current) => current.map((item) => pricePieceItemFromList({ ...item, pricing_mode: "piece" }, listItems, selectedList)));
      setMsg(t("pedMsgListaPiezaAplicada", selectedList?.name || listId));
    } catch (error) {
      setMsg(t("pedMsgListaPiezaError", error.message));
    }
  };

  const changePricingMode = (mode) => {
    if (inputsLocked) return;
    markEdited();
    setPo((current) => ({
      ...current,
      pricing_mode: mode,
      labor_list_id: mode === "gram" ? current.labor_list_id : "",
      piece_price_list_id: mode === "piece" ? current.piece_price_list_id : "",
    }));
    setPricingDirty(false);
    if (mode === "gram") {
      setSelectedPiecePriceListId("");
      setPiecePriceItems([]);
      setItems((current) => current.map((item) => priceItemFromLines({ ...item, pricing_mode: "gram" }, lines, laborLists.find((entry) => entry.id === selectedLaborListId), plataFinaMxn)));
    } else {
      setSelectedLaborListId("");
      setItems((current) => current.map((item) => calcItem({ ...item, pricing_mode: "piece", precio_pieza_mxn: Number(item.precio_pieza_mxn || 0), precio_gramo_mxn: 0, labor_mxn: 0 })));
    }
  };

  useEffect(() => {
    if (selectedLaborListId === CUSTOM_PRICE_LIST_VALUE) return;
    if (!selectedLaborListId || !laborLists.length || !lines.length) return;
    if (isPieceMode) return;
    if (lines.some((line) => line._priceListLine)) return;
    applyLaborList(selectedLaborListId, lines);
  }, [selectedLaborListId, laborLists.length, lines.length]);

  useEffect(() => {
    if (!isPieceMode) return;
    if (!selectedPiecePriceListId || !piecePriceLists.length || piecePriceItems.length) return;
    applyPiecePriceList(selectedPiecePriceListId);
  }, [isPieceMode, selectedPiecePriceListId, piecePriceLists.length]);

  const precargarPrecios = () => {
    if (inputsLocked) return;
    if (!po.client_id) { setMsg(t("pedMsgSelClienteExistente")); return; }
    if (isPieceMode) {
      const selectedList = piecePriceLists.find((entry) => entry.id === selectedPiecePriceListId);
      if (!selectedList) { setMsg(t("pedMsgSelListaPiezaActiva")); return; }
      if (!piecePriceItems.length) { setMsg(t("pedMsgListaPiezaSinSku")); return; }
      setItems((current) => current.map((item) => pricePieceItemFromList(item, piecePriceItems, selectedList)));
      setPricingDirty(false);
      setMsg(t("pedMsgPreciosPiezaRecalc", selectedList.name));
      return;
    }
    if (!lines.length) { setMsg(t("pedMsgSinLineas")); return; }
    if (!plataFinaMxn) { setMsg(t("pedMsgPlataPrimero")); return; }

    const selectedList = laborLists.find((entry) => entry.id === selectedLaborListId);
    const listSilverMxn = getListSilverMxn(selectedList);
    setItems((current) => current.map((item) => priceItemFromLines(item, lines, selectedList, listSilverMxn)));
    setPricingDirty(false);
    setMsg(selectedList ? t("pedMsgPreciosRecalcLista", selectedList.name) : t("pedMsgPreciosRecalc"));
  };

  const totals = {
    piezas: items.reduce((sum, item) => sum + Number(item.piezas || 0), 0),
    gramos: items.reduce((sum, item) => sum + Number(item.gramos_total || 0), 0),
    mxn: items.reduce((sum, item) => sum + Number(item.subtotal_mxn || 0), 0),
  };
  const ivaMxn = po.aplicar_iva ? totals.mxn * IVA_RATE : 0;
  const totalFinalMxn = totals.mxn + ivaMxn;

  const preorderConfigurableEnabled = useMemo(
    () => configurableCatalogEnabled || hasConfigurableCatalogProducts(products || []),
    [configurableCatalogEnabled, products]
  );
  const preorderCatalogProducts = useMemo(
    () => preorderConfigurableEnabled ? buildConfigurableCatalogProducts(products || []) : (products || []),
    [preorderConfigurableEnabled, products]
  );
  const componentGroups = useMemo(() => groupProductComponents(productComponents), [productComponents]);

  const productResults = useMemo(() => {
    const term = normalizeText(productSearch);
    if (!term || term.length < 2) return [];
    return preorderCatalogProducts
      .filter((product) => {
        const text = product.searchText || normalizeText([product.codigo, product.descripcion, product.linea, product.familia].join(" "));
        return term.split(/\s+/).every((word) => text.includes(word));
      })
      .slice(0, 8);
  }, [productSearch, preorderCatalogProducts]);

  // Devuelve el ref del input activo (top o bottom) para mantener el foco en la barra correcta
  const getActiveScannerRef = () =>
    activeScannerRef.current === "bottom" ? bottomScannerRef : scannerInputRef;

  const addProduct = (product) => {
    const selectedList = laborLists.find((entry) => entry.id === selectedLaborListId);
    const selectedPieceList = piecePriceLists.find((entry) => entry.id === selectedPiecePriceListId);
    const rawItem = buildPreorderItemFromProduct(product, 1, lines, plataFinaMxn);
    const nextItem = isConfigurableProductGroup(product)
      ? buildConfigurablePreorderItem(product, 1)
      : isPieceMode
        ? pricePieceItemFromList({ ...rawItem, pricing_mode: "piece" }, piecePriceItems, selectedPieceList)
        : priceItemFromLines(rawItem, lines, selectedList, getListSilverMxn(selectedList));

    // ── Detección de duplicado ──────────────────────────────────────────────
    const existing = items.find((item) => item.producto_codigo === nextItem.producto_codigo);
    if (existing) {
      setPendingDuplicate({ product, nextItem });
      setProductStatus({
        type: "error",
        text: t("pedStDuplicado", product.codigo, existing.piezas),
      });
      return; // no agrega aún — espera confirmación
    }

    setItems((current) => [...current, nextItem]);
    markEdited();
    setProductSearch("");
    setPendingDuplicate(null);
    setMsg(
      isConfigurableProductGroup(product)
        ? t("pedMsgProductoAgregadoConfig", product.configurableTitle || product.descripcion)
        : t("pedMsgProductoAgregado", product.codigo)
    );
    setProductStatus({
      type: "success",
      text: isConfigurableProductGroup(product)
        ? t("pedStConfigBase")
        : t("pedStAgregadoListo", product.codigo),
    });
    // Foco vuelve a la barra que usó el usuario (no siempre la de arriba)
    window.setTimeout(() => getActiveScannerRef().current?.focus(), 80);
  };

  // Confirma agregar el producto duplicado como línea separada
  const confirmDuplicate = () => {
    if (!pendingDuplicate) return;
    const { product, nextItem } = pendingDuplicate;
    setItems((current) => [...current, nextItem]);
    markEdited();
    setProductSearch("");
    setPendingDuplicate(null);
    setProductStatus({ type: "success", text: t("pedStAgregadoDuplicado", product.codigo) });
    window.setTimeout(() => getActiveScannerRef().current?.focus(), 80);
  };

  // Cancela el duplicado — limpia sin agregar
  const cancelDuplicate = () => {
    setPendingDuplicate(null);
    setProductSearch("");
    setProductStatus({ type: "info", text: t("pedStInicial") });
    window.setTimeout(() => getActiveScannerRef().current?.focus(), 80);
  };

  const buildItemForProduct = (product, quantity = 1, comments = "", listItemsOverride = piecePriceItems, priceOverride = null) => {
    const selectedList = laborLists.find((entry) => entry.id === selectedLaborListId);
    const selectedPieceList = piecePriceLists.find((entry) => entry.id === selectedPiecePriceListId);
    const rawItem = buildPreorderItemFromProduct(product, quantity, lines, plataFinaMxn);
    let pricedItem = isPieceMode
      ? pricePieceItemFromList({ ...rawItem, pricing_mode: "piece" }, listItemsOverride, selectedPieceList)
      : priceItemFromLines(rawItem, lines, selectedList, getListSilverMxn(selectedList));
    if (isPieceMode && priceOverride !== null) {
      pricedItem = {
        ...pricedItem,
        pricing_mode: "piece",
        piece_price_list_id: "",
        precio_pieza_mxn: fromDisplayMoney(priceOverride),
        precio_gramo_mxn: 0,
        labor_mxn: 0,
      };
    }
    return calcItem({
      ...pricedItem,
      piezas: Math.max(1, Number(quantity || 1)),
      comentarios: comments || pricedItem.comentarios || "",
    });
  };

  const mergePreorderItems = (currentItems, incomingItems) => {
    const next = [...currentItems];
    incomingItems.forEach((incoming) => {
      const existingIndex = next.findIndex((item) => normalizeText(item.producto_codigo) === normalizeText(incoming.producto_codigo));
      if (existingIndex >= 0) {
        const existing = next[existingIndex];
        const comentarios = [existing.comentarios, incoming.comentarios].filter(Boolean).join(" | ");
        next[existingIndex] = calcItem({
          ...existing,
          piezas: Number(existing.piezas || 0) + Number(incoming.piezas || 0),
          comentarios,
          precio_pieza_mxn: Number(incoming.precio_pieza_mxn || 0) > 0 ? incoming.precio_pieza_mxn : existing.precio_pieza_mxn,
          precio_gramo_mxn: Number(incoming.precio_gramo_mxn || 0) > 0 ? incoming.precio_gramo_mxn : existing.precio_gramo_mxn,
          labor_mxn: Number(incoming.labor_mxn || 0) > 0 ? incoming.labor_mxn : existing.labor_mxn,
        });
      } else {
        next.push(incoming);
      }
    });
    return next;
  };

  const handlePreorderExcelImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!isPieceMode) {
      setProductStatus({ type: "error", text: t("pedStCambiaPorPieza") });
      return;
    }
    setImportingPreorderExcel(true);
    try {
      const rows = await parsePreorderExcel(file);
      const hasValidSelectedList = selectedPiecePriceListId && selectedPiecePriceListId !== CUSTOM_PRICE_LIST_VALUE;
      const activePieceItems = hasValidSelectedList
        ? (piecePriceItems.length ? piecePriceItems : await fetchPiecePriceListItems(selectedPiecePriceListId))
        : [];
      if (hasValidSelectedList && !piecePriceItems.length) setPiecePriceItems(activePieceItems);
      const productByCode = new Map(products.map((product) => [normalizeText(product.codigo), product]));
      const found = [];
      const missing = [];
      let rowsWithExcelPrice = 0;
      let rowsWithoutPrice = 0;

      rows.forEach((row) => {
        const product = productByCode.get(normalizeText(row.codigo));
        if (!product) {
          missing.push(row.codigo);
          return;
        }
        if (row.precio !== null) rowsWithExcelPrice += 1;
        else rowsWithoutPrice += 1;
        found.push(buildItemForProduct(product, row.cantidad, row.comentarios, activePieceItems, row.precio));
      });

      if (!found.length) {
        setProductStatus({ type: "error", text: t("pedStSinSkuExcel") });
        return;
      }

      setItems((current) => mergePreorderItems(current, found));
      if (rowsWithExcelPrice) {
        setSelectedPiecePriceListId(CUSTOM_PRICE_LIST_VALUE);
        setPo((current) => ({ ...current, piece_price_list_id: "" }));
        setPricingDirty(true);
      }
      markEdited();
      setProductStatus({
        type: missing.length ? "info" : "success",
        text: `${t("pedStSkusBase", found.length)}${rowsWithExcelPrice ? t("pedStPrecioExcel") : hasValidSelectedList ? t("pedStPrecioLista") : ""}${rowsWithoutPrice && !hasValidSelectedList ? t("pedStSinPrecio", rowsWithoutPrice) : ""}${missing.length ? t("pedStNoEncontrados", `${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "..." : ""}`) : ""}`,
      });
      setMsg(rowsWithExcelPrice
        ? t("pedMsgProductosImportadosExcelPrecios", found.length)
        : t("pedMsgProductosImportadosPorPieza", found.length)
      );
    } catch (error) {
      setProductStatus({ type: "error", text: t("pedStExcelError", error.message) });
    } finally {
      setImportingPreorderExcel(false);
      window.setTimeout(() => scannerInputRef.current?.focus(), 80);
    }
  };

  const getConfigurableOptions = (item, componentType) => {
    if (componentType === "ring_size") {
      return (item._configurable_variants || []).map((variant) => ({
        codigo: variant.code,
        nombre: variant.label,
        label: variant.label,
        size: variant.size || String(variant.label || "").replace(/^Talla\s+/i, ""),
        product: variant.product,
      }));
    }

    // tipo_pieza: usa lista fija (selector lógico, no un componente con peso)
    if (componentType === "tipo_pieza") {
      return PIECE_TYPES;
    }

    // broche: filtrar según tipo_pieza seleccionado
    if (componentType === "broche") {
      const allBroches = componentGroups.broche || [];
      if (tipoPiezaFuerzaPlacaMilitar(item)) {
        // Esclava militar → solo broches tipo placa militar
        return allBroches.filter((b) => b.metadata?.es_placa_militar);
      }
      if (tipoPiezaExcluyePlacaMilitar(item)) {
        // Cadena / Pulso / Esclava placa en medio → sin placas militares
        return allBroches.filter((b) => !b.metadata?.es_placa_militar);
      }
      return allBroches;
    }

    // diseño_placa: solo disponible si el tipo de pieza lo requiere
    if (componentType === "diseño_placa") {
      if (!tipoPiezaRequiereDiseñoPlaca(item)) return [];
      return componentGroups["diseño_placa"] || [];
    }

    return componentGroups[componentType] || [];
  };

  const setConfigurableComponent = (idx, componentType, componentCode) => {
    const sourceItem = items[idx];
    const selected = getConfigurableOptions(sourceItem, componentType)
      .find((component) => String(component.codigo) === String(componentCode));

    setItems((current) => current.map((item, itemIdx) => {
      if (itemIdx !== idx) return item;
      const selections = { ...(item._configurable_selections || {}) };

      if (selected) selections[componentType] = selected;
      else delete selections[componentType];

      if (isRingSizeConfigurableItem(item) && componentType === "ring_size") {
        const sourceProduct = selected?.product || products.find((product) => product.codigo === selected?.codigo);
        const selectedList = laborLists.find((entry) => entry.id === selectedLaborListId);
        const selectedPieceList = piecePriceLists.find((entry) => entry.id === selectedPiecePriceListId);
        const baseItem = sourceProduct ? buildPreorderItemFromProduct(sourceProduct, item.piezas, lines, plataFinaMxn) : null;
        const pricedSource = baseItem
          ? (isPieceMode
              ? pricePieceItemFromList({ ...baseItem, pricing_mode: "piece" }, piecePriceItems, selectedPieceList)
              : priceItemFromLines(baseItem, lines, selectedList, getListSilverMxn(selectedList)))
          : {};
        const next = {
          ...item,
          ...pricedSource,
          _configurable_selections: selections,
          _configurable_variant_code: sourceProduct?.codigo || selected?.codigo || "",
          producto_codigo: sourceProduct?.codigo || selected?.codigo || item.producto_codigo,
          producto_descripcion: buildConfiguredDescription(item, selections),
          producto_foto_url: sourceProduct?.fotoUrl || item.producto_foto_url,
          producto_metal: sourceProduct?.metal || item.producto_metal,
          producto_kilataje: sourceProduct?.kilataje || item.producto_kilataje,
          producto_linea: sourceProduct?.linea || item.producto_linea,
          _configurable_base_weight: Number(sourceProduct?.pesoPromedio || item._configurable_base_weight || item.gramos_por_pieza || 0),
          comentarios: selected ? "" : "Pendiente de seleccionar talla",
        };
        return calcItem({
          ...next,
          gramos_por_pieza: Number(sourceProduct?.pesoPromedio || next.gramos_por_pieza || 0),
          _gt_manual: null,
        });
      }

      // Cuando cambia tipo_pieza → limpiar broche y diseño_placa dependientes
      if (componentType === "tipo_pieza") {
        delete selections.broche;
        delete selections["diseño_placa"];

        // Esclava militar → auto-seleccionar la placa militar si solo hay una opción
        if (selected?.metadata?.fuerza_placa_militar) {
          const placaOptions = (componentGroups.broche || []).filter((b) => b.metadata?.es_placa_militar);
          if (placaOptions.length === 1) selections.broche = placaOptions[0];
        }
      }

      // Cuando cambia broche → limpiar diseño_placa si cambia la compatibilidad
      if (componentType === "broche") {
        delete selections["diseño_placa"];
      }

      const sourceProduct = componentType === "tipo_pieza" ? selected?.product : null;
      const next = {
        ...item,
        _configurable_selections: selections,
        producto_descripcion: buildConfiguredDescription(item, selections),
      };
      const commentIsSystemGenerated = /pendiente de configurar/i.test(String(item.comentarios || ""));
      if (commentIsSystemGenerated) {
        next.comentarios = isConfigurableItemComplete({ ...item, _configurable_selections: selections })
          ? ""
          : "Pendiente de configurar componentes";
      }

      if (sourceProduct) {
        next.producto_foto_url = sourceProduct.fotoUrl || item.producto_foto_url;
        next.producto_metal = sourceProduct.metal || item.producto_metal;
        next.producto_kilataje = sourceProduct.kilataje || item.producto_kilataje;
        next.producto_linea = sourceProduct.linea || item.producto_linea;
        next._configurable_variant_code = sourceProduct.codigo;
        next._configurable_base_weight = Number(sourceProduct.pesoPromedio || item._configurable_base_weight || item.gramos_por_pieza || 0);
      }

      const weight = configuredWeight(next, selections);
      return calcItem({
        ...next,
        gramos_por_pieza: weight,
        _gt_manual: null,
      });
    }));
    markEdited();
    setProductStatus({ type: "success", text: t("pedStConfigActualizada") });
  };

  const findProductByScan = (code) => {
    const scanned = normalizeText(code);
    if (!scanned) return null;
    return preorderCatalogProducts.find((product) => {
      const candidates = [
        product.codigo,
        product.modelo,
        product.claveVenta,
        product.clave_venta,
        product.id,
      ].filter(Boolean);
      return candidates.some((value) => normalizeText(String(value)) === scanned);
    });
  };

  const handleProductEntrySubmit = () => {
    const code = productSearch.trim();
    if (!code) {
      setProductStatus({ type: "error", text: t("pedStEscaneaPrimero") });
      getActiveScannerRef().current?.focus();
      return;
    }
    const product = findProductByScan(code);
    if (!product) {
      setProductStatus({ type: "error", text: t("pedStSinCodigoExacto", code) });
      window.setTimeout(() => getActiveScannerRef().current?.focus(), 80);
      return;
    }
    addProduct(product);
  };

  const canDragPreorderItems = !inputsLocked && items.length > 1;

  useEffect(() => {
    if (draggedItemIndex === null || !canDragPreorderItems) {
      stopPreorderAutoScroll();
      return undefined;
    }
    const handleWindowDragOver = (event) => {
      updatePreorderAutoScroll(event.clientY);
    };
    window.addEventListener("dragover", handleWindowDragOver);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      stopPreorderAutoScroll();
    };
  }, [draggedItemIndex, canDragPreorderItems]);

  const movePreorderItem = (fromIndex, toIndex) => {
    if (pricingLocked || fromIndex === null || toIndex === null || fromIndex === toIndex) return;
    markEdited();
    setItems((current) => {
      if (!current[fromIndex] || !current[toIndex]) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return withPreorderSortOrder(next);
    });
  };

  const removePreorderItem = (idx) => {
    markEdited();
    setItems((current) => withPreorderSortOrder(current.filter((_, itemIndex) => itemIndex !== idx)));
  };

  const startPreorderItemDrag = (event, idx) => {
    if (!canDragPreorderItems) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(idx));
    setDraggedItemIndex(idx);
    setDragOverItemIndex(null);
  };

  const handlePreorderItemDragOver = (event, idx) => {
    if (!canDragPreorderItems || draggedItemIndex === null) return;
    updatePreorderAutoScroll(event.clientY);
    if (draggedItemIndex === idx) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverItemIndex(idx);
  };

  const handlePreorderTableDragOver = (event) => {
    if (!canDragPreorderItems || draggedItemIndex === null) return;
    updatePreorderAutoScroll(event.clientY);
  };

  const handlePreorderItemDrop = (event, idx) => {
    if (!canDragPreorderItems) return;
    event.preventDefault();
    const fromData = Number(event.dataTransfer.getData("text/plain"));
    const fromIndex = Number.isFinite(fromData) ? fromData : draggedItemIndex;
    movePreorderItem(fromIndex, idx);
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  const endPreorderItemDrag = () => {
    stopPreorderAutoScroll();
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  const preorderRowDragClass = (idx) =>
    [
      "preorder-item-row",
      draggedItemIndex === idx ? "is-dragging" : "",
      dragOverItemIndex === idx ? "is-drop-target" : "",
    ].filter(Boolean).join(" ");

  const adjustQuantity = (idx, delta) => {
    markEdited();
    setItems((current) => {
      const next = [...current];
      const item = { ...next[idx], piezas: Math.max(1, Number(next[idx]?.piezas || 1) + delta) };
      delete item._gt_manual;
      next[idx] = calcItem(item);
      return next;
    });
  };

  const handleClientSelect = (event) => {
    if (inputsLocked) return;
    const value = event.target.value;
    setPo((current) => ({
      ...current,
      client_id: value,
      ...(value === PROSPECT_CLIENT_VALUE
        ? {
            cliente_nombre: prospectForm.name,
            cliente_empresa: prospectForm.company,
            cliente_email: prospectForm.email,
            cliente_telefono: prospectForm.phone,
            cliente_rfc: prospectForm.rfc,
          }
        : {}),
    }));
    markEdited();
  };

  const updateProspect = (key, value) => {
    setProspectForm((current) => ({ ...current, [key]: value }));
    setPo((current) => current.client_id === PROSPECT_CLIENT_VALUE
      ? {
          ...current,
          cliente_nombre: key === "name" ? value : current.cliente_nombre,
          cliente_empresa: key === "company" ? value : current.cliente_empresa,
          cliente_email: key === "email" ? value : current.cliente_email,
          cliente_telefono: key === "phone" ? value : current.cliente_telefono,
          cliente_rfc: key === "rfc" ? value : current.cliente_rfc,
        }
      : current
    );
  };

  const resolveClientForSave = async () => {
    if (po.client_id && po.client_id !== PROSPECT_CLIENT_VALUE) return po.client_id;
    if (!isProspectMode) return "";
    if (!prospectForm.name.trim() && !prospectForm.company.trim()) {
      throw new Error("Captura nombre o empresa del prospecto.");
    }
    if (!prospectForm.email.trim() && !prospectForm.phone.trim()) {
      throw new Error("Captura correo o telefono del prospecto.");
    }
    const savedClient = await saveClient(prospectForm, resolvedTenantId);
    setPo((current) => ({
      ...current,
      client_id: savedClient.id,
      cliente_nombre: savedClient.name || "",
      cliente_empresa: savedClient.company || "",
      cliente_email: savedClient.email || "",
      cliente_telefono: savedClient.phone || "",
      cliente_rfc: savedClient.rfc || "",
    }));
    setMsg(t("pedMsgProspectoCreado"));
    return savedClient.id;
  };

  const doSave = async ({ forceOverwrite = false } = {}) => {
    if (!items.length) { setMsg(t("pedMsgAgregaProductoGuardar")); return; }
    if (hasUnconfiguredItems(items)) {
      setMsg(t("pedMsgConfiguraTipoGuardar"));
      return;
    }
    setSaving(true);
    setSaved(false);
    setSaveConflict(null);
    try {
      const resolvedClientId = await resolveClientForSave();
      if (!resolvedClientId) { setMsg(t("pedMsgSelClienteProspectoGuardar")); return; }
      const payload = {
        ...po,
        pricing_mode: pricingMode,
        labor_list_id: isPieceMode ? "" : selectedLaborListId,
        piece_price_list_id: isPieceMode ? selectedPiecePriceListId : "",
        client_id: resolvedClientId,
        total_mxn: totalFinalMxn,
        tenant_id: resolvedTenantId,
        created_by: po.created_by || profile?.id || null,
      };
      const savedResult = saveDocument
        ? await saveDocument(payload, items, { expectedUpdatedAt: loadedAt, forceOverwrite })
        : await savePreorder(payload, items, { expectedUpdatedAt: loadedAt, forceOverwrite });
      const savedId     = savedResult.id;
      const savedFolio  = savedResult.folio;
      const newUpdatedAt = savedResult.updatedAt || new Date().toISOString();
      setPo((current) => ({ ...current, id: savedId, folio: savedFolio || current.folio }));
      setLoadedAt(newUpdatedAt);  // actualizamos la versión de referencia
      setSavedAt(newUpdatedAt);
      setSaved(true);
      editSnapshotRef.current = null;
      setEditMode(false); // tras guardar, vuelve a solo lectura
      const hora = new Date(newUpdatedAt).toLocaleTimeString(language === "en" ? "en-US" : "es-MX", { hour: "2-digit", minute: "2-digit" });
      setMsg(t("pedMsgGuardadaHora", hora));
      window.setTimeout(() => onSaved?.({ id: savedId, folio: savedFolio || po.folio }), 900);
    } catch (error) {
      if (error.isConflict) {
        // Otra sesión guardó esta preorden antes — avisar al usuario
        setSaveConflict({ dbUpdatedAt: error.dbUpdatedAt });
        const hora = error.dbUpdatedAt
          ? new Date(error.dbUpdatedAt).toLocaleTimeString(language === "en" ? "en-US" : "es-MX", { hour: "2-digit", minute: "2-digit" })
          : "hora desconocida";
        setMsg(t("pedMsgConflicto", hora));
      } else {
        setMsg(t("pedMsgError", friendlyPreorderError(error)));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => doSave({ forceOverwrite: false });
  const handleForceSave = () => doSave({ forceOverwrite: true });

  const handlePdf = async () => {
    if (hasUnconfiguredItems(items)) {
      setMsg(t("pedMsgConfiguraTipoPdf"));
      return;
    }
    if (!UUID_RE.test(String(po.id || ""))) {
      setMsg(t("pedMsgGuardaAntesPdf"));
      return;
    }
    if (!po.client_id) { setMsg(t("pedMsgSelClienteProspectoPdf")); return; }
    if (isProspectMode && !prospectForm.name.trim() && !prospectForm.company.trim()) {
      setMsg(t("pedMsgProspectoNombrePdf"));
      return;
    }
    const customer = {
      serie: "",
      numero: po.folio,
      name: po.cliente_nombre,
      company: po.cliente_empresa,
      email: po.cliente_email,
      phone: po.cliente_telefono,
      rfc: po.cliente_rfc,
      tipoCambio: po.tipo_cambio || metalPrices.tipo_cambio,
      currency: po.moneda,
      pricingMode,
      applyIva: false,
      showBreakdown: !isPieceMode,
      plataFinaMxn,
      notes: po.notas || "",
      pfMode: po.pf_mode,
      kitcoUsdOz: po.kitco_usd_oz,
      premiumPct: po.premio_pct,
      status: po.status,
    };
    // Galería de imágenes de un producto configurable, en orden premium:
    // 1) tejido (imagen principal)  2) broche / placa militar  3) diseño de placa.
    const componentesPdf = (item) => {
      const sel = item._configurable_selections || {};
      const isConfig = Boolean(item._configurable_group || Object.keys(sel).length);
      if (!isConfig) return [];
      const list = [];
      if (item.producto_foto_url) {
        list.push({ label: "Tejido", nombre: sel.tipo_pieza?.nombre || item._configurable_title || "", fotoUrl: item.producto_foto_url });
      }
      if (sel.broche) {
        list.push({
          label: sel.broche.metadata?.es_placa_militar ? "Placa" : "Broche",
          nombre: sel.broche.nombre || "",
          fotoUrl: sel.broche.fotoUrl || sel.broche.foto_url || "",
        });
      }
      if (sel["diseño_placa"]) {
        list.push({
          label: "Diseño",
          nombre: sel["diseño_placa"].nombre || "",
          fotoUrl: sel["diseño_placa"].fotoUrl || sel["diseño_placa"].foto_url || "",
        });
      }
      return list.filter((c) => c.fotoUrl);
    };

    const pdfItems = items.map((item) => ({
      product: {
        codigo: item.producto_codigo,
        descripcion: item.producto_descripcion,
        metal: item.producto_metal,
        kilataje: item.producto_kilataje,
        fotoUrl: item.producto_foto_url,
        pesoPromedio: item.gramos_por_pieza,
        precioMinimo: item.precio_gramo_mxn,
        quoteLaborPerGram: item.labor_mxn,
      },
      componentes: componentesPdf(item),
      quantity: item.piezas,
      gramos_total: item.gramos_total,
      comentarios: item.comentarios,
      pricing_mode: item.pricing_mode || pricingMode,
      labor_mxn: item.labor_mxn,
      plata_fina_mxn: Math.max(0, Number(item.precio_gramo_mxn || 0) - Number(item.labor_mxn || 0)),
      precio_gramo_mxn: item.precio_gramo_mxn,
      precio_pieza_mxn: item.precio_pieza_mxn,
      subtotal_mxn: item.subtotal_mxn,
    }));
    await generatePdf(pdfItems, customer, language, activeCompany, {
      showGramos: !isPieceMode,
      applyIva: false,
      showBreakdown: !isPieceMode,
      pricingMode,
      silverFineMxn: plataFinaMxn,
      pfMode: po.pf_mode,
      kitcoUsdOz: po.kitco_usd_oz,
      premiumPct: po.premio_pct,
      status: po.status,
    });
  };

  const handleExcelDownload = async () => {
    if (!items.length) {
      setMsg(t("pedMsgAgregaProductoExcel"));
      return;
    }
    try {
      const XLSX = await import("xlsx");
      const exportRows = items.map((item, idx) => {
        const piezas = Number(item.piezas || 0);
        const gramosPorPieza = Number(item.gramos_por_pieza || 0);
        const gramosTotal = Number(item.gramos_total || 0);
        const subtotal = toDisplayMoney(item.subtotal_mxn);
        if (isPieceMode) {
          return {
            "#": idx + 1,
            codigo: item.producto_codigo || "",
            cantidad: piezas,
            descripcion: item.producto_descripcion || "",
            linea: item.producto_linea || "",
            metal: item.producto_metal || "",
            kilataje: item.producto_kilataje || "",
            [`precio_pieza_${moneyLabel.toLowerCase()}`]: toDisplayMoney(item.precio_pieza_mxn),
            [`subtotal_${moneyLabel.toLowerCase()}`]: subtotal,
            comentarios: item.comentarios || "",
          };
        }
        const fineSilver = Math.max(0, Number(item.precio_gramo_mxn || 0) - Number(item.labor_mxn || 0));
        return {
          "#": idx + 1,
          codigo: item.producto_codigo || "",
          cantidad: piezas,
          descripcion: item.producto_descripcion || "",
          linea: item.producto_linea || "",
          metal: item.producto_metal || "",
          kilataje: item.producto_kilataje || "",
          peso_unitario_g: gramosPorPieza,
          gramos_totales: gramosTotal,
          [`labor_g_${moneyLabel.toLowerCase()}`]: toDisplayMoney(item.labor_mxn),
          [`pf_g_${moneyLabel.toLowerCase()}`]: toDisplayMoney(fineSilver),
          [`precio_gramo_${moneyLabel.toLowerCase()}`]: toDisplayMoney(item.precio_gramo_mxn),
          [`subtotal_${moneyLabel.toLowerCase()}`]: subtotal,
          comentarios: item.comentarios || "",
        };
      });

      const summaryRows = [
        { campo: "Folio", valor: po.folio || "Borrador sin folio guardado" },
        { campo: "Cliente", valor: po.cliente_nombre || "" },
        { campo: "Empresa", valor: po.cliente_empresa || "" },
        { campo: "RFC", valor: po.cliente_rfc || "" },
        { campo: "Telefono", valor: po.cliente_telefono || "" },
        { campo: "Correo", valor: po.cliente_email || "" },
        { campo: "Moneda", valor: po.moneda || "MXN" },
        { campo: "Tipo de cotizacion", valor: isPieceMode ? "Por pieza" : "Por gramo" },
        { campo: "Lista de precios", valor: isPieceMode
          ? (piecePriceLists.find((list) => list.id === selectedPiecePriceListId)?.name || "Personalizada")
          : (laborLists.find((list) => list.id === selectedLaborListId)?.name || "Personalizada")
        },
        { campo: "Tipo de cambio", valor: Number(po.tipo_cambio || 0) },
        { campo: "Total piezas", valor: totals.piezas },
        ...(!isPieceMode ? [{ campo: "Total gramos", valor: Number(totals.gramos.toFixed(2)) }] : []),
        { campo: `Subtotal ${moneyLabel}`, valor: toDisplayMoney(totals.mxn) },
        { campo: `Total ${moneyLabel}`, valor: toDisplayMoney(totalFinalMxn) },
        { campo: "Comentarios", valor: po.notas || "" },
      ];

      const workbook = XLSX.utils.book_new();
      const productsSheet = XLSX.utils.json_to_sheet(exportRows);
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      productsSheet["!cols"] = Object.keys(exportRows[0] || {}).map((key) => ({
        wch: Math.max(12, Math.min(36, key.length + 4)),
      }));
      summarySheet["!cols"] = [{ wch: 24 }, { wch: 42 }];
      XLSX.utils.book_append_sheet(workbook, productsSheet, "Preorden");
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");
      const fileName = `preorden-${safeFilePart(po.folio || po.cliente_empresa || po.cliente_nombre)}.xlsx`;
      downloadWorkbook(XLSX, workbook, fileName);
      setMsg(t("pedMsgExcelDescargado"));
    } catch (error) {
      setMsg(t("pedMsgExcelDescargaError", error.message));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t("pedConfirmEliminar"))) return;
    await deletePreorder(po.id);
    onSaved?.();
  };

  // Importar artículos + cliente desde una preorden (solo modo remisión).
  // Los preorder_items ya vienen en el formato del editor, así que la PF
  // (labor_mxn + precio_gramo_mxn) entra editable tal cual.
  const handleImportPreorder = (preorderRow) => {
    setPo((current) => ({
      ...current,
      client_id:        preorderRow.client_id || current.client_id || "",
      cliente_nombre:   preorderRow.cliente_nombre || "",
      cliente_empresa:  preorderRow.cliente_empresa || "",
      cliente_email:    preorderRow.cliente_email || "",
      cliente_telefono: preorderRow.cliente_telefono || "",
      cliente_rfc:      preorderRow.cliente_rfc || "",
      moneda:           preorderRow.moneda || current.moneda,
      tipo_cambio:      preorderRow.tipo_cambio ? String(preorderRow.tipo_cambio) : current.tipo_cambio,
      preorder_id:      preorderRow.id || null,
    }));
    const imported = withPreorderSortOrder(orderPreorderItems(preorderRow.preorder_items || []));
    setItems(imported.length ? imported : []);
    setShowImportPreorder(false);
    markEdited();
    setMsg(t("pedMsgArticulosImportados", preorderRow.folio || ""));
  };

  const handleClose = () => {
    onClose?.({ ...po, preorder_items: items });
  };

  const canConfirmOrder = adminViewOnly && !isRemision && !isNew && !po.confirmed_order_id && items.length > 0;
  const handleConfirmOrder = async () => {
    if (!canConfirmOrder || confirmingOrder) return;
    setConfirmingOrder(true);
    setMsg("");
    try {
      const order = await confirmPreorderAsOrder(po.id || initial?.id, {
        anticipo_mxn: Number(orderConfirmForm.anticipo_mxn || 0),
        comprobante_url: orderConfirmForm.comprobante_url.trim(),
        terms_text: orderConfirmForm.terms_text.trim(),
        terms_accepted: Boolean(orderConfirmForm.terms_accepted),
        accepted_by_name: orderConfirmForm.accepted_by_name.trim(),
        accepted_by_email: orderConfirmForm.accepted_by_email.trim(),
        notas: orderConfirmForm.notas.trim(),
      });
      setPo((current) => ({ ...current, status: "confirmada", confirmed_order_id: order?.id || current.confirmed_order_id }));
      setShowConfirmOrder(false);
      setConfirmedOrder(order);
      setSaved(true);
      setMsg(`Orden ${order?.folio || ""} confirmada.`);
      onOrderConfirmed?.(order);
      window.setTimeout(() => setConfirmedOrder(null), 4200);
    } catch (error) {
      console.error("Error confirming preorder as order", error);
      setMsg(error?.message || "No se pudo confirmar la orden.");
    } finally {
      setConfirmingOrder(false);
    }
  };

  return (
    <div className={`po-editor${editMode ? " po-editor--editing" : ""}${adminViewOnly ? " po-editor--readonly" : ""}`}>
      <header className="po-editor-toolbar po-editor-toolbar--remission">
        <div className="po-editor-toolbar-left">
          <span className="tool-eyebrow">{isNew ? (docLabels.eyebrowNew || "Nueva preorden") : po.folio}</span>
          {/* En edición: pastilla verde "Editando". En consulta: nada. */}
          {!pricingLocked && editMode ? (
            <span className="po-mode-pill po-mode-pill--editing">
              <span className="po-mode-dot" aria-hidden="true" />
              {t("pedEditando")}
            </span>
          ) : null}
        </div>
        <div className="po-editor-toolbar-right">
          {/* Timestamp de la versión guardada — garantía de que tienes la más reciente */}
          {savedAt && !saveConflict ? (
            <span className="po-saved-at" title={t("pedTipGuardadoEl", new Date(savedAt).toLocaleString(language === "en" ? "en-US" : "es-MX"))}>
              ✓ {new Date(savedAt).toLocaleTimeString(language === "en" ? "en-US" : "es-MX", { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : loadedAt && !isNew && !saveConflict ? (
            <span className="po-saved-at po-saved-at--loaded" title={t("pedTipVersionCargada", new Date(loadedAt).toLocaleString(language === "en" ? "en-US" : "es-MX"))}>
              v {new Date(loadedAt).toLocaleTimeString(language === "en" ? "en-US" : "es-MX", { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}

          {msg ? <span className={`po-toolbar-msg${saveConflict ? " po-toolbar-msg--conflict" : ""}`}>{msg}</span> : null}

          {/* Banner de conflicto — aparece cuando otra sesión guardó primero */}
          {saveConflict ? (
            <button
              className="secondary-button compact-action warning-action"
              type="button"
              title={t("pedTipSobrescribir")}
              onClick={handleForceSave}
            >
              ⚠ Sobrescribir
            </button>
          ) : null}

          {/* Modo consulta: botón prominente para activar la edición */}
          {adminViewOnly ? (
            <button className="primary-button compact-action po-edit-btn" type="button" onClick={enterEditMode}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              {t("pedEditar")}
            </button>
          ) : null}

          {editMode && enableImportFromPreorder ? (
            <button
              className="secondary-button compact-action"
              type="button"
              onClick={() => setShowImportPreorder(true)}
              title={t("pedTipImportar")}
            >
              {t("pedImportarPreorden")}
            </button>
          ) : null}
          {(editMode || pricingLocked) && !isNew ? (
            <button className="danger-button compact-action" type="button" onClick={handleDelete}>
              {t("pedEliminar")}
            </button>
          ) : null}
          <button className="secondary-button compact-action" type="button" onClick={handlePdf}>
            PDF
          </button>
          <button className="secondary-button compact-action" type="button" onClick={handleExcelDownload}>
            Excel
          </button>
          {onCreateRemision ? (
            <button
              className="secondary-button compact-action"
              type="button"
              title={t("pedTipCrearRemision")}
              onClick={() => setShowCreateRem(true)}
            >
              {t("pedCrearRemision")}
            </button>
          ) : null}
          {canConfirmOrder ? (
            <button
              className="primary-button compact-action order-confirm-button"
              type="button"
              title="Confirmar como orden de compra"
              onClick={() => setShowConfirmOrder(true)}
            >
              Confirmar orden
            </button>
          ) : null}
          {editMode || pricingLocked ? (
            <>
              {editMode && !isNew ? (
                <button className="secondary-button compact-action" type="button" onClick={cancelEditMode}>
                  {t("pedCancelar")}
                </button>
              ) : null}
              <button
                className="primary-button compact-action"
                type="button"
                onClick={handleSave}
                disabled={saving || saved}
              >
                {saving ? t("pedGuardando") : saved ? t("pedGuardadoOk") : t("pedGuardar")}
              </button>
            </>
          ) : null}
        </div>
        <div className="po-remission-info">
          <section className="po-remission-group po-remission-group--client">
            <div className="po-remission-title">Cliente</div>
            <div className="po-remission-fields po-remission-fields--client">
              <Field label={t("pedFecha")}>
                <input value={new Date(initial?.created_at || Date.now()).toLocaleDateString(language === "en" ? "en-US" : "es-MX")} readOnly style={inp} />
              </Field>
              <Field label={t("pedClienteTitulo")}>
                {pricingLocked ? (
                  /* En vista de cliente el selector está bloqueado — solo muestra quién es */
                  <input
                    value={po.cliente_empresa || po.cliente_nombre || "—"}
                    readOnly
                    style={{ ...inp, background: "var(--romea-soft, #f8f7f4)", cursor: "default" }}
                  />
                ) : (
                  <select value={po.client_id} onChange={handleClientSelect} style={inp}>
                    <option value="">{t("pedSelClienteExistente")}</option>
                    <option value={PROSPECT_CLIENT_VALUE}>{t("pedProspectoNuevo")}</option>
                    {(clients || []).map((client) => (
                      <option key={client.id} value={client.id}>{client.company || client.name}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t("pedNombre")}><input value={po.cliente_nombre || ""} readOnly style={inp} /></Field>
              <Field label={t("pedEmpresa")}><input value={po.cliente_empresa || ""} readOnly style={inp} /></Field>
              <Field label={t("pedTelefono")}><input value={po.cliente_telefono || ""} readOnly style={inp} /></Field>
              <Field label={t("pedRfc")}><input value={po.cliente_rfc || ""} readOnly style={inp} /></Field>
            </div>
            {/* Estatus de la nota — segmentado justificado bajo el cliente.
                Solo el activo se colorea (tono); los demás en gris casi invisible. */}
            <div className="po-status-seg">
              {Object.entries(statusConfig).map(([key, value]) => (
                <button
                  key={key}
                  type="button"
                  className={`po-status-seg-btn po-status-seg-btn--${value.tone || "gray"}${po.status === key ? " is-active" : ""}`}
                  disabled={inputsLocked}
                  onClick={() => {
                    if (inputsLocked) return;
                    markEdited();
                    setPo((current) => ({ ...current, status: key }));
                  }}
                >
                  {statusLabel(key, value.label)}
                </button>
              ))}
            </div>
          </section>

          <section className="po-remission-group">
            <div className="po-remission-title">Moneda y lista</div>
            <div className="po-remission-fields">
              {!hideCurrencySelector ? (
                <Field label={t("pedMoneda")}>
                  <select value={po.moneda} onChange={set("moneda", { pricing: true })} style={inp}>
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                  </select>
                </Field>
              ) : null}
              {!hidePricingModeSelector ? (
                <Field label={t("pedTipo")}>
                  <select value={pricingMode} onChange={(e) => changePricingMode(e.target.value)} disabled={pricingLocked} style={inp}>
                    <option value="gram">{t("pedPorGramo")}</option>
                    <option value="piece">{t("pedPorPieza")}</option>
                  </select>
                </Field>
              ) : null}
              <Field label={isPieceMode ? t("pedListaPieza", po.moneda) : t("pedListaGramo", po.moneda)}>
                {isPieceMode ? (
                  <select
                    value={selectedPiecePriceListId || ""}
                    onChange={(e) => applyPiecePriceList(e.target.value)}
                    disabled={pricingLocked}
                    style={inp}
                  >
                    <option value="">{t("pedSelListaActiva")}</option>
                    <option value={CUSTOM_PRICE_LIST_VALUE}>{t("pedPersonalizada")}</option>
                    {compatiblePiecePriceLists.map((list) => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={selectedLaborListId || ""}
                    onChange={(e) => applyLaborList(e.target.value, lines)}
                    disabled={pricingLocked}
                    style={inp}
                  >
                    <option value="">{t("pedSelListaActiva")}</option>
                    <option value={CUSTOM_PRICE_LIST_VALUE}>{t("pedPersonalizada")}</option>
                    {compatibleLaborLists.map((list) => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                  </select>
                )}
              </Field>
              {!hideExchangeRate ? (
                <Field label={t("pedTipoCambio")}>
                  <input type="number" step="0.01" placeholder={t("pedPhTipoCambio")} value={po.tipo_cambio || ""} onChange={set("tipo_cambio", { pricing: true })} style={inp} />
                </Field>
              ) : null}
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label={t("pedComentariosTitulo")}>
                  <textarea value={po.notas || ""} onChange={set("notas")} placeholder={docLabels.notesPlaceholder || t("pedComentariosPlaceholder")} />
                </Field>
              </div>
            </div>
          </section>

          <section className="po-remission-group po-remission-group--totals">
            <div className="po-remission-title">Totales</div>
            <div className="po-remission-total-row"><span>{t("pedPiezas")}</span><strong>{totals.piezas}</strong></div>
            {!isPieceMode ? (
              <div className="po-remission-total-row"><span>{t("pedGramos")}</span><strong>{totals.gramos.toFixed(2)} g</strong></div>
            ) : null}
            <div className="po-remission-total-row po-remission-total-row--money"><span>{t("pedTotalCur", moneyLabel)}</span><strong>{fmt(toDisplayMoney(totalFinalMxn))}</strong></div>
          </section>
        </div>
      </header>

      <main className="po-editor-body">
          <section className="po-header-sheet">
            <div className="po-header-section po-header-section--client">
              <div className="po-header-line">
                <strong>{docLabels.sheetTitle || "Preorden"}</strong>
                <span>{new Date(initial?.created_at || Date.now()).toLocaleDateString(language === "en" ? "en-US" : "es-MX")}</span>
              </div>
              <Field label={t("pedClienteTitulo")}>
                {pricingLocked ? (
                  <input
                    value={po.cliente_empresa || po.cliente_nombre || "—"}
                    readOnly
                    style={{ ...inp, background: "var(--romea-soft, #f8f7f4)", cursor: "default" }}
                  />
                ) : (
                  <select value={po.client_id} onChange={handleClientSelect} style={inp}>
                    <option value="">{t("pedSelClienteExistente")}</option>
                    <option value={PROSPECT_CLIENT_VALUE}>{t("pedProspectoNuevo")}</option>
                    {(clients || []).map((client) => (
                      <option key={client.id} value={client.id}>{client.company || client.name}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t("pedNombre")}><input value={po.cliente_nombre || ""} readOnly style={inp} /></Field>
              <Field label={t("pedEmpresa")}><input value={po.cliente_empresa || ""} readOnly style={inp} /></Field>
              <Field label={t("pedTelefono")}><input value={po.cliente_telefono || ""} readOnly style={inp} /></Field>
              <Field label={t("pedRfc")}><input value={po.cliente_rfc || ""} readOnly style={inp} /></Field>
            </div>

            <div className="po-header-section po-header-section--pricing">
              <div className="po-header-line">
                <strong>Costeo</strong>
                <span>{isPieceMode ? "Por pieza" : selectedLaborListId === CUSTOM_PRICE_LIST_VALUE ? "Personalizada" : "Por gramo"}</span>
              </div>
              {!hideCurrencySelector ? (
                <Field label={t("pedMoneda")}>
                  <select value={po.moneda} onChange={set("moneda", { pricing: true })} style={inp}>
                    <option value="MXN">MXN</option>
                    <option value="USD">USD</option>
                  </select>
                </Field>
              ) : null}
              {!hidePricingModeSelector ? (
                <Field label={t("pedFieldTipoCotizacion")}>
                  <select value={pricingMode} onChange={(e) => changePricingMode(e.target.value)} disabled={pricingLocked} style={inp}>
                    <option value="gram">{t("pedPorGramo")}</option>
                    <option value="piece">{t("pedPorPieza")}</option>
                  </select>
                </Field>
              ) : null}
              <Field label={isPieceMode ? t("pedListaPieza", po.moneda) : t("pedListaGramo", po.moneda)}>
                {isPieceMode ? (
                  <select
                    value={selectedPiecePriceListId || ""}
                    onChange={(e) => applyPiecePriceList(e.target.value)}
                    disabled={pricingLocked}
                    style={inp}
                  >
                    <option value="">{t("pedSelListaActiva")}</option>
                    <option value={CUSTOM_PRICE_LIST_VALUE}>{t("pedPersonalizada")}</option>
                    {compatiblePiecePriceLists.map((list) => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={selectedLaborListId || ""}
                    onChange={(e) => applyLaborList(e.target.value, lines)}
                    disabled={pricingLocked}
                    style={inp}
                  >
                    <option value="">{t("pedSelListaActiva")}</option>
                    <option value={CUSTOM_PRICE_LIST_VALUE}>{t("pedPersonalizada")}</option>
                    {compatibleLaborLists.map((list) => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                  </select>
                )}
              </Field>
              {!hideExchangeRate ? (
                <Field label={t("pedFieldTipoCambioUsd")}>
                  <input type="number" step="0.01" placeholder={t("pedPhTipoCambio")} value={po.tipo_cambio || ""} onChange={set("tipo_cambio", { pricing: true })} style={inp} />
                </Field>
              ) : null}
              <Field label={t("pedFieldEstatus")}>
                <select value={po.status || defaultStatus} onChange={set("status")} style={inp}>
                  {Object.entries(statusConfig).map(([key, value]) => <option key={key} value={key}>{statusLabel(key, value.label)}</option>)}
                </select>
              </Field>
            </div>

            <div className="po-header-section po-header-section--notes">
              <div className="po-header-line">
                <strong>Comentarios</strong>
              </div>
              <textarea value={po.notas || ""} onChange={set("notas")} placeholder={docLabels.notesPlaceholder || t("pedComentariosPlaceholder")} />
            </div>

            <div className="po-header-section po-header-section--totals">
              <div className="po-header-line">
                <strong>Totales</strong>
              </div>
              <div><span>{t("pedPiezas")}</span><strong>{totals.piezas}</strong></div>
              {!isPieceMode ? (
                <div><span>{t("pedGramos")}</span><strong>{totals.gramos.toFixed(2)} g</strong></div>
              ) : null}
              <div><span>{t("pedTotalCur", moneyLabel)}</span><strong>{fmt(toDisplayMoney(totalFinalMxn))}</strong></div>
            </div>
          </section>
            {isProspectMode ? (
              <div className="prospect-inline-card">
                <div>
                  <h4>Prospecto JCK</h4>
                  <p>Captura sus datos aqui mismo. Al guardar la preorden, se crea el cliente/prospecto.</p>
                </div>
                <div className="form-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                  <Field label={t("pedNombre")}><input value={prospectForm.name} onChange={(event) => updateProspect("name", event.target.value)} style={inp} placeholder={t("pedPhNombreContacto")} /></Field>
                  <Field label={t("pedEmpresa")}><input value={prospectForm.company} onChange={(event) => updateProspect("company", event.target.value)} style={inp} placeholder={t("pedPhEmpresaTienda")} /></Field>
                  <Field label={t("pedFieldCorreo")}><input value={prospectForm.email} onChange={(event) => updateProspect("email", event.target.value)} style={inp} placeholder={t("pedPhCorreo")} /></Field>
                  <Field label={t("pedTelefono")}><input value={prospectForm.phone} onChange={(event) => updateProspect("phone", event.target.value)} style={inp} placeholder="+1..." /></Field>
                  <Field label={t("pedFieldRfcTaxId")}><input value={prospectForm.rfc} onChange={(event) => updateProspect("rfc", event.target.value)} style={inp} placeholder={t("pedPhOpcional")} /></Field>
                </div>
              </div>
            ) : null}

          {!isPieceMode ? (
          <section className="quote-block quote-block--pricing">
            <h3>{t("pedCosteoPlata")}</h3>

            <div className="po-pricing-panel">
              <div className="po-pricing-row">
                <label className="po-pricing-field">
                  Metodo plata fina
                  <select value={po.pf_mode || "manual"} onChange={set("pf_mode", { pricing: true })} disabled={pricingLocked}>
                    <option value="manual">Captura manual</option>
                    <option value="kitco">Calcular desde Kitco</option>
                  </select>
                </label>

                {po.pf_mode === "kitco" ? (
                  <>
                    <label className="po-pricing-field">
                      KITCO USD/oz
                      <input type="number" step="0.01" placeholder={t("pedPhKitco")} value={po.kitco_usd_oz || ""} onChange={set("kitco_usd_oz", { pricing: true })} readOnly={pricingLocked} />
                    </label>
                    <label className="po-pricing-field">
                      Premio Kitco (%)
                      <input type="number" step="0.1" min="0" placeholder={t("pedPhPremio")} value={po.premio_pct ?? 0} onChange={set("premio_pct", { pricing: true })} readOnly={pricingLocked} />
                    </label>
                    {!pricingLocked ? (
                      <div className="po-pricing-field po-pricing-field--action">
                        <button className="secondary-button compact-action" type="button" onClick={calculateSilverFineByKitco}>
                          Calcular PF
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}

                <label className="po-pricing-field">
                  Plata fina {moneyLabel}/g
                  <input
                    type="number"
                    step="0.0001"
                    placeholder="0.0000"
                    value={displayFineSilver || ""}
                    onChange={(event) => setSilverFine(event.target.value)}
                    readOnly={pricingLocked}
                  />
                </label>

                {!pricingLocked ? (
                  <div className="po-pricing-field po-pricing-field--action">
                    <button className={`primary-button compact-action ${pricingDirty ? "warning-action" : ""}`} type="button" onClick={precargarPrecios}>
                      Recalcular precios
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
          ) : null}

          <section className="quote-block">
            <h3>{t("pedProductosCotizados")}</h3>
            {msg ? <p className="status info">{msg}</p> : null}
            {!adminViewOnly && products.length ? (
              <div className="quote-product-picker">
                <label>{t("pedAgregarProductoTitulo")}<input
                    ref={scannerInputRef}
                    value={productSearch}
                    onFocus={() => { activeScannerRef.current = "top"; }}
                    onChange={(event) => {
                      activeScannerRef.current = "top";
                      setProductSearch(event.target.value);
                      setPendingDuplicate(null);
                      if (productStatus.type !== "info") {
                        setProductStatus({ type: "info", text: t("pedStEnterParaAgregar") });
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleProductEntrySubmit();
                      }
                    }}
                    placeholder={t("pedScanPlaceholder")}
                  />
                </label>
                <div className="quote-picker-actions">
                  <button className="primary-button compact-action" type="button" onClick={handleProductEntrySubmit}>{t("pedAgregarPorCodigo")}</button>
                  {isPieceMode ? (
                    <label className={`secondary-button compact-action file-action preorder-excel-action ${importingPreorderExcel ? "disabled" : ""}`}>
                      {importingPreorderExcel ? "Leyendo Excel..." : "Cargar Excel de preorden"}
                      <input type="file" accept=".xlsx,.xls" onChange={handlePreorderExcelImport} disabled={importingPreorderExcel} />
                    </label>
                  ) : null}
                  <p className={`scanner-status ${productStatus.type}`}>{productStatus.text}</p>
                </div>
                {/* Confirmación de duplicado — aparece en la barra que activó el warning */}
                {pendingDuplicate && activeScannerRef.current === "top" ? (
                  <div className="quote-duplicate-confirm">
                    <span>⚠ <strong>{pendingDuplicate.product.codigo}</strong> ya está en la preorden</span>
                    <button type="button" className="primary-button compact-action" onClick={confirmDuplicate}>
                      Sí, agregar línea separada
                    </button>
                    <button type="button" className="secondary-button compact-action" onClick={cancelDuplicate}>
                      Cancelar
                    </button>
                  </div>
                ) : null}
                {productResults.length && !pendingDuplicate ? (
                  <div className="quote-product-results">
                    {productResults.map((product) => (
                      <button key={product.id || product.codigo} type="button" onClick={() => { activeScannerRef.current = "top"; addProduct(product); }}>
                        <img
                          src={imageUrlForSize(product.fotoUrl, 120) || buildPlaceholderUrl()}
                          alt={product.descripcion}
                          loading="lazy"
                          decoding="async"
                          onError={(event) => { event.currentTarget.src = buildPlaceholderUrl(); }}
                        />
                        <span>
                          <strong>{product.codigo}</strong>
                          <small>{shortText(product.descripcion, 62)}</small>
                        </span>
                        <b>Agregar</b>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div
              ref={preorderItemsScrollRef}
              className="responsive-table"
              onDragOver={handlePreorderTableDragOver}
            >
              <table className="simple-admin-table quote-items-table">
                <thead>
                  {isPieceMode ? (
                    <tr>
                      <th className="preorder-row-move-head">{t("pedColOrden")}</th>
                      <th>{t("pedColFoto")}</th>
                      <th>SKU</th>
                      <th className="right">{t("pedColCantidad")}</th>
                      <th>{t("pedColDescripcion")}</th>
                      <th>{t("pedColLinea")}</th>
                      <th className="right">{t("pedColPrecioPieza", moneyLabel)}</th>
                      <th>{t("pedColComentariosShort")}</th>
                      <th className="right">{t("pedColSubtotal")}</th>
                      <th></th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="preorder-row-move-head">{t("pedColOrden")}</th>
                      <th>{t("pedColFoto")}</th>
                      <th>SKU</th>
                      <th className="right">{t("pedColCantidad")}</th>
                      <th>{t("pedColDescripcion")}</th>
                      <th>{t("pedColLinea")}</th>
                      <th className="right">{t("pedColPesoUnit")}</th>
                      <th className="right">{t("pedColGramosTot")}</th>
                      <th className="right">{t("pedColLaborG", moneyLabel)}</th>
                      <th className="right">{t("pedColPfG")} {moneyLabel}</th>
                      <th className="right">{t("pedColLaborPf")} {moneyLabel}</th>
                      <th>{t("pedColComentariosShort")}</th>
                      <th className="right">{t("pedColSubtotal")}</th>
                      <th></th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {items.length ? items.map((item, idx) => {
                    const isConfigurableItem = Boolean(item._configurable_group);
                    const fineSilver = Math.max(0, Number(item.precio_gramo_mxn || 0) - Number(item.labor_mxn || 0));

                    // ── Fila configurable: tarjeta de ancho completo ────────────────
                    if (isConfigurableItem) {
                      const colCount = isPieceMode ? 10 : 14;
                      const isComplete = isConfigurableItemComplete(item);
                      return (
                        <tr
                          key={`${item.producto_codigo}-${idx}`}
                          className={`cfg-item-row ${preorderRowDragClass(idx)}`}
                          onDragOver={(event) => handlePreorderItemDragOver(event, idx)}
                          onDrop={(event) => handlePreorderItemDrop(event, idx)}
                          onDragEnd={endPreorderItemDrag}
                        >
                          <td colSpan={colCount} className="cfg-item-cell">
                            <div className={`cfg-card${isComplete ? " cfg-card--complete" : ""}`}>

                              {/* ── Cabecera de la tarjeta ────────────────────────── */}
                              <div className="cfg-card__header">
                                <div className="cfg-card__header-left">
                                  {item._configurable_base_foto_url || item.producto_foto_url ? (
                                    <img
                                      className="cfg-card__tejido-thumb"
                                      src={imageUrlForSize(item._configurable_base_foto_url || item.producto_foto_url, 120)}
                                      alt={item._configurable_base_code}
                                      loading="lazy"
                                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                                    />
                                  ) : (
                                    <div className="cfg-card__tejido-thumb cfg-card__tejido-thumb--empty">
                                      {item._configurable_base_code?.split("-")[0] || "—"}
                                    </div>
                                  )}
                                  <div className="cfg-card__title-block">
                                    <span className="cfg-card__sku">{item._configurable_base_code || item.producto_codigo}</span>
                                    <span className="cfg-card__name">{item._configurable_title || item.producto_descripcion}</span>
                                    <span className="cfg-card__meta">{[item.producto_metal, item.producto_kilataje].filter(Boolean).join(" · ")}</span>
                                  </div>
                                </div>
                                <div className="cfg-card__header-right">
                                  <span
                                    className={`preorder-row-drag-handle cfg-drag-handle${canDragPreorderItems ? "" : " disabled"}`}
                                    draggable={canDragPreorderItems}
                                    onDragStart={(event) => startPreorderItemDrag(event, idx)}
                                    onDragEnd={endPreorderItemDrag}
                                    title={t("pedTipArrastrar")}
                                  >
                                    Mover
                                  </span>
                                  {isComplete
                                    ? <span className="cfg-badge cfg-badge--ok">✓ Completo</span>
                                    : <span className="cfg-badge cfg-badge--pending">Pendiente</span>
                                  }
                                  <button className="table-delete" type="button" onClick={() => removePreorderItem(idx)}>×</button>
                                </div>
                              </div>

                              {/* ══════════════════════════════════════════════════ */}
                              {/* SECCIÓN 1 — CONFIGURAR                           */}
                              {/* ══════════════════════════════════════════════════ */}
                              <div className="cfg-section">
                                <div className="cfg-section__label">
                                  <span className="cfg-section__num">1</span> Configurar modelo
                                </div>
                                <div className="cfg-selectors">
                                  {isRingSizeConfigurableItem(item) ? (
                                    <label className="cfg-field cfg-field--full cfg-field--ring-size">
                                      <span className="cfg-field__label">Talla</span>
                                      <select
                                        className="cfg-field__select"
                                        value={item._configurable_selections?.ring_size?.codigo || ""}
                                        onChange={(e) => setConfigurableComponent(idx, "ring_size", e.target.value)}
                                      >
                                        <option value="">— Selecciona talla —</option>
                                        {getConfigurableOptions(item, "ring_size").map((c) => (
                                          <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
                                        ))}
                                      </select>
                                    </label>
                                  ) : (
                                    <>

                                  {/* Tipo de pieza — ancho completo */}
                                  <label className="cfg-field cfg-field--full">
                                    <span className="cfg-field__label">Tipo de pieza</span>
                                    <select
                                      className="cfg-field__select"
                                      value={item._configurable_selections?.tipo_pieza?.codigo || ""}
                                      onChange={(e) => setConfigurableComponent(idx, "tipo_pieza", e.target.value)}
                                    >
                                      <option value="">— Selecciona tipo de pieza —</option>
                                      {getConfigurableOptions(item, "tipo_pieza").map((c) => (
                                        <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
                                      ))}
                                    </select>
                                  </label>

                                  {/* Broche (con preview de foto si existe) */}
                                  <label className={`cfg-field cfg-field--broche${item._configurable_selections?.broche ? " cfg-field--selected" : ""}`}>
                                    <span className="cfg-field__label">Broche</span>
                                    {item._configurable_selections?.broche?.fotoUrl ? (
                                      <img
                                        className="cfg-field__photo"
                                        src={imageUrlForSize(item._configurable_selections.broche.fotoUrl, 80)}
                                        alt={item._configurable_selections.broche.nombre}
                                        loading="lazy"
                                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                                      />
                                    ) : null}
                                    <select
                                      className="cfg-field__select"
                                      value={item._configurable_selections?.broche?.codigo || ""}
                                      onChange={(e) => setConfigurableComponent(idx, "broche", e.target.value)}
                                      disabled={!item._configurable_selections?.tipo_pieza}
                                    >
                                      <option value="">{item._configurable_selections?.tipo_pieza ? "— Selecciona broche —" : "Primero elige tipo de pieza"}</option>
                                      {getConfigurableOptions(item, "broche").map((c) => (
                                        <option key={c.id || c.codigo} value={c.codigo}>
                                          {c.nombre}{c.peso ? ` (+${c.peso}g)` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  {/* Diseño de placa — solo cuando aplica */}
                                  {tipoPiezaRequiereDiseñoPlaca(item) ? (
                                    <label className="cfg-field cfg-field--diseño">
                                      <span className="cfg-field__label">
                                        {tipoPiezaFuerzaPlacaMilitar(item) ? "Diseño de placa militar" : "Diseño de placa"}
                                      </span>
                                      <select
                                        className="cfg-field__select"
                                        value={item._configurable_selections?.["diseño_placa"]?.codigo || ""}
                                        onChange={(e) => setConfigurableComponent(idx, "diseño_placa", e.target.value)}
                                      >
                                        <option value="">— Selecciona diseño —</option>
                                        {getConfigurableOptions(item, "diseño_placa").map((c) => (
                                          <option key={c.id || c.codigo} value={c.codigo}>{c.nombre}</option>
                                        ))}
                                      </select>
                                    </label>
                                  ) : null}

                                  {/* Largo */}
                                  <label className="cfg-field">
                                    <span className="cfg-field__label">Largo</span>
                                    <select
                                      className="cfg-field__select"
                                      value={item._configurable_selections?.largo?.codigo || ""}
                                      onChange={(e) => setConfigurableComponent(idx, "largo", e.target.value)}
                                    >
                                      <option value="">— Selecciona largo —</option>
                                      {getConfigurableOptions(item, "largo").map((c) => (
                                        <option key={c.id || c.codigo} value={c.codigo}>{c.nombre}</option>
                                      ))}
                                    </select>
                                  </label>

                                  {/* Terminado */}
                                  <label className="cfg-field">
                                    <span className="cfg-field__label">Terminado</span>
                                    <select
                                      className="cfg-field__select"
                                      value={item._configurable_selections?.terminado?.codigo || ""}
                                      onChange={(e) => setConfigurableComponent(idx, "terminado", e.target.value)}
                                    >
                                      <option value="">— Selecciona terminado —</option>
                                      {getConfigurableOptions(item, "terminado").map((c) => (
                                        <option key={c.id || c.codigo} value={c.codigo}>{c.nombre}</option>
                                      ))}
                                    </select>
                                  </label>

                                    </>
                                  )}
                                </div>
                              </div>

                              {/* ══════════════════════════════════════════════════ */}
                              {/* SECCIÓN 2 — CANTIDAD Y PESOS                     */}
                              {/* ══════════════════════════════════════════════════ */}
                              <div className="cfg-section">
                                <div className="cfg-section__label">
                                  <span className="cfg-section__num">2</span> Cantidad y pesos
                                </div>
                                <div className="cfg-pricing">

                                  {/* Piezas */}
                                  <div className="cfg-pricing__field">
                                    <span className="cfg-pricing__label">{t("pedPiezas")}</span>
                                    <div className="qty-stepper">
                                      <button type="button" onClick={() => adjustQuantity(idx, -1)}>-</button>
                                      <input type="number" min="1" value={item.piezas} onChange={(e) => setItem(idx, "piezas", Number(e.target.value))} />
                                      <button type="button" onClick={() => adjustQuantity(idx, 1)}>+</button>
                                    </div>
                                  </div>

                                  {isPieceMode ? (
                                    <div className="cfg-pricing__field">
                                      <span className="cfg-pricing__label">{t("pedCfgPrecioPza")} {moneyLabel}</span>
                                      <input type="number" step="0.01" value={toDisplayMoney(item.precio_pieza_mxn) || ""} onChange={(e) => setItem(idx, "precio_pieza_mxn", fromDisplayMoney(e.target.value))} readOnly={pricingLocked} />
                                    </div>
                                  ) : (
                                    <>
                                      <div className="cfg-pricing__field">
                                        <span className="cfg-pricing__label">{t("pedCfgGrPieza")}</span>
                                        <input type="number" step="0.01" value={item.gramos_por_pieza} onChange={(e) => setItem(idx, "gramos_por_pieza", Number(e.target.value))} />
                                      </div>
                                      <div className="cfg-pricing__field">
                                        <span className="cfg-pricing__label">{t("pedCfgGrTotal")}</span>
                                        <input type="number" step="0.01" value={item._gt_manual ?? item.gramos_total} onChange={(e) => setGTotal(idx, e.target.value)} readOnly={pricingLocked} />
                                      </div>
                                      <div className="cfg-pricing__field">
                                        <span className="cfg-pricing__label">{t("pedColLaborG", moneyLabel)}</span>
                                        <input type="number" step="0.01" value={toDisplayMoney(item.labor_mxn) || ""} onChange={(e) => setLabor(idx, e.target.value)} readOnly={pricingLocked} />
                                      </div>
                                      <div className="cfg-pricing__field cfg-pricing__field--readonly">
                                        <span className="cfg-pricing__label">{t("pedColPfG")}</span>
                                        <span className="cfg-pricing__value">{fmt(toDisplayMoney(fineSilver))}</span>
                                      </div>
                                      <div className="cfg-pricing__field cfg-pricing__field--readonly">
                                        <span className="cfg-pricing__label">{t("pedColLaborPf")}</span>
                                        <span className="cfg-pricing__value">{fmt(toDisplayMoney(item.precio_gramo_mxn))}</span>
                                      </div>
                                    </>
                                  )}

                                  <div className="cfg-pricing__field cfg-pricing__field--comments">
                                    <span className="cfg-pricing__label">{t("pedColComentariosShort")}</span>
                                    <input value={item.comentarios || ""} onChange={(e) => setItem(idx, "comentarios", e.target.value)} placeholder={t("pedCfgNotasPlaceholder")} />
                                  </div>

                                  <div className="cfg-pricing__field cfg-pricing__field--subtotal">
                                    <span className="cfg-pricing__label">{t("pedColSubtotal")}</span>
                                    <strong className="cfg-pricing__subtotal">{fmt(toDisplayMoney(item.subtotal_mxn))}</strong>
                                  </div>

                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // ── Fila normal ────────────────────────────────────────────────
                    return (
                      <tr
                        key={`${item.producto_codigo}-${idx}`}
                        className={preorderRowDragClass(idx)}
                        onDragOver={(event) => handlePreorderItemDragOver(event, idx)}
                        onDrop={(event) => handlePreorderItemDrop(event, idx)}
                        onDragEnd={endPreorderItemDrag}
                      >
                        <td className="preorder-row-move-cell">
                          <span
                            className={`preorder-row-drag-handle${canDragPreorderItems ? "" : " disabled"}`}
                            draggable={canDragPreorderItems}
                            onDragStart={(event) => startPreorderItemDrag(event, idx)}
                            onDragEnd={endPreorderItemDrag}
                            title={t("pedTipArrastrar")}
                          >
                            Mover
                          </span>
                        </td>
                        <td className="quote-item-photo-cell">
                          {item.producto_foto_url ? (
                            <img
                              className="quote-item-photo"
                              src={imageUrlForSize(item.producto_foto_url, 240)}
                              alt={item.producto_codigo}
                              loading="lazy"
                              decoding="async"
                              onError={(event) => { event.currentTarget.src = buildPlaceholderUrl(); }}
                            />
                          ) : (
                            <span className="quote-item-photo-placeholder">Sin foto</span>
                          )}
                        </td>
                        <td><strong>{item.producto_codigo}</strong></td>
                        <td>
                          <div className="qty-stepper">
                            <button type="button" onClick={() => adjustQuantity(idx, -1)}>-</button>
                            <input type="number" min="1" value={item.piezas} onChange={(event) => setItem(idx, "piezas", Number(event.target.value))} />
                            <button type="button" onClick={() => adjustQuantity(idx, 1)}>+</button>
                          </div>
                        </td>
                        <td>
                          <div>{item.producto_descripcion}</div>
                          <small>{[item.producto_metal, item.producto_kilataje].filter(Boolean).join(" / ")}</small>
                        </td>
                        <td><strong>{item.producto_linea || "-"}</strong></td>
                        {isPieceMode ? (
                          <td className="right">
                            <input
                              type="number"
                              step="0.01"
                              value={toDisplayMoney(item.precio_pieza_mxn) || ""}
                              onChange={(event) => setItem(idx, "precio_pieza_mxn", fromDisplayMoney(event.target.value))}
                              readOnly={pricingLocked}
                            />
                          </td>
                        ) : (
                          <>
                            <td><input type="number" step="0.01" value={item.gramos_por_pieza} onChange={(event) => setItem(idx, "gramos_por_pieza", Number(event.target.value))} /></td>
                            <td><input type="number" step="0.01" value={item._gt_manual ?? item.gramos_total} onChange={(event) => setGTotal(idx, event.target.value)} readOnly={pricingLocked} /></td>
                            <td><input type="number" step="0.01" value={toDisplayMoney(item.labor_mxn) || ""} onChange={(event) => setLabor(idx, event.target.value)} readOnly={pricingLocked} /></td>
                            <td className="right">{fmt(toDisplayMoney(fineSilver))}</td>
                            <td className="right">{fmt(toDisplayMoney(item.precio_gramo_mxn))}</td>
                          </>
                        )}
                        <td className="quote-item-comments-cell"><input value={item.comentarios || ""} onChange={(event) => setItem(idx, "comentarios", event.target.value)} placeholder={t("pedPhComentariosItem")} /></td>
                        <td className="right"><strong>{fmt(toDisplayMoney(item.subtotal_mxn))}</strong></td>
                        <td><button className="table-delete" type="button" onClick={() => removePreorderItem(idx)}>x</button></td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={isPieceMode ? "10" : "14"} className="empty-row">{t("pedSinProductos")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Barra inferior de búsqueda ───────────────────────────────────────
              Solo visible cuando hay productos en la tabla y no está en modo cliente.
              Evita tener que scrollear hasta arriba para agregar más artículos. */}
          {!adminViewOnly && items.length >= 3 && products.length ? (
            <div className="quote-product-picker quote-product-picker--bottom">
              <label>{t("pedAgregarOtro")}<input
                  ref={bottomScannerRef}
                  value={productSearch}
                  onFocus={() => { activeScannerRef.current = "bottom"; }}
                  onChange={(event) => {
                    activeScannerRef.current = "bottom";
                    setProductSearch(event.target.value);
                    setPendingDuplicate(null);
                    if (productStatus.type !== "info") {
                      setProductStatus({ type: "info", text: t("pedStEnterParaAgregar") });
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleProductEntrySubmit();
                    }
                  }}
                  placeholder={t("pedScanPlaceholder")}
                />
              </label>
              <div className="quote-picker-actions">
                <button className="primary-button compact-action" type="button" onClick={() => { activeScannerRef.current = "bottom"; handleProductEntrySubmit(); }}>{t("pedAgregarPorCodigo")}</button>
                <p className={`scanner-status ${productStatus.type}`}>{productStatus.text}</p>
              </div>
              {/* Confirmación de duplicado en barra inferior */}
              {pendingDuplicate && activeScannerRef.current === "bottom" ? (
                <div className="quote-duplicate-confirm">
                  <span>⚠ <strong>{pendingDuplicate.product.codigo}</strong> ya está en la preorden</span>
                  <button type="button" className="primary-button compact-action" onClick={confirmDuplicate}>
                    Sí, agregar línea separada
                  </button>
                  <button type="button" className="secondary-button compact-action" onClick={cancelDuplicate}>
                    Cancelar
                  </button>
                </div>
              ) : null}
              {productResults.length && !pendingDuplicate ? (
                <div className="quote-product-results">
                  {productResults.map((product) => (
                    <button key={product.id || product.codigo} type="button" onClick={() => { activeScannerRef.current = "bottom"; addProduct(product); }}>
                      <img
                        src={imageUrlForSize(product.fotoUrl, 120) || buildPlaceholderUrl()}
                        alt={product.descripcion}
                        loading="lazy"
                        decoding="async"
                        onError={(event) => { event.currentTarget.src = buildPlaceholderUrl(); }}
                      />
                      <span>
                        <strong>{product.codigo}</strong>
                        <small>{shortText(product.descripcion, 62)}</small>
                      </span>
                      <b>Agregar</b>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <section className="po-totals-bar">
            <div><span>{t("pedPiezas")}</span><strong>{totals.piezas}</strong></div>
            {!isPieceMode ? (
              <div><span>{t("pedGramos")}</span><strong>{totals.gramos.toFixed(2)} g</strong></div>
            ) : null}
            <div><span>{t("pedSubtotalCur", moneyLabel)}</span><strong>{fmt(toDisplayMoney(totals.mxn))}</strong></div>
            <div className="po-total-highlight"><span>{t("pedTotalCur", moneyLabel)}</span><strong>{fmt(toDisplayMoney(totalFinalMxn))}</strong></div>
          </section>
      </main>

      {showImportPreorder ? (
        <ImportarPreordenModal
          tenantId={resolvedTenantId}
          profile={profile}
          onSelect={handleImportPreorder}
          onClose={() => setShowImportPreorder(false)}
        />
      ) : null}

      {showCreateRem ? (
        <div className="client-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowCreateRem(false)}>
          <div className="client-modal gf-modal" style={{ maxWidth: 460 }}>
            <header>
              <h2>Generar remisión</h2>
              <button type="button" className="icon-button" onClick={() => setShowCreateRem(false)} aria-label={t("pedAriaCerrar")}>×</button>
            </header>
            <div className="gf-body">
              <p>Se generará una <strong>remisión</strong> a partir de esta preorden{po.folio ? ` ${po.folio}` : ""}, con los mismos artículos.</p>
              <p className="cap-hint">Quedará guardada como <strong>borrador</strong> para que agregues la plata fina y la completes. La preorden no se modifica.</p>
            </div>
            <footer className="gf-footer">
              <button type="button" className="secondary-button" onClick={() => setShowCreateRem(false)}>Cancelar</button>
              <button type="button" className="primary-button" onClick={() => { setShowCreateRem(false); onCreateRemision({ ...po, preorder_items: items }); }}>
                Sí, generar e ir a la remisión
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {showConfirmOrder ? (
        <div className="client-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowConfirmOrder(false)}>
          <div className="client-modal gf-modal order-confirm-modal" style={{ maxWidth: 560 }}>
            <header>
              <h2>Confirmar orden de compra</h2>
              <button type="button" className="icon-button" onClick={() => setShowConfirmOrder(false)} aria-label={t("pedAriaCerrar")}>×</button>
            </header>
            <div className="gf-body order-confirm-body">
              <p>
                Esta preorden se convertira en una <strong>orden confirmada</strong> con folio propio.
                Despues podras verla en la pestaña <strong>Ordenes de compra</strong>.
              </p>
              <div className="order-confirm-grid">
                <label>
                  <span>Anticipo recibido</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={orderConfirmForm.anticipo_mxn}
                    onChange={(e) => setOrderConfirmForm((current) => ({ ...current, anticipo_mxn: e.target.value }))}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  <span>URL del comprobante</span>
                  <input
                    value={orderConfirmForm.comprobante_url}
                    onChange={(e) => setOrderConfirmForm((current) => ({ ...current, comprobante_url: e.target.value }))}
                    placeholder="https://..."
                  />
                </label>
                <label>
                  <span>Nombre de quien acepta</span>
                  <input
                    value={orderConfirmForm.accepted_by_name}
                    onChange={(e) => setOrderConfirmForm((current) => ({ ...current, accepted_by_name: e.target.value }))}
                    placeholder={po.cliente_nombre || po.cliente_empresa || "Cliente"}
                  />
                </label>
                <label>
                  <span>Correo de aceptacion</span>
                  <input
                    type="email"
                    value={orderConfirmForm.accepted_by_email}
                    onChange={(e) => setOrderConfirmForm((current) => ({ ...current, accepted_by_email: e.target.value }))}
                    placeholder={po.cliente_email || "correo@empresa.com"}
                  />
                </label>
              </div>
              <label className="order-confirm-wide">
                <span>Terminos y condiciones</span>
                <textarea
                  rows={4}
                  value={orderConfirmForm.terms_text}
                  onChange={(e) => setOrderConfirmForm((current) => ({ ...current, terms_text: e.target.value }))}
                />
              </label>
              <label className="order-confirm-wide">
                <span>Notas internas</span>
                <textarea
                  rows={3}
                  value={orderConfirmForm.notas}
                  onChange={(e) => setOrderConfirmForm((current) => ({ ...current, notas: e.target.value }))}
                  placeholder="Ej. anticipo pendiente de validar, fecha acordada, condiciones especiales..."
                />
              </label>
              <label className="order-confirm-check">
                <input
                  type="checkbox"
                  checked={orderConfirmForm.terms_accepted}
                  onChange={(e) => setOrderConfirmForm((current) => ({ ...current, terms_accepted: e.target.checked }))}
                />
                <span>El cliente ya acepto los terminos de esta orden.</span>
              </label>
            </div>
            <footer className="gf-footer">
              <button type="button" className="secondary-button" onClick={() => setShowConfirmOrder(false)}>Cancelar</button>
              <button type="button" className="primary-button order-confirm-submit" onClick={handleConfirmOrder} disabled={confirmingOrder}>
                {confirmingOrder ? "Confirmando..." : "Si, confirmar orden"}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {confirmedOrder ? (
        <div className="order-confirm-success" role="status" aria-live="polite">
          <div className="order-confirm-success__mark">✓</div>
          <div>
            <strong>Orden confirmada</strong>
            <span>{confirmedOrder?.folio ? `${confirmedOrder.folio} · ` : ""}Podras verla en Ordenes de compra.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default PreorderEditorContent;
