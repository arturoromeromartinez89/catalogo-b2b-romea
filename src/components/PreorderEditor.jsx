import { useEffect, useState } from "react";
import { useCompany } from "../contexts/CompanyContext";
import { fetchLines, fetchMetalPrices, fetchClientMargins, calcPrecioGramo } from "../services/pricingService";
import { savePreorder, updatePreorderStatus, deletePreorder } from "../services/preorderService";
import { generatePdf } from "../utils/pdfGenerator";
import { useLanguage } from "../i18n/LanguageContext";

const STATUS_LABELS = {
  pendiente:  { label: "Pendiente",  color: "#f59e0b" },
  revision:   { label: "En revisión", color: "#3b82f6" },
  confirmada: { label: "Confirmada", color: "#10b981" },
  cancelada:  { label: "Cancelada",  color: "#ef4444" },
};

const fmt = (n) => n != null ? `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

const calcItem = (item) => ({
  ...item,
  gramos_total: item.gramos_total_manual ?? (Number(item.piezas || 0) * Number(item.gramos_por_pieza || 0)),
  subtotal_mxn: (item.gramos_total_manual ?? (Number(item.piezas || 0) * Number(item.gramos_por_pieza || 0))) * Number(item.precio_gramo_mxn || 0),
});

export default function PreorderEditor({ preorder: initial, clients, onClose, onSaved }) {
  const { language } = useLanguage();
  const company = useCompany();
  const isNew = !initial?.id;

  const [po, setPo] = useState({
    folio: "", status: "pendiente", client_id: "", cliente_nombre: "",
    cliente_empresa: "", cliente_email: "", cliente_telefono: "",
    cliente_rfc: "", tipo_cambio: "", moneda: "MXN", notas: "",
    ...(initial || {}),
  });
  const [items, setItems] = useState(
    (initial?.preorder_items || []).map((i) => ({ ...i, gramos_total_manual: i.gramos_total }))
  );
  const [lines, setLines] = useState([]);
  const [metalPrices, setMetalPrices] = useState({});
  const [margins, setMargins] = useState([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetchLines().then(setLines);
    fetchMetalPrices().then(setMetalPrices);
  }, []);

  useEffect(() => {
    if (po.client_id) fetchClientMargins(po.client_id).then(setMargins);
  }, [po.client_id]);

  const setProp = (key) => (e) => setPo((p) => ({ ...p, [key]: e.target.value }));

  const updateItem = (idx, key, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = calcItem({ ...next[idx], [key]: value });
      return next;
    });
  };

  const precargarPrecios = () => {
    if (!po.client_id || !lines.length) { setStatus("Selecciona un cliente primero"); return; }
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
    setStatus("✓ Precios precargados desde configuración");
  };

  const totals = {
    piezas: items.reduce((s, i) => s + Number(i.piezas || 0), 0),
    gramos: items.reduce((s, i) => s + Number(i.gramos_total || 0), 0),
    mxn: items.reduce((s, i) => s + Number(i.subtotal_mxn || 0), 0),
  };
  const totalUsd = po.tipo_cambio && Number(po.tipo_cambio) > 0 ? totals.mxn / Number(po.tipo_cambio) : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const id = await savePreorder(po, items);
      setStatus("✓ Preorden guardada");
      onSaved?.();
    } catch (e) { setStatus("Error: " + e.message); }
    finally { setSaving(false); }
  };

  const handlePdf = async () => {
    const customer = {
      serie: "", numero: po.folio,
      name: po.cliente_nombre, company: po.cliente_empresa,
      email: po.cliente_email, phone: po.cliente_telefono,
      rfc: po.cliente_rfc, tipoCambio: po.tipo_cambio, currency: po.moneda,
    };
    const cartItems = items.map((item) => ({
      product: {
        codigo: item.producto_codigo,
        descripcion: item.producto_descripcion,
        metal: item.producto_metal,
        kilataje: item.producto_kilataje,
        fotoUrl: item.producto_foto_url,
        pesoPromedio: item.gramos_por_pieza,
        precioMinimo: item.precio_gramo_mxn,
      },
      quantity: item.piezas,
      gramos_total: item.gramos_total,
      labor_mxn: item.labor_mxn,
      precio_gramo_mxn: item.precio_gramo_mxn,
      subtotal_mxn: item.subtotal_mxn,
    }));
    await generatePdf(cartItems, customer, language, company, { showGramos: true });
  };

  const handleDelete = async () => {
    if (!window.confirm("¿Eliminar esta preorden?")) return;
    await deletePreorder(po.id);
    onSaved?.();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ background: "var(--color-background-primary)", borderRadius: 12, width: "100%", maxWidth: 980, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, borderBottom: "1px solid var(--color-border-tertiary)", paddingBottom: 16 }}>
          <div>
            <h2 style={{ margin: "0 0 10px 0", fontSize: 20 }}>{isNew ? "Nueva preorden" : `Preorden ${po.folio}`}</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
                <button
                  key={key}
                  onClick={() => setPo((p) => ({ ...p, status: key }))}
                  style={{
                    padding: "4px 12px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                    border: `1px solid ${color}`,
                    background: po.status === key ? color : "transparent",
                    color: po.status === key ? "#fff" : color,
                    fontWeight: po.status === key ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "var(--color-text-secondary)", lineHeight: 1, padding: "0 0 0 16px" }}>✕</button>
        </div>

        {/* ── DATOS GENERALES ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          <label>Cliente<br />
            <select value={po.client_id} onChange={setProp("client_id")} style={{ width: "100%" }}>
              <option value="">Sin cliente</option>
              {(clients || []).map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
            </select>
          </label>
          <label>Nombre<br /><input value={po.cliente_nombre || ""} onChange={setProp("cliente_nombre")} /></label>
          <label>Empresa<br /><input value={po.cliente_empresa || ""} onChange={setProp("cliente_empresa")} /></label>
          <label>Correo<br /><input value={po.cliente_email || ""} onChange={setProp("cliente_email")} /></label>
          <label>Teléfono<br /><input value={po.cliente_telefono || ""} onChange={setProp("cliente_telefono")} /></label>
          <label>RFC<br /><input value={po.cliente_rfc || ""} onChange={setProp("cliente_rfc")} /></label>
          <label>Tipo de cambio (USD)<br /><input type="number" step="0.01" value={po.tipo_cambio || ""} onChange={setProp("tipo_cambio")} placeholder="ej. 17.25" /></label>
          <label>Moneda<br />
            <select value={po.moneda} onChange={setProp("moneda")}>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label>Notas<br /><input value={po.notas || ""} onChange={setProp("notas")} /></label>
        </div>

        {/* ── BOTÓN PRECARGAR PRECIOS ── */}
        <div style={{ marginBottom: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <button className="secondary-button compact-action" onClick={precargarPrecios}>
            Precargar precios desde configuración
          </button>
          {status && <span style={{ fontSize: 13, color: "var(--color-text-success)" }}>{status}</span>}
        </div>

        {/* ── TABLA DE ITEMS ── */}
        <div style={{ overflowX: "auto", marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                {["Código", "Descripción", "Pzs", "G/Pza", "G.Total", "Labor/g", "$/G Int.", "Subtotal", ""].map((h) => (
                  <th key={h} style={{ padding: "7px 8px", textAlign: h === "Subtotal" ? "right" : "left", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}>
                  <td style={{ padding: "6px 8px", fontWeight: 500, whiteSpace: "nowrap" }}>{item.producto_codigo}</td>
                  <td style={{ padding: "6px 8px", maxWidth: 160 }}>
                    <div style={{ fontSize: 11 }}>{item.producto_descripcion}</div>
                    <div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>{[item.producto_metal, item.producto_kilataje, item.producto_linea].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <input type="number" min="1" value={item.piezas} onChange={(e) => updateItem(idx, "piezas", Number(e.target.value))} style={{ width: 56 }} />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <input type="number" step="0.01" value={item.gramos_por_pieza} onChange={(e) => updateItem(idx, "gramos_por_pieza", Number(e.target.value))} style={{ width: 64 }} />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <input type="number" step="0.01"
                      value={item.gramos_total_manual ?? item.gramos_total}
                      onChange={(e) => updateItem(idx, "gramos_total_manual", Number(e.target.value))}
                      style={{ width: 64, background: item.gramos_total_manual != null ? "#fffbea" : undefined }}
                    />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <input type="number" step="0.01" value={item.labor_mxn || ""} onChange={(e) => updateItem(idx, "labor_mxn", Number(e.target.value))} style={{ width: 72 }} placeholder="0.00" />
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <input type="number" step="0.0001" value={item.precio_gramo_mxn || ""} onChange={(e) => updateItem(idx, "precio_gramo_mxn", Number(e.target.value))} style={{ width: 80 }} placeholder="0.00" />
                  </td>
                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>
                    {fmt(item.subtotal_mxn)}
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <button onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-danger)", fontSize: 16 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── TOTALES ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "12px 20px", minWidth: 280 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
              <span>Total piezas:</span><strong>{totals.piezas} pz</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
              <span>Total gramos:</span><strong>{totals.gramos.toFixed(2)} g</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 14, borderTop: "1px solid var(--color-border-tertiary)", paddingTop: 8 }}>
              <span>Total MXN:</span><strong>{fmt(totals.mxn)}</strong>
            </div>
            {totalUsd && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--color-text-secondary)" }}>
                <span>≈ USD (TC ${po.tipo_cambio}):</span><strong>{fmt(totalUsd)}</strong>
              </div>
            )}
          </div>
        </div>

        {/* ── ACCIONES ── */}
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 10 }}>
            {!isNew && (
              <button className="secondary-button compact-action" style={{ color: "var(--color-text-danger)", borderColor: "var(--color-border-danger)" }} onClick={handleDelete}>
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
