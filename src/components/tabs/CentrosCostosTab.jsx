import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// ─── Constantes ────────────────────────────────────────────────────────────────

const TIPOS = [
  { value: "operativo",      label: "Operativo" },
  { value: "administrativo", label: "Administrativo" },
  { value: "produccion",     label: "Producción" },
  { value: "ventas",         label: "Ventas" },
];

const emptyForm = () => ({
  nombre: "",
  codigo: "",
  tipo: "operativo",
  activo: true,
});

// ─── Servicio inline ────────────────────────────────────────────────────────────

async function fetchCentros(tenantId) {
  const { data, error } = await supabase
    .from("centros_costos")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("tipo")
    .order("nombre");
  if (error) throw new Error(error.message);
  return data || [];
}

async function saveCentro(form, tenantId) {
  const row = {
    nombre:    form.nombre.trim(),
    codigo:    form.codigo?.trim() || null,
    tipo:      form.tipo,
    activo:    form.activo,
    tenant_id: tenantId,
  };
  if (form.id) {
    const { data, error } = await supabase.from("centros_costos").update(row).eq("id", form.id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await supabase.from("centros_costos").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteCentro(id) {
  const { error } = await supabase.from("centros_costos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Form Modal ────────────────────────────────────────────────────────────────

function CentroForm({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState(initial ? { ...initial } : emptyForm());
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="client-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="client-modal">
        <header>
          <h2>{form.id ? "Editar centro" : "Nuevo centro de costos"}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <form id="centro-form" className="rem-modal__body" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
          <div className="rem-form-grid">
            <label className="rem-field">
              <span>Nombre</span>
              <input
                type="text" value={form.nombre} required
                onChange={(e) => set("nombre", e.target.value)}
                placeholder="Ej. Producción joyería"
              />
            </label>
            <label className="rem-field">
              <span>Código</span>
              <input
                type="text" value={form.codigo || ""}
                onChange={(e) => set("codigo", e.target.value)}
                placeholder="Ej. PROD-01"
              />
            </label>
            <label className="rem-field rem-field--full">
              <span>Tipo</span>
              <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="rem-field rem-field--full" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <input type="checkbox" checked={form.activo} onChange={(e) => set("activo", e.target.checked)} style={{ width: "auto" }} />
              <span>Centro activo</span>
            </label>
          </div>
        </form>
        <footer>
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" form="centro-form" className="primary-button" disabled={saving || !form.nombre.trim()}>
            {saving ? "Guardando…" : form.id ? "Guardar cambios" : "Crear centro"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Tab principal ─────────────────────────────────────────────────────────────

export default function CentrosCostosTab({ tenantId, notifyAction }) {
  const [centros, setCentros]   = useState([]);
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
      setCentros(await fetchCentros(tenantId));
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
      await saveCentro(form, tenantId);
      notify(form.id ? "Centro actualizado." : "Centro creado.");
      setShowForm(false);
      setEditItem(null);
      load();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (centro) => {
    if (!window.confirm(`¿Eliminar "${centro.nombre}"?`)) return;
    try {
      await deleteCentro(centro.id);
      notify("Centro eliminado.");
      load();
    } catch (e) {
      notify(e.message, "error");
    }
  };

  const byTipo = TIPOS.map((t) => ({
    ...t,
    items: centros.filter((c) => c.tipo === t.value),
  })).filter((g) => g.items.length > 0 || centros.length === 0);

  return (
    <div className="rem-tab">
      <div className="rem-tab__header">
        <div className="rem-tab__title-row">
          <h2 className="rem-tab__title">Centros de costos</h2>
          <button
            className="primary-button"
            onClick={() => { setEditItem(null); setShowForm(true); }}
          >
            + Nuevo centro
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rem-loading" style={{ padding: "40px 24px" }}>Cargando…</div>
      ) : error ? (
        <div className="rem-error" style={{ padding: "24px" }}>{error}</div>
      ) : centros.length === 0 ? (
        <div className="admin-placeholder-panel">
          <span className="placeholder-icon">🏷️</span>
          <h3>Sin centros de costos</h3>
          <p>Crea el primero con el botón de arriba. Los centros de costos te permiten clasificar gastos por área.</p>
        </div>
      ) : (
        <div style={{ padding: "16px 24px" }}>
          {byTipo.map((grupo) => (
            <div key={grupo.value} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--neutral-500)", marginBottom: 8 }}>
                {grupo.label}
              </div>
              <div className="rem-table-wrap">
                <table className="rem-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Código</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.items.map((c) => (
                      <tr key={c.id} className={!c.activo ? "rem-row--cancelled" : ""}>
                        <td><strong>{c.nombre}</strong></td>
                        <td><code style={{ fontSize: 12 }}>{c.codigo || "—"}</code></td>
                        <td>
                          <span className="rem-badge" style={{ "--badge-color": c.activo ? "var(--color-success)" : "var(--neutral-400)" }}>
                            {c.activo ? "Activo" : "Inactivo"}
                          </span>
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
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CentroForm
          initial={editItem}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          saving={saving}
        />
      )}
    </div>
  );
}
