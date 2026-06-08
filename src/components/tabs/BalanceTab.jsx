import { useEffect, useState } from "react";
import { fetchBalanceData } from "../../services/adminModuleService";

const fmtMXN = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n || 0));
const fmtUSD = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" }).format(Number(n || 0));
const fmtG = (n) => `${Number(n || 0).toFixed(3)} g`;

const firstOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
const today = () => new Date().toISOString().split("T")[0];

// ─── Tarjeta KPI ──────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, variant = "default", icon }) {
  return (
    <div className={`bal-kpi bal-kpi--${variant}`}>
      {icon && <span className="bal-kpi__icon">{icon}</span>}
      <div className="bal-kpi__body">
        <span className="bal-kpi__label">{label}</span>
        <strong className="bal-kpi__value">{value}</strong>
        {sub && <span className="bal-kpi__sub">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Barra de progreso ────────────────────────────────────────────────────────

function ProgressBar({ value, total, color = "var(--brand-700, #1f335f)" }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="bal-progress">
      <div className="bal-progress__bar" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ─── Tab principal ────────────────────────────────────────────────────────────

export default function BalanceTab({ tenantId }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [desde, setDesde]   = useState(firstOfMonth());
  const [hasta, setHasta]   = useState(today());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchBalanceData(tenantId, { desde, hasta });
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId, desde, hasta]);

  const ESTADO_REMISION_LABELS = {
    emitida:   "Emitidas",
    parcial:   "Pago parcial",
    cobrada:   "Cobradas",
    cancelada: "Canceladas",
    borrador:  "Borradores",
  };

  return (
    <div className="rem-tab">
      {/* Header */}
      <div className="rem-tab__header">
        <div className="rem-tab__title-row">
          <h2 className="rem-tab__title">Balance general</h2>
          <div className="bal-period-picker">
            <label>
              <span>Desde</span>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label>
              <span>Hasta</span>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </label>
            <button className="secondary-button compact-action" onClick={load}>↻ Actualizar</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rem-loading">Calculando balance…</div>
      ) : error ? (
        <div className="rem-error">{error}</div>
      ) : !data ? null : (
        <div className="bal-content">

          {/* ── Ventas del periodo ── */}
          <section className="bal-section">
            <h3 className="bal-section__title">📦 Ventas del periodo</h3>
            <div className="bal-kpi-grid">
              {data.ventas.usd > 0 && (
                <KpiCard label="Ventas USD" value={fmtUSD(data.ventas.usd)} icon="🇺🇸" variant="primary" />
              )}
              {data.ventas.mxn > 0 && (
                <KpiCard label="Ventas MXN" value={fmtMXN(data.ventas.mxn)} icon="🇲🇽" variant="primary" />
              )}
              {data.ventas.usd === 0 && data.ventas.mxn === 0 && (
                <div className="bal-empty-note">Sin remisiones en este periodo.</div>
              )}
            </div>
          </section>

          {/* ── Cobros del periodo ── */}
          <section className="bal-section">
            <h3 className="bal-section__title">💰 Cobros del periodo</h3>
            <div className="bal-kpi-grid">
              {data.cobrado.usd > 0 && (
                <KpiCard label="Cobrado USD" value={fmtUSD(data.cobrado.usd)} icon="✓" variant="ok" />
              )}
              {data.cobrado.mxn > 0 && (
                <KpiCard label="Cobrado MXN" value={fmtMXN(data.cobrado.mxn)} icon="✓" variant="ok" />
              )}
              {data.gananciaCambiaria !== 0 && (
                <KpiCard
                  label="Ganancia cambiaria"
                  value={fmtMXN(Math.abs(data.gananciaCambiaria))}
                  variant={data.gananciaCambiaria >= 0 ? "ok" : "alert"}
                  icon={data.gananciaCambiaria >= 0 ? "↑" : "↓"}
                  sub={data.gananciaCambiaria >= 0 ? "Ganancia" : "Pérdida"}
                />
              )}
              {data.cobrado.usd === 0 && data.cobrado.mxn === 0 && (
                <div className="bal-empty-note">Sin cobros registrados en este periodo.</div>
              )}
            </div>
          </section>

          {/* ── Cuentas por cobrar (todas, no solo el periodo) ── */}
          <section className="bal-section">
            <h3 className="bal-section__title">⏳ Cuentas por cobrar (saldo total)</h3>
            <div className="bal-kpi-grid">
              {data.cxc.usd > 0 && (
                <KpiCard label="CxC en USD" value={fmtUSD(data.cxc.usd)} icon="$" variant="alert" />
              )}
              {data.cxc.mxn > 0 && (
                <KpiCard label="CxC en MXN" value={fmtMXN(data.cxc.mxn)} icon="$" variant="alert" />
              )}
              {data.cxc.plataGramos > 0 && (
                <KpiCard label="CxC Plata" value={fmtG(data.cxc.plataGramos)} icon="⬡" variant="plata" sub="gramos pendientes" />
              )}
              {data.cxc.usd === 0 && data.cxc.mxn === 0 && data.cxc.plataGramos === 0 && (
                <div className="bal-empty-note">✓ Sin cuentas por cobrar pendientes.</div>
              )}
            </div>
          </section>

          {/* ── Gastos del periodo ── */}
          <section className="bal-section">
            <h3 className="bal-section__title">📉 Gastos del periodo</h3>
            <div className="bal-kpi-grid">
              <KpiCard label="Total gastos" value={fmtMXN(data.gastos.total)} icon="🧾" />
              <KpiCard label="Gastos fijos" value={fmtMXN(data.gastos.fijos)} icon="📌" />
              <KpiCard label="Gastos variables" value={fmtMXN(data.gastos.variables)} icon="⚡" />
              {data.gastos.pendientes > 0 && (
                <KpiCard label="Por pagar" value={fmtMXN(data.gastos.pendientes)} icon="⚠️" variant="alert" sub="gastos sin liquidar" />
              )}
            </div>

            {/* Desglose por categoría */}
            {Object.keys(data.gastos.porCategoria).length > 0 && (
              <div className="bal-cat-breakdown">
                <div className="bal-cat-breakdown__title">Por categoría</div>
                {Object.entries(data.gastos.porCategoria)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, monto]) => (
                    <div key={cat} className="bal-cat-row">
                      <span className="bal-cat-row__name">{cat}</span>
                      <ProgressBar value={monto} total={data.gastos.total} />
                      <span className="bal-cat-row__amount">{fmtMXN(monto)}</span>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* ── Estado de resultados simplificado ── */}
          {(data.cobrado.usd > 0 || data.cobrado.mxn > 0) && data.gastos.total > 0 && (
            <section className="bal-section">
              <h3 className="bal-section__title">📊 Resultado del periodo (estimado)</h3>
              <div className="bal-result-table">
                {data.cobrado.usd > 0 && (
                  <div className="bal-result-row">
                    <span>Ingresos USD (en equiv. MXN a la fecha)</span>
                    <strong className="green">{fmtUSD(data.cobrado.usd)}</strong>
                  </div>
                )}
                {data.cobrado.mxn > 0 && (
                  <div className="bal-result-row">
                    <span>Ingresos MXN</span>
                    <strong className="green">{fmtMXN(data.cobrado.mxn)}</strong>
                  </div>
                )}
                {data.gananciaCambiaria !== 0 && (
                  <div className="bal-result-row">
                    <span>Ganancia / pérdida cambiaria</span>
                    <strong className={data.gananciaCambiaria >= 0 ? "green" : "red"}>{fmtMXN(data.gananciaCambiaria)}</strong>
                  </div>
                )}
                <div className="bal-result-row bal-result-row--expense">
                  <span>Gastos del periodo</span>
                  <strong className="red">− {fmtMXN(data.gastos.total)}</strong>
                </div>
                <div className="bal-result-row bal-result-row--total">
                  <span>Resultado neto MXN</span>
                  <strong className={data.cobrado.mxn + data.gananciaCambiaria - data.gastos.total >= 0 ? "green" : "red"}>
                    {fmtMXN(data.cobrado.mxn + data.gananciaCambiaria - data.gastos.total)}
                  </strong>
                </div>
              </div>
              <p className="bal-disclaimer">* Resultado estimado en MXN. Los ingresos USD no están convertidos aquí — registra el tipo de cambio en cada cobro para mayor exactitud.</p>
            </section>
          )}

          {/* ── Remisiones por estado ── */}
          {Object.keys(data.remisionesPorEstado).length > 0 && (
            <section className="bal-section">
              <h3 className="bal-section__title">📋 Remisiones por estado (total histórico)</h3>
              <div className="bal-kpi-grid">
                {Object.entries(data.remisionesPorEstado).map(([estado, count]) => (
                  <KpiCard
                    key={estado}
                    label={ESTADO_REMISION_LABELS[estado] || estado}
                    value={String(count)}
                    sub={`remisión${count !== 1 ? "es" : ""}`}
                  />
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  );
}
