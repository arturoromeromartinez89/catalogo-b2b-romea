import { useEffect, useState, useCallback } from "react";
import {
  fetchRemisiones,
  fetchRemisionById,
  createRemision,
  registrarCobro,
  cancelarRemision,
  generateFolio,
  fetchCuentas,
  seedCuentasDefault,
} from "../../services/adminModuleService";

// ─── Utilidades ───────────────────────────────────────────────────────────────

const fmt = (n, currency = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 2 }).format(Number(n || 0));

const fmtUSD = (n) => fmt(n, "USD");
const fmtMXN = (n) => fmt(n, "MXN");

const today = () => new Date().toISOString().split("T")[0];

const ESTADO_LABELS = {
  borrador: { label: "Borrador",   color: "#94a3b8" },
  emitida:  { label: "Emitida",    color: "#2563eb" },
  parcial:  { label: "Pago parcial", color: "#d97706" },
  cobrada:  { label: "Cobrada",    color: "#059669" },
  cancelada:{ label: "Cancelada",  color: "#dc2626" },
};

const MEDIO_PAGO_LABELS = {
  efectivo_mxn:      "Efectivo MXN",
  transferencia_usd: "Transferencia USD",
  plata_fisica:      "Plata física",
  mercado_pago:      "Mercado Pago",
  otro:              "Otro",
};

const emptyForm = () => ({
  fecha: today(),
  fechaEntrega: "",
  clienteNombre: "",
  clienteEmpresa: "",
  moneda: "USD",
  origen: "manual",
  kitcoEmision: "",
  tipoCambioEmision: "",
  descuento: 0,
  notas: "",
});

const emptyItem = () => ({
  productoCodigo: "",
  descripcion: "",
  cantidad: 1,
  gramosPorPieza: 0,
  gramosTotal: 0,
  laborMxnPorGramo: 0,
  plataMxnPorGramo: 0,
  precioTotalPorGramo: 0,
  precioUsdPorGramo: 0,
  subtotalUsd: 0,
  subtotalLaborMxn: 0,
  subtotalPlataGramos: 0,
  notas: "",
});

const emptyCobro = (remision) => ({
  remisionId: remision?.id || "",
  clienteId: remision?.clienteId || null,
  fechaCobro: today(),
  tipoAbono: remision?.moneda === "USD" ? "total_usd" : "labor_mxn",
  abonoLaborMxn: 0,
  abonoPlataGramos: 0,
  abonoUsd: 0,
  medioPago: remision?.moneda === "USD" ? "transferencia_usd" : "efectivo_mxn",
  montoRecibido: 0,
  monedaRecibida: remision?.moneda === "USD" ? "USD" : "MXN",
  tipoCambio: 0,
  montoMxnEquivalente: 0,
  gramosRecibidos: 0,
  kitcoDia: 0,
  gananciaCambiariaMxn: 0,
  referenciaBancaria: "",
  notas: "",
});

// ─── Badge de estado ──────────────────────────────────────────────────────────

function EstadoBadge({ estado }) {
  const { label, color } = ESTADO_LABELS[estado] || { label: estado, color: "#888" };
  return (
    <span className="rem-badge" style={{ "--badge-color": color }}>
      {label}
    </span>
  );
}

// ─── Modal de nuevo cobro ─────────────────────────────────────────────────────

