import { useRef, useState } from "react";
import { parseImportFile } from "../utils/importParser";
import { upsertProducts } from "../services/supabaseCatalog";
import { getTerminologyByProfile } from "../utils/catalogTerminology";

const BATCH_SIZE = 200;

const topItems = (items = [], max = 8) => items.slice(0, max);

function AnalysisList({ title, items = [], emptyText = "Sin datos detectados." }) {
  return (
    <div style={{ border: "1px solid var(--color-border-tertiary)", borderRadius: 8, padding: 12, background: "var(--color-background-primary)" }}>
      <h4 style={{ margin: "0 0 8px", fontSize: 13 }}>{title}</h4>
      {items.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {topItems(items).map((item) => (
            <div key={`${title}-${item.name || item.reason}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
              <span style={{ color: "var(--color-text-primary)" }}>{item.name || item.reason}</span>
              <strong>{Number(item.count || 0).toLocaleString()}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>{emptyText}</p>
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

  return (
    <div className={embedded ? "database-import-flow" : "admin-soft-panel compact-panel"} style={embedded ? { marginTop: 14 } : { marginBottom: 16 }}>
      {!embedded ? (
        <>
          <h3 style={{ marginBottom: 4 }}>Importar desde fuente</h3>
          <p className="muted" style={{ marginBottom: 12 }}>
            Sube un XLS/XLSX de ComerciaGold o de otra matriz. El sistema detecta columnas equivalentes como SKU, nombre, categoria, tipo, material, marca y precio.
          </p>
        </>
      ) : null}

      {error ? (
        <div style={{ padding: "10px 14px", background: "var(--color-background-danger)", borderRadius: 8, marginBottom: 12, fontSize: 13, color: "var(--color-text-danger)" }}>
          {error}
        </div>
      ) : null}

      {step === "idle" ? (
        <button className={triggerClassName} onClick={() => fileRef.current?.click()}>
          {triggerLabel}
        </button>
      ) : null}

      {step === "parsing" ? <p className="muted">Leyendo archivo... un momento.</p> : null}

      {step === "preview" && preview ? (
        <div>
          <div style={{ padding: 14, border: "1px solid var(--color-border-tertiary)", borderRadius: 8, background: "var(--color-background-secondary)", marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>Resumen antes de importar</h3>
            <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
              El sistema ya leyo tu Excel. Si confirmas, estos productos se guardaran en la base de datos de esta empresa.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
              {[
                ["Codigos leidos", analysis.totalRows ?? preview.total, "#2563eb"],
                ["Listos para importar", analysis.importableCount ?? preview.productos.length, "#059669"],
                ["Codigos repetidos", analysis.duplicateCount ?? 0, "#d97706"],
                ["Omitidos", analysis.omittedCount ?? preview.omitidos.length, "#dc2626"],
              ].map(([label, value, color]) => (
                <div key={label} style={{ padding: "10px 12px", borderRadius: 8, background: `${color}10`, border: `1px solid ${color}30` }}>
                  <strong style={{ display: "block", fontSize: 22, color }}>{Number(value || 0).toLocaleString()}</strong>
                  <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{label}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 12 }}>
              <AnalysisList title={terminology.familia || "Categorias"} items={analysis.columns?.categories || []} />
              <AnalysisList title={terminology.grupo || "Subcategorias"} items={analysis.columns?.subcategories || []} />
              <AnalysisList title={terminology.metal || "Materiales"} items={analysis.columns?.materials || []} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              <AnalysisList title="Omitidos por razon" items={analysis.omittedByReason || []} emptyText="No se omitira ningun producto." />
              <div style={{ border: "1px solid var(--color-border-tertiary)", borderRadius: 8, padding: 12, background: "var(--color-background-primary)" }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 13 }}>Botones rapidos sugeridos</h4>
                {(analysis.quickFilterSuggestions || []).length ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {analysis.quickFilterSuggestions.map((item) => (
                      <span key={item.label} style={{ padding: "5px 9px", borderRadius: 999, background: "#eef2ff", color: "#3730a3", fontSize: 12, fontWeight: 600 }}>
                        {item.label} ({Number(item.count || 0).toLocaleString()})
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0, fontSize: 12 }}>No hay categorias suficientes para sugerir botones.</p>
                )}
              </div>
            </div>

            {analysis.duplicateCodes?.length ? (
              <p className="muted" style={{ margin: "10px 0 0", fontSize: 12 }}>
                Repetidos detectados: {analysis.duplicateCodes.join(", ")}
                {analysis.duplicateCount > analysis.duplicateCodes.length ? "..." : ""}
              </p>
            ) : null}
            {(analysis.notes || []).length ? (
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--color-text-secondary)" }}>
                {analysis.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              ["Productos a importar", preview.productos.length, "#059669"],
              ["Omitidos", preview.omitidos.length, "#d97706"],
              ["Total en archivo", preview.total, "#2563eb"],
              ["Formato detectado", preview.profile === "comerciagold" ? "ComerciaGold" : "Generico", "#4f46e5"],
            ].map(([label, val, color]) => (
              <div key={label} style={{ padding: "12px 16px", borderRadius: 8, border: `1px solid ${color}30`, background: `${color}10`, minWidth: 160 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color }}>{val.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{label}</div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>
            Primeros 5 productos que se importarán:
          </p>
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--color-background-secondary)" }}>
                  {previewHeadings.map((heading) => (
                    <th key={heading} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 500 }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.productos.slice(0, 5).map((product) => (
                  <tr key={product.codigo} style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}>
                    <td style={{ padding: "6px 10px", fontWeight: 600 }}>{product.codigo}</td>
                    <td style={{ padding: "6px 10px" }}>{product.descripcion}</td>
                    <td style={{ padding: "6px 10px" }}>{[product.metal, product.kilataje].filter(Boolean).join(" ")}</td>
                    <td style={{ padding: "6px 10px" }}>{product.linea}</td>
                    <td style={{ padding: "6px 10px" }}>{product.pesoPromedio}g</td>
                    <td style={{ padding: "6px 10px" }}>{product.familia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="secondary-button compact-action" onClick={reset}>Cancelar</button>
            <button className="primary-button compact-action" onClick={handleImport}>
              Importar {preview.productos.length.toLocaleString()} productos a Supabase
            </button>
          </div>
        </div>
      ) : null}

      {step === "importing" ? (
        <div>
          <p style={{ marginBottom: 8 }}>Importando... {progress}%</p>
          <div style={{ height: 8, background: "var(--color-background-secondary)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "#2563eb", borderRadius: 4, transition: "width 0.3s" }} />
          </div>
          <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            No cierres esta ventana. Importando en bloques de {BATCH_SIZE} productos.
          </p>
        </div>
      ) : null}

      {step === "done" ? (
        <div>
          <p style={{ color: "#059669", fontWeight: 600, marginBottom: 12 }}>
            ✓ {preview?.productos.length.toLocaleString()} productos importados correctamente.
          </p>
          <button className="secondary-button compact-action" onClick={reset}>
            Importar otro archivo
          </button>
        </div>
      ) : null}

      <input ref={fileRef} type="file" accept=".xls,.xlsx" onChange={handleFile} style={{ display: "none" }} />
    </div>
  );
}
