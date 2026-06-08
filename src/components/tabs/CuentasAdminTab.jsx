import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// ─── Constantes ────────────────────────────────────────────────────────────────

const TIPOS_CUENTA = [
  { value: "efectivo",   label: "Efectivo" },
  { value: "banco",      label: "Banco" },
  { value: "plataforma", label: "Plataforma digital" },
  { value: "plata",      label: "Caja de plata (gramos)" },
];

const MONEDAS = [
  { value: "MXN", label: "MXN — Pesos mexicanos" },
  { value: "USD", label: "USD — Dólares" },
  { value: "GRM", label: "GRM — Gramos de plata" },
];

const emptyForm = () => ({
  nombre: "",
  tipo: "efectivo",
  moneda: "MXN",
  saldo_inicial: 0,
  gramos_iniciales: 0,
  orden: 99,
});

// ─── Servicio inline ────────────────────────────────────────────────────────────

async function fetchCuentas(tenantId) {
  const { data, error } = await supabase
    .from("cuentas_caja_banco")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("orden")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data || [];
}

async function saveCuenta(form, tenantId) {
  const row = {
    nombre:           form.nombre.trim(),
    tipo:             form.tipo,
    moneda:           form.moneda,
    saldo_inicial:    Number(form.saldo_inicial || 0),
    gramos_iniciales: Number(form.gramos_iniciales || 0),
    orden:            Number(form.orden || 99),
    tenant_id:        tenantId,
  };
  if (form.id) {
    const { data, error } = await supabase.from("cuentas_caja_banco").update(row).eq("id", form.id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await supabase.from("cuentas_caja_banco").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteCuenta(id) {
  const { error } = await supabase.from("cuentas_caja_banco").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Form Modal ────────────────────────────────────────────────────────────────

function CuentaForm({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState(initial ? { ...initial } : emptyForm());
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const esPlata = form.tipo === "plata";

  return (
    <div className="client-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="client-modal">
        <header>
          <h2>{form.id ? "Editar cuenta" : "Nueva cuenta"}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <form id="cuenta-form" className="rem-modal__body" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <div className="rem-form-grid">
            <label className="rem-field rem-field--full">
              <span>Nombre</span>
              <input
                type="text" value={form.nombre} required
                onChange={(e) => set("nombre", e.target.value)}
                placeholder="Ej. Banco BBVA, Efectivo taller..."
              />
            </label>
            <label className="rem-field">
              <span>Tipo de cuenta</span>
              <select value={form.tipo} onChange={(e) => {
                const tipo = e.target.value;
                set("tipo", tipo);
                if (tipo === "plata") set("moneda", "GRM");
                else if (form.moneda === "GRM") set("moneda", "MXN");
              }}>
                {TIPOS_CUENTA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="rem-field">
              <span>Moneda</span>
              <select value={form.moneda} onChange={(e) => set("moneda", e.target.value)} disabled={esPlata}>
                {MONEDAS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
            {!esPlata ? (
              <label className="rem-field">
                <span>Saldo inicial</span>
                <input type="number" step="0.01" min="0" value={form.saldo_inicial}
                  onChange={(e) => set("saldo_inicial", e.target.value)}
                />
              </label>
            ) : (
              <label className="rem-field">
                <span>Gramos iniciales</span>
                <input type="number" step="0.001" min="0" value={form.gramos_iniciales}
                  onChange={(e) => set("gramos_iniciales", e.target.value)}
                />
              </label>
            )}
            <label className="rem-field">
              <span>Orden de aparición</span>
              <input type="number" min="1" value={form.orden}
                onChange={(e) => set("orden", e.target.value)}
              />
            </label>
          </div>
        </form>
        <footer>
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" form="cuenta-form" className="primary-button" disabled={saving || !form.nombre.trim()}>
            {saving ? "Guardando…" : form.id ? "Guardar cambios" : "Crear cuenta"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Tab principal ─────────────────────────────────────────────────────────────

export default function CuentasAdminTab({ tenantId, notifyAction }) {
  const [cuentas, setCuentas]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving]     = useState(false);

  const notify = (msg, type = "success") => notifyAction?.(type, "", msg);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCuentas(await fetchCuentas(tenantId));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form) => {
    setSaving(true);
    try {
      await saveCuenta(form, tenantId);
      notify(form.id ? "Cuenta actualizada." : "Cuenta creada.");
      setShowForm(false);
      setEditItem(null);
      load();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cuenta) => {
    if (!window.confirm(`¿Eliminar "${cuenta.nombre}"? Esto no afecta movimientos ya registrados.`)) return;
    try {
      await deleteCuenta(cuenta.id);
      notify("Cuenta eliminada.");
      load();
    } catch (e) {
      notify(e.message, "error");
    }
  };

  const tipoLabel = (tipo) => TIPOS_CUENTA.find((t) => t.value === tipo)?.label || tipo;

  return (
    <div className="rem-tab">
      <div className="rem-tab__header">
        <div className="rem-tab__title-row">
          <h2 className="rem-tab__title">Cuentas</h2>
          <button className="primary-button" onClick={() => { setEditItem(null); setShowForm(true); }}>
            + Nueva cuenta
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rem-loading" style={{ padding: "40px 24px" }}>Cargando…</div>
      ) : error ? (
        <div className="rem-error" style={{ padding: "24px" }}>{error}</div>
      ) : cuentas.length === 0 ? (
        <div className="admin-placeholder-panel">
          <span className="placeholder-icon">🏦</span>
          <h3>Sin cuentas registradas</h3>
          <p>Registra tus cuentas de efectivo, banco y plata para llevar el balance correctamente.</p>
        </div>
      ) : (
        <div className="rem-table-wrap" style={{ padding: "16px 24px" }}>
          <table className="rem-table">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Tipo</th>
                <th>Moneda</th>
                <th className="right">Saldo inicial</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cuentas.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.nombre}</strong></td>
                  <td>{tipoLabel(c.tipo)}</td>
                  <td><span className={`rem-moneda-badge rem-moneda-badge--${(c.moneda || "mxn").toLowerCase()}`}>{c.moneda}</span></td>
                  <td className="right">
                    {c.tipo === "plata"
                      ? `${Number(c.gramos_iniciales || 0).toFixed(3)} g`
                      : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(c.saldo_inicial || 0))
                    }
                  </td>
                  <td>
                    <div className="rem-row-actions">
                      <button className="secondary-button compact-action" onClick={() => { setEditItem(c); setShowForm(true); }}>Editar</button>
                      <button className="table-delete" onClick={() => handleDelete(c)}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <CuentaForm
          initial={editItem}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          saving={saving}
        />
      )}
    </div>
  );
}