function CobrarModal({ remision, cuentas, onSave, onClose, saving }) {
  const [form, setForm] = useState(() => emptyCobro(remision));
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const esUSD = remision.moneda === "USD";
  const saldoPendiente = esUSD ? remision.saldoDinero : remision.saldoDinero;
  const saldoPlata = remision.saldoPlataGramos;

  const calcMxnEquiv = (monto, moneda, tc) => {
    if (moneda === "MXN") return Number(monto);
    return Number(monto) * Number(tc || 1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cobro = {
      ...form,
      montoMxnEquivalente: calcMxnEquiv(form.montoRecibido, form.monedaRecibida, form.tipoCambio),
    };
    onSave(cobro);
  };

  return (
    <div className="client-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="client-modal">
        <header>
          <h2>Registrar cobro — {remision.folio}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <form id="cobro-form" className="rem-modal__body" onSubmit={handleSubmit}>
          <div className="rem-modal__info" style={{ marginBottom: 12 }}>
            <span>Saldo pendiente: <strong>{esUSD ? fmtUSD(saldoPendiente) : fmtMXN(saldoPendiente)}</strong></span>
            {saldoPlata > 0 && <span>Plata pendiente: <strong>{saldoPlata.toFixed(3)} g</strong></span>}
          </div>
          <div className="rem-form-grid">

            <label className="rem-field">
              <span>Fecha de cobro</span>
              <input type="date" value={form.fechaCobro} onChange={(e) => set("fechaCobro", e.target.value)} required />
            </label>

            <label className="rem-field">
              <span>Tipo de abono</span>
              <select value={form.tipoAbono} onChange={(e) => set("tipoAbono", e.target.value)}>
                {esUSD
                  ? <option value="total_usd">Pago total (USD)</option>
                  : <>
                      <option value="labor_mxn">Mano de obra (MXN)</option>
                      <option value="plata_gramos">Plata física (gramos)</option>
                    </>
                }
              </select>
            </label>

            {form.tipoAbono !== "plata_gramos" ? (
              <>
                <label className="rem-field">
                  <span>Monto {esUSD ? "USD" : "MXN"}</span>
                  <input
                    type="number" step="0.01" min="0"
                    value={form.montoRecibido}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      set("montoRecibido", v);
                      if (esUSD) set("abonoUsd", v);
                      else set("abonoLaborMxn", v);
                    }}
                    required
                  />
                </label>

                <label className="rem-field">
                  <span>Medio de pago</span>
                  <select value={form.medioPago} onChange={(e) => set("medioPago", e.target.value)}>
                    {Object.entries(MEDIO_PAGO_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </label>

                {esUSD && (
                  <label className="rem-field">
                    <span>Tipo de cambio (si aplica)</span>
                    <input type="number" step="0.01" min="0" value={form.tipoCambio} onChange={(e) => set("tipoCambio", e.target.value)} placeholder="Ej. 17.50" />
                  </label>
                )}

                {cuentas.filter(c => c.tipo !== "plata").length > 0 && (
                  <label className="rem-field">
                    <span>Cuenta destino</span>
                    <select value={form.cuentaId || ""} onChange={(e) => set("cuentaId", e.target.value)}>
                      <option value="">— Sin cuenta —</option>
                      {cuentas.filter(c => c.tipo !== "plata").map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            ) : (
              <>
                <label className="rem-field">
                  <span>Gramos recibidos</span>
                  <input type="number" step="0.001" min="0" value={form.gramosRecibidos}
                    onChange={(e) => { set("gramosRecibidos", Number(e.target.value)); set("abonoPlataGramos", Number(e.target.value)); }}
                    required />
                </label>
                <label className="rem-field">
                  <span>Kitco del día (USD/oz)</span>
                  <input type="number" step="0.01" min="0" value={form.kitcoDia} onChange={(e) => set("kitcoDia", e.target.value)} />
                </label>
                <label className="rem-field">
                  <span>Tipo de cambio</span>
                  <input type="number" step="0.01" min="0" value={form.tipoCambio} onChange={(e) => set("tipoCambio", e.target.value)} />
                </label>
              </>
            )}

            <label className="rem-field rem-field--full">
              <span>Referencia / comprobante</span>
              <input type="text" value={form.referenciaBancaria} onChange={(e) => set("referenciaBancaria", e.target.value)} placeholder="Folio transferencia, número de cheque..." />
            </label>

            <label className="rem-field rem-field--full">
              <span>Notas</span>
              <textarea value={form.notas} onChange={(e) => set("notas", e.target.value)} rows={2} />
            </label>
          </div>
        </form>
        <footer>
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" form="cobro-form" className="primary-button" disabled={saving}>
            {saving ? "Guardando…" : "Registrar cobro"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Modal de nueva remisión ──────────────────────────────────────────────────

function NuevaRemisionModal({ folios, clients, onSave, onClose, saving }) {
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([emptyItem()]);
  const folio = generateFolio("REM", folios);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const setItem = (idx, key, value) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [key]: value };
      // Auto-calcular totales
      if (["cantidad", "gramosPorPieza"].includes(key)) {
        item.gramosTotal = Number(item.cantidad) * Number(item.gramosPorPieza);
      }
      if (["gramosTotal", "laborMxnPorGramo", "plataMxnPorGramo", "precioUsdPorGramo"].includes(key)) {
        item.subtotalLaborMxn  = Number(item.gramosTotal) * Number(item.laborMxnPorGramo);
        item.subtotalPlataGramos = Number(item.gramosTotal) * Number(item.plataMxnPorGramo) > 0
          ? Number(item.gramosTotal) : 0;
        item.subtotalUsd = Number(item.gramosTotal) * Number(item.precioUsdPorGramo);
        item.precioTotalPorGramo = Number(item.laborMxnPorGramo) + Number(item.plataMxnPorGramo);
      }
      next[idx] = item;
      return next;
    });
  };

  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const totalGramos = items.reduce((s, i) => s + Number(i.gramosTotal || 0), 0);
  const totalUsd    = items.reduce((s, i) => s + Number(i.subtotalUsd || 0), 0);
  const totalMxn    = items.reduce((s, i) => s + Number(i.subtotalLaborMxn || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, folio }, items);
  };

  return (
    <div className="client-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="client-modal client-modal--wide">
        <header>
          <h2>Nueva remisión <span className="rem-modal__folio">{folio}</span></h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <form id="nueva-rem-form" className="rem-modal__body" onSubmit={handleSubmit}>

          {/* Datos generales */}
          <div className="rem-section-title">Datos generales</div>
          <div className="rem-form-grid">
            <label className="rem-field">
              <span>Fecha</span>
              <input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} required />
            </label>
            <label className="rem-field">
              <span>Fecha de entrega</span>
              <input type="date" value={form.fechaEntrega} onChange={(e) => set("fechaEntrega", e.target.value)} />
            </label>
            <label className="rem-field">
              <span>Cliente / empresa</span>
              <input type="text" value={form.clienteNombre} onChange={(e) => set("clienteNombre", e.target.value)} placeholder="Nombre del cliente" required />
            </label>
            <label className="rem-field">
              <span>Empresa</span>
              <input type="text" value={form.clienteEmpresa} onChange={(e) => set("clienteEmpresa", e.target.value)} placeholder="Nombre comercial" />
            </label>
            <label className="rem-field">
              <span>Moneda</span>
              <select value={form.moneda} onChange={(e) => set("moneda", e.target.value)}>
                <option value="USD">USD — Exportación</option>
                <option value="MXN">MXN — México</option>
              </select>
            </label>
            {form.moneda === "USD" && (
              <>
                <label className="rem-field">
                  <span>Kitco emisión (USD/oz)</span>
                  <input type="number" step="0.01" value={form.kitcoEmision} onChange={(e) => set("kitcoEmision", e.target.value)} placeholder="Ej. 31.50" />
                </label>
                <label className="rem-field">
                  <span>Tipo de cambio</span>
                  <input type="number" step="0.01" value={form.tipoCambioEmision} onChange={(e) => set("tipoCambioEmision", e.target.value)} placeholder="Ej. 17.50" />
                </label>
              </>
            )}
            <label className="rem-field rem-field--full">
              <span>Notas</span>
              <textarea value={form.notas} onChange={(e) => set("notas", e.target.value)} rows={2} placeholder="Instrucciones de envío, observaciones..." />
            </label>
          </div>

          {/* Artículos */}
          <div className="rem-section-title" style={{ marginTop: 20 }}>
            Artículos
            <button type="button" className="secondary-button compact-action" style={{ marginLeft: 12 }} onClick={addItem}>+ Agregar línea</button>
          </div>

          <div className="rem-items-table-wrap">
            <table className="rem-items-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Pzs</th>
                  <th>g/pza</th>
                  <th>g total</th>
                  {form.moneda === "USD"
                    ? <><th>$/g USD</th><th>Subtotal USD</th></>
                    : <><th>Labor/g</th><th>Subtotal labor</th><th>g plata</th></>
                  }
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td><input className="rem-cell-input" value={item.productoCodigo} onChange={(e) => setItem(idx, "productoCodigo", e.target.value)} placeholder="CHI-10MM" /></td>
                    <td><input className="rem-cell-input rem-cell-input--wide" value={item.descripcion} onChange={(e) => setItem(idx, "descripcion", e.target.value)} placeholder="Descripción del producto" required /></td>
                    <td><input className="rem-cell-input rem-cell-input--num" type="number" min="1" value={item.cantidad} onChange={(e) => setItem(idx, "cantidad", Number(e.target.value))} /></td>
                    <td><input className="rem-cell-input rem-cell-input--num" type="number" step="0.01" value={item.gramosPorPieza} onChange={(e) => setItem(idx, "gramosPorPieza", Number(e.target.value))} /></td>
                    <td><span className="rem-cell-value">{Number(item.gramosTotal || 0).toFixed(2)}</span></td>
                    {form.moneda === "USD" ? (
                      <>
                        <td><input className="rem-cell-input rem-cell-input--num" type="number" step="0.001" value={item.precioUsdPorGramo} onChange={(e) => setItem(idx, "precioUsdPorGramo", Number(e.target.value))} /></td>
                        <td><span className="rem-cell-value">{fmtUSD(item.subtotalUsd)}</span></td>
                      </>
                    ) : (
                      <>
                        <td><input className="rem-cell-input rem-cell-input--num" type="number" step="0.01" value={item.laborMxnPorGramo} onChange={(e) => setItem(idx, "laborMxnPorGramo", Number(e.target.value))} /></td>
                        <td><span className="rem-cell-value">{fmtMXN(item.subtotalLaborMxn)}</span></td>
                        <td><span className="rem-cell-value">{Number(item.subtotalPlataGramos || item.gramosTotal || 0).toFixed(3)}g</span></td>
                      </>
                    )}
                    <td><button type="button" className="table-delete" onClick={() => removeItem(idx)} disabled={items.length === 1}>×</button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="right"><strong>Totales:</strong></td>
                  <td><strong>{totalGramos.toFixed(2)}g</strong></td>
                  {form.moneda === "USD"
                    ? <><td></td><td><strong>{fmtUSD(totalUsd)}</strong></td></>
                    : <><td></td><td><strong>{fmtMXN(totalMxn)}</strong></td><td></td></>
                  }
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

        </form>
        <footer>
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" form="nueva-rem-form" className="primary-button" disabled={saving || items.every((i) => !i.descripcion)}>
            {saving ? "Guardando…" : "Crear remisión"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Panel de detalle de remisión ─────────────────────────────────────────────

function RemisionDetail({ remision, cuentas, onCobrar, onCancelar, onClose }) {
  const esUSD = remision.moneda === "USD";
  const totalCobros = remision.cobros?.length || 0;

  return (
    <div className="rem-detail">
      <div className="rem-detail__header">
        <div>
          <h3 className="rem-detail__folio">{remision.folio}</h3>
          <span className="rem-detail__cliente">{remision.clienteEmpresa || remision.clienteNombre}</span>
        </div>
        <div className="rem-detail__header-right">
          <EstadoBadge estado={remision.estado} />
          {remision.estado !== "cancelada" && remision.estado !== "cobrada" && (
            <button className="primary-button compact-action" onClick={() => onCobrar(remision)}>
              + Registrar cobro
            </button>
          )}
          {remision.estado === "emitida" && (
            <button className="danger-button compact-action" onClick={() => onCancelar(remision.id)}>
              Cancelar
            </button>
          )}
          <button className="secondary-button compact-action" onClick={onClose}>Cerrar</button>
        </div>
      </div>

      <div className="rem-detail__summary">
        <div className="rem-kpi">
          <span>Total</span>
          <strong>{esUSD ? fmtUSD(remision.total) : fmtMXN(remision.total)}</strong>
        </div>
        <div className="rem-kpi rem-kpi--cobrado">
          <span>Cobrado</span>
          <strong>{esUSD ? fmtUSD(remision.montoCobrado) : fmtMXN(remision.montoCobrado)}</strong>
        </div>
        <div className={`rem-kpi ${remision.saldoDinero > 0 ? "rem-kpi--saldo" : "rem-kpi--ok"}`}>
          <span>Saldo</span>
          <strong>{esUSD ? fmtUSD(remision.saldoDinero) : fmtMXN(remision.saldoDinero)}</strong>
        </div>
        <div className="rem-kpi">
          <span>Gramos total</span>
          <strong>{Number(remision.totalGramos || 0).toFixed(2)} g</strong>
        </div>
        {!esUSD && remision.cargoPlatGramos > 0 && (
          <div className={`rem-kpi ${remision.saldoPlataGramos > 0 ? "rem-kpi--saldo" : "rem-kpi--ok"}`}>
            <span>Plata pendiente</span>
            <strong>{Number(remision.saldoPlataGramos || 0).toFixed(3)} g</strong>
          </div>
        )}
      </div>

      {/* Artículos */}
      <div className="rem-detail__section">
        <div className="rem-detail__section-title">Artículos ({remision.items?.length || 0})</div>
        <table className="rem-items-table rem-items-table--readonly">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descripción</th>
              <th>Pzs</th>
              <th>g/pza</th>
              <th>g total</th>
              {esUSD ? <th>Subtotal USD</th> : <><th>Labor MXN</th><th>g plata</th></>}
            </tr>
          </thead>
          <tbody>
            {(remision.items || []).map((item) => (
              <tr key={item.id}>
                <td><code>{item.productoCodigo}</code></td>
                <td>{item.descripcion}</td>
                <td className="right">{item.cantidad}</td>
                <td className="right">{Number(item.gramosPorPieza).toFixed(2)}</td>
                <td className="right">{Number(item.gramosTotal).toFixed(2)}</td>
                {esUSD
                  ? <td className="right">{fmtUSD(item.subtotalUsd)}</td>
                  : <><td className="right">{fmtMXN(item.subtotalLaborMxn)}</td><td className="right">{Number(item.subtotalPlataGramos || item.gramosTotal || 0).toFixed(3)}g</td></>
                }
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cobros */}
      {totalCobros > 0 && (
        <div className="rem-detail__section">
          <div className="rem-detail__section-title">Cobros registrados ({totalCobros})</div>
          <table className="rem-items-table rem-items-table--readonly">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Medio</th>
                <th>Monto recibido</th>
                <th>Referencia</th>
              </tr>
            </thead>
            <tbody>
              {(remision.cobros || []).map((cobro) => (
                <tr key={cobro.id}>
                  <td>{cobro.fechaCobro}</td>
                  <td>{cobro.tipoAbono === "total_usd" ? "Total USD" : cobro.tipoAbono === "plata_gramos" ? "Plata física" : "Labor MXN"}</td>
                  <td>{MEDIO_PAGO_LABELS[cobro.medioPago] || cobro.medioPago}</td>
                  <td className="right">
                    {cobro.tipoAbono === "total_usd" ? fmtUSD(cobro.abonoUsd) :
                     cobro.tipoAbono === "plata_gramos" ? `${Number(cobro.abonoPlataGramos).toFixed(3)} g` :
                     fmtMXN(cobro.abonoLaborMxn)}
                  </td>
                  <td>{cobro.referenciaBancaria || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab principal ────────────────────────────────────────────────────────────

export default function RemisionesTab({ tenantId, clients = [], notifyAction, setStatus }) {
  const [remisiones, setRemisiones] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [cuentas, setCuentas]       = useState([]);

  // Filtros
  const [filtroEstado, setFiltroEstado]   = useState("");
  const [filtroMoneda, setFiltroMoneda]   = useState("");
  const [filtroBusqueda, setFiltroBusqueda] = useState("");

  // Modals
  const [showNueva, setShowNueva]         = useState(false);
  const [showCobrar, setShowCobrar]       = useState(null); // remision
  const [selected, setSelected]           = useState(null); // remision para detalle
  const [saving, setSaving]               = useState(false);

  // Retroalimentación al usuario — usa notifyAction del dashboard si está disponible
  const notify = (text, type = "success") => {
    if (notifyAction) notifyAction(type, "", text);
    else if (setStatus) setStatus(text);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rems, ctas] = await Promise.all([
        fetchRemisiones(tenantId, {
          estado: filtroEstado || undefined,
          moneda: filtroMoneda || undefined,
        }),
        seedCuentasDefault(tenantId),
      ]);
      setRemisiones(rems);
      setCuentas(ctas);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId, filtroEstado, filtroMoneda]);

  useEffect(() => { load(); }, [load]);

  const handleCreateRemision = async (form, items) => {
    setSaving(true);
    try {
      await createRemision(form, items, tenantId);
      notify("Remisión creada correctamente.");
      setShowNueva(false);
      load();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCobrar = async (cobro) => {
    setSaving(true);
    try {
      await registrarCobro(cobro, tenantId);
      notify("Cobro registrado.");
      setShowCobrar(null);
      // Actualizar detalle si está abierto
      if (selected?.id === cobro.remisionId) {
        const updated = await fetchRemisionById(cobro.remisionId);
        setSelected(updated);
      }
      load();
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelar = async (id) => {
    if (!window.confirm("¿Cancelar esta remisión?")) return;
    try {
      await cancelarRemision(id);
      notify("Remisión cancelada.");
      if (selected?.id === id) setSelected(null);
      load();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const handleRowClick = async (remision) => {
    if (selected?.id === remision.id) { setSelected(null); return; }
    try {
      const full = await fetchRemisionById(remision.id);
      setSelected(full);
    } catch (e) {
      setSelected(remision);
    }
  };

  // Filtrado client-side por búsqueda de texto
  const filtered = remisiones.filter((r) => {
    if (!filtroBusqueda) return true;
    const q = filtroBusqueda.toLowerCase();
    return (
      (r.folio || "").toLowerCase().includes(q) ||
      (r.clienteNombre || "").toLowerCase().includes(q) ||
      (r.clienteEmpresa || "").toLowerCase().includes(q)
    );
  });

  const folios = remisiones.map((r) => r.folio);

  // Totales de resumen
  const totales = filtered.reduce(
    (acc, r) => {
      if (r.moneda === "USD") {
        acc.totalUsd += Number(r.total || 0);
        acc.saldoUsd += Number(r.saldoDinero || 0);
      } else {
        acc.totalMxn += Number(r.total || 0);
        acc.saldoMxn += Number(r.saldoDinero || 0);
      }
      acc.saldoPlata += Number(r.saldoPlataGramos || 0);
      return acc;
    },
    { totalUsd: 0, saldoUsd: 0, totalMxn: 0, saldoMxn: 0, saldoPlata: 0 }
  );

  return (
    <div className="rem-tab">
      {/* Header */}
      <div className="rem-tab__header">
        <div className="rem-tab__title-row">
          <h2 className="rem-tab__title">Remisiones</h2>
          <button className="primary-button" onClick={() => setShowNueva(true)}>
            + Nueva remisión
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="rem-filters">
        <input
          className="rem-search"
          placeholder="Buscar folio, cliente..."
          value={filtroBusqueda}
          onChange={(e) => setFiltroBusqueda(e.target.value)}
        />
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABELS).map(([k, { label }]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <select value={filtroMoneda} onChange={(e) => setFiltroMoneda(e.target.value)}>
          <option value="">USD + MXN</option>
          <option value="USD">Solo USD</option>
          <option value="MXN">Solo MXN</option>
        </select>
        <button className="secondary-button compact-action" onClick={load}>↻ Actualizar</button>
      </div>

      {/* KPIs de resumen */}
      {filtered.length > 0 && (
        <div className="rem-kpi-bar">
          {totales.totalUsd > 0 && <div className="rem-kpi-bar__item"><span>Ventas USD</span><strong>{fmtUSD(totales.totalUsd)}</strong></div>}
          {totales.saldoUsd > 0 && <div className="rem-kpi-bar__item rem-kpi-bar__item--alert"><span>CxC USD</span><strong>{fmtUSD(totales.saldoUsd)}</strong></div>}
          {totales.totalMxn > 0 && <div className="rem-kpi-bar__item"><span>Ventas MXN</span><strong>{fmtMXN(totales.totalMxn)}</strong></div>}
          {totales.saldoMxn > 0 && <div className="rem-kpi-bar__item rem-kpi-bar__item--alert"><span>CxC MXN</span><strong>{fmtMXN(totales.saldoMxn)}</strong></div>}
          {totales.saldoPlata > 0 && <div className="rem-kpi-bar__item rem-kpi-bar__item--plata"><span>Plata pendiente</span><strong>{totales.saldoPlata.toFixed(3)} g</strong></div>}
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="rem-loading">Cargando remisiones…</div>
      ) : error ? (
        <div className="rem-error">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="rem-empty">
          <span>No hay remisiones{filtroEstado || filtroMoneda || filtroBusqueda ? " con esos filtros" : ". Crea la primera con el botón de arriba"}.</span>
        </div>
      ) : (
        <div className="rem-table-wrap">
          <table className="rem-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Moneda</th>
                <th className="right">Total</th>
                <th className="right">Cobrado</th>
                <th className="right">Saldo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rem) => {
                const esUSD = rem.moneda === "USD";
                const isSelected = selected?.id === rem.id;
                return (
                  <>
                    <tr
                      key={rem.id}
                      className={`rem-row${isSelected ? " rem-row--active" : ""}${rem.estado === "cancelada" ? " rem-row--cancelled" : ""}`}
                      onClick={() => handleRowClick(rem)}
                    >
                      <td><strong>{rem.folio}</strong></td>
                      <td>{rem.fecha}</td>
                      <td>
                        <div>{rem.clienteEmpresa || rem.clienteNombre}</div>
                        {rem.clienteEmpresa && rem.clienteNombre && <small className="muted">{rem.clienteNombre}</small>}
                      </td>
                      <td><span className={`rem-moneda-badge rem-moneda-badge--${rem.moneda.toLowerCase()}`}>{rem.moneda}</span></td>
                      <td className="right">{esUSD ? fmtUSD(rem.total) : fmtMXN(rem.total)}</td>
                      <td className="right">{esUSD ? fmtUSD(rem.montoCobrado) : fmtMXN(rem.montoCobrado)}</td>
                      <td className={`right ${rem.saldoDinero > 0 ? "rem-saldo--pendiente" : "rem-saldo--ok"}`}>
                        <strong>{esUSD ? fmtUSD(rem.saldoDinero) : fmtMXN(rem.saldoDinero)}</strong>
                        {rem.saldoPlataGramos > 0 && <div><small>{rem.saldoPlataGramos.toFixed(2)}g plata</small></div>}
                      </td>
                      <td><EstadoBadge estado={rem.estado} /></td>
                      <td>
                        {rem.estado !== "cancelada" && rem.estado !== "cobrada" && (
                          <button
                            className="primary-button compact-action"
                            onClick={(e) => { e.stopPropagation(); setShowCobrar(rem); }}
                          >
                            Cobrar
                          </button>
                        )}
                      </td>
                    </tr>
                    {isSelected && selected && (
                      <tr key={`${rem.id}-detail`} className="rem-row-detail">
                        <td colSpan={9} className="rem-row-detail__cell">
                          <RemisionDetail
                            remision={selected}
                            cuentas={cuentas}
                            onCobrar={setShowCobrar}
                            onCancelar={handleCancelar}
                            onClose={() => setSelected(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nueva remisión */}
      {showNueva && (
        <NuevaRemisionModal
          folios={folios}
          clients={clients}
          onSave={handleCreateRemision}
          onClose={() => setShowNueva(false)}
          saving={saving}
        />
      )}

      {/* Modal cobrar */}
      {showCobrar && (
        <CobrarModal
          remision={showCobrar}
          cuentas={cuentas}
          onSave={handleCobrar}
          onClose={() => setShowCobrar(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
