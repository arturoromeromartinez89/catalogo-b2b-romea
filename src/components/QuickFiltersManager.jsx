import { useCallback, useEffect, useState } from "react";
import {
  fetchTenantQuickFiltersAdmin, saveQuickFilter, deleteQuickFilter, reorderQuickFilters,
} from "../services/catalogQuickFiltersService";

const blankForm = { id: null, label: "", termsText: "", match_type: "terms", active: true, sort_order: 0 };

// Fase 2 — gestión de botones rápidos por tenant (sin SQL).
export default function QuickFiltersManager({ tenantId, onClose, onSaved }) {
  const [filters, setFilters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);     // null = sin formulario; objeto = nuevo/editar
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setMsg("");
    try { setFilters(await fetchTenantQuickFiltersAdmin(tenantId)); }
    catch (e) { setMsg(e.message); }
    finally { setLoading(false); }
  }, [tenantId]);
  useEffect(() => { load(); }, [load]);

  const startNew = () => setForm({ ...blankForm, sort_order: filters.length });
  const startEdit = (f) => setForm({
    id: f.id, label: f.label, termsText: (f.terms || []).join(", "),
    match_type: f.match_type, active: f.active, sort_order: f.sort_order,
  });

  const save = async () => {
    if (!form.label.trim()) { setMsg("Escribe un nombre para el botón."); return; }
    setSaving(true); setMsg("");
    try {
      const terms = form.match_type === "without_stone"
        ? []
        : form.termsText.split(",").map((t) => t.trim()).filter(Boolean);
      await saveQuickFilter(tenantId, { id: form.id, label: form.label, terms, match_type: form.match_type, active: form.active, sort_order: form.sort_order });
      setForm(null);
      await load();
      onSaved?.();
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (f) => {
    if (!window.confirm(`¿Borrar el botón "${f.label}"?`)) return;
    try { await deleteQuickFilter(f.id); await load(); onSaved?.(); }
    catch (e) { setMsg(e.message); }
  };

  const toggleActive = async (f) => {
    try { await saveQuickFilter(tenantId, { ...f, active: !f.active }); await load(); onSaved?.(); }
    catch (e) { setMsg(e.message); }
  };

  const move = async (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= filters.length) return;
    const next = [...filters];
    [next[idx], next[j]] = [next[j], next[idx]];
    setFilters(next);
    try { await reorderQuickFilters(next.map((f) => f.id)); onSaved?.(); }
    catch (e) { setMsg(e.message); }
  };

  return (
    <div className="client-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="client-modal qf-manager">
        <header>
          <h2>Botones rápidos del catálogo</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <div className="qf-body">
          <p className="qf-hint">
            Cada botón filtra productos por palabras (en SKU, descripción, línea…). Si borras todos,
            el catálogo muestra los botones joyeros por defecto.
          </p>
          {msg ? <p className="qf-msg">{msg}</p> : null}

          {form ? (
            <div className="qf-form">
              <div className="qf-form-row">
                <label className="qf-field">
                  <span>Nombre del botón</span>
                  <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ej. Anillos, Vitrinas…" autoFocus />
                </label>
                <label className="qf-field">
                  <span>Tipo</span>
                  <select value={form.match_type} onChange={(e) => setForm({ ...form, match_type: e.target.value })}>
                    <option value="terms">Por palabras</option>
                    <option value="without_stone">Sin piedra (especial)</option>
                  </select>
                </label>
              </div>
              {form.match_type === "terms" ? (
                <label className="qf-field">
                  <span>Palabras que activan el botón (separadas por coma)</span>
                  <input value={form.termsText} onChange={(e) => setForm({ ...form, termsText: e.target.value })} placeholder="anillo, anillos, ring" />
                </label>
              ) : (
                <p className="qf-hint">“Sin piedra” usa lógica especial (excluye piedra, zirconia, perla, cristal…). No necesita palabras.</p>
              )}
              <label className="qf-check">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Activo (visible en el catálogo)
              </label>
              <div className="qf-form-actions">
                <button className="secondary-button" type="button" onClick={() => setForm(null)} disabled={saving}>Cancelar</button>
                <button className="primary-button" type="button" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar botón"}</button>
              </div>
            </div>
          ) : (
            <button className="primary-button qf-new" type="button" onClick={startNew}>+ Nuevo botón</button>
          )}

          {loading ? (
            <p className="qf-hint">Cargando…</p>
          ) : filters.length === 0 ? (
            <p className="qf-hint">No hay botones configurados. El catálogo usa los joyeros por defecto.</p>
          ) : (
            <table className="rem-table qf-table">
              <thead><tr><th></th><th>Botón</th><th>Palabras</th><th>Activo</th><th></th></tr></thead>
              <tbody>
                {filters.map((f, idx) => (
                  <tr key={f.id} className={f.active ? "" : "qf-inactive"}>
                    <td className="qf-move">
                      <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Subir">▲</button>
                      <button type="button" onClick={() => move(idx, 1)} disabled={idx === filters.length - 1} aria-label="Bajar">▼</button>
                    </td>
                    <td><strong>{f.label}</strong>{f.match_type === "without_stone" ? <span className="qf-badge">especial</span> : null}</td>
                    <td className="qf-terms">{f.match_type === "without_stone" ? "—" : (f.terms || []).join(", ")}</td>
                    <td><button type="button" className={`qf-toggle${f.active ? " on" : ""}`} onClick={() => toggleActive(f)}>{f.active ? "Sí" : "No"}</button></td>
                    <td className="rem-row-actions">
                      <button type="button" className="link-button" onClick={() => startEdit(f)}>Editar</button>
                      <button type="button" className="link-button link-button--danger" onClick={() => remove(f)}>Borrar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
