import { useEffect, useRef, useState } from "react";
import {
  COMPONENT_TYPES,
  COMPONENT_TYPE_KEYS,
  UNIDADES,
  fetchAllComponents,
  createComponent,
  updateComponent,
  deleteComponent,
  toggleComponentStatus,
  uploadComponentPhoto,
  parseComponentsExcel,
  bulkCreateComponents,
} from "../../services/productComponentsAdminService";
import { buildPlaceholderUrl, imageUrlForSize } from "../../utils/formatters";

// ─── Formulario vacío ─────────────────────────────────────────────────────────
const emptyForm = (tipo = "tejido") => ({
  codigo:       "",
  nombre:       "",
  tipo,
  descripcion:  "",
  peso:         "",
  unidad:       "g",
  fotoUrl:      "",
  visibleWeb:   true,
  estatus:      "activo",
  orden:        "",
  tagsBusqueda: "",
  metadata:     {},
});

// ─── Metadatos especiales según tipo ─────────────────────────────────────────
const MetadataFields = ({ tipo, metadata, onChange }) => {
  const set = (key, value) => onChange({ ...metadata, [key]: value });

  if (tipo === "broche") {
    return (
      <label className="components-meta-check">
        <input
          type="checkbox"
          checked={Boolean(metadata?.es_placa_militar)}
          onChange={(e) => set("es_placa_militar", e.target.checked)}
        />
        <span>Es placa militar (condiciona tipo de pieza → Esclava militar)</span>
      </label>
    );
  }
  if (tipo === "tipo_pieza") {
    return (
      <div className="components-meta-group">
        <label className="components-meta-check">
          <input
            type="checkbox"
            checked={Boolean(metadata?.excluye_placa_militar)}
            onChange={(e) => {
              const next = { ...metadata, excluye_placa_militar: e.target.checked };
              if (e.target.checked) next.fuerza_placa_militar = false;
              onChange(next);
            }}
          />
          <span>Excluye Placa Militar del selector de broche</span>
        </label>
        <label className="components-meta-check">
          <input
            type="checkbox"
            checked={Boolean(metadata?.fuerza_placa_militar)}
            onChange={(e) => {
              const next = { ...metadata, fuerza_placa_militar: e.target.checked };
              if (e.target.checked) next.excluye_placa_militant = false;
              onChange(next);
            }}
          />
          <span>Fuerza Placa Militar como broche (Esclava placa militar)</span>
        </label>
        <label className="components-meta-check">
          <input
            type="checkbox"
            checked={Boolean(metadata?.requiere_diseño_placa)}
            onChange={(e) => set("requiere_diseño_placa", e.target.checked)}
          />
          <span>Muestra selector de diseño de placa</span>
        </label>
      </div>
    );
  }
  return null;
};

