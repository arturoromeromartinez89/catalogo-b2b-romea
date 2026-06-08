import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// ─── Servicio inline ────────────────────────────────────────────────────────────

async function fetchCategorias(tenantId) {
  const { data, error } = await supabase
    .from("categorias_gasto")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("nombre");
  if (error) throw new Error(error.message);
  return data || [];
}

async function saveCategoria(form, tenantId) {
  const row = {
    nombre:    form.nombre.trim(),
    tenant_id: tenantId,
  };
  if (form.id) {
    const { data, error } = await supabase.from("categorias_gasto").update(row).eq("id", form.id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await supabase.from("categorias_gasto").insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function deleteCategoria(id) {
  const { error } = await supabase.from("categorias_gasto").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Form Modal ────────────────────────────────────────────────────────────────

function CategoriaForm({ initial, onSave, onClose, saving }) {
  const [nombre, setNombre] = useState(initial?.nombre || "");

  return (
    <div className="client-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="client-modal">
        <header>
          <h2>{initial?.id ? "Editar categoría" : "Nueva categoría de gasto"}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <form
          id="categoria-form"
          className="rem-modal__body"
          onSubmit={(e) => { e.preventDefault(); onSave({ ...initial, nombre }); }}
        >
          <div className="rem-form-grid">
            <label className="rem-field rem-field--full">
              <span>Nombre de categoría</span>
              <input
                type="text" value={nombre} required
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Renta, Sueldos, Material, Envíos..."
                autoFocus
              />
            </label>
          </div>
        </form>
        <footer>
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" form="categoria-form" className="primary-button" disabled={saving || !nombre.trim()}>
            {saving ? "Guardando…" : initial?.id ? "Guardar cambios" : "Crear categoría"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Tab principal ─────────────────────────────────────────────────────────────

export default function CategoriasGastoTab({ tenantId, notifyAction }) {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [saving, setSaving]         = useState(false);

  const notify = (msg, type = "success") => notifyAction?.(type, "", msg);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCategorias(await fetchCategorias(tenantId));
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
      await saveCategoria(form, tenantId);
      notify(form.id ? "Categoría actualizada." : "Categoría creada.");
      setShowForm(false);
      setEditItem(null);
      load();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    if (!window.confirm(`¿Eliminar "${cat.nombre}"?`)) return;
    try {
      await deleteCategoria(cat.id);
      notify("Categoría eliminada.");
      load();
    } catch (e) {
      notify(e.message, "error");
    }
  };

  return (
    <div className="rem-tab">
      <div className="rem-tab__header">
        <div className="rem-tab__title-row">
          <h2 className="rem-tab__title">Categorías de gasto</h2>
          <button className="primary-button" onClick={() => { setEditItem(null); setShowForm(true); }}>
            + Nueva categoría
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rem-loading" style={{ padding: "40px 24px" }}>Cargando…</div>
      ) : error ? (
        <div className="rem-error" style={{ padding: "24px" }}>{error}</div>
      ) : categorias.length === 0 ? (
        <div className="admin-placeholder-panel">
          <span className="placeholder-icon">🗂️</span>
          <h3>Sin categorías</h3>
          <p>Las categorías te permiten clasificar y agrupar los gastos del taller por tipo. Ej: Renta, Sueldos, Material, Envíos.</p>
        </div>
      ) : (
        <div className="rem-table-wrap" style={{ padding: "16px 24px" }}>
          <table className="rem-table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((cat) => (
                <tr key={cat.id}>
                  <td><strong>{cat.nombre}</strong></td>
                  <td>
                    <div className="rem-row-actions">
                      <button className="secondary-button compact-action" onClick={() => { setEditItem(cat); setShowForm(true); }}>Editar</button>
                      <button className="table-delete" onClick={() => handleDelete(cat)}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <CategoriaForm
          initial={editItem}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          saving={saving}
        />
      )}
    </div>
  );
}
