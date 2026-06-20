import { useRef, useState } from "react";
import { parseImportFile } from "../utils/importParser";
import { upsertProducts } from "../services/supabaseCatalog";
import { getTerminologyByProfile } from "../utils/catalogTerminology";

const BATCH_SIZE = 200;
const topItems = (items = [], max = 8) => items.slice(0, max);

function AnalysisList({ title, items = [], emptyText = "Sin datos detectados." }) {
  return (
    <div className="import-analysis-list">
      <h4>{title}</h4>
      {items.length ? (
        <div className="import-analysis-list__items">
          {topItems(items).map((item) => (
            <div key={`${title}-${item.name || item.reason}`} className="import-analysis-list__row">
              <span>{item.name || item.reason}</span>
              <strong>{Number(item.count || 0).toLocaleString()}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">{emptyText}</p>
      )}
    </div>
  );
}

export default function ImportPanel({
  onImported,
  tenantId = "",
  embedded = false,
  triggerLabel = "Seleccionar archivo XLS/XLSX",
  triggerClassName = "primary-button compact-action",
  buttonOnly = false,
}) {
  const fileRef = useRef();
  const [step, setStep] = useState("idle");
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStep("parsing");
    setError("");
    try {
      const result = await parseImportFile(file);
      setPreview(result);
      setStep("preview");
    } catch (err) {
      setError(err.message);
      setStep("idle");
    } finally {
      event.target.value = "";
    }
  };

  const handleImport = async () => {
    if (!preview) return;
    setStep("importing");
    setProgress(0);
    try {
      const { productos } = preview;
      const total = productos.length;
      let done = 0;

      for (let index = 0; index < total; index += BATCH_SIZE) {
        const batch = productos.slice(index, index + BATCH_SIZE);
        await upsertProducts(batch, tenantId);
        done += batch.length;
        setProgress(Math.round((done / total) * 100));
      }

      setStep("done");
      onImported?.();
    } catch (err) {
      setError(err.message);
      setStep("preview");
    }
  };

  const reset = () => {
    setStep("idle");
    setPreview(null);
    setProgress(0);
    setError("");
  };

  const terminology = preview ? getTerminologyByProfile(preview.profile, "es") : {};
  const analysis = preview?.analysis || {};
  const previewHeadings = [
    "Codigo",
    "Descripcion",
    terminology.metal || "Material",
    terminology.linea || "Linea / coleccion",
    terminology.avgWeight || "Peso/cantidad",
    terminology.familia || "Categoria",
  ];

  const triggerButton = (
    <>
      {error && buttonOnly ? <p className="status info import-inline-error">{error}</p> : null}
      {step === "idle" ? (
        <button className={triggerClassName} type="button" onClick={() => fileRef.current?.click()}>
          {triggerLabel}
        </button>
      ) : null}
      {step === "parsing" ? <p className="muted import-inline-status">Leyendo archivo...</p> : null}
      <input ref={fileRef} type="file" accept=".xls,.xlsx" onChange={handleFile} style={{ display: "none" }} />
    </>
  );

  const previewContent = step === "preview" && preview ? (
    <div className="import-preview">
      <div className="import-analysis-card">
        <h3>Resumen antes de importar</h3>
        <p className="muted">
          El sistema ya leyo tu Excel. Si confirmas, estos productos se guardaran en la base de datos de esta empresa.
        </p>

        <div className="import-kpi-grid">
          {[
            ["Codigos leidos", analysis.totalRows ?? preview.total, "#2563eb"],
            ["Listos para importar", analysis.importableCount ?? preview.productos.length, "#059669"],
            ["Codigos repetidos", analysis.duplicateCount ?? 0, "#d97706"],
            ["Omitidos", analysis.omittedCount ?? preview.omitidos.length, "#dc2626"],
          ].map(([label, value, color]) => (
            <div key={label} className="import-kpi" style={{ "--import-kpi-color": color }}>
              <strong>{Number(value || 0).toLocaleString()}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="import-analysis-grid">
          <AnalysisList title={terminology.familia || "Categorias"} items={analysis.columns?.categories || []} />
          <AnalysisList title={terminology.grupo || "Subcategorias"} items={analysis.columns?.subcategories || []} />
          <AnalysisList title={terminology.metal || "Materiales"} items={analysis.columns?.materials || []} />
          <AnalysisList title="Omitidos por razon" items={analysis.omittedByReason || []} emptyText="No se omitira ningun producto." />
        </div>

        <div className="import-suggested-filters">
          <h4>Botones rapidos sugeridos</h4>
          {(analysis.quickFilterSuggestions || []).length ? (
            <div>
              {analysis.quickFilterSuggestions.map((item) => (
                <span key={item.label}>
                  {item.label} ({Number(item.count || 0).toLocaleString()})
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">No hay categorias suficientes para sugerir botones.</p>
          )}
        </div>

        {analysis.duplicateCodes?.length ? (
          <p className="muted import-duplicates">
            Repetidos detectados: {analysis.duplicateCodes.join(", ")}
            {analysis.duplicateCount > analysis.duplicateCodes.length ? "..." : ""}
          </p>
        ) : null}

        {(analysis.notes || []).length ? (
          <ul className="import-notes">
            {analysis.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        ) : null}
      </div>

      <div className="import-summary-row">
        {[
          ["Productos a importar", preview.productos.length, "#059669"],
          ["Omitidos", preview.omitidos.length, "#d97706"],
          ["Total en archivo", preview.total, "#2563eb"],
          ["Formato detectado", preview.profile === "comerciagold" ? "ComerciaGold" : "Generico", "#4f46e5"],
        ].map(([label, val, color]) => (
          <div key={label} className="import-summary-box" style={{ "--import-kpi-color": color }}>
            <div>{typeof val === "number" ? val.toLocaleString() : val}</div>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <p className="import-preview-caption">Primeros 5 productos que se importaran:</p>
      <div className="import-preview-table-wrap">
        <table className="import-preview-table">
          <thead>
            <tr>
              {previewHeadings.map((heading) => <th key={heading}>{heading}</th>)}
            </tr>
          </thead>
          <tbody>
            {preview.productos.slice(0, 5).map((product) => (
              <tr key={product.codigo}>
                <td>{product.codigo}</td>
                <td>{product.descripcion}</td>
                <td>{[product.metal, product.kilataje].filter(Boolean).join(" ")}</td>
                <td>{product.linea}</td>
                <td>{product.pesoPromedio}g</td>
                <td>{product.familia}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="import-confirm-actions">
        <button className="secondary-button compact-action" type="button" onClick={reset}>Cancelar</button>
        <button className="primary-button compact-action" type="button" onClick={handleImport}>
          Importar {preview.productos.length.toLocaleString()} productos
        </button>
      </div>
    </div>
  ) : null;

  const progressContent = step === "importing" ? (
    <div className="import-progress">
      <p>Importando... {progress}%</p>
      <div><span style={{ width: `${progress}%` }} /></div>
      <small>No cierres esta ventana. Importando en bloques de {BATCH_SIZE} productos.</small>
    </div>
  ) : null;

  const doneContent = step === "done" ? (
    <div className="import-done">
      <p>{preview?.productos.length.toLocaleString()} productos importados correctamente.</p>
      <button className="secondary-button compact-action" type="button" onClick={reset}>Importar otro archivo</button>
    </div>
  ) : null;

  if (buttonOnly) {
    return (
      <>
        {triggerButton}
        {previewContent}
        {progressContent}
        {doneContent}
      </>
    );
  }

  return (
    <div className={embedded ? "database-import-flow" : "admin-soft-panel compact-panel"}>
      {!embedded ? (
        <>
          <h3>Importar desde fuente</h3>
          <p className="muted">
            Sube un XLS/XLSX de ComerciaGold o de otra matriz. El sistema detecta columnas equivalentes como SKU, nombre, categoria, tipo, material, marca y precio.
          </p>
        </>
      ) : null}

      {error ? <p className="status info import-inline-error">{error}</p> : null}
      {triggerButton}
      {previewContent}
      {progressContent}
      {doneContent}
    </div>
  );
}
