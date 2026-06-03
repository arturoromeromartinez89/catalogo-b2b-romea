import { useEffect, useMemo, useRef, useState } from "react";
import { useCompany } from "../contexts/CompanyContext";
import { fetchCompanySettings } from "../services/companySettings";
import { fetchLines, fetchMetalPrices, calcPrecioGramo, getSilverFinePrice, fetchLaborLists, fetchLaborListLines, roundUp2 } from "../services/pricingService";
import { saveClient } from "../services/supabaseCatalog";
import { savePreorder, deletePreorder } from "../services/preorderService";
import { generatePdf } from "../utils/pdfGenerator";
import { useLanguage } from "../i18n/LanguageContext";
import { buildPlaceholderUrl, imageUrlForSize, shortText } from "../utils/formatters";
import { normalizeText } from "../utils/textNormalizer";
import { buildPreorderItemFromProduct } from "../utils/preorderUtils";

const STATUS = {
  borrador: { label: "Borrador", color: "#64748b" },
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

const calcItem = (item) => {
  const piezas = Number(item.piezas || 0);
  const gPieza = Number(item.gramos_por_pieza || 0);
  const gTotal = item._gt_manual != null ? Number(item._gt_manual) : piezas * gPieza;
  const pGramo = Number(item.precio_gramo_mxn || 0);
  return { ...item, gramos_total: gTotal, subtotal_mxn: gTotal * pGramo };
};

const Field = ({ label, children }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--color-text-secondary)" }}>
    {label}
    {children}
  </label>
);

