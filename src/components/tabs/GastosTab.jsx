import { useEffect, useState, useCallback } from "react";
import {
  fetchGastos,
  registerExpenseTransaction,
  registerExpensePaymentTransaction,
  deleteGasto,
  fetchCategoriasGasto,
  seedCategoriasDefault,
  fetchCuentas,
  seedCuentasDefault,
} from "../../services/adminModuleService";

const today = () => new Date().toISOString().split("T")[0];
const fmtMXN = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(n || 0));

const ESTADO_LABELS = {
  pendiente: { label: "Pendiente", color: "#d97706" },
  parcial:   { label: "Parcial",   color: "#2563eb" },
  pagado:    { label: "Pagado",    color: "#059669" },
  cancelado: { label: "Cancelado", color: "#dc2626" },
};

// Estado de vencimiento de un gasto con saldo: vencido, vence pronto (≤7 días)
// o nada. Solo aplica si tiene fecha de vencimiento y saldo pendiente.
const vencimientoInfo = (g) => {
  if (!g.fechaVencimiento || !(Number(g.saldoMxn) > 0) || g.estado === "pagado" || g.estado === "cancelado") return {};
  const venc = new Date(g.fechaVencimiento + "T00:00:00");
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((venc - hoy) / 86400000);
  if (dias < 0) return { estado: "vencido", label: `vencido hace ${Math.abs(dias)}d` };
  if (dias === 0) return { estado: "vencido", label: "vence hoy" };
  if (dias <= 7) return { estado: "pronto", label: `en ${dias}d` };
  return {};
};

const emptyForm = () => ({
  fecha:        today(),
  fechaVencimiento: "",
  numeroDocumento: "",
  descripcion:  "",
  categoriaId:  "",
  montoMxn:     "",
  montoPagadoMxn: 0,
  tipoGasto:    "variable",
  beneficiario: "",
  notas:        "",
  // Estado del pago al registrar: pendiente | pagado | parcial
  pagoEstado:   "pendiente",
  pagoMonto:    "",
  pagoCuentaId: "",
  pagoMetodo:   "transferencia",
});