// ─── Modal de crear / editar ──────────────────────────────────────────────────
function ComponentForm({ initial, onSave, onCancel, tenantId, saving }) {
  const [form, setForm] = useState(initial || emptyForm());
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileRef = useRef(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setChecked = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }));

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadMsg("Subiendo foto...");
    try {
      const url = await uploadComponentPhoto(file, tenantId, form.codigo || `comp-${Date.now()}`);
      setForm((f) => ({ ...f, fotoUrl: url }));
      setUploadMsg("Foto subida.");
    } catch (err) {
      setUploadMsg("Error: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.codigo.trim()) { setUploadMsg("El código es obligatorio."); return; }
    if (!form.nombre.trim()) { setUploadMsg("El nombre es obligatorio."); return; }
    onSave(form);
  };

  return (
    <div className="components-form-overlay">
      <form className="components-form-card" onSubmit={handleSubmit}>
        <div className="components-form-header">
          <h3>{initial?.id ? "Editar componente" : "Nuevo componente"}</h3>
          <button type="button" className="modal-close-btn" onClick={onCancel}>✕</button>
        </div>

        <div className="components-form-grid">
          {/* Tipo */}
          <label className="components-field components-field--span2">
            <span>Tipo</span>
            <select value={form.tipo} onChange={set("tipo")}>
              {COMPONENT_TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.icon} {t.label}</option>
              ))}
            </select>
          </label>

          {/* Código */}
          <label className="components-field">
            <span>Código (único por tipo)</span>
            <input
              value={form.codigo}
              onChange={set("codigo")}
              placeholder="Ej. BROCHE-CAJA"
              style={{ textTransform: "uppercase" }}
            />
          </label>

          {/* Nombre */}
          <label className="components-field">
            <span>Nombre visible</span>
            <input value={form.nombre} onChange={set("nombre")} placeholder="Ej. Broche de caja" />
          </label>

          {/* Descripción */}
          <label className="components-field components-field--span2">
            <span>Descripción (opcional)</span>
            <input value={form.descripcion} onChange={set("descripcion")} placeholder="Descripción interna" />
          </label>

          {/* Peso */}
          <label className="components-field">
            <span>Peso</span>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={form.peso}
              onChange={set("peso")}
              placeholder="0.00"
            />
          </label>

          {/* Unidad */}
          <label className="components-field">
            <span>Unidad</span>
            <select value={form.unidad} onChange={set("unidad")}>
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>

          {/* Orden */}
          <label className="components-field">
            <span>Orden en lista</span>
            <input type="number" value={form.orden} onChange={set("orden")} placeholder="0" />
          </label>

          {/* Estatus */}
          <label className="components-field">
            <span>Estatus</span>
            <select value={form.estatus} onChange={set("estatus")}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </label>

          {/* Foto */}
          <div className="components-field components-field--span2 components-photo-row">
            <span className="components-field-label">Foto</span>
            <div className="components-photo-preview">
              <img
                src={form.fotoUrl ? imageUrlForSize(form.fotoUrl, 120) : buildPlaceholderUrl()}
                alt="Foto componente"
                onError={(e) => { e.currentTarget.src = buildPlaceholderUrl(); }}
              />
            </div>
            <div className="components-photo-actions">
              <label className="secondary-button compact-action">
                {uploading ? "Subiendo..." : "Subir foto"}
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} disabled={uploading} />
              </label>
              <input
                value={form.fotoUrl}
                onChange={set("fotoUrl")}
                placeholder="O pega una URL de imagen"
                style={{ flex: 1 }}
              />
            </div>
            {uploadMsg ? <span className="components-upload-msg">{uploadMsg}</span> : null}
          </div>

          {/* Metadata condicional */}
          <div className="components-field components-field--span2">
            <MetadataFields
              tipo={form.tipo}
              metadata={form.metadata}
              onChange={(meta) => setForm((f) => ({ ...f, metadata: meta }))}
            />
          </div>
        </div>

        <div className="components-form-actions">
          <button type="button" className="secondary-button compact-action" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="primary-button compact-action" disabled={saving}>
            {saving ? "Guardando..." : initial?.id ? "Guardar cambios" : "Crear componente"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Tab principal ────────────────────────────────────────────────────────────
export default function ComponentsTab({ tenantId }) {
  const [components, setComponents]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeType, setActiveType]   = useState("tejido");
  const [formOpen, setFormOpen]       = useState(false);
  const [editing, setEditing]         = useState(null);
  const [saving, setSaving]           = useState(false);
  const [status, setStatus]           = useState("");
  const [importing, setImporting]     = useState(false);
  const [importMsg, setImportMsg]     = useState("");
  const importRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await fetchAllComponents(tenantId);
      setComponents(rows);
    } catch (err) {
      setStatus("Error al cargar componentes: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (tenantId) load(); }, [tenantId]);

  const byType = components.filter((c) => c.tipo === activeType);
  const counts = Object.fromEntries(
    COMPONENT_TYPES.map((t) => [t.key, components.filter((c) => c.tipo === t.key).length])
  );

  const handleSave = async (form) => {
    setSaving(true);
    setStatus("");
    try {
      if (editing?.id) {
        const updated = await updateComponent(editing.id, form);
        setComponents((prev) => prev.map((c) => c.id === updated.id ? updated : c));
        setStatus("Componente actualizado.");
      } else {
        const created = await createComponent(form, tenantId);
        setComponents((prev) => [...prev, created]);
        setStatus("Componente creado.");
      }
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      setStatus("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (component) => {
    try {
      const updated = await toggleComponentStatus(component.id, component.estatus);
      setComponents((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  };

  const handleDelete = async (component) => {
    if (!window.confirm(`¿Eliminar "${component.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteComponent(component.id);
      setComponents((prev) => prev.filter((c) => c.id !== component.id));
      setStatus("Componente eliminado.");
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  };

  const handleEdit = (component) => {
    setEditing(component);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleExcelImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportMsg("");
    try {
      const rows = await parseComponentsExcel(file);
      if (!rows.length) {
        setImportMsg("No se encontraron filas válidas. Revisa que el tipo sea uno de los permitidos.");
        return;
      }
      const result = await bulkCreateComponents(rows, tenantId);
      await load();
      setImportMsg(`${result.created} componentes importados/actualizados.`);
    } catch (err) {
      setImportMsg("Error al importar: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleExcelTemplate = async () => {
    const XLSX = await import("xlsx");
    const example = [
      { codigo: "CHINO", nombre: "Chino", tipo: "tejido", descripcion: "Tejido chino clásico", peso: 0, unidad: "g", orden: 10, tags_busqueda: "chino tejido chain" },
      { codigo: "BROCHE-CAJA", nombre: "Broche de caja", tipo: "broche", descripcion: "", peso: 0.25, unidad: "g", orden: 10, tags_busqueda: "" },
      { codigo: "21CM", nombre: "21 cm", tipo: "largo", descripcion: "", peso: 0, unidad: "cm", orden: 21, tags_busqueda: "" },
    ];
    const ws = XLSX.utils.json_to_sheet(example);
    ws["!cols"] = Object.keys(example[0]).map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Componentes");
    XLSX.writeFile(wb, "plantilla-componentes.xlsx");
  };

  const activeTypeInfo = COMPONENT_TYPES.find((t) => t.key === activeType);

  return (
    <div className="components-tab">

      {/* ── Header ── */}
      <div className="components-header">
        <div>
          <h2>Componentes del configurador</h2>
          <p className="components-subtitle">
            Define tejidos, broches, largos y terminados con sus pesos reales.
            El configurador usará estos datos para calcular pesos exactos.
          </p>
        </div>
        <div className="components-header-actions">
          <label className={`secondary-button compact-action ${importing ? "disabled" : ""}`}>
            {importing ? "Importando..." : "Importar Excel"}
            <input ref={importRef} type="file" accept=".xlsx,.xls" onChange={handleExcelImport} disabled={importing} />
          </label>
          <button className="secondary-button compact-action" type="button" onClick={handleExcelTemplate}>
            Descargar plantilla
          </button>
          <button className="primary-button compact-action" type="button" onClick={handleNew}>
            + Nuevo componente
          </button>
        </div>
      </div>

      {status ? <p className="status info">{status}</p> : null}
      {importMsg ? <p className="status info">{importMsg}</p> : null}

      {/* ── Tabs por tipo ── */}
      <div className="components-type-tabs">
        {COMPONENT_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`components-type-tab ${activeType === t.key ? "active" : ""}`}
            onClick={() => setActiveType(t.key)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {counts[t.key] > 0 && (
              <span className="components-type-count">{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tabla del tipo activo ── */}
      <div className="components-table-section">
        <div className="components-table-header">
          <h3>{activeTypeInfo?.icon} {activeTypeInfo?.label}</h3>
          <span className="components-table-hint">
            {activeType === "broche" && "Activa el flag 'Es placa militar' en los broches tipo placa para activar las reglas de Esclava militar."}
            {activeType === "tipo_pieza" && "Configura las reglas de compatibilidad con broches desde el boton Editar."}
            {activeType === "tejido" && "El peso es por gramo del tejido — se multiplica por el largo al calcular."}
            {activeType === "largo" && "El peso aqui no aplica — el largo afecta el total multiplicando gramos base del tejido."}
            {activeType === "diseño_placa" && "Disenos de placa disponibles para esclavas (placa en medio y placa militar)."}
          </span>
        </div>

        {loading ? (
          <p className="components-loading">Cargando componentes...</p>
        ) : byType.length === 0 ? (
          <div className="components-empty">
            <p>No hay {activeTypeInfo?.label.toLowerCase()} registrados.</p>
            <button className="primary-button compact-action" type="button" onClick={handleNew}>
              + Agregar primero
            </button>
          </div>
        ) : (
          <div className="responsive-table">
            <table className="simple-admin-table components-table">
              <thead>
                <tr>
                  <th>Foto</th>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th className="right">Peso</th>
                  <th>Unidad</th>
                  <th className="right">Orden</th>
                  <th>Reglas</th>
                  <th>Estatus</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {byType.map((comp) => (
                  <tr key={comp.id} className={comp.estatus === "inactivo" ? "row-inactive" : ""}>
                    <td>
                      <img
                        className="component-thumb"
                        src={comp.fotoUrl ? imageUrlForSize(comp.fotoUrl, 80) : buildPlaceholderUrl()}
                        alt={comp.nombre}
                        onError={(e) => { e.currentTarget.src = buildPlaceholderUrl(); }}
                      />
                    </td>
                    <td><code className="component-code">{comp.codigo}</code></td>
                    <td><strong>{comp.nombre}</strong>{comp.descripcion ? <small>{comp.descripcion}</small> : null}</td>
                    <td className="right">
                      {Number(comp.peso) > 0 ? (
                        <strong className="component-weight">{comp.peso} {comp.unidad}</strong>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>{comp.unidad}</td>
                    <td className="right">{comp.orden}</td>
                    <td>
                      {/* Badges de metadata */}
                      {comp.metadata?.es_placa_militar && (
                        <span className="component-badge component-badge--military">Placa militar</span>
                      )}
                      {comp.metadata?.fuerza_placa_militar && (
                        <span className="component-badge component-badge--military">→ Esclava militar</span>
                      )}
                      {comp.metadata?.excluye_placa_militar && (
                        <span className="component-badge component-badge--exclude">Sin placa militar</span>
                      )}
                      {comp.metadata?.requiere_diseño_placa && (
                        <span className="component-badge component-badge--plate">+ Diseño placa</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`component-status-btn ${comp.estatus === "activo" ? "active" : "inactive"}`}
                        onClick={() => handleToggle(comp)}
                        title={comp.estatus === "activo" ? "Desactivar" : "Activar"}
                      >
                        {comp.estatus === "activo" ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td>
                      <div className="component-row-actions">
                        <button className="secondary-button compact-action" type="button" onClick={() => handleEdit(comp)}>
                          Editar
                        </button>
                        <button className="table-delete" type="button" onClick={() => handleDelete(comp)}>
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal de crear/editar ── */}
      {formOpen ? (
        <ComponentForm
          initial={editing ? { ...editing, tipo: editing.tipo || activeType } : emptyForm(activeType)}
          onSave={handleSave}
          onCancel={() => { setFormOpen(false); setEditing(null); }}
          tenantId={tenantId}
          saving={saving}
        />
      ) : null}

    </div>
  );
}
