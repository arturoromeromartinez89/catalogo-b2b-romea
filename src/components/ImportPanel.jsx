import { useRef, useState } from "react";
import { parseImportFile } from "../utils/importParser";
import { upsertProducts } from "../services/supabaseCatalog";

const BATCH_SIZE = 200;

export default function ImportPanel({ onImported, tenantId = "" }) {
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

  return (
    <div className="admin-soft-panel compact-panel" style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 4 }}>Importar desde fuente</h3>
      <p className="muted" style={{ marginBottom: 12 }}>
        Sube el archivo XLS/XLSX exportado de Commercia Gold. Se importan productos con Estatus = Alta, Activo o Vigente.
      </p>

      {error ? (
        <div style={{ padding: "10px 14px", background: "var(--color-background-danger)", borderRadius: 8, marginBottom: 12, fontSize: 13, color: "var(--color-text-danger)" }}>
          {error}
        </div>
      ) : null}

      {step === "idle" ? (
        <button className="primary-button compact-action" onClick={() => fileRef.current?.click()}>
          Seleccionar archivo XLS/XLSX
        </button>
      ) : null}

      {step === "parsing" ? <p className="muted">Leyendo archivo... un momento.</p> : null}

      {step === "preview" && preview ? (
        <div>
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              ["Productos a importar", preview.productos.length, "#059669"],
              ["Omitidos", preview.omitidos.length, "#d97706"],
              ["Total en archivo", preview.total, "#2563eb"],
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
                  {["Código", "Descripción", "Metal", "Línea", "Peso g", "Familia"].map((heading) => (
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