// ─── Captura guiada de gasto ──────────────────────────────────────────────────
// Flujo en lenguaje del dueño: qué pagaste → cuánto → clasifícalo → ¿ya lo
// pagaste? Registrar la obligación y el pago son pasos relacionados pero
// distintos; aquí se capturan juntos y el guardado los encadena.
function GastoForm({ initial, categorias, cuentas, beneficiarios = [], onSave, onClose, saving }) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(() => initial ? { ...emptyForm(), ...initial } : emptyForm());
  const [showNotas, setShowNotas] = useState(Boolean(initial?.notas));
  const [savedMsg, setSavedMsg] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const cuentasDinero = cuentas.filter((c) => c.tipo !== "plata");
  const monto = Number(form.montoMxn || 0);
  const pagoMonto = form.pagoEstado === "pagado" ? monto : Number(form.pagoMonto || 0);

  const pagoValido =
    form.pagoEstado === "pendiente" ||
    (pagoMonto > 0 && pagoMonto <= monto && (cuentasDinero.length === 0 || form.pagoCuentaId));

  const valido = form.descripcion.trim() && monto > 0 && pagoValido;

  const submit = async (keepOpen) => {
    if (!valido || saving) return;
    const ok = await onSave(form, { keepOpen });
    if (ok && keepOpen) {
      setForm((f) => ({ ...emptyForm(), fecha: f.fecha, categoriaId: f.categoriaId, tipoGasto: f.tipoGasto }));
      setShowNotas(false);
      setSavedMsg("Gasto guardado. Captura el siguiente.");
      window.setTimeout(() => setSavedMsg(""), 3000);
    }
  };

  return (
    <div className="client-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="client-modal gf-modal">
        <header>
          <h2>{isEdit ? "Editar gasto" : "Registrar gasto"}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>

        <form className="gf-body" onSubmit={(e) => { e.preventDefault(); submit(false); }}>

          {/* 1 · Qué pagaste y a quién */}
          <div className="gf-step">
            <span className="gf-step__label">¿Qué pagaste o compraste?</span>
            <div className="gf-row">
              <input
                className="gf-input gf-input--desc"
                type="text"
                value={form.descripcion}
                onChange={(e) => set("descripcion", e.target.value)}
                placeholder="Ej. Renta del local, gasolina, plata .925…"
                autoFocus={!isEdit}
                required
              />
              <input
                className="gf-input"
                type="text"
                list="gf-proveedores"
                value={form.beneficiario}
                onChange={(e) => set("beneficiario", e.target.value)}
                placeholder="¿A quién? — escribe o elige"
              />
              {/* Registro rápido de proveedor: sugiere los ya usados; uno nuevo
                  queda guardado con el gasto y aparece como sugerencia después */}
              <datalist id="gf-proveedores">
                {beneficiarios.map((b) => <option key={b} value={b} />)}
              </datalist>
            </div>
          </div>

          {/* 2 · Cuánto y cuándo */}
          <div className="gf-step">
            <span className="gf-step__label">¿Cuánto y cuándo?</span>
            <div className="gf-row">
              <div className="gf-amount">
                <span className="gf-amount__symbol">$</span>
                <input
                  type="number" step="0.01" min="0"
                  value={form.montoMxn}
                  onChange={(e) => set("montoMxn", e.target.value)}
                  placeholder="0.00"
                  required
                />
                <span className="gf-amount__currency">MXN</span>
              </div>
              <input
                className="gf-input gf-input--date"
                type="date"
                value={form.fecha}
                onChange={(e) => set("fecha", e.target.value)}
                required
              />
            </div>
          </div>

          {/* 2b · Vencimiento y documento — para saber "cuánto debo" con calendario */}
          <div className="gf-step">
            <span className="gf-step__label">Vencimiento y documento <span className="gf-step__opt">(opcional)</span></span>
            <div className="gf-row">
              <label className="gf-labeled">
                <span>¿Cuándo se debe pagar?</span>
                <input
                  className="gf-input gf-input--date"
                  type="date"
                  value={form.fechaVencimiento}
                  onChange={(e) => set("fechaVencimiento", e.target.value)}
                />
              </label>
              <label className="gf-labeled">
                <span>Factura / referencia</span>
                <input
                  className="gf-input"
                  type="text"
                  value={form.numeroDocumento}
                  onChange={(e) => set("numeroDocumento", e.target.value)}
                  placeholder="N.º de factura o nota"
                />
              </label>
            </div>
          </div>

          {/* 3 · Clasificación: categoría como chips + fijo/variable */}
          <div className="gf-step">
            <span className="gf-step__label">Clasifícalo</span>
            <div className="gf-chips">
              {categorias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`gf-chip${form.categoriaId === c.id ? " gf-chip--on" : ""}`}
                  onClick={() => set("categoriaId", form.categoriaId === c.id ? "" : c.id)}
                >
                  {c.nombre}
                </button>
              ))}
            </div>
            <div className="gf-segmented" role="radiogroup" aria-label="Tipo de gasto">
              <button type="button" className={form.tipoGasto === "variable" ? "on" : ""} onClick={() => set("tipoGasto", "variable")}>
                Variable
              </button>
              <button type="button" className={form.tipoGasto === "fijo" ? "on" : ""} onClick={() => set("tipoGasto", "fijo")}>
                Fijo (recurrente)
              </button>
            </div>
          </div>

          {/* 4 · ¿Ya lo pagaste? — solo al crear; al editar, el pago va por su flujo */}
          {!isEdit && (
            <div className="gf-step">
              <span className="gf-step__label">¿Ya lo pagaste?</span>
              <div className="gf-segmented gf-segmented--pay" role="radiogroup" aria-label="Estado del pago">
                <button type="button" className={form.pagoEstado === "pendiente" ? "on" : ""} onClick={() => set("pagoEstado", "pendiente")}>
                  Queda pendiente
                </button>
                <button type="button" className={form.pagoEstado === "pagado" ? "on on--ok" : ""} onClick={() => set("pagoEstado", "pagado")}>
                  Ya lo pagué
                </button>
                <button type="button" className={form.pagoEstado === "parcial" ? "on" : ""} onClick={() => set("pagoEstado", "parcial")}>
                  Pago parcial
                </button>
              </div>

              {form.pagoEstado !== "pendiente" && (
                <div className="gf-pay">
                  {form.pagoEstado === "parcial" && (
                    <div className="gf-amount gf-amount--sm">
                      <span className="gf-amount__symbol">$</span>
                      <input
                        type="number" step="0.01" min="0.01" max={monto || undefined}
                        value={form.pagoMonto}
                        onChange={(e) => set("pagoMonto", e.target.value)}
                        placeholder="Monto pagado"
                      />
                    </div>
                  )}
                  {cuentasDinero.length > 0 && (
                    <div className="gf-chips">
                      {cuentasDinero.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={`gf-chip${form.pagoCuentaId === c.id ? " gf-chip--on" : ""}`}
                          onClick={() => set("pagoCuentaId", c.id)}
                        >
                          {c.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                  <select
                    className="gf-input gf-input--metodo"
                    value={form.pagoMetodo}
                    onChange={(e) => set("pagoMetodo", e.target.value)}
                  >
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="mercado_pago">Mercado Pago</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* 5 · Notas (opcional, colapsado) */}
          {showNotas ? (
            <div className="gf-step">
              <span className="gf-step__label">Notas</span>
              <textarea className="gf-input" value={form.notas} onChange={(e) => set("notas", e.target.value)} rows={2} />
            </div>
          ) : (
            <button type="button" className="gf-add-notes" onClick={() => setShowNotas(true)}>
              + Agregar nota
            </button>
          )}

          {savedMsg && <p className="gf-saved">{savedMsg}</p>}
        </form>

        <footer className="gf-footer">
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
            Cerrar
          </button>
          <div className="gf-footer__actions">
            {!isEdit && (
              <button type="button" className="secondary-button" disabled={saving || !valido} onClick={() => submit(true)}>
                Guardar y registrar otro
              </button>
            )}
            <button type="button" className="primary-button" disabled={saving || !valido} onClick={() => submit(false)}>
              {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Guardar gasto"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function PagarModal({ gasto, cuentas, onPagar, onClose, saving }) {
  const [monto, setMonto]   = useState(gasto.saldoMxn || gasto.montoMxn);
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id || "");
  const [metodo, setMetodo] = useState("transferencia");

  return (
    <div className="client-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="client-modal">
        <header>
          <h2>Pagar gasto</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <div className="rem-modal__body">
          <div className="rem-modal__info" style={{ marginBottom: 12 }}>
            <strong>{gasto.descripcion}</strong>
            <span>Saldo pendiente: <strong>{fmtMXN(gasto.saldoMxn)}</strong></span>
          </div>
          <div className="rem-form-grid">
            <label className="rem-field">
              <span>Monto a pagar MXN</span>
              <input type="number" step="0.01" min="0.01" max={gasto.saldoMxn} value={monto} onChange={(e) => setMonto(e.target.value)} required />
            </label>
            <label className="rem-field">
              <span>Método de pago</span>
              <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="mercado_pago">Mercado Pago</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            {cuentas.filter((c) => c.tipo !== "plata").length > 0 && (
              <label className="rem-field rem-field--full">
                <span>Cuenta de salida</span>
                <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
                  {cuentas.filter((c) => c.tipo !== "plata").map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
        <footer>
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            type="button" className="primary-button" disabled={saving || !monto || Number(monto) <= 0}
            onClick={() => onPagar(gasto.id, Number(monto), cuentaId, metodo)}
          >
            {saving ? "Guardando…" : "Registrar pago"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function GastosTab({ tenantId, notifyAction, setStatus }) {
  const [gastos, setGastos]           = useState([]);
  const [categorias, setCategorias]   = useState([]);
  const [cuentas, setCuentas]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [vista, setVista]             = useState("todos"); // todos | porpagar | pagados
  const [busqueda, setBusqueda]       = useState("");
  const [showForm, setShowForm]       = useState(false);
  const [editGasto, setEditGasto]     = useState(null);
  const [showPagar, setShowPagar]     = useState(null);
  const [saving, setSaving]           = useState(false);

  const notify = (text, type = "success") => {
    if (notifyAction) notifyAction(type, "", text);
    else if (setStatus) setStatus(text);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, c, cu] = await Promise.all([
        fetchGastos(tenantId),
        seedCategoriasDefault(tenantId),
        seedCuentasDefault(tenantId),
      ]);
      setGastos(g);
      setCategorias(c);
      setCuentas(cu);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // Gasto + pago en UNA transacción del servidor (RPC atómica). Si algo falla,
  // no queda nada a medias. Sólo aplica a gastos nuevos; la edición de un gasto
  // existente no pasa por aquí en este bloque.
  const handleSave = async (form, { keepOpen = false } = {}) => {
    setSaving(true);
    try {
      await registerExpenseTransaction(form);
      notify(form.pagoEstado === "pagado" ? "Gasto registrado y pagado." : form.pagoEstado === "parcial" ? "Gasto registrado con abono." : "Gasto registrado.");
      if (!keepOpen) { setShowForm(false); setEditGasto(null); }
      load();
      return true;
    } catch (e) {
      notify(`No se pudo registrar: ${e.message}`, "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePagar = async (gastoId, monto, cuentaId, metodo) => {
    setSaving(true);
    try {
      await registerExpensePaymentTransaction({ gastoId, monto, cuentaId, metodo });
      notify("Pago registrado.");
      setShowPagar(null);
      load();
    } catch (e) { notify(`No se pudo registrar el pago: ${e.message}`, "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (gasto) => {
    if (!window.confirm(`¿Eliminar "${gasto.descripcion}"?`)) return;
    try {
      await deleteGasto(gasto.id);
      notify("Gasto eliminado.");
      load();
    } catch (e) { alert(e.message); }
  };

  // Proveedores usados antes — sugerencias para registro rápido en el formulario
  const beneficiarios = [...new Set(gastos.map((g) => (g.beneficiario || "").trim()).filter(Boolean))].sort();

  const filtered = gastos.filter((g) => {
    if (vista === "porpagar" && !(Number(g.saldoMxn) > 0 && g.estado !== "cancelado")) return false;
    if (vista === "pagados" && g.estado !== "pagado") return false;
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    return (g.descripcion || "").toLowerCase().includes(q) ||
           (g.beneficiario || "").toLowerCase().includes(q) ||
           (g.categoriaNombre || "").toLowerCase().includes(q);
  });

  // Totales
  const totals = filtered.reduce(
    (acc, g) => {
      acc.total += Number(g.montoMxn || 0);
      acc.pagado += Number(g.montoPagadoMxn || 0);
      acc.saldo  += Number(g.saldoMxn || 0);
      return acc;
    },
    { total: 0, pagado: 0, saldo: 0 }
  );

  return (
    <div className="rem-tab">
      <div className="rem-tab__header">
        <div className="rem-tab__title-row">
          <h2 className="rem-tab__title">Gastos</h2>
          <button className="primary-button" onClick={() => { setEditGasto(null); setShowForm(true); }}>+ Nuevo gasto</button>
        </div>
      </div>

      <div className="rem-filters">
        <input className="rem-search" placeholder="Buscar gasto o proveedor…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <div className="gf-segmented" role="radiogroup" aria-label="Filtrar gastos">
          {[["todos", "Todos"], ["porpagar", "Por pagar"], ["pagados", "Pagados"]].map(([k, label]) => (
            <button key={k} type="button" className={vista === k ? "on" : ""} onClick={() => setVista(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="rem-kpi-bar">
          <div className="rem-kpi-bar__item"><span>Total gastos</span><strong>{fmtMXN(totals.total)}</strong></div>
          <div className="rem-kpi-bar__item rem-kpi-bar__item--ok"><span>Pagado</span><strong>{fmtMXN(totals.pagado)}</strong></div>
          {totals.saldo > 0 && <div className="rem-kpi-bar__item rem-kpi-bar__item--alert"><span>Por pagar</span><strong>{fmtMXN(totals.saldo)}</strong></div>}
        </div>
      )}

      {loading ? <div className="rem-loading">Cargando gastos…</div>
        : error ? <div className="rem-error">{error}</div>
        : filtered.length === 0 ? (
          <div className="rem-empty">{busqueda || vista !== "todos" ? "No hay gastos con ese filtro." : "No hay gastos registrados. Agrega el primero arriba."}</div>
        ) : (
          <div className="rem-table-wrap">
            <table className="rem-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Vence</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>Tipo</th>
                  <th className="right">Monto</th>
                  <th className="right">Pagado</th>
                  <th className="right">Saldo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => {
                  const { label, color } = ESTADO_LABELS[g.estado] || { label: g.estado, color: "#888" };
                  const venc = vencimientoInfo(g);
                  return (
                    <tr key={g.id} className={g.estado === "cancelado" ? "rem-row--cancelled" : ""}>
                      <td>{g.fecha}</td>
                      <td>
                        {g.fechaVencimiento ? (
                          <span className={`gf-venc${venc.estado ? ` gf-venc--${venc.estado}` : ""}`}>
                            {g.fechaVencimiento}{venc.label ? <small>{venc.label}</small> : null}
                          </span>
                        ) : <span className="muted">—</span>}
                      </td>
                      <td>
                        <div>{g.descripcion}</div>
                        {g.beneficiario && <small className="muted">{g.beneficiario}</small>}
                      </td>
                      <td>{g.categoriaNombre || "—"}</td>
                      <td><span className={`rem-tipo-badge ${g.tipoGasto === "fijo" ? "rem-tipo-badge--fijo" : ""}`}>{g.tipoGasto === "fijo" ? "Fijo" : "Variable"}</span></td>
                      <td className="right">{fmtMXN(g.montoMxn)}</td>
                      <td className="right">{fmtMXN(g.montoPagadoMxn)}</td>
                      <td className={`right ${g.saldoMxn > 0 ? "rem-saldo--pendiente" : "rem-saldo--ok"}`}><strong>{fmtMXN(g.saldoMxn)}</strong></td>
                      <td><span className="rem-badge" style={{ "--badge-color": color }}>{label}</span></td>
                      <td>
                        <div className="rem-row-actions">
                          {g.estado !== "pagado" && g.estado !== "cancelado" && (
                            <button className="primary-button compact-action" onClick={() => setShowPagar(g)}>Pagar</button>
                          )}
                          <button className="secondary-button compact-action" onClick={() => { setEditGasto(g); setShowForm(true); }}>Editar</button>
                          <button className="table-delete" onClick={() => handleDelete(g)}>×</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      }

      {showForm && (
        <GastoForm
          initial={editGasto}
          categorias={categorias}
          cuentas={cuentas}
          beneficiarios={beneficiarios}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditGasto(null); }}
          saving={saving}
        />
      )}

      {showPagar && (
        <PagarModal
          gasto={showPagar}
          cuentas={cuentas}
          onPagar={handlePagar}
          onClose={() => setShowPagar(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