function PreorderEditorContent({ preorder: initial, clients, products = [], onClose, onSaved, onDirty, pricingLocked = false, tenantId = "", profile }) {
  const { language } = useLanguage();
  const company = useCompany();
  const isNew = !initial?.id;
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
  const [selectedLaborListId, setSelectedLaborListId] = useState(initial?.labor_list_id || "");
  const [pricingDirty, setPricingDirty] = useState(false);
  const [metalPrices, setMetalPrices] = useState({});
  const [plataFinaMxn, setPlataFinaMxn] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productStatus, setProductStatus] = useState({ type: "info", text: "Escanea o busca un producto para agregarlo." });
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

  useEffect(() => {
    const currentList = laborLists.find((list) => list.id === selectedLaborListId);
    if (currentList && (currentList.currency || "MXN") !== po.moneda) {
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
  }, [po.moneda, laborLists, selectedLaborListId]);

  const exchangeRate = Number(po.tipo_cambio || metalPrices.tipo_cambio || 0);
  const useUsd = po.moneda === "USD" && exchangeRate > 0;
  const moneyLabel = po.moneda === "USD" ? "USD" : "MXN";
  const compatibleLaborLists = laborLists.filter((list) => (list.currency || "MXN") === po.moneda && (list.status || "borrador") === "activa");
  const toDisplayMoney = (value) => (useUsd ? Number(value || 0) / exchangeRate : Number(value || 0));
  const fromDisplayMoney = (value) => (useUsd ? Number(value || 0) * exchangeRate : Number(value || 0));
  const displayFineSilver = roundUp2(toDisplayMoney(plataFinaMxn));
  const markCustomPricing = () => {
    if (pricingLocked) return;
    setPricingDirty(true);
    setSelectedLaborListId(CUSTOM_PRICE_LIST_VALUE);
    setPo((current) => ({ ...current, labor_list_id: "" }));
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

  useEffect(() => {
    if (selectedLaborListId === CUSTOM_PRICE_LIST_VALUE) return;
    if (!selectedLaborListId || !laborLists.length || !lines.length) return;
    if (lines.some((line) => line._priceListLine)) return;
    applyLaborList(selectedLaborListId, lines);
  }, [selectedLaborListId, laborLists.length, lines.length]);

  const precargarPrecios = () => {
    if (!po.client_id) { setMsg("Debes seleccionar un cliente existente."); return; }
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

  const productResults = useMemo(() => {
    const term = normalizeText(productSearch);
    if (!term || term.length < 2) return [];
    return products
      .filter((product) => {
        const text = product.searchText || normalizeText([product.codigo, product.descripcion, product.linea, product.familia].join(" "));
        return term.split(/\s+/).every((word) => text.includes(word));
      })
      .slice(0, 8);
  }, [productSearch, products]);

  const addProduct = (product) => {
    const selectedList = laborLists.find((entry) => entry.id === selectedLaborListId);
    const rawItem = buildPreorderItemFromProduct(product, 1, lines, plataFinaMxn);
    const nextItem = priceItemFromLines(rawItem, lines, selectedList, getListSilverMxn(selectedList));
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
    setMsg(`${product.codigo} agregado a la preorden.`);
    setProductStatus({ type: "success", text: `${product.codigo} agregado. Listo para el siguiente.` });
    window.setTimeout(() => scannerInputRef.current?.focus(), 80);
  };

  const findProductByScan = (code) => {
    const scanned = normalizeText(code);
    if (!scanned) return null;
    return products.find((product) => {
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
    setSaving(true);
    setSaved(false);
    try {
      const resolvedClientId = await resolveClientForSave();
      if (!resolvedClientId) { setMsg("Debes seleccionar un cliente o registrar un prospecto para guardar la preorden."); return; }
      const savedId = await savePreorder({
        ...po,
        client_id: resolvedClientId,
        total_mxn: totalFinalMxn,
        tenant_id: resolvedTenantId,
        created_by: po.created_by || profile?.id || null,
      }, items);
      setPo((current) => ({ ...current, id: savedId }));
      setSaved(true);
      setMsg("Preorden guardada correctamente.");
      window.setTimeout(() => onSaved?.({ id: savedId, folio: po.folio }), 900);
    } catch (error) {
      setMsg(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePdf = async () => {
    if (!po.id) {
      setMsg("Primero guarda la preorden como borrador antes de generar PDF.");
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
      applyIva: false,
      showBreakdown: true,
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
      labor_mxn: item.labor_mxn,
      plata_fina_mxn: Math.max(0, Number(item.precio_gramo_mxn || 0) - Number(item.labor_mxn || 0)),
      precio_gramo_mxn: item.precio_gramo_mxn,
      subtotal_mxn: item.subtotal_mxn,
    }));
    await generatePdf(pdfItems, customer, language, activeCompany, {
      showGramos: true,
      applyIva: false,
      showBreakdown: true,
      silverFineMxn: plataFinaMxn,
      status: po.status,
    });
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
              <Field label={`Lista ${po.moneda}`}>
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
            <div className="po-remission-total-row"><span>Gramos</span><strong>{totals.gramos.toFixed(2)} g</strong></div>
            <div className="po-remission-total-row"><span>Piezas</span><strong>{totals.piezas}</strong></div>
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
                <span>{selectedLaborListId === CUSTOM_PRICE_LIST_VALUE ? "Personalizada" : po.moneda}</span>
              </div>
              <Field label="Moneda">
                <select value={po.moneda} onChange={set("moneda", { pricing: true })} style={inp}>
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
              <Field label={`Lista de precios ${po.moneda}`}>
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
              <div><span>Gramos</span><strong>{totals.gramos.toFixed(2)} g</strong></div>
              <div><span>Piezas</span><strong>{totals.piezas}</strong></div>
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
                </thead>
                <tbody>
                  {items.length ? items.map((item, idx) => {
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
                          <small>{[item.producto_metal, item.producto_kilataje].filter(Boolean).join(" / ")}</small>
                        </td>
                        <td><strong>{item.producto_linea || "-"}</strong></td>
                        <td><input type="number" step="0.01" value={item.gramos_por_pieza} onChange={(event) => setItem(idx, "gramos_por_pieza", Number(event.target.value))} /></td>
                        <td><input type="number" step="0.01" value={item._gt_manual ?? item.gramos_total} onChange={(event) => setGTotal(idx, event.target.value)} readOnly={pricingLocked} /></td>
                        <td><input type="number" step="0.01" value={toDisplayMoney(item.labor_mxn) || ""} onChange={(event) => setLabor(idx, event.target.value)} readOnly={pricingLocked} /></td>
                        <td className="right">{fmt(toDisplayMoney(fineSilver))}</td>
                        <td className="right">{fmt(toDisplayMoney(item.precio_gramo_mxn))}</td>
                        <td><input value={item.comentarios || ""} onChange={(event) => setItem(idx, "comentarios", event.target.value)} placeholder="Color, piedra, medida..." /></td>
                        <td className="right"><strong>{fmt(toDisplayMoney(item.subtotal_mxn))}</strong></td>
                        <td><button className="table-delete" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== idx))}>x</button></td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan="12" className="empty-row">Sin productos. Agrega productos desde el catalogo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="po-totals-bar">
            <div><span>Piezas</span><strong>{totals.piezas}</strong></div>
            <div><span>Gramos</span><strong>{totals.gramos.toFixed(2)} g</strong></div>
            <div><span>Subtotal {moneyLabel}</span><strong>{fmt(toDisplayMoney(totals.mxn))}</strong></div>
            <div className="po-total-highlight"><span>Total {moneyLabel}</span><strong>{fmt(toDisplayMoney(totalFinalMxn))}</strong></div>
          </section>
      </main>
    </div>
  );
}

export default PreorderEditorContent;
