import { useCallback, useEffect, useState } from "react";
import { fetchBalanceData, fetchCuentas } from "../../services/adminModuleService";

// ─── Inicio financiero ────────────────────────────────────────────────────────
// Dashboard que responde las 6 preguntas del dueño:
// 1. cuánto vendí · 2. cuánto debo · 3. cuánto me deben
// 4. cuánto gasté · 5. dónde está el dinero · 6. cómo van mis utilidades
// Fase A: solo lectura sobre las tablas actuales (remisiones, cobros, gastos,
// cuentas). No cambia captura ni esquema.

const hoy = () => new Date().toISOString().split("T")[0];
const inicioMes = () => hoy().slice(0, 8) + "01";

const fmtMXN = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(n || 0));
const fmtMXN2 = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n || 0));
const fmtUSD = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n || 0));
const fmtG = (n) =>
  `${Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 1 })} g`;

const CUENTA_TIPO_LABEL = {
  efectivo: "Efectivo",
  banco: "Banco",
  plataforma: "Plataforma",
  plata: "Plata",
};

export default function InicioFinancieroTab({ tenantId, onNavigate }) {
  const [desde, setDesde] = useState(inicioMes());
  const [hasta, setHasta] = useState(hoy());
  const [data, setData] = useState(null);
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [balance, ctas] = await Promise.all([
        fetchBalanceData(tenantId, { desde, hasta }),
        fetchCuentas(tenantId),
      ]);
      setData(balance);
      setCuentas(ctas);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId, desde, hasta]);

  useEffect(() => { load(); }, [load]);

  const go = (subTab) => onNavigate?.(subTab);

  if (loading && !data) return <div className="fin-loading">Cargando tu información financiera…</div>;
  if (error) return <div className="fin-error">Error al cargar: {error}</div>;
  if (!data) return null;

  // ── Derivar las 6 respuestas ──────────────────────────────────────────────
  const ventas = data.ventas || {};
  const cobrado = data.cobrado || {};
  const cxc = data.cxc || {};
  const gastos = data.gastos || {};

  // Dinero disponible: cuentas que no son plata, en saldo_actual
  const cuentasDinero = cuentas.filter((c) => c.tipo !== "plata");
  const cuentasPlata = cuentas.filter((c) => c.tipo === "plata");
  const dineroTotal = cuentasDinero.reduce((s, c) => s + Number(c.saldo_actual || 0), 0);
  const plataGramos = cuentasPlata.reduce((s, c) => s + Number(c.gramos_actuales || 0), 0);

  // Resultado operativo del periodo (estimado): cobrado - gastos.
  // Etiquetado con honestidad: no es un estado de resultados contable.
  const cobradoTotalMxn = Number(cobrado.mxn || 0) + Number(data.gananciaCambiaria || 0);
  const resultadoOperativo = cobradoTotalMxn - Number(gastos.total || 0);

  // Top categorías de gasto
  const categorias = Object.entries(gastos.porCategoria || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxCat = categorias.length ? categorias[0][1] : 0;

  return (
    <div className="fin-dashboard">
      {/* ── Encabezado con periodo ── */}
      <div className="fin-header">
        <div>
          <h2 className="fin-title">Inicio</h2>
          <p className="fin-subtitle">Tu negocio en un vistazo · {data.periodo?.desde} al {data.periodo?.hasta}</p>
        </div>
        <div className="fin-period">
          <label>
            <span>Desde</span>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label>
            <span>Hasta</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <button type="button" className="secondary-button compact-action" onClick={load} disabled={loading}>
            {loading ? "…" : "Actualizar"}
          </button>
        </div>
      </div>

      {/* ── Banda 1: las 6 preguntas ── */}
      <div className="fin-grid">

        <button type="button" className="fin-card" onClick={() => go("remisiones")}>
          <span className="fin-card__q">¿Cuánto vendí?</span>
          <span className="fin-card__value">{fmtMXN(ventas.mxn)}</span>
          {Number(ventas.usd) > 0 && <span className="fin-card__alt">+ {fmtUSD(ventas.usd)} en USD</span>}
          <span className="fin-card__detail">
            Cobrado en el periodo: <strong>{fmtMXN(cobrado.mxn)}</strong>
            {Number(cobrado.usd) > 0 ? <> · {fmtUSD(cobrado.usd)}</> : null}
          </span>
          <span className="fin-card__link">Ver ventas y cobros →</span>
        </button>

        <button type="button" className="fin-card" onClick={() => go("gastos")}>
          <span className="fin-card__q">¿Cuánto debo?</span>
          <span className={`fin-card__value${Number(gastos.pendientes) > 0 ? " fin-card__value--alert" : ""}`}>
            {fmtMXN(gastos.pendientes)}
          </span>
          <span className="fin-card__detail">
            {Number(gastos.pendientes) > 0
              ? "Gastos con saldo pendiente de pago"
              : "Sin deudas pendientes registradas"}
          </span>
          <span className="fin-card__link">Ver gastos por pagar →</span>
        </button>

        <button type="button" className="fin-card" onClick={() => go("remisiones")}>
          <span className="fin-card__q">¿Cuánto me deben?</span>
          <span className={`fin-card__value${(Number(cxc.mxn) + Number(cxc.usd)) > 0 ? " fin-card__value--warn" : ""}`}>
            {fmtMXN(cxc.mxn)}
          </span>
          {(Number(cxc.usd) > 0 || Number(cxc.plataGramos) > 0) && (
            <span className="fin-card__alt">
              {Number(cxc.usd) > 0 && <>+ {fmtUSD(cxc.usd)}</>}
              {Number(cxc.usd) > 0 && Number(cxc.plataGramos) > 0 && " · "}
              {Number(cxc.plataGramos) > 0 && <>+ {fmtG(cxc.plataGramos)} de plata</>}
            </span>
          )}
          <span className="fin-card__detail">Saldo total por cobrar a clientes</span>
          <span className="fin-card__link">Ver cuentas por cobrar →</span>
        </button>

        <button type="button" className="fin-card" onClick={() => go("gastos")}>
          <span className="fin-card__q">¿Cuánto gasté?</span>
          <span className="fin-card__value">{fmtMXN(gastos.total)}</span>
          <span className="fin-card__detail">
            Fijos <strong>{fmtMXN(gastos.fijos)}</strong> · Variables <strong>{fmtMXN(gastos.variables)}</strong>
          </span>
          <span className="fin-card__link">Ver gastos del periodo →</span>
        </button>

        <button type="button" className="fin-card" onClick={() => go("cuentas")}>
          <span className="fin-card__q">¿Dónde está el dinero?</span>
          <span className="fin-card__value">{fmtMXN(dineroTotal)}</span>
          {plataGramos > 0 && <span className="fin-card__alt">+ {fmtG(plataGramos)} de plata</span>}
          <span className="fin-card__detail">
            {cuentasDinero.length
              ? `En ${cuentasDinero.length} cuenta${cuentasDinero.length !== 1 ? "s" : ""} activa${cuentasDinero.length !== 1 ? "s" : ""}`
              : "Configura tus cuentas de dinero"}
          </span>
          <span className="fin-card__link">Ver cuentas y saldos →</span>
        </button>

        <button type="button" className="fin-card" onClick={() => go("balance")}>
          <span className="fin-card__q">¿Cómo van mis utilidades?</span>
          <span className={`fin-card__value ${resultadoOperativo >= 0 ? "fin-card__value--ok" : "fin-card__value--alert"}`}>
            {fmtMXN(resultadoOperativo)}
          </span>
          <span className="fin-card__detail">
            Resultado operativo estimado del periodo (cobrado − gastado)
          </span>
          <span className="fin-card__link">Ver resultados →</span>
        </button>

      </div>

      {/* ── Banda 2: detalle accionable ── */}
      <div className="fin-row">

        {/* Dónde está el dinero — por cuenta */}
        <section className="fin-panel">
          <h3 className="fin-panel__title">Saldos por cuenta</h3>
          {cuentas.length === 0 ? (
            <p className="fin-panel__empty">Aún no tienes cuentas configuradas.</p>
          ) : (
            <ul className="fin-account-list">
              {cuentas.map((c) => (
                <li key={c.id} className="fin-account">
                  <span className={`fin-account__dot fin-account__dot--${c.tipo}`} />
                  <span className="fin-account__name">
                    {c.nombre}
                    <small>{CUENTA_TIPO_LABEL[c.tipo] || c.tipo}</small>
                  </span>
                  <strong className="fin-account__amount">
                    {c.tipo === "plata" ? fmtG(c.gramos_actuales) : fmtMXN2(c.saldo_actual)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* En qué se va el dinero — top categorías */}
        <section className="fin-panel">
          <h3 className="fin-panel__title">En qué se va el dinero</h3>
          {categorias.length === 0 ? (
            <p className="fin-panel__empty">Sin gastos registrados en este periodo.</p>
          ) : (
            <ul className="fin-cat-list">
              {categorias.map(([nombre, monto]) => (
                <li key={nombre} className="fin-cat">
                  <span className="fin-cat__name">{nombre}</span>
                  <span className="fin-cat__bar">
                    <span className="fin-cat__fill" style={{ width: `${maxCat ? Math.max(6, (monto / maxCat) * 100) : 0}%` }} />
                  </span>
                  <strong className="fin-cat__amount">{fmtMXN(monto)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>

      <p className="fin-disclaimer">
        Cifras operativas calculadas de tus remisiones, cobros, gastos y cuentas.
        No sustituyen un estado financiero contable ni información fiscal.
      </p>
    </div>
  );
}
