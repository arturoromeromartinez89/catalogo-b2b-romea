import { useEffect, useRef, useState } from "react";
import ActionNotice from "./ActionNotice";
import {
  deleteLaborList,
  fetchLaborListLines,
  fetchLaborLists,
  fetchLines,
  saveLaborList,
  syncProductLinesFromProducts,
  upsertLaborListLines,
} from "../services/pricingService";

// ─── Vista: lista de listas ───────────────────────────────────────────────────

function LaborListCard({ list, onEdit, onDelete }) {
  return (
    <article className="labor-list-card">
      <div className="labor-list-card-header">
        <strong>{list.name}</strong>
        <span className="database-badge">{list._configured ?? "—"} líneas</span>
      </div>
      <div className="labor-list-card-actions">
        <button className="secondary-button compact-action" type="button" onClick={() => onEdit(list)}>
          Editar labores
        </button>
        <button className="link-button" type="button" onClick={() => onDelete(list)}>
          Eliminar
        </button>
      </div>
    </article>
  );
}

// ─── Vista: editar una lista ──────────────────────────────────────────────────

function EditListView({ list, productLines, onBack, onSaved, setNotice }) {
  const [name, setName] = useState(list.name);
  const [lineValues, setLineValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetchLaborListLines(list.id)
      .then((rows) => {
        const map = {};
        rows.forEach((row) => { map[row.line_codigo] = String(row.mo_base ?? ""); });
        setLineValues(map);
      })
      .catch((err) => setNotice({ type: "error", title: "Error", message: err.message }));
  }, [list.id]);

  const setValue = (codigo, value) => {
    setLineValues((prev) => ({ ...prev, [codigo]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Rename if needed
      if (name.trim() !== list.name) {
        await saveLaborList({ id: list.id, name: name.trim() });
      }
      // Save all lines
      const lines = productLines.map((line) => ({
        line_codigo: line.codigo,
        mo_base: Number(lineValues[line.codigo] || 0),
      }));
      await upsertLaborListLines(list.id, lines);
      setDirty(false);
      setNotice({ type: "success", title: "Lista guardada", message: `"${name}" guardada con ${lines.length} líneas.` });
      onSaved();
    } catch (err) {
      setNotice({ type: "error", title: "No se pudo guardar", message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const configured = Object.values(lineValues).filter((v) => Number(v) > 0).length;

  return (
    <div className="pricing-edit-view">
      {/* Header de la vista de edición */}
      <div className="pricing-edit-header">
        <button className="link-button pricing-back-btn" type="button" onClick={onBack}>
          ← Volver a listas
        </button>
        <div className="pricing-edit-title-row">
          <input
            className="pricing-list-name-input"
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            placeholder="Nombre de la lista"
          />
          <span className="database-badge">{configured} / {productLines.length} líneas configuradas</span>
          <button
            className="primary-button compact-action"
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
          >
            {saving ? "Guardando..." : "Guardar lista"}
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          Mano de obra en MXN/g por cada línea de producto. Configura solo las líneas que uses.
        </p>
      </div>

      {/* Tabla editable */}
      <div className="pricing-lines-table-wrap">
        <table className="database-health-table pricing-labor-table">
          <thead>
            <tr>
              <th style={{ width: 120 }}>Línea</th>
              <th>Descripción</th>
              <th style={{ width: 160, textAlign: "right" }}>Labor MXN/g</th>
            </tr>
          </thead>
          <tbody>
            {productLines.map((line) => (
              <tr key={line.codigo} className={Number(lineValues[line.codigo] || 0) > 0 ? "line-row-configured" : ""}>
                <td><strong>{line.codigo}</strong></td>
                <td className="muted-cell">{line.descripcion || "—"}</td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={lineValues[line.codigo] ?? ""}
                    onChange={(e) => setValue(line.codigo, e.target.value)}
                    placeholder="0.00"
                    style={{ textAlign: "right" }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────

export default function PricingPanel({ products = [], tenantId = "" }) {
  const [laborLists, setLaborLists] = useState([]);
  const [productLines, setProductLines] = useState([]);
  const [editingList, setEditingList] = useState(null);
  const [newListName, setNewListName] = useState("");
  const [showNewInput, setShowNewInput] = useState(false);
  const [syncingLines, setSyncingLines] = useState(false);
  const [notice, setNotice] = useState(null);
  const newInputRef = useRef(null);

  const loadAll = async () => {
    const [lists, lines] = await Promise.all([
      fetchLaborLists(tenantId),
      fetchLines(tenantId),
    ]);
    // Add _configured count per list
    const listsWithCount = await Promise.all(
      lists.map(async (list) => {
        try {
          const rows = await fetchLaborListLines(list.id);
          const configured = rows.filter((r) => Number(r.mo_base) > 0).length;
          return { ...list, _configured: configured };
        } catch {
          return { ...list, _configured: 0 };
        }
      })
    );
    setLaborLists(listsWithCount);
    setProductLines(lines);
  };

  useEffect(() => {
    loadAll().catch((err) => setNotice({ type: "error", title: "Error al cargar", message: err.message }));
  }, [tenantId]);

  useEffect(() => {
    if (showNewInput) newInputRef.current?.focus();
  }, [showNewInput]);

  const handleSync = async () => {
    setSyncingLines(true);
    try {
      const updated = await syncProductLinesFromProducts(products, tenantId);
      setProductLines(updated);
      setNotice({ type: "success", title: "Líneas sincronizadas", message: `${updated.length} líneas desde el catálogo.` });
    } catch (err) {
      setNotice({ type: "error", title: "Error", message: err.message });
    } finally {
      setSyncingLines(false);
    }
  };

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) return;
    try {
      const created = await saveLaborList({ name }, tenantId);
      setLaborLists((prev) => [...prev, { ...created, _configured: 0 }]);
      setNewListName("");
      setShowNewInput(false);
      setNotice({ type: "success", title: "Lista creada", message: `"${name}" creada. Ahora edítala para configurar labores.` });
    } catch (err) {
      setNotice({ type: "error", title: "Error", message: err.message });
    }
  };

  const handleDelete = async (list) => {
    if (!window.confirm(`¿Eliminar la lista "${list.name}"?`)) return;
    try {
      await deleteLaborList(list.id);
      setLaborLists((prev) => prev.filter((l) => l.id !== list.id));
    } catch (err) {
      setNotice({ type: "error", title: "Error", message: err.message });
    }
  };

  // ── Vista edición ────────────────────────────────────────────────────────
  if (editingList) {
    return (
      <section className="database-health-dashboard" style={{ padding: "20px 24px" }}>
        <EditListView
          list={editingList}
          productLines={productLines}
          onBack={() => setEditingList(null)}
          onSaved={() => { loadAll(); setEditingList(null); }}
          setNotice={setNotice}
        />
        <ActionNotice notice={notice} onClose={() => setNotice(null)} />
      </section>
    );
  }

  // ── Vista lista ──────────────────────────────────────────────────────────
  const totalConfigured = laborLists.reduce((sum, l) => sum + (l._configured || 0), 0);

  return (
    <section className="database-health-dashboard" style={{ padding: "20px 24px" }}>

      {/* Fila de métricas compacta */}
      <div className="pricing-metrics-row">
        <div className="pricing-metric-chip">
          <span>Listas de labor</span>
          <strong>{laborLists.length}</strong>
        </div>
        <div className="pricing-metric-chip">
          <span>Líneas disponibles</span>
          <strong>{productLines.length}</strong>
        </div>
        <div className="pricing-metric-chip">
          <span>Plata fina</span>
          <strong className="muted-cell" style={{ fontSize: 12 }}>por preorden</strong>
        </div>
        <div className="pricing-metric-actions">
          <button
            className="secondary-button compact-action"
            type="button"
            onClick={handleSync}
            disabled={syncingLines}
          >
            {syncingLines ? "Sincronizando..." : "Actualizar líneas"}
          </button>
        </div>
      </div>

      {/* Grid de listas de labor */}
      <article className="database-health-card">
        <div className="database-card-header">
          <h2>Listas de labor</h2>
          <button
            className="primary-button compact-action"
            type="button"
            onClick={() => setShowNewInput((v) => !v)}
          >
            + Nueva lista
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          Cada lista define la mano de obra (MXN/g) por línea. Al crear una preorden seleccionas qué lista aplicar.
        </p>

        {showNewInput ? (
          <div className="pricing-new-list-row">
            <input
              ref={newInputRef}
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Nombre de la lista, ej: Lista Estándar 2026"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateList(); if (e.key === "Escape") setShowNewInput(false); }}
            />
            <button className="primary-button compact-action" type="button" onClick={handleCreateList} disabled={!newListName.trim()}>
              Crear
            </button>
            <button className="secondary-button compact-action" type="button" onClick={() => setShowNewInput(false)}>
              Cancelar
            </button>
          </div>
        ) : null}

        {laborLists.length ? (
          <div className="labor-lists-grid">
            {laborLists.map((list) => (
              <LaborListCard
                key={list.id}
                list={list}
                onEdit={setEditingList}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <p className="empty-row" style={{ textAlign: "center", padding: "24px 0", color: "var(--romea-muted)" }}>
            Aún no hay listas. Crea la primera con el botón de arriba.
          </p>
        )}
      </article>

      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </section>
  );
}
