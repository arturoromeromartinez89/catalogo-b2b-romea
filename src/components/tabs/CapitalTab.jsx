import { useCallback, useEffect, useState } from "react";
import {
  fetchMovimientosCapital, saveMovimientoCapital, deleteMovimientoCapital,
  fetchActivosFijos, saveActivoFijo, deleteActivoFijo, resumenCapital,
} from "../../services/capitalService";
import { fetchCuentas, seedCuentasDefault } from "../../services/adminModuleService";

const today = () => new Date().toISOString().split("T")[0];
const fmt = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(n || 0));
const fmt2 = (n) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n || 0));

const CAT_LABEL = { maquinaria: "Maquinaria", equipo: "Equipo", herramienta: "Herramienta", mobiliario: "Mobiliario", vehiculo: "Vehículo", otro: "Otro" };
const VIDA_OPCIONES = [[36, "3 años"], [60, "5 años"], [120, "10 años"]];

// ─── Modal: registrar aportación o retiro ─────────────────────────────────────
function MovimientoForm({ tipoInicial, cuentas, socios, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    fecha: today(), tipo: tipoInicial || "aportacion", montoMxn: "",
    concepto: "", socio: socios[0] || "", cuentaId: "", metodo: "transferencia", notas: "",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const cuentasDinero = cuentas.filter((c) => c.tipo !== "plata");
  const valido = form.concepto.trim() && Number(form.montoMxn) > 0;
  const esApor = form.tipo === "aportacion";

  return (
    <div className="client-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="client-modal gf-modal">
        <header>
          <h2>{esApor ? "Registrar aportación" : "Registrar retiro"}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <form className="gf-body" onSubmit={(e) => { e.preventDefault(); if (valido && !saving) onSave(form); }}>
          <div className="gf-step">
            <span className="gf-step__label">¿Es dinero que metes o que sacas?</span>
            <div className="gf-segmented" role="radiogroup">
              <button type="button" className={esApor ? "on on--ok" : ""} onClick={() => set("tipo", "aportacion")}>Metí dinero (aportación)</button>
              <button type="button" className={!esApor ? "on" : ""} onClick={() => set("tipo", "retiro")}>Saqué dinero (retiro)</button>
            </div>
          </div>

          <div className="gf-step">
            <span className="gf-step__label">{esApor ? "¿Para qué lo metiste?" : "¿Para qué lo sacaste?"}</span>
            <input className="gf-input gf-input--desc" type="text" value={form.concepto} autoFocus
              onChange={(e) => set("concepto", e.target.value)}
              placeholder={esApor ? "Ej. Capital inicial, anticipo de renta, mudanza…" : "Ej. Retiro de utilidades, gasto personal…"} />
          </div>

          <div className="gf-step">
            <span className="gf-step__label">¿Cuánto y cuándo?</span>
            <div className="gf-row">
              <div className="gf-amount">
                <span className="gf-amount__symbol">$</span>
                <input type="number" step="0.01" min="0" value={form.montoMxn} onChange={(e) => set("montoMxn", e.target.value)} placeholder="0.00" />
                <span className="gf-amount__currency">MXN</span>
              </div>
              <input className="gf-input gf-input--date" type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} />
            </div>
          </div>

          {cuentasDinero.length > 0 && (
            <div className="gf-step">
              <span className="gf-step__label">{esApor ? "¿A qué cuenta entró?" : "¿De qué cuenta salió?"}</span>
              <div className="gf-chips">
                {cuentasDinero.map((c) => (
                  <button key={c.id} type="button" className={`gf-chip${form.cuentaId === c.id ? " gf-chip--on" : ""}`} onClick={() => set("cuentaId", form.cuentaId === c.id ? "" : c.id)}>
                    {c.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="gf-step">
            <span className="gf-step__label">¿Quién? (opcional)</span>
            <input className="gf-input" type="text" list="cap-socios" value={form.socio} onChange={(e) => set("socio", e.target.value)} placeholder="Nombre del socio o dueño" />
            <datalist id="cap-socios">{socios.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
        </form>
        <footer className="gf-footer">
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="primary-button" disabled={!valido || saving} onClick={() => onSave(form)}>
            {saving ? "Guardando…" : esApor ? "Registrar aportación" : "Registrar retiro"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Modal: registrar activo / maquinaria ─────────────────────────────────────
function ActivoForm({ proveedores, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    nombre: "", categoria: "maquinaria", fechaCompra: today(), costoMxn: "",
    valorResidualMxn: 0, vidaUtilMeses: 60, proveedor: "", notas: "", estatus: "activo",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const valido = form.nombre.trim() && Number(form.costoMxn) > 0;
  const depMensual = valido ? (Number(form.costoMxn) - Number(form.valorResidualMxn || 0)) / Math.max(1, form.vidaUtilMeses) : 0;

  return (
    <div className="client-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="client-modal gf-modal">
        <header>
          <h2>Registrar maquinaria o equipo</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <form className="gf-body" onSubmit={(e) => { e.preventDefault(); if (valido && !saving) onSave(form); }}>
          <div className="gf-step">
            <span className="gf-step__label">¿Qué compraste?</span>
            <div className="gf-row">
              <input className="gf-input gf-input--desc" type="text" value={form.nombre} autoFocus onChange={(e) => set("nombre", e.target.value)} placeholder="Ej. Laminadora, pulidora, horno…" />
              <input className="gf-input" type="text" list="cap-proveedores" value={form.proveedor} onChange={(e) => set("proveedor", e.target.value)} placeholder="¿A quién? (opcional)" />
              <datalist id="cap-proveedores">{proveedores.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
          </div>

          <div className="gf-step">
            <span className="gf-step__label">Tipo</span>
            <div className="gf-chips">
              {Object.entries(CAT_LABEL).map(([k, label]) => (
                <button key={k} type="button" className={`gf-chip${form.categoria === k ? " gf-chip--on" : ""}`} onClick={() => set("categoria", k)}>{label}</button>
              ))}
            </div>
          </div>

          <div className="gf-step">
            <span className="gf-step__label">¿Cuánto costó y cuándo?</span>
            <div className="gf-row">
              <div className="gf-amount">
                <span className="gf-amount__symbol">$</span>
                <input type="number" step="0.01" min="0" value={form.costoMxn} onChange={(e) => set("costoMxn", e.target.value)} placeholder="0.00" />
                <span className="gf-amount__currency">MXN</span>
              </div>
              <input className="gf-input gf-input--date" type="date" value={form.fechaCompra} onChange={(e) => set("fechaCompra", e.target.value)} />
            </div>
          </div>

          <div className="gf-step">
            <span className="gf-step__label">¿En cuánto tiempo se "gasta" (vida útil)?</span>
            <div className="gf-segmented">
              {VIDA_OPCIONES.map(([m, label]) => (
                <button key={m} type="button" className={form.vidaUtilMeses === m ? "on" : ""} onClick={() => set("vidaUtilMeses", m)}>{label}</button>
              ))}
            </div>
            {valido && (
              <p className="cap-hint">Perderá valor a razón de <strong>{fmt2(depMensual)}/mes</strong> (depreciación lineal estimada).</p>
            )}
          </div>
        </form>
        <footer className="gf-footer">
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="primary-button" disabled={!valido || saving} onClick={() => onSave(form)}>
            {saving ? "Guardando…" : "Registrar activo"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CapitalTab({ tenantId, notifyAction, setStatus }) {
  const [movimientos, setMovimientos] = useState([]);
  const [activos, setActivos] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [movForm, setMovForm] = useState(null); // {tipo} o null
  const [showActivo, setShowActivo] = useState(false);
  const [saving, setSaving] = useState(false);

  const notify = (t, type = "success") => { if (notifyAction) notifyAction(type, "", t); else if (setStatus) setStatus(t); };

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [m, a, c] = await Promise.all([
        fetchMovimientosCapital(tenantId),
        fetchActivosFijos(tenantId),
        seedCuentasDefault(tenantId).catch(() => fetchCuentas(tenantId)),
      ]);
      setMovimientos(m); setActivos(a); setCuentas(c || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const socios = [...new Set(movimientos.map((m) => m.socio).filter(Boolean))].sort();
  const proveedores = [...new Set(activos.map((a) => a.proveedor).filter(Boolean))].sort();
  const r = resumenCapital(movimientos, activos);

  const handleSaveMov = async (form) => {
    setSaving(true);
    try { await saveMovimientoCapital(form, tenantId); notify(form.tipo === "aportacion" ? "Aportación registrada." : "Retiro registrado."); setMovForm(null); load(); }
    catch (e) { alert(e.message); } finally { setSaving(false); }
  };
  const handleSaveActivo = async (form) => {
    setSaving(true);
    try { await saveActivoFijo(form, tenantId); notify("Activo registrado."); setShowActivo(false); load(); }
    catch (e) { alert(e.message); } finally { setSaving(false); }
  };
  const handleDelMov = async (m) => { if (!window.confirm(`¿Eliminar "${m.concepto}"?`)) return; await deleteMovimientoCapital(m.id); load(); };
  const handleDelActivo = async (a) => { if (!window.confirm(`¿Eliminar "${a.nombre}"?`)) return; await deleteActivoFijo(a.id); load(); };

  if (loading) return <div className="fin-loading">Cargando tu capital…</div>;
  if (error) return <div className="fin-error">Error: {error}</div>;

  return (
    <div className="fin-dashboard cap-dashboard">
      <div className="fin-header">
        <div>
          <h2 className="fin-title">Mi inversión</h2>
          <p className="fin-subtitle">Cuánto has puesto, cuánto te debe el negocio y qué vale tu maquinaria</p>
        </div>
      </div>

      {/* KPIs — el dato estrella primero: lo que el negocio te debe */}
      <div className="cap-kpis">
        <div className="cap-kpi cap-kpi--hero">
          <span className="cap-kpi__label">El negocio te debe a ti</span>
          <span className="cap-kpi__value">{fmt(r.deudaSocios)}</span>
          <span className="cap-kpi__sub">Tus aportaciones menos lo que has retirado</span>
        </div>
        <div className="cap-kpi">
          <span className="cap-kpi__label">Total aportado</span>
          <span className="cap-kpi__value">{fmt(r.aportado)}</span>
          <span className="cap-kpi__sub">Dinero que metiste de tu bolsa</span>
        </div>
        <div className="cap-kpi">
          <span className="cap-kpi__label">Valor de tu maquinaria</span>
          <span className="cap-kpi__value">{fmt(r.valorActivosLibros)}</span>
          <span className="cap-kpi__sub">Hoy, ya descontando desgaste</span>
        </div>
        <div className="cap-kpi">
          <span className="cap-kpi__label">Desgaste acumulado</span>
          <span className="cap-kpi__value cap-kpi__value--muted">{fmt(r.depAcumuladaTotal)}</span>
          <span className="cap-kpi__sub">De {fmt(r.costoActivos)} de costo original</span>
        </div>
      </div>

      <div className="fin-row">
        {/* Aportaciones y retiros */}
        <section className="fin-panel cap-panel">
          <div className="cap-panel__head">
            <h3 className="fin-panel__title">Aportaciones y retiros</h3>
            <div className="cap-panel__actions">
              <button type="button" className="primary-button compact-action" onClick={() => setMovForm({ tipo: "aportacion" })}>+ Aportación</button>
              <button type="button" className="secondary-button compact-action" onClick={() => setMovForm({ tipo: "retiro" })}>Retiro</button>
            </div>
          </div>
          {movimientos.length === 0 ? (
            <p className="fin-panel__empty">Aún no registras movimientos. Empieza con tu capital inicial o el anticipo de renta.</p>
          ) : (
            <ul className="cap-list">
              {movimientos.map((m) => (
                <li key={m.id} className="cap-mov">
                  <span className={`cap-mov__tag cap-mov__tag--${m.tipo}`}>{m.tipo === "aportacion" ? "Entró" : "Salió"}</span>
                  <span className="cap-mov__body">
                    <strong>{m.concepto}</strong>
                    <small>{new Date(m.fecha).toLocaleDateString("es-MX")}{m.cuentaNombre ? ` · ${m.cuentaNombre}` : ""}{m.socio ? ` · ${m.socio}` : ""}</small>
                  </span>
                  <strong className={`cap-mov__amount cap-mov__amount--${m.tipo}`}>
                    {m.tipo === "aportacion" ? "+" : "−"}{fmt2(m.montoMxn)}
                  </strong>
                  <button className="table-delete" onClick={() => handleDelMov(m)} aria-label="Eliminar">×</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Maquinaria y equipo */}
        <section className="fin-panel cap-panel">
          <div className="cap-panel__head">
            <h3 className="fin-panel__title">Maquinaria y equipo</h3>
            <button type="button" className="primary-button compact-action" onClick={() => setShowActivo(true)}>+ Activo</button>
          </div>
          {activos.length === 0 ? (
            <p className="fin-panel__empty">Registra tu maquinaria para conocer cuánto vale tu inversión y cómo se deprecia.</p>
          ) : (
            <ul className="cap-asset-list">
              {activos.map((a) => {
                const pct = a.costoMxn > 0 ? Math.min(100, (a.depAcumulada / (a.costoMxn - a.valorResidualMxn || a.costoMxn)) * 100) : 0;
                return (
                  <li key={a.id} className={`cap-asset${a.estatus === "baja" ? " cap-asset--baja" : ""}`}>
                    <div className="cap-asset__top">
                      <span className="cap-asset__name"><strong>{a.nombre}</strong><small>{CAT_LABEL[a.categoria]}{a.proveedor ? ` · ${a.proveedor}` : ""}</small></span>
                      <button className="table-delete" onClick={() => handleDelActivo(a)} aria-label="Eliminar">×</button>
                    </div>
                    <div className="cap-asset__nums">
                      <span>Costó <strong>{fmt2(a.costoMxn)}</strong></span>
                      <span className="cap-asset__books">Vale hoy <strong>{fmt2(a.valorLibros)}</strong></span>
                    </div>
                    <div className="cap-asset__bar"><span className="cap-asset__fill" style={{ width: `${pct}%` }} /></div>
                    <small className="cap-asset__foot">
                      {a.totalmenteDepreciado ? "Totalmente depreciado" : `Pierde ${fmt2(a.depMensual)}/mes · ${a.mesesDepreciados} de ${a.vidaUtilMeses} meses`}
                    </small>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <p className="fin-disclaimer">
        Registro operativo de tu inversión. La depreciación es una estimación lineal, no un cálculo fiscal.
      </p>

      {movForm && (
        <MovimientoForm tipoInicial={movForm.tipo} cuentas={cuentas} socios={socios} onSave={handleSaveMov} onClose={() => setMovForm(null)} saving={saving} />
      )}
      {showActivo && (
        <ActivoForm proveedores={proveedores} onSave={handleSaveActivo} onClose={() => setShowActivo(false)} saving={saving} />
      )}
    </div>
  );
}
