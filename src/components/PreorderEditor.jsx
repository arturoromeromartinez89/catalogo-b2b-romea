import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useCompany } from "../contexts/CompanyContext";
import { fetchLines, fetchMetalPrices, fetchClientMargins, calcPrecioGramo } from "../services/pricingService";
import { savePreorder, deletePreorder } from "../services/preorderService";
import { generatePdf } from "../utils/pdfGenerator";
import { useLanguage } from "../i18n/LanguageContext";

const STATUS = {
  pendiente:  { label: "Pendiente",   color: "#d97706" },
  revision:   { label: "En revisión", color: "#2563eb" },
  confirmada: { label: "Confirmada",  color: "#059669" },
  cancelada:  { label: "Cancelada",   color: "#dc2626" },
};

const fmt = (n) => n != null
  ? `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : "—";

const calcItem = (item) => {
  const piezas = Number(item.piezas || 0);
  const gPieza = Number(item.gramos_por_pieza || 0);
  const gTotal = item._gt_manual != null ? Number(item._gt_manual) : piezas * gPieza;
  const pGramo = Number(item.precio_gramo_mxn || 0);
  return { ...item, gramos_total: gTotal, subtotal_mxn: gTotal * pGramo };
};

const Field = ({ label, children }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)" }}>
    {label}
    {children}
  </label>
);

function PreorderEditorContent({ preorder: initial, clients, onClose, onSaved }) {
  const { language } = useLanguage();
  const company = useCompany();
  const isNew = !initial?.id;

  const blank = {
    folio: "", status: "pendiente", client_id: "",
    cliente_nombre: "", cliente_empresa: "", cliente_email: "",
    cliente_telefono: "", cliente_rfc: "",
    tipo_cambio: "", moneda: "MXN", notas: "",
  };

  const [po, setPo] = useState({ ...blank, ...(initial || {}) });
  const [items, setItems] = useState(
    (initial?.preorder_items || []).map((i) => ({ ...i, _gt_manual: i.gramos_total }))
  );
  const [lines, setLines] = useState([]);
  const [metalPrices, setMetalPrices] = useState({});
  const [margins, setMargins] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetchLines().then(setLines);
    fetchMetalPrices().then(setMetalPrices);
    // Bloquear scroll del body
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (po.client_id) fetchClientMargins(po.client_id).then(setMargins);
  }, [po.client_id]);

  const set = (key) => (e) => setPo((p) => ({ ...p, [key]: e.target.value }));

  const setItem = (idx, key, val) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = calcItem({ ...next[idx], [key]: val });
      return next;
    });
  };

  const setGTotal = (idx, val) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], _gt_manual: val };
      item.gramos_total = Number(val);
      item.subtotal_mxn = Number(val) * Number(item.precio_gramo_mxn || 0);
      next[idx] = item;
      return next;
    });
  };

  const precargarPrecios = () => {
    if (!po.client_id || !lines.length) { setMsg("⚠️ Selecciona un cliente primero"); return; }
    setItems((prev) => prev.map((item) => {
      const line = lines.find((l) => l.codigo === item.producto_linea);
      if (!line) return item;
      const margin = margins.find((m) => m.line_codigo === item.producto_linea);
      const precio = calcPrecioGramo({
        mo_base: line.mo_base,
        plata_fina_mxn: metalPrices.plata_fina_mxn || 0,
        margen_pct: margin?.margen_pct || 0,
      });
      return calcItem({ ...item, labor_mxn: precio.mo_visible, precio_gramo_mxn: precio.integrado });
    }));
    setMsg("✓ Precios precargados");
  };

  const totals = {
    piezas: items.reduce((s, i) => s + Number(i.piezas || 0), 0),
    gramos: items.reduce((s, i) => s + Number(i.gramos_total || 0), 0),
    mxn:    items.reduce((s, i) => s + Number(i.subtotal_mxn || 0), 0),
  };
  const totalUsd = Number(po.tipo_cambio) > 0 ? totals.mxn / Number(po.tipo_cambio) : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await savePreorder(po, items);
      setMsg("✓ Guardado");
      onSaved?.();
    } catch (e) { setMsg("Error: " + e.message); }
    finally { setSaving(false); }
  };

  const handlePdf = async () => {
    const customer = {
      serie: "", numero: po.folio,
      name: po.cliente_nombre, company: po.cliente_empresa,
      email: po.cliente_email, phone: po.cliente_telefono,
      rfc: po.cliente_rfc, tipoCambio: po.tipo_cambio, currency: po.moneda,
    };
    const pdfItems = items.map((item) => ({
      product: {
        codigo: item.producto_codigo, descripcion: item.producto_descripcion,
        metal: item.producto_metal, kilataje: item.producto_kilataje,
        fotoUrl: item.producto_foto_url, pesoPromedio: item.gramos_por_pieza,
        precioMinimo: item.precio_gramo_mxn,
      },
      quantity: item.piezas,
      gramos_total: item.gramos_total,
      labor_mxn: item.labor_mxn,
      precio_gramo_mxn: item.precio_gramo_mxn,
      subtotal_mxn: item.subtotal_mxn,
    }));
    await generatePdf(pdfItems, customer, language, company, { showGramos: true });
  };

  const handleDelete = async () => {
    if (!window.confirm("¿Eliminar esta preorden?")) return;
    await deletePreorder(po.id);
    onSaved?.();
  };

  const inp = { width: "100%", boxSizing: "border-box" };

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0,
      width: "100vw", height: "100vh",
      background: "rgba(0,0,0,0.75)",
      zIndex: 99999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      boxSizing: "border-box",
    }}>
      <div style={{
        background: "var(--color-background-primary)",
        borderRadius: 12,
        width: "100%",
        maxWidth: 1000,
        height: "85vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
      }}>

        {/* HEADER FIJO */}
        <div style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--color-border-tertiary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, color: "var(--color-text-primary)" }}>
            {isNew ? "Nueva preorden" : `Preorden — ${po.folio}`}
          </h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {Object.entries(STATUS).map(([key, { label, color }]) => (
              <button key={key} onClick={() => setPo((p) => ({ ...p, status: key }))} style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                border: `1.5px solid ${color}`,
                background: po.status === key ? color : "transparent",
                color: po.status === key ? "#fff" : color,
                fontWeight: 500,
              }}>
                {label}
              </button>
            ))}
            <button onClick={onClose} style={{
              marginLeft: 8, background: "none", border: "none",
              fontSize: 22, cursor: "pointer", color: "var(--color-text-secondary)", padding: 4,
            }}>✕</button>
          </div>
        </div>

        {/* CUERPO SCROLLEABLE */}
        <div style={{ overflow: "auto", padding: "20px 24px", flex: 1 }}>

          {/* Datos del cliente */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12, marginBottom: 20,
            padding: 16, background: "var(--color-background-secondary)", borderRadius: 8,
          }}>
            <Field label="Cliente">
              <select value={po.client_id} onChange={set("client_id")} style={inp}>
                <option value="">Sin cliente</option>
                {(clients || []).map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
              </select>
            </Field>
            <Field label="Nombre"><input value={po.cliente_nombre || ""} onChange={set("cliente_nombre")} style={inp} /></Field>
            <Field label="Empresa"><input value={po.cliente_empresa || ""} onChange={set("cliente_empresa")} style={inp} /></Field>
            <Field label="Correo"><input value={po.cliente_email || ""} onChange={set("cliente_email")} style={inp} /></Field>
            <Field label="Teléfono"><input value={po.cliente_telefono || ""} onChange={set("cliente_telefono")} style={inp} /></Field>
            <Field label="RFC"><input value={po.cliente_rfc || ""} onChange={set("cliente_rfc")} style={inp} /></Field>
            <Field label="Tipo de cambio USD">
              <input type="number" step="0.01" placeholder="ej. 17.25" value={po.tipo_cambio || ""} onChange={set("tipo_cambio")} style={inp} />
            </Field>
            <Field label="Moneda">
              <select value={po.moneda} onChange={set("moneda")} style={inp}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </Field>
            <Field label="Notas">
              <input value={po.notas || ""} onChange={set("notas")} style={inp} placeholder="Observaciones..." />
            </Field>
          </div>

          {/* Precargar precios */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <button className="secondary-button compact-action" onClick={precargarPrecios}>
              Precargar precios desde configuración
            </button>
            {msg && <span style={{ fontSize: 13, color: msg.startsWith("✓") ? "#059669" : "#d97706" }}>{msg}</span>}
          </div>

          {/* Tabla de productos */}
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--color-background-secondary)" }}>
                  {[["Código","left"],["Descripción / Línea","left"],["Pzs","center"],["G/Pza","center"],["G.Total","center"],["Labor/g","right"],["$/G Int.","right"],["Subtotal","right"],["","center"]].map(([h, a]) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: a, fontWeight: 500, fontSize: 11, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: 24, textAlign: "center", color: "var(--color-text-secondary)", fontSize: 13 }}>
                    Sin productos — agrega desde el catálogo usando el botón "Agregar a preorden"
                  </td></tr>
                ) : items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>{item.producto_codigo}</td>
                    <td style={{ padding: "8px 10px", maxWidth: 180 }}>
                      <div style={{ fontSize: 12 }}>{item.producto_descripcion}</div>
                      <div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>
                        {[item.producto_metal, item.producto_kilataje, item.producto_linea].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <input type="number" min="1" value={item.piezas} onChange={(e) => setItem(idx, "piezas", Number(e.target.value))} style={{ width: 54, textAlign: "center" }} />
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <input type="number" step="0.01" value={item.gramos_por_pieza} onChange={(e) => setItem(idx, "gramos_por_pieza", Number(e.target.value))} style={{ width: 62, textAlign: "center" }} />
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <input type="number" step="0.01" value={item._gt_manual ?? item.gramos_total} onChange={(e) => setGTotal(idx, e.target.value)} style={{ width: 62, textAlign: "center" }} title="Editable manualmente" />
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <input type="number" step="0.01" value={item.labor_mxn || ""} onChange={(e) => setItem(idx, "labor_mxn", Number(e.target.value))} style={{ width: 70, textAlign: "right" }} placeholder="0.00" />
                    </td>
                    <td style={{ padding: "8px 6px" }}>
                      <input type="number" step="0.0001" value={item.precio_gramo_mxn || ""} onChange={(e) => setItem(idx, "precio_gramo_mxn", Number(e.target.value))} style={{ width: 80, textAlign: "right" }} placeholder="0.00" />
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{fmt(item.subtotal_mxn)}</td>
                    <td style={{ padding: "8px 6px", textAlign: "center" }}>
                      <button onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 16 }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totales */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "14px 20px", minWidth: 260 }}>
              {[["Total piezas", `${totals.piezas} pz`], ["Total gramos", `${totals.gramos.toFixed(2)} g`]].map(([l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>{l}</span><strong>{v}</strong>
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--color-border-tertiary)", paddingTop: 8, marginTop: 4, display: "flex", justifyContent: "space-between", fontSize: 15 }}>
                <span>Total MXN</span><strong>{fmt(totals.mxn)}</strong>
              </div>
              {totalUsd && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 4, color: "var(--color-text-secondary)" }}>
                  <span>≈ USD (TC ${po.tipo_cambio})</span><strong>{fmt(totalUsd)}</strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER FIJO */}
        <div style={{
          padding: "14px 24px",
          borderTop: "1px solid var(--color-border-tertiary)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0,
        }}>
          <div>
            {!isNew && (
              <button className="secondary-button compact-action" style={{ color: "#dc2626", borderColor: "#fca5a5" }} onClick={handleDelete}>
                Eliminar preorden
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="secondary-button compact-action" onClick={onClose}>Cancelar</button>
            <button className="secondary-button compact-action" onClick={handlePdf}>Generar PDF</button>
            <button className="primary-button compact-action" onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar preorden"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PreorderEditor(props) {
  const portalRoot = document.getElementById("portal-root") || document.body;
  return createPortal(<PreorderEditorContent {...props} />, portalRoot);
}
