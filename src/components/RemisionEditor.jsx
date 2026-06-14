/**
 * RemisionEditor.jsx
 * Diseño idéntico al PreorderEditor. Mismo CSS, misma disposición.
 * Campos simplificados: no usa listas de labor ni precios calculados.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { saveRemision, generateFolio, fetchRemisiones } from "../services/adminModuleService";
import { fetchAllPreorders } from "../services/preorderService";
import { buildPlaceholderUrl, imageUrlForSize, shortText } from "../utils/formatters";
import { normalizeText } from "../utils/textNormalizer";

// ─── Constantes ────────────────────────────────────────────────────────────────

const STATUS = {
  borrador:  { label: "Borrador",   color: "#94a3b8" },
  emitida:   { label: "Emitida",    color: "#2563eb" },
  entregada: { label: "Entregada",  color: "#059669" },
  cancelada: { label: "Cancelada",  color: "#dc2626" },
};

const today = () => new Date().toISOString().split("T")[0];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const fmt = (n, currency = "MXN") =>
  n != null && n !== 0
    ? new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 2 }).format(Number(n || 0))
    : "—";

const inp = {
  background: "var(--color-bg-input, #f8faff)",
  border: "1px solid var(--color-border, #dde3ee)",
  borderRadius: 4,
  fontSize: 12,
  padding: "4px 7px",
  width: "100%",
};

const Field = ({ label, children }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--color-text-secondary)" }}>
    {label}
    {children}
  </label>
);

// ─── Item helpers ──────────────────────────────────────────────────────────────

const emptyItem = () => ({
  productoCodigo: "",
  productoFotoUrl: "",
  descripcion: "",
  cantidad: 1,
  gramosPorPieza: 0,
  gramosTotal: 0,
  laborMxnPorGramo: 0,
  precioUsdPorGramo: 0,
  subtotalUsd: 0,
  subtotalLaborMxn: 0,
  notas: "",
});

const calcItem = (item) => {
  const gramosTotal = Number(item.cantidad || 0) * Number(item.gramosPorPieza || 0);
  const subtotalLaborMxn = gramosTotal * Number(item.laborMxnPorGramo || 0);
  const subtotalUsd = gramosTotal * Number(item.precioUsdPorGramo || 0);
  return { ...item, gramosTotal, subtotalLaborMxn, subtotalUsd };
};

const itemFromProduct = (product, qty = 1) => calcItem({
  ...emptyItem(),
  productoCodigo:  product.codigo || "",
  productoFotoUrl: product.fotoUrl || "",
  descripcion:     product.descripcion || "",
  cantidad:        Math.max(1, Number(qty || 1)),
  gramosPorPieza:  Number(product.pesoPromedio || 0),
});

// Convierte items de preorden al formato de remisión
const itemsFromPreorder = (preorder) =>
  (preorder?.preorder_items || []).map((pi) => calcItem({
    ...emptyItem(),
    productoCodigo:   pi.producto_codigo || "",
    productoFotoUrl:  pi.producto_foto_url || "",
    descripcion:      pi.producto_descripcion || "",
    cantidad:         Number(pi.piezas || 1),
    gramosPorPieza:   Number(pi.gramos_por_pieza || 0),
    laborMxnPorGramo: Number(pi.labor_mxn || 0),
    precioUsdPorGramo: Number(pi.precio_gramo_mxn || 0),
  }));

// ─── Modal: importar desde preorden ────────────────────────────────────────────

function ImportarPreordenModal({ tenantId, profile, onSelect, onClose }) {
  const [preorders, setPreorders] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");

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
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <div className="rem-modal__body">
          <input
            className="rem-search"
            style={{ marginBottom: 12 }}
            placeholder="Buscar folio, cliente..."
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
                      <td>{new Date(po.created_at).toLocaleDateString("es-MX")}</td>
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

// ─── Editor principal ──────────────────────────────────────────────────────────

export default function RemisionEditor({
  remision: initial,
  clients = [],
  products = [],
  tenantId = "",
  profile,
  existingFolios = [],
  onClose,
  onSaved,
  onDirty,
}) {
  const hasSavedId = UUID_RE.test(String(initial?.id || ""));
  const isNew = !hasSavedId;

  const blank = {
    folio:             isNew ? generateFolio("REM", existingFolios) : (initial?.folio || ""),
    estado:            "borrador",
    fecha:             today(),
    fechaEntrega:      "",
    client_id:         "",
    clienteId:         "",
    clienteNombre:     "",
    clienteEmpresa:    "",
    clienteEmail:      "",
    clienteTelefono:   "",
    clienteRfc:        "",
    moneda:            "USD",
    tipoCambioEmision: "",
    kitcoEmision:      "",
    descuento:         0,
    notas:             "",
  };

  const [rem, setRem] = useState({ ...blank, ...(initial ? {
    folio:             initial.folio || blank.folio,
    estado:            initial.estado || "borrador",
    fecha:             initial.fecha || today(),
    fechaEntrega:      initial.fechaEntrega || "",
    client_id:         initial.clienteId || initial.client_id || "",
    clienteId:         initial.clienteId || initial.client_id || "",
    clienteNombre:     initial.clienteNombre || "",
    clienteEmpresa:    initial.clienteEmpresa || "",
    clienteEmail:      initial.clienteEmail || "",
    clienteTelefono:   initial.clienteTelefono || "",
    moneda:            initial.moneda || "USD",
    tipoCambioEmision: initial.tipoCambioEmision || "",
    kitcoEmision:      initial.kitcoEmision || "",
    descuento:         initial.descuento || 0,
    notas:             initial.notas || "",
    preorderId:        initial.preorderId || null,
  } : {}) });

  const [items, setItems] = useState(
    initial?.items?.length ? initial.items.map(calcItem) : [emptyItem()]
  );

  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [msg, setMsg]                 = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showImport, setShowImport]   = useState(false);
  const scannerInputRef               = useRef(null);

  const markEdited = () => { onDirty?.(); setSaved(false); };
  const setRf = (key) => (e) => { setRem((r) => ({ ...r, [key]: e.target.value })); markEdited(); };

  // Auto-fill client info from select
  useEffect(() => {
    const client = clients.find((c) => c.id === rem.client_id);
    if (!client) return;
    setRem((r) => ({
      ...r,
      clienteId:       client.id,
      clienteNombre:   client.name || "",
      clienteEmpresa:  client.company || "",
      clienteEmail:    client.email || "",
      clienteTelefono: client.phone || "",
      clienteRfc:      client.rfc || "",
    }));
  }, [rem.client_id, clients]);

  // Product search results
  const productResults = useMemo(() => {
    if (!productSearch || productSearch.length < 2) return [];
    const q = normalizeText(productSearch);
    return products
      .filter((p) => normalizeText([p.codigo, p.descripcion, p.linea, p.familia].join(" ")).includes(q))
      .slice(0, 8);
  }, [productSearch, products]);

  const addProduct = (product, qty = 1) => {
    setItems((prev) => {
      const existing = prev.findIndex((i) => i.productoCodigo === product.codigo);
      if (existing >= 0) {
        return prev.map((i, idx) => idx === existing ? calcItem({ ...i, cantidad: Number(i.cantidad) + Number(qty) }) : i);
      }
      return [...prev, itemFromProduct(product, qty)];
    });
    setProductSearch("");
    markEdited();
  };

  const handleProductSubmit = () => {
    const q = productSearch.trim().toUpperCase();
    if (!q) return;
    const exact = products.find((p) => p.codigo?.toUpperCase() === q);
    if (exact) { addProduct(exact); return; }
    const partial = products.filter((p) => normalizeText([p.codigo, p.descripcion].join(" ")).includes(normalizeText(q)));
    if (partial.length === 1) { addProduct(partial[0]); return; }
  };

  const setItemField = (idx, key, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = calcItem({ ...next[idx], [key]: value });
      return next;
    });
    markEdited();
  };

  const removeItem = (idx) => { setItems((prev) => prev.filter((_, i) => i !== idx)); markEdited(); };
  const addLine    = () => { setItems((prev) => [...prev, emptyItem()]); markEdited(); };

  const handleImportFromPreorder = (preorder) => {
    setRem((r) => ({
      ...r,
      client_id:         preorder.client_id || "",
      clienteId:         preorder.client_id || "",
      clienteNombre:     preorder.cliente_nombre || "",
      clienteEmpresa:    preorder.cliente_empresa || "",
      clienteEmail:      preorder.cliente_email || "",
      clienteTelefono:   preorder.cliente_telefono || "",
      clienteRfc:        preorder.cliente_rfc || "",
      moneda:            preorder.moneda || "USD",
      tipoCambioEmision: preorder.tipo_cambio || "",
      preorderId:        preorder.id,
    }));
    const importedItems = itemsFromPreorder(preorder);
    setItems(importedItems.length ? importedItems : [emptyItem()]);
    setShowImport(false);
    markEdited();
  };

  const totals = useMemo(() => items.reduce((acc, item) => ({
    piezas:   acc.piezas   + Number(item.cantidad  || 0),
    gramos:   acc.gramos   + Number(item.gramosTotal || 0),
    totalUsd: acc.totalUsd + Number(item.subtotalUsd || 0),
    totalMxn: acc.totalMxn + Number(item.subtotalLaborMxn || 0),
  }), { piezas: 0, gramos: 0, totalUsd: 0, totalMxn: 0 }), [items]);

  const esUSD = rem.moneda === "USD";
  const grandTotal = esUSD ? totals.totalUsd : totals.totalMxn;

  const handleSave = async () => {
    if (!items.some((i) => i.descripcion || i.productoCodigo)) {
      setMsg("Agrega al menos un artículo antes de guardar.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const result = await saveRemision(rem, items, tenantId);
      setSaved(true);
      setMsg("");
      // Sync folio if new
      if (isNew && result?.folio) setRem((r) => ({ ...r, folio: result.folio, id: result.id }));
      onSaved?.(result);
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => onClose?.({ ...rem, items });

  return (
    <div className="po-editor">
      {/* ── Toolbar superior (status pills + acciones) ── */}
      <header className="po-editor-toolbar po-editor-toolbar--remission">
        <div className="po-editor-toolbar-left">
          <span className="tool-eyebrow">{isNew ? "Nueva remisión" : rem.folio}</span>
          <div className="po-status-pills">
            {Object.entries(STATUS).map(([key, { label, color }]) => (
              <button
                key={key}
                type="button"
                className="po-status-pill"
                onClick={() => { markEdited(); setRem((r) => ({ ...r, estado: key })); }}
                style={{
                  borderColor: color,
                  background:  rem.estado === key ? color : "transparent",
                  color:       rem.estado === key ? "#fff" : color,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {rem.clienteEmpresa || rem.clienteNombre ? (
            <span className="po-client-chip">{rem.clienteEmpresa || rem.clienteNombre}</span>
          ) : null}
        </div>

        <div className="po-editor-toolbar-right">
          {msg ? <span className="po-toolbar-msg">{msg}</span> : null}
          <button
            className="secondary-button compact-action"
            type="button"
            onClick={() => setShowImport(true)}
            title="Importar artículos y cliente desde una preorden"
          >
            ↑ Importar preorden
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

        {/* ── Secciones del encabezado del documento ── */}
        <div className="po-remission-info">
          {/* Cliente */}
          <section className="po-remission-group po-remission-group--client">
            <div className="po-remission-title">Cliente</div>
            <div className="po-remission-fields po-remission-fields--client">
              <Field label="Fecha emisión">
                <input type="date" value={rem.fecha} onChange={setRf("fecha")} style={inp} />
              </Field>
              <Field label="Cliente">
                <select
                  value={rem.client_id || ""}
                  onChange={(e) => { setRem((r) => ({ ...r, client_id: e.target.value })); markEdited(); }}
                  style={inp}
                >
                  <option value="">Selecciona un cliente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.company || c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Nombre">
                <input value={rem.clienteNombre} onChange={setRf("clienteNombre")} style={inp} />
              </Field>
              <Field label="Empresa">
                <input value={rem.clienteEmpresa} onChange={setRf("clienteEmpresa")} style={inp} />
              </Field>
              <Field label="Teléfono">
                <input value={rem.clienteTelefono} onChange={setRf("clienteTelefono")} style={inp} />
              </Field>
              <Field label="RFC">
                <input value={rem.clienteRfc} onChange={setRf("clienteRfc")} style={inp} />
              </Field>
            </div>
          </section>

          {/* Datos de emisión */}
          <section className="po-remission-group">
            <div className="po-remission-title">Datos de emisión</div>
            <div className="po-remission-fields">
              <Field label="Moneda">
                <select value={rem.moneda} onChange={setRf("moneda")} style={inp}>
                  <option value="USD">USD — Venta de exportación</option>
                  <option value="MXN">MXN — México</option>
                </select>
              </Field>
              <Field label="Tipo de cambio">
                <input type="number" step="0.01" placeholder="Ej. 17.50" value={rem.tipoCambioEmision} onChange={setRf("tipoCambioEmision")} style={inp} />
              </Field>
              {esUSD ? (
                <Field label="Kitco (USD/oz)">
                  <input type="number" step="0.01" placeholder="Ej. 31.50" value={rem.kitcoEmision} onChange={setRf("kitcoEmision")} style={inp} />
                </Field>
              ) : null}
              <Field label="Fecha de entrega">
                <input type="date" value={rem.fechaEntrega} onChange={setRf("fechaEntrega")} style={inp} />
              </Field>
              <Field label="Estado">
                <select value={rem.estado} onChange={setRf("estado")} style={inp}>
                  {Object.entries(STATUS).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {/* Comentarios */}
          <section className="po-remission-group po-remission-group--notes">
            <div className="po-remission-title">Comentarios</div>
            <textarea
              value={rem.notas}
              onChange={setRf("notas")}
              placeholder="Instrucciones de envío, observaciones..."
            />
          </section>

          {/* Totales */}
          <section className="po-remission-group po-remission-group--totals">
            <div className="po-remission-title">Totales</div>
            <div className="po-remission-total-row"><span>Piezas</span><strong>{totals.piezas}</strong></div>
            <div className="po-remission-total-row"><span>Gramos</span><strong>{totals.gramos.toFixed(2)} g</strong></div>
            <div className="po-remission-total-row po-remission-total-row--money">
              <span>Total {rem.moneda}</span>
              <strong>{esUSD ? fmt(totals.totalUsd, "USD") : fmt(totals.totalMxn, "MXN")}</strong>
            </div>
          </section>
        </div>
      </header>

      {/* ── Cuerpo: tabla de artículos ── */}
      <main className="po-editor-body">
        <section className="quote-block">
          <h3>Artículos</h3>

          {/* Buscador / scanner de productos */}
          {products.length ? (
            <div className="quote-product-picker">
              <label>
                Agregar producto a esta remisión
                <input
                  ref={scannerInputRef}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleProductSubmit(); }}}
                  placeholder="Escanear código o buscar por SKU / descripción / línea"
                />
              </label>
              <div className="quote-picker-actions">
                <button className="primary-button compact-action" type="button" onClick={handleProductSubmit}>
                  Agregar por código
                </button>
                <button className="secondary-button compact-action" type="button" onClick={addLine}>
                  + Línea manual
                </button>
              </div>
              {productResults.length ? (
                <div className="quote-product-results">
                  {productResults.map((p) => (
                    <button key={p.codigo} type="button" onClick={() => addProduct(p)}>
                      <img
                        src={imageUrlForSize(p.fotoUrl, 120) || buildPlaceholderUrl()}
                        alt={p.descripcion}
                        loading="lazy"
                        onError={(e) => { e.currentTarget.src = buildPlaceholderUrl(); }}
                      />
                      <span>
                        <strong>{p.codigo}</strong>
                        <small>{shortText(p.descripcion, 62)}</small>
                      </span>
                      <b>Agregar</b>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <button className="secondary-button compact-action" type="button" onClick={addLine}>
                + Agregar línea
              </button>
            </div>
          )}

          {/* Tabla de artículos */}
          <div className="responsive-table">
            <table className="simple-admin-table quote-items-table">
              <thead>
                {esUSD ? (
                  <tr>
                    <th>Foto</th>
                    <th>SKU</th>
                    <th className="right">Pzs</th>
                    <th>Descripción</th>
                    <th className="right">g/pza</th>
                    <th className="right">g total</th>
                    <th className="right">$/g USD</th>
                    <th className="right">Subtotal USD</th>
                    <th>Notas</th>
                    <th></th>
                  </tr>
                ) : (
                  <tr>
                    <th>Foto</th>
                    <th>SKU</th>
                    <th className="right">Pzs</th>
                    <th>Descripción</th>
                    <th className="right">g/pza</th>
                    <th className="right">g total</th>
                    <th className="right">Labor/g MXN</th>
                    <th className="right">Sub. labor MXN</th>
                    <th>Notas</th>
                    <th></th>
                  </tr>
                )}
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      {item.productoFotoUrl ? (
                        <img
                          src={imageUrlForSize(item.productoFotoUrl, 80) || buildPlaceholderUrl()}
                          alt={item.productoCodigo}
                          style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, display: "block" }}
                          onError={(e) => { e.currentTarget.src = buildPlaceholderUrl(); }}
                          loading="lazy"
                        />
                      ) : <div style={{ width: 40, height: 40, background: "var(--neutral-100)", borderRadius: 4 }} />}
                    </td>
                    <td>
                      <input
                        className="rem-cell-input"
                        value={item.productoCodigo}
                        onChange={(e) => setItemField(idx, "productoCodigo", e.target.value)}
                        placeholder="SKU"
                        style={{ width: 80 }}
                      />
                    </td>
                    <td>
                      <input
                        className="rem-cell-input rem-cell-input--num"
                        type="number" min="1"
                        value={item.cantidad}
                        onChange={(e) => setItemField(idx, "cantidad", Number(e.target.value))}
                        style={{ width: 50 }}
                      />
                    </td>
                    <td>
                      <input
                        className="rem-cell-input rem-cell-input--wide"
                        value={item.descripcion}
                        onChange={(e) => setItemField(idx, "descripcion", e.target.value)}
                        placeholder="Descripción del artículo"
                        required
                      />
                    </td>
                    <td>
                      <input
                        className="rem-cell-input rem-cell-input--num"
                        type="number" step="0.001" min="0"
                        value={item.gramosPorPieza}
                        onChange={(e) => setItemField(idx, "gramosPorPieza", Number(e.target.value))}
                        style={{ width: 70 }}
                      />
                    </td>
                    <td className="right">
                      <span className="rem-cell-value">{Number(item.gramosTotal || 0).toFixed(3)}</span>
                    </td>
                    {esUSD ? (
                      <>
                        <td>
                          <input
                            className="rem-cell-input rem-cell-input--num"
                            type="number" step="0.001" min="0"
                            value={item.precioUsdPorGramo}
                            onChange={(e) => setItemField(idx, "precioUsdPorGramo", Number(e.target.value))}
                            style={{ width: 80 }}
                          />
                        </td>
                        <td className="right">
                          <strong className="rem-cell-value">{fmt(item.subtotalUsd, "USD")}</strong>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          <input
                            className="rem-cell-input rem-cell-input--num"
                            type="number" step="0.01" min="0"
                            value={item.laborMxnPorGramo}
                            onChange={(e) => setItemField(idx, "laborMxnPorGramo", Number(e.target.value))}
                            style={{ width: 80 }}
                          />
                        </td>
                        <td className="right">
                          <strong className="rem-cell-value">{fmt(item.subtotalLaborMxn, "MXN")}</strong>
                        </td>
                      </>
                    )}
                    <td>
                      <input
                        className="rem-cell-input"
                        value={item.notas || ""}
                        onChange={(e) => setItemField(idx, "notas", e.target.value)}
                        placeholder="Nota..."
                        style={{ width: 120 }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-delete"
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="right"><strong>Totales:</strong></td>
                  <td className="right"><strong>{totals.gramos.toFixed(3)} g</strong></td>
                  {esUSD ? (
                    <>
                      <td></td>
                      <td className="right"><strong>{fmt(totals.totalUsd, "USD")}</strong></td>
                    </>
                  ) : (
                    <>
                      <td></td>
                      <td className="right"><strong>{fmt(totals.totalMxn, "MXN")}</strong></td>
                    </>
                  )}
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* ── Barra de totales inferior ── */}
        <section className="po-totals-bar">
          <div>
            <span>Piezas</span><strong>{totals.piezas}</strong>
          </div>
          <div>
            <span>Gramos</span><strong>{totals.gramos.toFixed(2)} g</strong>
          </div>
          <div>
            <span>Total {rem.moneda}</span>
            <strong>{esUSD ? fmt(totals.totalUsd, "USD") : fmt(totals.totalMxn, "MXN")}</strong>
          </div>
          <div>
            <span>Folio</span><strong>{rem.folio || "—"}</strong>
          </div>
        </section>
      </main>

      {/* Modal importar desde preorden */}
      {showImport ? (
        <ImportarPreordenModal
          tenantId={tenantId}
          profile={profile}
          onSelect={handleImportFromPreorder}
          onClose={() => setShowImport(false)}
        />
      ) : null}
    </div>
  );
}
