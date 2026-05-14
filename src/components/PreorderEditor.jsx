import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useCompany } from "../contexts/CompanyContext";
import { fetchLines, fetchMetalPrices, calcPrecioGramo, getSilverFinePrice } from "../services/pricingService";
import { savePreorder, deletePreorder } from "../services/preorderService";
import { generatePdf } from "../utils/pdfGenerator";
import { useLanguage } from "../i18n/LanguageContext";

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

function PreorderEditorContent({ preorder: initial, clients, onClose, onSaved, pricingLocked = false }) {
  const { language } = useLanguage();
  const company = useCompany();
  const isNew = !initial?.id;

  const blank = {
    folio: "",
    status: "pendiente",
    client_id: "",
    cliente_nombre: "",
    cliente_empresa: "",
    cliente_email: "",
    cliente_telefono: "",
    cliente_rfc: "",
    tipo_cambio: "",
    moneda: "MXN",
    notas: "",
  };

  const [po, setPo] = useState({ ...blank, ...(initial || {}) });
  const [items, setItems] = useState((initial?.preorder_items || []).map((item) => ({ ...item, _gt_manual: item.gramos_total })));
  const [lines, setLines] = useState([]);
  const [metalPrices, setMetalPrices] = useState({});
  const [plataFinaMxn, setPlataFinaMxn] = useState(0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchLines().then(setLines).catch((error) => setMsg(`Error: ${error.message}`));
    fetchMetalPrices()
      .then((prices) => {
        setMetalPrices(prices);
        setPlataFinaMxn(getSilverFinePrice(prices));
      })
      .catch((error) => setMsg(`Error: ${error.message}`));
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

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

  const exchangeRate = Number(po.tipo_cambio || metalPrices.tipo_cambio || 0);
  const useUsd = po.moneda === "USD" && exchangeRate > 0;
  const moneyLabel = useUsd ? "USD" : "MXN";
  const toDisplayMoney = (value) => (useUsd ? Number(value || 0) / exchangeRate : Number(value || 0));
  const fromDisplayMoney = (value) => (useUsd ? Number(value || 0) * exchangeRate : Number(value || 0));
  const set = (key) => (event) => setPo((current) => ({ ...current, [key]: event.target.value }));
  const inp = { width: "100%", boxSizing: "border-box" };

  const recalcWithPrice = (item, laborMxn = item.labor_mxn, silverMxn = plataFinaMxn) =>
    calcItem({ ...item, labor_mxn: Number(laborMxn || 0), precio_gramo_mxn: Number(laborMxn || 0) + Number(silverMxn || 0) });

  const setItem = (idx, key, value) => {
    if (pricingLocked) return;
    setItems((current) => {
      const next = [...current];
      next[idx] = calcItem({ ...next[idx], [key]: value });
      return next;
    });
  };

  const setGTotal = (idx, value) => {
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

  const handleSave = async () => {
    if (!po.client_id) { setMsg("Debes seleccionar un cliente existente para guardar la preorden."); return; }
    setSaving(true);
    try {
      await savePreorder(po, items);
      setMsg("Guardado.");
      onSaved?.();
    } catch (error) {
      setMsg(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePdf = async () => {
    if (!po.client_id) { setMsg("Debes seleccionar un cliente existente para generar el PDF."); return; }
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
    await generatePdf(pdfItems, customer, language, company, { showGramos: true });
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
    <div className="quote-modal-backdrop">
      <div className="quote-modal">
        <header className="quote-modal-header">
          <h2>{isNew ? "Nueva preorden" : `Preorden - ${po.folio}`}</h2>
          <div className="quote-status-row">
            {Object.entries(STATUS).map(([key, { label, color }]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPo((current) => ({ ...current, status: key }))}
                style={{
                  border: `1.5px solid ${color}`,
                  background: po.status === key ? color : "transparent",
                  color: po.status === key ? "#fff" : color,
                }}
              >
                {label}
              </button>
            ))}
            <button className="icon-button" type="button" onClick={handleClose}>x</button>
          </div>
        </header>

        <main className="quote-modal-body">
          <section className="quote-block">
            <h3>Cliente obligatorio</h3>
            <div className="form-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              <Field label="Cliente">
                <select value={po.client_id} onChange={set("client_id")} style={inp}>
                  <option value="">Selecciona cliente existente</option>
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
          </section>

          <section className="quote-block">
            <div className="section-title-row">
              <h3>Productos cotizados</h3>
              <div className="quote-price-tools">
                <label>
                  Plata fina ({moneyLabel}/g)
                  <input
                    type="number"
                    step="0.0001"
                    value={toDisplayMoney(plataFinaMxn) || ""}
                    onChange={(event) => setSilverFine(event.target.value)}
                    readOnly={pricingLocked}
                  />
                </label>
                {!pricingLocked ? (
                  <button className="secondary-button compact-action" type="button" onClick={precargarPrecios}>
                    Calcular precios por linea
                  </button>
                ) : null}
              </div>
            </div>
            {msg ? <p className="status info">{msg}</p> : null}

            <div className="responsive-table">
              <table className="simple-admin-table quote-items-table">
                <thead>
                  <tr>
                    <th>Foto</th>
                    <th>SKU</th>
                    <th className="right">Cantidad</th>
                    <th>Descripcion</th>
                    <th className="right">Peso unit.</th>
                    <th className="right">Gramos totales</th>
                    <th className="right">Labor/g {moneyLabel}</th>
                    <th className="right">PF/g {moneyLabel}</th>
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
                        <td><input type="number" min="1" value={item.piezas} onChange={(event) => setItem(idx, "piezas", Number(event.target.value))} /></td>
                        <td>
                          <div>{item.producto_descripcion}</div>
                          <small>{[item.producto_metal, item.producto_kilataje, item.producto_linea].filter(Boolean).join(" / ")}</small>
                        </td>
                        <td><input type="number" step="0.01" value={item.gramos_por_pieza} onChange={(event) => setItem(idx, "gramos_por_pieza", Number(event.target.value))} /></td>
                        <td><input type="number" step="0.01" value={item._gt_manual ?? item.gramos_total} onChange={(event) => setGTotal(idx, event.target.value)} readOnly={pricingLocked} /></td>
                        <td><input type="number" step="0.01" value={toDisplayMoney(item.labor_mxn) || ""} onChange={(event) => setLabor(idx, event.target.value)} readOnly={pricingLocked} /></td>
                        <td className="right">{fmt(toDisplayMoney(fineSilver))}</td>
                        <td className="right">{fmt(toDisplayMoney(item.precio_gramo_mxn))}</td>
                        <td className="right"><strong>{fmt(toDisplayMoney(item.subtotal_mxn))}</strong></td>
                        <td><button className="table-delete" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== idx))}>x</button></td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan="11" className="empty-row">Sin productos. Agrega productos desde el catalogo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="quote-totals-box">
            <div><span>Total piezas</span><strong>{totals.piezas}</strong></div>
            <div><span>Total gramos</span><strong>{totals.gramos.toFixed(2)} g</strong></div>
            <div><span>Total {moneyLabel}</span><strong>{fmt(toDisplayMoney(totals.mxn))}</strong></div>
          </section>
        </main>

        <footer className="quote-modal-footer">
          <div>
            {!isNew ? <button className="secondary-button compact-action danger-text" type="button" onClick={handleDelete}>Eliminar preorden</button> : null}
          </div>
          <div className="quote-footer-actions">
            <button className="secondary-button compact-action" type="button" onClick={handleClose}>Cancelar</button>
            <button className="secondary-button compact-action" type="button" onClick={handlePdf}>Generar PDF</button>
            <button className="primary-button compact-action" type="button" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar preorden"}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function PreorderEditor(props) {
  const portalRoot = document.getElementById("portal-root") || document.body;
  return createPortal(<PreorderEditorContent {...props} />, portalRoot);
}
