import { useEffect, useMemo, useRef, useState } from "react";
import { useCompany } from "../contexts/CompanyContext";
import { fetchCompanySettings } from "../services/companySettings";
import { fetchLines, fetchMetalPrices, calcPrecioGramo, getSilverFinePrice, fetchLaborLists, fetchLaborListLines, fetchPiecePriceLists, fetchPiecePriceListItems, roundUp2 } from "../services/pricingService";
import { saveClient } from "../services/supabaseCatalog";
import { savePreorder, deletePreorder } from "../services/preorderService";
import { generatePdf } from "../utils/pdfGenerator";
import { useLanguage } from "../i18n/LanguageContext";
import { buildPlaceholderUrl, imageUrlForSize, shortText } from "../utils/formatters";
import { normalizeText } from "../utils/textNormalizer";
import { buildPreorderItemFromProduct } from "../utils/preorderUtils";
import { buildConfigurableCatalogProducts, isConfigurableProductGroup } from "../utils/configurableCatalog";

const STATUS = {
  pendiente: { label: "Pendiente de revision", color: "#d97706" },
  revision: { label: "En revision", color: "#2563eb" },
  confirmada: { label: "Confirmada", color: "#059669" },
  cancelada: { label: "Cancelada", color: "#dc2626" },
};

const fmt = (value) =>
  Number(value || 0)
    ? `$${Number(value || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "-";

const IVA_RATE = 0.16;
const PROSPECT_CLIENT_VALUE = "__new_prospect__";
const CUSTOM_PRICE_LIST_VALUE = "__custom_price_list__";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
    comentarios: "Pendiente de configurar tipo de pieza",
    _configurable_group: true,
    _configurable_title: product.configurableTitle || product.descripcion,
    _configurable_variants: (product.variants || []).map((variant) => ({
      code: variant.code,
      label: variant.label,
      product: variant.product,
    })),
  };
};

const hasUnconfiguredItems = (items = []) => items.some((item) => item?._configurable_group);

const Field = ({ label, children }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--color-text-secondary)" }}>
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

function PreorderEditorContent({ preorder: initial, clients, products = [], onClose, onSaved, onDirty, pricingLocked = false, tenantId = "", profile }) {
  const { language } = useLanguage();
  const company = useCompany();
  const hasSavedInitialId = UUID_RE.test(String(initial?.id || ""));
  const isNew = !hasSavedInitialId;
  const resolvedTenantId = tenantId || initial?.tenant_id || initial?.tenantId || profile?.tenant_id || "";

  const blank = {
    folio: "",
    status: "pendiente",
    tenant_id: resolvedTenantId,
    created_by: profile?.id || "",
    client_id: "",
    cliente_nombre: "",
    cliente_empresa: "",
    cliente_email: "",
    cliente_telefono: "",
    cliente_rfc: "",
    tipo_cambio: "",
    moneda: "MXN",
    notas: "",
    pricing_mode: initial?.pricing_mode || "gram",
    pf_mode: "manual",
    kitco_usd_oz: "",
    premio_pct: 0,
    aplicar_iva: false,
    mostrar_desglose: true,
  };

  const [po, setPo] = useState({ ...blank, ...(initial || {}) });
  const [items, setItems] = useState((initial?.preorder_items || []).map((item) => ({ ...item })));
  const [lines, setLines] = useState([]);
  const [laborLists, setLaborLists] = useState([]);
  const [piecePriceLists, setPiecePriceLists] = useState([]);
  const [selectedLaborListId, setSelectedLaborListId] = useState(initial?.labor_list_id || "");
  const [selectedPiecePriceListId, setSelectedPiecePriceListId] = useState(initial?.piece_price_list_id || "");
  const [piecePriceItems, setPiecePriceItems] = useState([]);
  const [pricingDirty, setPricingDirty] = useState(false);
  const [metalPrices, setMetalPrices] = useState({});
  const [plataFinaMxn, setPlataFinaMxn] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productStatus, setProductStatus] = useState({ type: "info", text: "Escanea o busca un producto para agregarlo." });
  const [importingPreorderExcel, setImportingPreorderExcel] = useState(false);
  const [prospectForm, setProspectForm] = useState({ name: "", company: "", email: "", phone: "", rfc: "", active: true });
  const [tenantCompany, setTenantCompany] = useState(null);
  const scannerInputRef = useRef(null);
  const activeCompany = resolvedTenantId ? (tenantCompany || {}) : company;
  const markEdited = () => {
    onDirty?.();
    setSaved(false);
  };

  useEffect(() => {
    if (resolvedTenantId) fetchCompanySettings(resolvedTenantId).then(setTenantCompany).catch(() => setTenantCompany(null));
    else setTenantCompany(null);
    fetchLines(resolvedTenantId).then(setLines).catch((error) => setMsg(`Error: ${error.message}`));
    fetchLaborLists(resolvedTenantId).then(setLaborLists).catch(() => setLaborLists([]));
    fetchPiecePriceLists(resolvedTenantId)
      .then(setPiecePriceLists)
      .catch((error) => {
        if (/piece_price_lists|schema cache|does not exist/i.test(error.message || "")) setPiecePriceLists([]);
        else setMsg(`Error: ${error.message}`);
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
      .catch((error) => setMsg(`Error: ${error.message}`));
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
      setMsg(`La lista se removio porque la preorden cambio a ${po.moneda}.`);
    }
    const currentPieceList = piecePriceLists.find((list) => list.id === selectedPiecePriceListId);
    if (isPieceMode && currentPieceList && (currentPieceList.currency || "MXN") !== po.moneda) {
      setSelectedPiecePriceListId("");
      setPiecePriceItems([]);
      setPo((current) => ({ ...current, piece_price_list_id: "" }));
      setItems((current) => current.map((item) => calcItem({ ...item, precio_pieza_mxn: 0 })));
      setMsg(`La lista por pieza se removio porque la preorden cambio a ${po.moneda}.`);
    }
  }, [po.moneda, laborLists, selectedLaborListId, piecePriceLists, selectedPiecePriceListId, isPieceMode]);

  const compatibleLaborLists = laborLists.filter((list) => (list.currency || "MXN") === po.moneda && (list.status || "borrador") === "activa");
  const compatiblePiecePriceLists = piecePriceLists.filter((list) => (list.currency || "MXN") === po.moneda && (list.status || "borrador") === "activa");
  const toDisplayMoney = (value) => (useUsd ? Number(value || 0) / exchangeRate : Number(value || 0));
  const fromDisplayMoney = (value) => (useUsd ? Number(value || 0) * exchangeRate : Number(value || 0));
  const displayFineSilver = roundUp2(toDisplayMoney(plataFinaMxn));
  const markCustomPricing = () => {
    if (pricingLocked) return;
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
    markEdited();
    if (options.pricing) markCustomPricing();
    setPo((current) => ({ ...current, [key]: event.target.value }));
  };
  const setChecked = (key) => (event) => {
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
    if (pricingLocked) return;
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
    if (pricingLocked) return;
    markEdited();
    markCustomPricing();
    setItems((current) => {
      const next = [...current];
      next[idx] = recalcWithPrice(next[idx], fromDisplayMoney(value), plataFinaMxn);
      return next;
    });
  };

  const setSilverFine = (value) => {
    if (pricingLocked) return;
    markEdited();
    markCustomPricing();
    const nextSilver = fromDisplayMoney(value);
    setPlataFinaMxn(nextSilver);
    setItems((current) => current.map((item) => recalcWithPrice(item, item.labor_mxn, nextSilver)));
  };

  const calculateSilverFineByKitco = () => {
    if (pricingLocked) return;
    const nextSilver = getSilverFinePrice({
      kitco_usd_oz: po.kitco_usd_oz,
      tipo_cambio: po.tipo_cambio || metalPrices.tipo_cambio,
      premio_pct: po.premio_pct || 0,
    });
    if (!nextSilver) {
      setMsg("Captura KITCO USD/oz y tipo de cambio para calcular la plata fina.");
      return;
    }
    setPlataFinaMxn(nextSilver);
    setItems((current) => current.map((item) => recalcWithPrice(item, item.labor_mxn, nextSilver)));
    setMsg("Plata fina actualizada.");
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
      setMsg("Lista de labor removida. Usando mano de obra base de líneas.");
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
      setMsg(`Lista "${listName}" aplicada.`);
    } catch (err) {
      setMsg(`Error al cargar lista: ${err.message}`);
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
      setMsg("Lista por pieza removida. Usando precios por pieza personalizados.");
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
      setMsg(`Lista por pieza "${selectedList?.name || listId}" aplicada.`);
    } catch (error) {
      setMsg(`Error al cargar lista por pieza: ${error.message}`);
    }
  };

  const changePricingMode = (mode) => {
    if (pricingLocked) return;
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
    if (!po.client_id) { setMsg("Debes seleccionar un cliente existente."); return; }
    if (isPieceMode) {
      const selectedList = piecePriceLists.find((entry) => entry.id === selectedPiecePriceListId);
      if (!selectedList) { setMsg("Selecciona una lista por pieza activa."); return; }
      if (!piecePriceItems.length) { setMsg("La lista por pieza no tiene SKUs cargados."); return; }
      setItems((current) => current.map((item) => pricePieceItemFromList(item, piecePriceItems, selectedList)));
      setPricingDirty(false);
      setMsg(`Precios por pieza recalculados con "${selectedList.name}".`);
      return;
    }
    if (!lines.length) { setMsg("No hay lineas configuradas en el menu de precios."); return; }
    if (!plataFinaMxn) { setMsg("Captura primero el precio de plata fina."); return; }

    const selectedList = laborLists.find((entry) => entry.id === selectedLaborListId);
    const listSilverMxn = getListSilverMxn(selectedList);
    setItems((current) => current.map((item) => priceItemFromLines(item, lines, selectedList, listSilverMxn)));
    setPricingDirty(false);
    setMsg(selectedList ? `Precios recalculados con "${selectedList.name}".` : "Precios recalculados.");
  };

  const totals = {
    piezas: items.reduce((sum, item) => sum + Number(item.piezas || 0), 0),
    gramos: items.reduce((sum, item) => sum + Number(item.gramos_total || 0), 0),
    mxn: items.reduce((sum, item) => sum + Number(item.subtotal_mxn || 0), 0),
  };
  const ivaMxn = po.aplicar_iva ? totals.mxn * IVA_RATE : 0;
  const totalFinalMxn = totals.mxn + ivaMxn;

  const preorderCatalogProducts = useMemo(
    () => buildConfigurableCatalogProducts(products || []),
    [products]
  );

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

  const addProduct = (product) => {
    const selectedList = laborLists.find((entry) => entry.id === selectedLaborListId);
    const selectedPieceList = piecePriceLists.find((entry) => entry.id === selectedPiecePriceListId);
    const rawItem = buildPreorderItemFromProduct(product, 1, lines, plataFinaMxn);
    const nextItem = isConfigurableProductGroup(product)
      ? buildConfigurablePreorderItem(product, 1)
      : isPieceMode
        ? pricePieceItemFromList({ ...rawItem, pricing_mode: "piece" }, piecePriceItems, selectedPieceList)
        : priceItemFromLines(rawItem, lines, selectedList, getListSilverMxn(selectedList));
    setItems((current) => {
      const existing = current.find((item) => item.producto_codigo === nextItem.producto_codigo);
      if (existing) {
        return current.map((item) =>
          item.producto_codigo === nextItem.producto_codigo
            ? calcItem({ ...item, piezas: Number(item.piezas || 0) + 1 })
            : item
        );
      }
      return [...current, nextItem];
    });
    markEdited();
    setProductSearch("");
    setMsg(
      isConfigurableProductGroup(product)
        ? `${product.configurableTitle || product.descripcion} agregado. Configura el tipo de pieza en la tabla.`
        : `${product.codigo} agregado a la preorden.`
    );
    setProductStatus({
      type: "success",
      text: isConfigurableProductGroup(product)
        ? "Base agregada. Ahora elige tipo de pieza en la fila de la preorden."
        : `${product.codigo} agregado. Listo para el siguiente.`,
    });
    window.setTimeout(() => scannerInputRef.current?.focus(), 80);
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
      setProductStatus({ type: "error", text: "Cambia la preorden a Por pieza antes de cargar Excel." });
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
        setProductStatus({ type: "error", text: `No encontre ningun SKU del Excel en el catalogo. Revisa codigos.` });
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
        text: `${found.length} SKUs cargados desde Excel.${rowsWithExcelPrice ? " Precio tomado del Excel." : hasValidSelectedList ? " Precio tomado de la lista seleccionada." : ""}${rowsWithoutPrice && !hasValidSelectedList ? ` ${rowsWithoutPrice} sin precio quedaron en 0 para editar.` : ""}${missing.length ? ` No encontrados: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "..." : ""}` : ""}`,
      });
      setMsg(rowsWithExcelPrice
        ? `${found.length} productos importados. La preorden queda con precios personalizados del Excel.`
        : `${found.length} productos importados a la preorden por pieza.`
      );
    } catch (error) {
      setProductStatus({ type: "error", text: `No se pudo leer el Excel: ${error.message}` });
    } finally {
      setImportingPreorderExcel(false);
      window.setTimeout(() => scannerInputRef.current?.focus(), 80);
    }
  };

  const applyConfigurableVariant = (idx, variantCode) => {
    const sourceItem = items[idx];
    const variant = (sourceItem?._configurable_variants || []).find((entry) => entry.product?.codigo === variantCode);
    if (!variant?.product) return;

    const selectedList = laborLists.find((entry) => entry.id === selectedLaborListId);
    const selectedPieceList = piecePriceLists.find((entry) => entry.id === selectedPiecePriceListId);
    const rawItem = buildPreorderItemFromProduct(variant.product, Number(sourceItem.piezas || 1), lines, plataFinaMxn);
    const pricedItem = isPieceMode
      ? pricePieceItemFromList({ ...rawItem, pricing_mode: "piece" }, piecePriceItems, selectedPieceList)
      : priceItemFromLines(rawItem, lines, selectedList, getListSilverMxn(selectedList));
    const configuredDescription = `${variant.label} ${sourceItem._configurable_title || sourceItem.producto_descripcion}`.trim();

    setItems((current) =>
      current.map((item, itemIdx) =>
        itemIdx === idx
          ? {
              ...pricedItem,
              producto_descripcion: configuredDescription,
              comentarios: "",
            }
          : item
      )
    );
    markEdited();
    setMsg(`${variant.product.codigo} configurado en la preorden.`);
    setProductStatus({ type: "success", text: `${variant.product.codigo} configurado. Puedes seguir agregando productos.` });
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
      setProductStatus({ type: "error", text: "Escanea, escribe un SKU o busca un producto primero." });
      scannerInputRef.current?.focus();
      return;
    }
    const product = findProductByScan(code);
    if (!product) {
      setProductStatus({ type: "error", text: `No encontre producto con codigo exacto: ${code}` });
      window.setTimeout(() => scannerInputRef.current?.focus(), 80);
      return;
    }
    addProduct(product);
    window.setTimeout(() => scannerInputRef.current?.focus(), 80);
  };

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
    setMsg("Prospecto creado como cliente y listo para guardar preorden.");
    return savedClient.id;
  };

  const handleSave = async () => {
    if (!items.length) { setMsg("Agrega al menos un producto para guardar la preorden."); return; }
    if (hasUnconfiguredItems(items)) {
      setMsg("Configura el tipo de pieza en todos los productos pendientes antes de guardar.");
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      const resolvedClientId = await resolveClientForSave();
      if (!resolvedClientId) { setMsg("Debes seleccionar un cliente o registrar un prospecto para guardar la preorden."); return; }
      const savedResult = await savePreorder({
        ...po,
        pricing_mode: pricingMode,
        labor_list_id: isPieceMode ? "" : selectedLaborListId,
        piece_price_list_id: isPieceMode ? selectedPiecePriceListId : "",
        client_id: resolvedClientId,
        total_mxn: totalFinalMxn,
        tenant_id: resolvedTenantId,
        created_by: po.created_by || profile?.id || null,
      }, items);
      const savedId = typeof savedResult === "string" ? savedResult : savedResult.id;
      const savedFolio = typeof savedResult === "string" ? po.folio : savedResult.folio;
      setPo((current) => ({ ...current, id: savedId, folio: savedFolio || current.folio }));
      setSaved(true);
      setMsg("Preorden guardada correctamente.");
      window.setTimeout(() => onSaved?.({ id: savedId, folio: savedFolio || po.folio }), 900);
    } catch (error) {
      setMsg(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePdf = async () => {
    if (hasUnconfiguredItems(items)) {
      setMsg("Configura el tipo de pieza en todos los productos pendientes antes de generar PDF.");
      return;
    }
    if (!UUID_RE.test(String(po.id || ""))) {
      setMsg("Primero guarda la preorden antes de generar PDF.");
      return;
    }
    if (!po.client_id) { setMsg("Debes seleccionar un cliente o registrar un prospecto para generar el PDF."); return; }
    if (isProspectMode && !prospectForm.name.trim() && !prospectForm.company.trim()) {
      setMsg("Captura nombre o empresa del prospecto antes de generar PDF.");
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
      status: po.status,
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
      status: po.status,
    });
  };

  const handleExcelDownload = async () => {
    if (!items.length) {
      setMsg("Agrega al menos un producto para descargar la preorden en Excel.");
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
      XLSX.writeFile(workbook, fileName);
      setMsg("Excel de preorden descargado correctamente.");
    } catch (error) {
      setMsg(`Error al descargar Excel: ${error.message}`);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Eliminar esta preorden?")) return;
    await deletePreorder(po.id);
    onSaved?.();
  };

  const handleClose = () => {
    onClose?.({ ...po, preorder_items: items });
  };

  return (
    <div className="po-editor">
      <header className="po-editor-toolbar po-editor-toolbar--remission">
        <div className="po-editor-toolbar-left">
          <span className="tool-eyebrow">{isNew ? "Nueva preorden" : po.folio}</span>
          <div className="po-status-pills">
            {Object.entries(STATUS).map(([key, { label, color }]) => (
              <button
                key={key}
                type="button"
                className="po-status-pill"
                onClick={() => {
                  if (pricingLocked) return;
                  markEdited();
                  setPo((current) => ({ ...current, status: key }));
                }}
                style={{
                  borderColor: color,
                  background: po.status === key ? color : "transparent",
                  color: po.status === key ? "#fff" : color,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {po.cliente_empresa || po.cliente_nombre ? (
            <span className="po-client-chip">
              {po.cliente_empresa || po.cliente_nombre}
            </span>
          ) : null}
        </div>
        <div className="po-editor-toolbar-right">
          {msg ? <span className="po-toolbar-msg">{msg}</span> : null}
          {!isNew ? (
            <button className="danger-button compact-action" type="button" onClick={handleDelete}>
              Eliminar
            </button>
          ) : null}
          <button className="secondary-button compact-action" type="button" onClick={handlePdf}>
            PDF
          </button>
          <button className="secondary-button compact-action" type="button" onClick={handleExcelDownload}>
            Excel
          </button>
          <button
            className="primary-button compact-action"
            type="button"
            onClick={handleSave}
            disabled={saving || saved}
          >
            {saving ? "Guardando..." : saved ? "Guardado ✓" : "Guardar"}
          </button>
        </div>
        <div className="po-remission-info">
          <section className="po-remission-group po-remission-group--client">
            <div className="po-remission-title">Cliente</div>
            <div className="po-remission-fields po-remission-fields--client">
              <Field label="Fecha">
                <input value={new Date(initial?.created_at || Date.now()).toLocaleDateString("es-MX")} readOnly style={inp} />
              </Field>
              <Field label="Cliente">
                <select value={po.client_id} onChange={handleClientSelect} style={inp}>
                  <option value="">Selecciona cliente existente</option>
                  <option value={PROSPECT_CLIENT_VALUE}>+ Prospecto nuevo</option>
                  {(clients || []).map((client) => (
                    <option key={client.id} value={client.id}>{client.company || client.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Nombre"><input value={po.cliente_nombre || ""} readOnly style={inp} /></Field>
              <Field label="Empresa"><input value={po.cliente_empresa || ""} readOnly style={inp} /></Field>
              <Field label="Telefono"><input value={po.cliente_telefono || ""} readOnly style={inp} /></Field>
              <Field label="RFC"><input value={po.cliente_rfc || ""} readOnly style={inp} /></Field>
            </div>
          </section>

          <section className="po-remission-group">
            <div className="po-remission-title">Moneda y lista</div>
            <div className="po-remission-fields">
              <Field label="Moneda">
                <select value={po.moneda} onChange={set("moneda", { pricing: true })} style={inp}>
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
              <Field label="Tipo">
                <select value={pricingMode} onChange={(e) => changePricingMode(e.target.value)} disabled={pricingLocked} style={inp}>
                  <option value="gram">Por gramo</option>
                  <option value="piece">Por pieza</option>
                </select>
              </Field>
              <Field label={isPieceMode ? `Lista por pieza ${po.moneda}` : `Lista por gramo ${po.moneda}`}>
                {isPieceMode ? (
                  <select
                    value={selectedPiecePriceListId || ""}
                    onChange={(e) => applyPiecePriceList(e.target.value)}
                    disabled={pricingLocked}
                    style={inp}
                  >
                    <option value="">Selecciona una lista activa</option>
                    <option value={CUSTOM_PRICE_LIST_VALUE}>Personalizada</option>
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
                    <option value="">Selecciona una lista activa</option>
                    <option value={CUSTOM_PRICE_LIST_VALUE}>Personalizada</option>
                    {compatibleLaborLists.map((list) => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Tipo de cambio">
                <input type="number" step="0.01" placeholder="Ej. 17.25" value={po.tipo_cambio || ""} onChange={set("tipo_cambio", { pricing: true })} style={inp} />
              </Field>
              <Field label="Estatus">
                <select value={po.status || "pendiente"} onChange={set("status")} style={inp}>
                  {Object.entries(STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
                </select>
              </Field>
            </div>
          </section>

          <section className="po-remission-group po-remission-group--notes">
            <div className="po-remission-title">Comentarios</div>
            <textarea value={po.notas || ""} onChange={set("notas")} placeholder="Observaciones generales de la preorden" />
          </section>

          <section className="po-remission-group po-remission-group--totals">
            <div className="po-remission-title">Totales</div>
            <div className="po-remission-total-row"><span>Piezas</span><strong>{totals.piezas}</strong></div>
            {!isPieceMode ? (
              <div className="po-remission-total-row"><span>Gramos</span><strong>{totals.gramos.toFixed(2)} g</strong></div>
            ) : null}
            <div className="po-remission-total-row po-remission-total-row--money"><span>Total {moneyLabel}</span><strong>{fmt(toDisplayMoney(totalFinalMxn))}</strong></div>
          </section>
        </div>
      </header>

      <main className="po-editor-body">
          <section className="po-header-sheet">
            <div className="po-header-section po-header-section--client">
              <div className="po-header-line">
                <strong>Preorden</strong>
                <span>{new Date(initial?.created_at || Date.now()).toLocaleDateString("es-MX")}</span>
              </div>
              <Field label="Cliente">
                <select value={po.client_id} onChange={handleClientSelect} style={inp}>
                  <option value="">Selecciona cliente existente</option>
                  <option value={PROSPECT_CLIENT_VALUE}>+ Prospecto nuevo</option>
                  {(clients || []).map((client) => (
                    <option key={client.id} value={client.id}>{client.company || client.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Nombre"><input value={po.cliente_nombre || ""} readOnly style={inp} /></Field>
              <Field label="Empresa"><input value={po.cliente_empresa || ""} readOnly style={inp} /></Field>
              <Field label="Telefono"><input value={po.cliente_telefono || ""} readOnly style={inp} /></Field>
              <Field label="RFC"><input value={po.cliente_rfc || ""} readOnly style={inp} /></Field>
            </div>

            <div className="po-header-section po-header-section--pricing">
              <div className="po-header-line">
                <strong>Costeo</strong>
                <span>{isPieceMode ? "Por pieza" : selectedLaborListId === CUSTOM_PRICE_LIST_VALUE ? "Personalizada" : "Por gramo"}</span>
              </div>
              <Field label="Moneda">
                <select value={po.moneda} onChange={set("moneda", { pricing: true })} style={inp}>
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
              <Field label="Tipo de cotizacion">
                <select value={pricingMode} onChange={(e) => changePricingMode(e.target.value)} disabled={pricingLocked} style={inp}>
                  <option value="gram">Por gramo</option>
                  <option value="piece">Por pieza</option>
                </select>
              </Field>
              <Field label={isPieceMode ? `Lista por pieza ${po.moneda}` : `Lista por gramo ${po.moneda}`}>
                {isPieceMode ? (
                  <select
                    value={selectedPiecePriceListId || ""}
                    onChange={(e) => applyPiecePriceList(e.target.value)}
                    disabled={pricingLocked}
                    style={inp}
                  >
                    <option value="">Selecciona una lista activa</option>
                    <option value={CUSTOM_PRICE_LIST_VALUE}>Personalizada</option>
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
                    <option value="">Selecciona una lista activa</option>
                    <option value={CUSTOM_PRICE_LIST_VALUE}>Personalizada</option>
                    {compatibleLaborLists.map((list) => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Tipo de cambio USD">
                <input type="number" step="0.01" placeholder="Ej. 17.25" value={po.tipo_cambio || ""} onChange={set("tipo_cambio", { pricing: true })} style={inp} />
              </Field>
              <Field label="Estatus">
                <select value={po.status || "pendiente"} onChange={set("status")} style={inp}>
                  {Object.entries(STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
                </select>
              </Field>
            </div>

            <div className="po-header-section po-header-section--notes">
              <div className="po-header-line">
                <strong>Comentarios</strong>
              </div>
              <textarea value={po.notas || ""} onChange={set("notas")} placeholder="Observaciones generales de la preorden" />
            </div>

            <div className="po-header-section po-header-section--totals">
              <div className="po-header-line">
                <strong>Totales</strong>
              </div>
              <div><span>Piezas</span><strong>{totals.piezas}</strong></div>
              {!isPieceMode ? (
                <div><span>Gramos</span><strong>{totals.gramos.toFixed(2)} g</strong></div>
              ) : null}
              <div><span>Total {moneyLabel}</span><strong>{fmt(toDisplayMoney(totalFinalMxn))}</strong></div>
            </div>
          </section>
            {isProspectMode ? (
              <div className="prospect-inline-card">
                <div>
                  <h4>Prospecto JCK</h4>
                  <p>Captura sus datos aqui mismo. Al guardar la preorden, se crea el cliente/prospecto.</p>
                </div>
                <div className="form-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                  <Field label="Nombre"><input value={prospectForm.name} onChange={(event) => updateProspect("name", event.target.value)} style={inp} placeholder="Nombre del contacto" /></Field>
                  <Field label="Empresa"><input value={prospectForm.company} onChange={(event) => updateProspect("company", event.target.value)} style={inp} placeholder="Empresa / tienda" /></Field>
                  <Field label="Correo"><input value={prospectForm.email} onChange={(event) => updateProspect("email", event.target.value)} style={inp} placeholder="correo@empresa.com" /></Field>
                  <Field label="Telefono"><input value={prospectForm.phone} onChange={(event) => updateProspect("phone", event.target.value)} style={inp} placeholder="+1..." /></Field>
                  <Field label="RFC / Tax ID"><input value={prospectForm.rfc} onChange={(event) => updateProspect("rfc", event.target.value)} style={inp} placeholder="Opcional" /></Field>
                </div>
              </div>
            ) : null}

          {!isPieceMode ? (
          <section className="quote-block quote-block--pricing">
            <h3>Costeo de plata fina</h3>

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
                      <input type="number" step="0.01" placeholder="Ej. 31.50" value={po.kitco_usd_oz || ""} onChange={set("kitco_usd_oz", { pricing: true })} readOnly={pricingLocked} />
                    </label>
                    <label className="po-pricing-field">
                      Premio Kitco (%)
                      <input type="number" step="0.1" min="0" placeholder="Ej. 4" value={po.premio_pct ?? 0} onChange={set("premio_pct", { pricing: true })} readOnly={pricingLocked} />
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
            <h3>Productos cotizados</h3>
            {msg ? <p className="status info">{msg}</p> : null}
            {!pricingLocked && products.length ? (
              <div className="quote-product-picker">
                <label>
                  Agregar producto a esta preorden
                  <input
                    ref={scannerInputRef}
                    value={productSearch}
                    onChange={(event) => {
                      setProductSearch(event.target.value);
                      if (productStatus.type !== "info") {
                        setProductStatus({ type: "info", text: "Presiona Enter para agregar un codigo exacto o elige una sugerencia." });
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleProductEntrySubmit();
                      }
                    }}
                    placeholder="Escanear codigo o buscar por SKU, descripcion, linea o familia"
                  />
                </label>
                <div className="quote-picker-actions">
                  <button className="primary-button compact-action" type="button" onClick={handleProductEntrySubmit}>
                    Agregar por codigo
                  </button>
                  {isPieceMode ? (
                    <label className={`secondary-button compact-action file-action preorder-excel-action ${importingPreorderExcel ? "disabled" : ""}`}>
                      {importingPreorderExcel ? "Leyendo Excel..." : "Cargar Excel de preorden"}
                      <input type="file" accept=".xlsx,.xls" onChange={handlePreorderExcelImport} disabled={importingPreorderExcel} />
                    </label>
                  ) : null}
                  <p className={`scanner-status ${productStatus.type}`}>{productStatus.text}</p>
                </div>
                {productResults.length ? (
                  <div className="quote-product-results">
                    {productResults.map((product) => (
                      <button key={product.id || product.codigo} type="button" onClick={() => addProduct(product)}>
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

            <div className="responsive-table">
              <table className="simple-admin-table quote-items-table">
                <thead>
                  {isPieceMode ? (
                    <tr>
                      <th>Foto</th>
                      <th>SKU</th>
                      <th className="right">Cantidad</th>
                      <th>Descripcion</th>
                      <th>Linea</th>
                      <th className="right">Precio pieza {moneyLabel}</th>
                      <th>Comentarios</th>
                      <th className="right">Subtotal</th>
                      <th></th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Foto</th>
                      <th>SKU</th>
                      <th className="right">Cantidad</th>
                      <th>Descripcion</th>
                      <th>Linea</th>
                      <th className="right">Peso unit.</th>
                      <th className="right">Gramos totales</th>
                      <th className="right">Labor/g {moneyLabel}</th>
                      <th className="right">PF/g {moneyLabel}</th>
                      <th className="right">Labor+PF {moneyLabel}</th>
                      <th>Comentarios</th>
                      <th className="right">Subtotal</th>
                      <th></th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {items.length ? items.map((item, idx) => {
                    const isConfigurableItem = Boolean(item._configurable_group);
                    const fineSilver = Math.max(0, Number(item.precio_gramo_mxn || 0) - Number(item.labor_mxn || 0));
                    return (
                      <tr key={`${item.producto_codigo}-${idx}`}>
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
                          {isConfigurableItem ? (
                            <select
                              value=""
                              onChange={(event) => applyConfigurableVariant(idx, event.target.value)}
                              style={{ marginTop: 6, width: "100%" }}
                            >
                              <option value="">Configurar tipo de pieza...</option>
                              {(item._configurable_variants || []).map((variant) => (
                                <option key={variant.product?.codigo || variant.code} value={variant.product?.codigo || ""}>
                                  {variant.label} - {variant.product?.codigo}
                                </option>
                              ))}
                            </select>
                          ) : null}
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
                        <td><input value={item.comentarios || ""} onChange={(event) => setItem(idx, "comentarios", event.target.value)} placeholder="Color, piedra, medida..." /></td>
                        <td className="right"><strong>{fmt(toDisplayMoney(item.subtotal_mxn))}</strong></td>
                        <td><button className="table-delete" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== idx))}>x</button></td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={isPieceMode ? "9" : "13"} className="empty-row">Sin productos. Agrega productos desde el catalogo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="po-totals-bar">
            <div><span>Piezas</span><strong>{totals.piezas}</strong></div>
            {!isPieceMode ? (
              <div><span>Gramos</span><strong>{totals.gramos.toFixed(2)} g</strong></div>
            ) : null}
            <div><span>Subtotal {moneyLabel}</span><strong>{fmt(toDisplayMoney(totals.mxn))}</strong></div>
            <div className="po-total-highlight"><span>Total {moneyLabel}</span><strong>{fmt(toDisplayMoney(totalFinalMxn))}</strong></div>
          </section>
      </main>
    </div>
  );
}

export default PreorderEditorContent;
