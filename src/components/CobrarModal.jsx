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

const mediosDinero = (moneda) => moneda === "USD"
  ? ["transferencia_usd", "otro"]
  : ["efectivo_mxn", "mercado_pago", "otro"];

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
  const esPlataFisica = form.tipoAbono === "plata_gramos";
  const monedaCuenta = esPlataFisica ? "GRM" : form.monedaRecibida;
  const cuentasCompatibles = cuentas.filter((cuenta) => cuenta.activo
    && (esPlataFisica
      ? cuenta.tipo === "plata" && cuenta.moneda === "GRM"
      : cuenta.tipo !== "plata" && cuenta.moneda === monedaCuenta));
  const cuentaValida = cuentasCompatibles.some((cuenta) => cuenta.id === form.cuentaId);

  const calcMxnEquiv = (monto, moneda, tc) => {
    if (moneda === "MXN") return Number(monto);
    return Number(monto) * Number(tc || 1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cuentaValida) return;
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
              <select value={form.tipoAbono} onChange={(e) => {
                const tipoAbono = e.target.value;
                setForm((current) => ({
                  ...current,
                  tipoAbono,
                  cuentaId: "",
                  medioPago: tipoAbono === "plata_gramos"
                    ? "plata_fisica"
                    : (esUSD ? "transferencia_usd" : "efectivo_mxn"),
                  monedaRecibida: tipoAbono === "plata_gramos" ? null : (esUSD ? "USD" : "MXN"),
                }));
              }}>
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
                    {mediosDinero(form.monedaRecibida).map((key) => (
                      <option key={key} value={key}>{MEDIO_PAGO_LABELS[key]}</option>
                    ))}
                  </select>
                </label>

                {esUSD && (
                  <label className="rem-field">
                    <span>Tipo de cambio (si aplica)</span>
                    <input type="number" step="0.01" min="0" value={form.tipoCambio} onChange={(e) => set("tipoCambio", e.target.value)} placeholder="Ej. 17.50" />
                  </label>
                )}

                <label className="rem-field">
                  <span>Cuenta destino</span>
                  <select value={form.cuentaId || ""} onChange={(e) => set("cuentaId", e.target.value)} required>
                    <option value="">Selecciona una cuenta...</option>
                    {cuentasCompatibles.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  {cuentasCompatibles.length === 0 && <small>Crea primero una cuenta activa en {monedaCuenta}.</small>}
                </label>
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
                <label className="rem-field">
                  <span>Caja de plata destino</span>
                  <select value={form.cuentaId || ""} onChange={(e) => set("cuentaId", e.target.value)} required>
                    <option value="">Selecciona una caja de plata...</option>
                    {cuentasCompatibles.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  {cuentasCompatibles.length === 0 && <small>Crea primero una caja activa en gramos.</small>}
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
          <button type="submit" form="cobro-form" className="primary-button" disabled={saving || !cuentaValida}>
            {saving ? "Guardando…" : "Registrar cobro"}
          </button>
        </footer>
      </div>
    </div>
  );
}
