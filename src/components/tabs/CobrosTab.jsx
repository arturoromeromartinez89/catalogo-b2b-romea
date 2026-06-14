import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchCobros, registrarCobro, fetchRemisiones, fetchCuentas, seedCuentasDefault,
} from "../../services/adminModuleService";

const today = () => new Date().toISOString().split("T")[0];
const fmtMXN = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n || 0));
const fmtUSD = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n || 0));
const fmtG = (n) => `${Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 2 })} g`;

const MEDIO_LABELS = {
  efectivo_mxn: "Efectivo", transferencia_usd: "Transferencia", plata_fisica: "Plata física",
  mercado_pago: "Mercado Pago", otro: "Otro",
};

// ─── Modal: nuevo cobro ───────────────────────────────────────────────────────
// Flujo: ¿de quién? → ¿a qué venta se aplica (o anticipo)? → ¿cómo pagó?
function NuevoCobroModal({ clients, remisiones, cuentas, onSave, onClose, saving }) {
  const [clienteId, setClienteId] = useState("");
  const [destino, setDestino] = useState("");        // remisionId | "anticipo"
  const [forma, setForma] = useState("MXN");          // MXN | USD | PLATA
  const [monto, setMonto] = useState("");
  const [tipoCambio, setTipoCambio] = useState("");
  const [fecha, setFecha] = useState(today());
  const [medio, setMedio] = useState("efectivo_mxn");
  const [cuentaId, setCuentaId] = useState("");
  const [referencia, setReferencia] = useState("");

  // Remisiones con saldo del cliente elegido
  const saldos = useMemo(
    () => remisiones.filter((r) => r.clienteId === clienteId && (Number(r.saldoDinero) > 0 || Number(r.saldoPlataGramos) > 0) && r.estado !== "cancelada"),
    [remisiones, clienteId]
  );

  const cuentasDinero = cuentas.filter((c) => c.tipo !== "plata");
  const num = Number(monto || 0);
  const valido = clienteId && destino && num > 0 && (forma !== "USD" || Number(tipoCambio) > 0);

  const submit = () => {
    if (!valido || saving) return;
    const remisionId = destino === "anticipo" ? null : destino;
    const base = { clienteId, remisionId, fechaCobro: fecha, medioPago: medio, cuentaId: cuentaId || null, referenciaBancaria: referencia };
    let cobro;
    if (forma === "MXN") {
      cobro = { ...base, tipoAbono: "labor_mxn", abonoLaborMxn: num, montoRecibido: num, monedaRecibida: "MXN", montoMxnEquivalente: num };
    } else if (forma === "USD") {
      const tc = Number(tipoCambio || 0);
      cobro = { ...base, tipoAbono: "total_usd", abonoUsd: num, montoRecibido: num, monedaRecibida: "USD", tipoCambio: tc, montoMxnEquivalente: num * tc };
    } else {
      cobro = { ...base, tipoAbono: "plata_gramos", abonoPlataGramos: num, gramosRecibidos: num, monedaRecibida: "GRM" };
    }
    onSave(cobro);
  };

  return (
    <div className="client-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="client-modal gf-modal">
        <header>
          <h2>Registrar cobro</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <div className="gf-body">

          <div className="gf-step">
            <span className="gf-step__label">¿De qué cliente?</span>
            <select className="gf-input" value={clienteId} onChange={(e) => { setClienteId(e.target.value); setDestino(""); }} autoFocus>
              <option value="">Elige un cliente…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
            </select>
          </div>

          {clienteId && (
            <div className="gf-step">
              <span className="gf-step__label">¿A qué se aplica?</span>
              <div className="gf-chips">
                {saldos.map((r) => (
                  <button key={r.id} type="button" className={`gf-chip${destino === r.id ? " gf-chip--on" : ""}`} onClick={() => setDestino(r.id)}>
                    {r.folio} · debe {Number(r.saldoDinero) > 0 ? fmtMXN(r.saldoDinero) : ""}{Number(r.saldoPlataGramos) > 0 ? ` ${fmtG(r.saldoPlataGramos)}` : ""}
                  </button>
                ))}
                <button type="button" className={`gf-chip gf-chip--anticipo${destino === "anticipo" ? " gf-chip--on" : ""}`} onClick={() => setDestino("anticipo")}>
                  + Anticipo (sin venta — saldo a favor)
                </button>
              </div>
              {saldos.length === 0 && destino !== "anticipo" && (
                <p className="cap-hint">Este cliente no tiene ventas con saldo. Puedes registrar el cobro como anticipo.</p>
              )}
            </div>
          )}

          {destino && (
            <>
              <div className="gf-step">
                <span className="gf-step__label">¿Cómo pagó?</span>
                <div className="gf-segmented">
                  <button type="button" className={forma === "MXN" ? "on" : ""} onClick={() => setForma("MXN")}>Pesos</button>
                  <button type="button" className={forma === "USD" ? "on" : ""} onClick={() => setForma("USD")}>Dólares</button>
                  <button type="button" className={forma === "PLATA" ? "on" : ""} onClick={() => setForma("PLATA")}>Plata (gramos)</button>
                </div>
              </div>

              <div className="gf-step">
                <span className="gf-step__label">{forma === "PLATA" ? "¿Cuántos gramos?" : "¿Cuánto y cuándo?"}</span>
                <div className="gf-row">
                  <div className="gf-amount">
                    <span className="gf-amount__symbol">{forma === "PLATA" ? "g" : "$"}</span>
                    <input type="number" step="0.01" min="0" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
                    <span className="gf-amount__currency">{forma === "PLATA" ? "GRM" : forma}</span>
                  </div>
                  <input className="gf-input gf-input--date" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
                {forma === "USD" && (
                  <label className="gf-labeled" style={{ maxWidth: 220 }}>
                    <span>Tipo de cambio del día</span>
                    <input className="gf-input" type="number" step="0.01" min="0" value={tipoCambio} onChange={(e) => setTipoCambio(e.target.value)} placeholder="Ej. 17.50" />
                  </label>
                )}
              </div>

              <div className="gf-step">
                <span className="gf-step__label">Medio y cuenta</span>
                <div className="gf-row">
                  <select className="gf-input" value={medio} onChange={(e) => setMedio(e.target.value)} style={{ flex: "0 0 auto" }}>
                    {Object.entries(MEDIO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  {forma !== "PLATA" && cuentasDinero.length > 0 && (
                    <select className="gf-input" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
                      <option value="">¿A qué cuenta entró? (opcional)</option>
                      {cuentasDinero.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  )}
                </div>
                <input className="gf-input" type="text" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Referencia / folio (opcional)" />
              </div>
            </>
          )}
        </div>
        <footer className="gf-footer">
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="primary-button" disabled={!valido || saving} onClick={submit}>
            {saving ? "Guardando…" : destino === "anticipo" ? "Registrar anticipo" : "Registrar cobro"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CobrosTab({ tenantId, clients = [], notifyAction, setStatus }) {
  const [cobros, setCobros] = useState([]);
  const [remisiones, setRemisiones] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [saving, setSaving] = useState(false);

  const notify = (t, type = "success") => { if (notifyAction) notifyAction(type, "", t); else if (setStatus) setStatus(t); };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [cb, rm, cu] = await Promise.all([
        fetchCobros(tenantId),
        fetchRemisiones(tenantId),
        seedCuentasDefault(tenantId).catch(() => fetchCuentas(tenantId)),
      ]);
      setCobros(cb); setRemisiones(rm); setCuentas(cu || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (cobro) => {
    setSaving(true);
    try {
      await registrarCobro(cobro, tenantId);
      notify(cobro.remisionId ? "Cobro registrado." : "Anticipo registrado.");
      setShowNuevo(false);
      load();
    } catch (e) { notify(`No se pudo registrar: ${e.message}`, "error"); }
    finally { setSaving(false); }
  };

  // Enriquecer cobros con cliente/folio desde lo ya cargado (sin joins de
  // PostgREST, que fallan si el FK no está en el schema cache).
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.company || c.name])), [clients]);
  const remisionMap = useMemo(() => new Map(remisiones.map((r) => [r.id, r.folio])), [remisiones]);
  const cobrosEnriq = useMemo(() => cobros.map((c) => ({
    ...c,
    clienteNombre: clientMap.get(c.clienteId) || "",
    remisionFolio: remisionMap.get(c.remisionId) || "",
    esAnticipo: !c.remisionId,
  })), [cobros, clientMap, remisionMap]);

  // Saldo a favor por cliente (anticipos sin asociar)
  const saldoAFavor = useMemo(() => {
    const m = new Map();
    cobrosEnriq.filter((c) => c.esAnticipo).forEach((c) => {
      const mxn = Number(c.montoMxnEquivalente || c.abonoLaborMxn || 0);
      if (mxn > 0) m.set(c.clienteNombre || "Cliente", (m.get(c.clienteNombre || "Cliente") || 0) + mxn);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [cobrosEnriq]);

  if (loading) return <div className="fin-loading">Cargando cobros…</div>;
  if (error) return <div className="fin-error">Error: {error}</div>;

  const montoCobro = (c) => {
    if (c.tipoAbono === "plata_gramos") return fmtG(c.abonoPlataGramos);
    if (c.tipoAbono === "total_usd") return fmtUSD(c.abonoUsd);
    return fmtMXN(c.abonoLaborMxn || c.montoMxnEquivalente);
  };

  return (
    <div className="fin-dashboard">
      <div className="fin-header">
        <div>
          <h2 className="fin-title">Cobros</h2>
          <p className="fin-subtitle">Pagos que te hacen tus clientes — asociados a una venta o como anticipo</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setShowNuevo(true)}>+ Nuevo cobro</button>
      </div>

      {saldoAFavor.length > 0 && (
        <div className="fin-panel" style={{ marginBottom: "var(--sp-4)" }}>
          <h3 className="fin-panel__title">Saldo a favor (anticipos por aplicar)</h3>
          <ul className="fin-cat-list">
            {saldoAFavor.map(([nombre, monto]) => (
              <li key={nombre} className="cap-mov">
                <span className="cap-mov__body"><strong>{nombre}</strong><small>adelantó dinero</small></span>
                <strong className="cap-mov__amount cap-mov__amount--aportacion">{fmtMXN(monto)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cobrosEnriq.length === 0 ? (
        <div className="rem-empty">Aún no registras cobros. Captura el primero con “+ Nuevo cobro”.</div>
      ) : (
        <div className="rem-table-wrap">
          <table className="rem-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Se aplicó a</th>
                <th>Medio</th>
                <th className="right">Monto</th>
              </tr>
            </thead>
            <tbody>
              {cobrosEnriq.map((c) => (
                <tr key={c.id}>
                  <td>{c.fechaCobro}</td>
                  <td><strong>{c.clienteNombre || "—"}</strong></td>
                  <td>
                    {c.esAnticipo
                      ? <span className="cap-mov__tag cap-mov__tag--aportacion">Anticipo</span>
                      : <span>{c.remisionFolio || "Venta"}</span>}
                  </td>
                  <td>{MEDIO_LABELS[c.medioPago] || c.medioPago || "—"}</td>
                  <td className="right"><strong>{montoCobro(c)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNuevo && (
        <NuevoCobroModal
          clients={clients}
          remisiones={remisiones}
          cuentas={cuentas}
          onSave={handleSave}
          onClose={() => setShowNuevo(false)}
          saving={saving}
        />
      )}
    </div>
  );
}
