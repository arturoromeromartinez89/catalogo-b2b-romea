import { useEffect, useState, useCallback } from "react";
import {
  fetchGastos,
  saveGasto,
  deleteGasto,
  pagarGasto,
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

const emptyForm = () => ({
  fecha:        today(),
  descripcion:  "",
  categoriaId:  "",
  montoMxn:     "",
  montoPagadoMxn: 0,
  tipoGasto:    "variable",
  beneficiario: "",
  notas:        "",
});

function GastoForm({ initial, categorias, onSave, onClose, saving }) {
  const [form, setForm] = useState(initial || emptyForm());
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="rem-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rem-modal">
        <div className="rem-modal__header">
          <h3>{initial?.id ? "Editar gasto" : "Nuevo gasto"}</h3>
          <button type="button" className="rem-modal__close" onClick={onClose}>×</button>
        </div>
        <form className="rem-modal__body" onSubmit={handleSubmit}>
          <div className="rem-form-grid">
            <label className="rem-field">
              <span>Fecha</span>
              <input type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} required />
            </label>
            <label className="rem-field">
              <span>Categoría</span>
              <select value={form.categoriaId} onChange={(e) => set("categoriaId", e.target.value)}>
                <option value="">— Sin categoría —</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </label>
            <label className="rem-field rem-field--full">
              <span>Descripción</span>
              <input type="text" value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} required placeholder="Ej. Renta local julio 2026" />
            </label>
            <label className="rem-field">
              <span>Monto MXN</span>
              <input type="number" step="0.01" min="0" value={form.montoMxn} onChange={(e) => set("montoMxn", e.target.value)} required placeholder="0.00" />
            </label>
            <label className="rem-field">
              <span>Tipo</span>
              <select value={form.tipoGasto} onChange={(e) => set("tipoGasto", e.target.value)}>
                <option value="fijo">Fijo (recurrente)</option>
                <option value="variable">Variable</option>
              </select>
            </label>
            <label className="rem-field">
              <span>Beneficiario / proveedor</span>
              <input type="text" value={form.beneficiario} onChange={(e) => set("beneficiario", e.target.value)} placeholder="Arrendadora, proveedor..." />
            </label>
            <label className="rem-field rem-field--full">
              <span>Notas</span>
              <textarea value={form.notas} onChange={(e) => set("notas", e.target.value)} rows={2} />
            </label>
          </div>
          <div className="rem-modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="btn btn--accent" disabled={saving || !form.descripcion || !form.montoMxn}>
              {saving ? "Guardando…" : initial?.id ? "Guardar cambios" : "Crear gasto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PagarModal({ gasto, cuentas, onPagar, onClose, saving }) {
  const [monto, setMonto]   = useState(gasto.saldoMxn || gasto.montoMxn);
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id || "");
  const [metodo, setMetodo] = useState("transferencia");

  return (
    <div className="rem-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rem-modal">
        <div className="rem-modal__header">
          <h3>Pagar gasto</h3>
          <button type="button" className="rem-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="rem-modal__info">
          <strong>{gasto.descripcion}</strong>
          <span>Saldo pendiente: <strong>{fmtMXN(gasto.saldoMxn)}</strong></span>
        </div>
        <div className="rem-modal__body">
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
          <div className="rem-modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button
              type="button" className="btn btn--accent" disabled={saving || !monto || Number(monto) <= 0}
              onClick={() => onPagar(gasto.id, Number(monto), cuentaId, metodo)}
            >
              {saving ? "Guardando…" : "Registrar pago"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GastosTab({ tenantId }) {
  const [gastos, setGastos]           = useState([]);
  const [categorias, setCategorias]   = useState([]);
  const [cuentas, setCuentas]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroTipo, setFiltroTipo]   = useState("");
  const [filtroCateg, setFiltroCateg] = useState("");
  const [busqueda, setBusqueda]       = useState("");
  const [showForm, setShowForm]       = useState(false);
  const [editGasto, setEditGasto]     = useState(null);
  const [showPagar, setShowPagar]     = useState(null);
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState("");

  const notify = (text) => { setMsg(text); setTimeout(() => setMsg(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, c, cu] = await Promise.all([
        fetchGastos(tenantId, {
          estado: filtroEstado || undefined,
          tipoGasto: filtroTipo || undefined,
          categoriaId: filtroCateg || undefined,
        }),
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
  }, [tenantId, filtroEstado, filtroTipo, filtroCateg]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      await saveGasto(form, tenantId);
      notify(form.id ? "Gasto actualizado." : "Gasto creado.");
      setShowForm(false);
      setEditGasto(null);
      load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const handlePagar = async (gastoId, monto, cuentaId, metodo) => {
    setSaving(true);
    try {
      await pagarGasto(gastoId, monto, cuentaId, tenantId, metodo);
      notify("Pago registrado.");
      setShowPagar(null);
      load();
    } catch (e) { alert(e.message); }
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

  const filtered = gastos.filter((g) => {
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
          <button className="btn btn--accent" onClick={() => { setEditGasto(null); setShowForm(true); }}>+ Nuevo gasto</button>
        </div>
        {msg && <div className="rem-toast">{msg}</div>}
      </div>

      <div className="rem-filters">
        <input className="rem-search" placeholder="Buscar descripción, proveedor..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABELS).map(([k, { label }]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Fijos + variables</option>
          <option value="fijo">Solo fijos</option>
          <option value="variable">Solo variables</option>
        </select>
        <select value={filtroCateg} onChange={(e) => setFiltroCateg(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <button className="btn btn--ghost btn--sm" onClick={load}>↻</button>
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
          <div className="rem-empty">No hay gastos registrados{busqueda || filtroEstado || filtroTipo || filtroCateg ? " con esos filtros" : ". Agrega el primero arriba."}.</div>
        ) : (
          <div className="rem-table-wrap">
            <table className="rem-table">
              <thead>
                <tr>
                  <th>Fecha</th>
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
                  return (
                    <tr key={g.id} className={g.estado === "cancelado" ? "rem-row--cancelled" : ""}>
                      <td>{g.fecha}</td>
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
                            <button className="btn btn--accent btn--sm" onClick={() => setShowPagar(g)}>Pagar</button>
                          )}
                          <button className="btn btn--ghost btn--sm" onClick={() => { setEditGasto(g); setShowForm(true); }}>Editar</button>
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
