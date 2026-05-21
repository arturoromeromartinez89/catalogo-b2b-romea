import { useEffect, useMemo, useRef, useState } from "react";
import { useCompany } from "../contexts/CompanyContext";
import { fetchCompanySettings } from "../services/companySettings";
import { fetchLines, fetchMetalPrices, calcPrecioGramo, getSilverFinePrice, fetchLaborLists, fetchLaborListLines } from "../services/pricingService";
import { saveClient } from "../services/supabaseCatalog";
import { savePreorder, deletePreorder } from "../services/preorderService";
import { generatePdf } from "../utils/pdfGenerator";
import { useLanguage } from "../i18n/LanguageContext";
import { buildPlaceholderUrl, shortText } from "../utils/formatters";
import { normalizeText } from "../utils/textNormalizer";

const STATUS = {
  pendiente: { label: "Pendiente", color: "#d97706" },
  revision: { label: "En revision", color: "#2563eb" },
  confirmada: { label: "Confirmada", color: "#059669" },
  cancelada: { label: "Cancelada", color: "#dc2626" },
};

const fmt = (value) =>
  Number(value || 0)
    ? `$${Number(value || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "-";

const IVA_RATE = 0.16;
const TROY_OUNCE_GRAMS = 31.1035;
const PROSPECT_CLIENT_VALUE = "__new_prospect__";

const calcSilverFineFromKitco = (kitcoUsdOz, exchangeRate, premiumPct = 0) => {
  const kitco = Number(kitcoUsdOz || 0);
  const tc = Number(exchangeRate || 0);
  const premium = Number(premiumPct || 0);
  if (!kitco || !tc) return 0;
  return (kitco / TROY_OUNCE_GRAMS) * (1 + premium / 100) * tc;
};

const calcItem = (item) => {
  const piezas = Number(item.piezas || 0);
  const gPieza = Number(item.gramos_por_pieza || 0);
  const gTotal = item._gt_manual != null ? Number(item._gt_manual) : piezas * gPieza;
  const pGramo = Number(item.precio_gramo_mxn || 0);
  return { ...item, gramos_total: gTotal, subtotal_mxn: gTotal * pGramo };
};

const productToPreorderItem = (product, quantity = 1, lines = [], plataFinaMxn = 0) => {
  const piezas = Math.max(1, Number(quantity || 1));
  const gramosPorPieza = Number(product.pesoPromedio || product.peso_promedio || 0);
  const line = lines.find((lineItem) => normalizeText(lineItem.codigo) === normalizeText(product.linea));
  const price = line && plataFinaMxn
    ? calcPrecioGramo({ mo_base: line.mo_base, plata_fina_mxn: plataFinaMxn })
    : null;
  const labor = Number(price?.mo_visible || product.quoteLaborPerGram || product.manoObra || product.mano_obra || 0);
  const precioGramo = Number(price?.integrado || product.quotePricePerGram || product.precioMinimo || product.precio_minimo || 0);

  return {
    producto_codigo: product.codigo,
    producto_descripcion: product.descripcion,
    producto_metal: product.metal,
    producto_kilataje: product.kilataje,
    producto_linea: product.linea,
    producto_foto_url: product.fotoUrl || product.foto_url || "",
    piezas,
    gramos_por_pieza: gramosPorPieza,
    gramos_total: piezas * gramosPorPieza,
    labor_mxn: labor,
    precio_gramo_mxn: precioGramo,
    subtotal_mxn: piezas * gramosPorPieza * precioGramo,
  };
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

  const exchangeRate = Number(po.tipo_cambio || metalPrices.tipo_cambio || 0);
  const useUsd = po.moneda === "USD" && exchangeRate > 0;
  const moneyLabel = po.moneda === "USD" ? "USD" : "MXN";
  const toDisplayMoney = (value) => (useUsd ? Number(value || 0) / exchangeRate : Number(value || 0));
  const fromDisplayMoney = (value) => (useUsd ? Number(value || 0) * exchangeRate : Number(value || 0));
  const set = (key) => (event) => { onDirty?.(); setPo((current) => ({ ...current, [key]: event.target.value })); };
  const setChecked = (key) => (event) => setPo((current) => ({ ...current, [key]: event.target.checked }));
  const inp = { width: "100%", boxSizing: "border-box" };
  const isProspectMode = po.client_id === PROSPECT_CLIENT_VALUE;

  const recalcWithPrice = (item, laborMxn = item.labor_mxn, silverMxn = plataFinaMxn) =>
    calcItem({ ...item, labor_mxn: Number(laborMxn || 0), precio_gramo_mxn: Number(laborMxn || 0) + Number(silverMxn || 0) });

  const setItem = (idx, key, value) => {
    if (pricingLocked && key !== "piezas") return;
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
    setItems((current) => {
      const next = [...current];
      next[idx] = recalcWithPrice(next[idx], fromDisplayMoney(value), plataFinaMxn);
      return next;
    });
  };

  const setSilverFine = (value) => {
    if (pricingLocked) return;
    const nextSilver = fromDisplayMoney(value);
    setPlataFinaMxn(nextSilver);
    setItems((current) => current.map((item) => recalcWithPrice(item, item.labor_mxn, nextSilver)));
  };

  const calculateSilverFineByKitco = () => {
    if (pricingLocked) return;
    const nextSilver = calcSilverFineFromKitco(po.kitco_usd_oz, po.tipo_cambio || metalPrices.tipo_cambio, po.premio_pct || 0);
    if (!nextSilver) {
      setMsg("Captura KITCO USD/oz y tipo de cambio para calcular la plata fina.");
      return;
    }
    setPlataFinaMxn(nextSilver);
    setItems((current) => current.map((item) => recalcWithPrice(item, item.labor_mxn, nextSilver)));
    setMsg(`Plata fina calculada: $${nextSilver.toFixed(4)} MXN/g.`);
  };

  const applyLaborList = async (listId, currentLines) => {
    if (!listId) {
      // Reset to base product_lines mo_base
      const baseLines = await fetchLines(resolvedTenantId);
      setLines(baseLines);
      setSelectedLaborListId("");
      setPo((current) => ({ ...current, labor_list_id: "" }));
      setMsg("Lista de labor removida. Usando mano de obra base de líneas.");
      return;
    }
    try {
      const listLines = await fetchLaborListLines(listId);
      const lineMap = new Map(listLines.map((l) => [l.line_codigo, Number(l.mo_base || 0)]));
      const merged = (currentLines || lines).map((line) => ({
        ...line,
        mo_base: lineMap.has(line.codigo) ? lineMap.get(line.codigo) : line.mo_base,
      }));
      setLines(merged);
      setSelectedLaborListId(listId);
      setPo((current) => ({ ...current, labor_list_id: listId }));
      const listName = laborLists.find((l) => l.id === listId)?.name || listId;
      setMsg(`Lista "${listName}" aplicada. Presiona "Calcular precios" para actualizar.`);
    } catch (err) {
      setMsg(`Error al cargar lista: ${err.message}`);
    }
  };

  const precargarPrecios = () => {
    if (!po.client_id) { setMsg("Debes seleccionar un cliente existente."); return; }
    if (!lines.length) { setMsg("No hay lineas configuradas en el menu de precios."); return; }
    if (!plataFinaMxn) { setMsg("Captura primero el precio de plata fina."); return; }

    setItems((current) => current.map((item) => {
      const line = lines.find((lineItem) => lineItem.codigo === item.producto_linea);
      if (!line) return item;
      const precio = calcPrecioGramo({ mo_base: line.mo_base, plata_fina_mxn: plataFinaMxn });
      return calcItem({ ...item, labor_mxn: precio.mo_visible, precio_gramo_mxn: precio.integrado });
    }));
    setMsg("Precios calculados por linea.");
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
    const nextItem = productToPreorderItem(product, 1, lines, plataFinaMxn);
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
      applyIva: po.aplicar_iva,
      showBreakdown: po.mostrar_desglose,
      plataFinaMxn,
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
      labor_mxn: item.labor_mxn,
      plata_fina_mxn: Math.max(0, Number(item.precio_gramo_mxn || 0) - Number(item.labor_mxn || 0)),
      precio_gramo_mxn: item.precio_gramo_mxn,
      subtotal_mxn: item.subtotal_mxn,
    }));
    await generatePdf(pdfItems, customer, language, activeCompany, {
      showGramos: true,
      applyIva: po.aplicar_iva,
      showBreakdown: po.mostrar_desglose,
      silverFineMxn: plataFinaMxn,
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
      <header className="po-editor-toolbar">
        <div className="po-editor-toolbar-left">
          <span className="tool-eyebrow">{isNew ? "Nueva preorden" : po.folio}</span>
          <div className="po-status-pills">
            {Object.entries(STATUS).map(([key, { label, color }]) => (
              <button
                key={key}
                type="button"
                className="po-status-pill"
                onClick={() => !pricingLocked && setPo((current) => ({ ...current, status: key }))}
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
      </header>

      <main className="po-editor-body">
          <section className="quote-block">
            <h3>Cliente obligatorio</h3>
            <div className="form-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
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
              <Field label="Correo"><input value={po.cliente_email || ""} readOnly style={inp} /></Field>
              <Field label="Telefono"><input value={po.cliente_telefono || ""} readOnly style={inp} /></Field>
              <Field label="RFC"><input value={po.cliente_rfc || ""} readOnly style={inp} /></Field>
              <Field label="Moneda">
                <select value={po.moneda} onChange={set("moneda")} style={inp}>
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
              <Field label="Tipo de cambio USD">
                <input type="number" step="0.01" placeholder="Ej. 17.25" value={po.tipo_cambio || ""} onChange={set("tipo_cambio")} style={inp} />
              </Field>
              <Field label="Notas">
                <input value={po.notas || ""} onChange={set("notas")} style={inp} placeholder="Observaciones" />
              </Field>
            </div>
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
          </section>

          <section className="quote-block">
            <div className="section-title-row">
              <h3>Productos cotizados</h3>
              <div className="quote-price-tools">
                <label>
                  Lista de labor
                  <select
                    value={selectedLaborListId || ""}
                    onChange={(e) => applyLaborList(e.target.value, lines)}
                    disabled={pricingLocked}
                  >
                    <option value="">— Sin lista —</option>
                    {laborLists.map((list) => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                  </select>
                  {selectedLaborListId ? (
                    <small style={{ color: "var(--color-success)" }}>✓ Lista aplicada</small>
                  ) : (
                    <small>Elige para cargar mano de obra</small>
                  )}
                </label>
                <label>
                  Metodo PF
                  <select value={po.pf_mode || "manual"} onChange={set("pf_mode")} disabled={pricingLocked}>
                    <option value="manual">Manual</option>
                    <option value="kitco">Kitco + premio</option>
                  </select>
                </label>
                {po.pf_mode === "kitco" ? (
                  <>
                    <label>
                      KITCO USD/oz
                      <input type="number" step="0.01" value={po.kitco_usd_oz || ""} onChange={set("kitco_usd_oz")} readOnly={pricingLocked} />
                    </label>
                    <label>
                      Premio sobre Kitco (%)
                      <input type="number" step="0.1" min="0" value={po.premio_pct ?? 0} onChange={set("premio_pct")} readOnly={pricingLocked} />
                    </label>
                    {!pricingLocked ? (
                      <button className="secondary-button compact-action" type="button" onClick={calculateSilverFineByKitco}>
                        Calcular PF Kitco
                      </button>
                    ) : null}
                  </>
                ) : null}
                <label>
                  Plata fina ({moneyLabel}/g)
                  <input
                    type="number"
                    step="0.0001"
                    value={toDisplayMoney(plataFinaMxn) || ""}
                    onChange={(event) => setSilverFine(event.target.value)}
                    readOnly={pricingLocked}
                  />
                  <small>Aplica en {moneyLabel} segun la moneda de la preorden.</small>
                </label>
                {!pricingLocked ? (
                  <button className="secondary-button compact-action" type="button" onClick={precargarPrecios}>
                    Calcular precios por linea
                  </button>
                ) : null}
              </div>
            </div>
            <div className="quote-option-row">
              <label>
                <input type="checkbox" checked={Boolean(po.mostrar_desglose)} onChange={setChecked("mostrar_desglose")} />
                Mostrar desglose labor + plata fina
              </label>
              <label>
                <input type="checkbox" checked={Boolean(po.aplicar_iva)} onChange={setChecked("aplicar_iva")} />
                Agregar IVA 16%
              </label>
            </div>
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
                          src={product.fotoUrl || buildPlaceholderUrl()}
                          alt={product.descripcion}
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
                    {po.mostrar_desglose ? <th className="right">Labor/g {moneyLabel}</th> : null}
                    {po.mostrar_desglose ? <th className="right">PF/g {moneyLabel}</th> : null}
                    <th className="right">Labor+PF {moneyLabel}</th>
                    <th className="right">Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length ? items.map((item, idx) => {
                    const fineSilver = Math.max(0, Number(item.precio_gramo_mxn || 0) - Number(item.labor_mxn || 0));
                    return (
                      <tr key={`${item.producto_codigo}-${idx}`}>
                        <td>{item.producto_foto_url ? <img src={item.producto_foto_url} alt={item.producto_codigo} /> : "-"}</td>
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
                        {po.mostrar_desglose ? <td><input type="number" step="0.01" value={toDisplayMoney(item.labor_mxn) || ""} onChange={(event) => setLabor(idx, event.target.value)} readOnly={pricingLocked} /></td> : null}
                        {po.mostrar_desglose ? <td className="right">{fmt(toDisplayMoney(fineSilver))}</td> : null}
                        <td className="right">{fmt(toDisplayMoney(item.precio_gramo_mxn))}</td>
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
            <div><span>IVA 16%</span><strong>{po.aplicar_iva ? fmt(toDisplayMoney(ivaMxn)) : "—"}</strong></div>
            <div className="po-total-highlight"><span>Total {moneyLabel}</span><strong>{fmt(toDisplayMoney(totalFinalMxn))}</strong></div>
          </section>
      </main>
    </div>
  );
}

export default PreorderEditorContent;
