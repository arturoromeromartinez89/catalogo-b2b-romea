import { useState } from "react";

// ─── Modal de registro de cobro sobre una remisión ───────────────────────────
// Extraído de RemisionesTab (componente legado no renderizado) para que el
// flujo de cobros viva en RemisionWorkspace — "Ventas y cobros".

const today = () => new Date().toISOString().split("T")[0];
const fmtMXN = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n || 0));
const fmtUSD = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n || 0));

const MEDIO_PAGO_LABELS = {
  efectivo_mxn:      "Efectivo MXN",
  transferencia_usd: "Transferencia USD",
  plata_fisica:      "Plata física",
  mercado_pago:      "Mercado Pago",
  otro:              "Otro",
};

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

export default function CobrarModal({ remision, cuentas = [], onSave, onClose, saving }) {
  const [form, setForm] = useState(() => emptyCobro(remision));
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const esUSD = remision.moneda === "USD";
  const saldoPendiente = remision.saldoDinero;
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
            {saldoPlata > 0 && <span>Plata pendiente: <strong>{Number(saldoPlata).toFixed(3)} g</strong></span>}
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

                {cuentas.filter((c) => c.tipo !== "plata").length > 0 && (
                  <label className="rem-field">
                    <span>Cuenta destino</span>
                    <select value={form.cuentaId || ""} onChange={(e) => set("cuentaId", e.target.value)}>
                      <option value="">— Sin cuenta —</option>
                      {cuentas.filter((c) => c.tipo !== "plata").map((c) => (
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
