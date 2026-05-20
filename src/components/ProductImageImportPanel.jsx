import { useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { importProductImagesByCode } from "../services/productImageService";

const copy = {
  es: {
    eyebrow: "Imagenes de productos",
    title: "Cargar fotos por codigo",
    help: "Selecciona la carpeta de imagenes exportada. El sistema usa el nombre del archivo para encontrar el SKU y actualizar la foto principal.",
    choose: "Seleccionar carpeta o imagenes",
    running: "Subiendo imagenes...",
    noTenant: "Primero selecciona una empresa.",
    noProducts: "Primero carga productos para poder cruzar las imagenes por codigo.",
    noFiles: "No se seleccionaron imagenes.",
    doneTitle: "Imagenes actualizadas",
    done: (uploaded, total) => `${uploaded.toLocaleString()} de ${total.toLocaleString()} imagenes se actualizaron correctamente.`,
    failed: "Errores",
    unmatched: "Sin coincidencia",
    matched: "Coincidentes",
    uploaded: "Actualizadas",
    selected: "Archivos",
    pending: "Pendiente",
    note: "Tip: si el archivo se llama RJDP001.jpg, se actualiza el producto con codigo RJDP001.",
  },
  en: {
    eyebrow: "Product images",
    title: "Upload photos by code",
    help: "Select the exported image folder. The system uses each file name to find the SKU and update the main photo.",
    choose: "Select folder or images",
    running: "Uploading images...",
    noTenant: "Select a company first.",
    noProducts: "Load products first so images can be matched by code.",
    noFiles: "No images were selected.",
    doneTitle: "Images updated",
    done: (uploaded, total) => `${uploaded.toLocaleString()} of ${total.toLocaleString()} images were updated successfully.`,
    failed: "Errors",
    unmatched: "Unmatched",
    matched: "Matched",
    uploaded: "Updated",
    selected: "Files",
    pending: "Pending",
    note: "Tip: if the file is named RJDP001.jpg, the product with code RJDP001 is updated.",
  },
};

export default function ProductImageImportPanel({ products = [], tenantId = "", onCompleted, onNotice, onStatus }) {
  const { language } = useLanguage();
  const text = copy[language] || copy.es;
  const inputRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [lastSummary, setLastSummary] = useState(null);

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    setLastSummary(null);

    if (!tenantId) {
      onNotice?.("warning", text.noTenant, text.noTenant);
      return;
    }
    if (!products.length) {
      onNotice?.("warning", text.noProducts, text.noProducts);
      return;
    }
    if (!files.length) {
      onNotice?.("warning", text.noFiles, text.noFiles);
      return;
    }

    setRunning(true);
    setProgress({ totalFiles: files.length, matched: 0, uploaded: 0, failed: 0, unmatched: [], processed: 0, totalJobs: 0 });
    onStatus?.(text.running);

    try {
      const summary = await importProductImagesByCode({
        files,
        products,
        tenantId,
        onProgress: setProgress,
      });
      setLastSummary(summary);
      onStatus?.(text.done(summary.uploaded, summary.matched));
      onNotice?.("success", text.doneTitle, text.done(summary.uploaded, summary.matched));
      await onCompleted?.(summary);
    } catch (error) {
      onStatus?.(error.message);
      onNotice?.("error", text.failed, error.message);
    } finally {
      setRunning(false);
    }
  };

  const current = progress || lastSummary;
  const processed = current?.processed ?? (current ? current.uploaded + current.failed : 0);
  const totalJobs = current?.totalJobs ?? current?.matched ?? 0;
  const percent = totalJobs ? Math.round((processed / totalJobs) * 100) : 0;

  return (
    <section className="admin-soft-panel compact-panel image-import-panel">
      <div className="image-import-header">
        <div>
          <span className="tool-eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p className="muted">{text.help}</p>
        </div>
        <button className="primary-button compact-action image-upload-action" type="button" onClick={() => inputRef.current?.click()} disabled={running}>
          <span aria-hidden="true">↑</span>
          {running ? text.running : text.choose}
        </button>
        <input
          ref={inputRef}
          className="visually-hidden-file"
          type="file"
          accept="image/*"
          multiple
          webkitdirectory=""
          directory=""
          onChange={handleFiles}
        />
      </div>

      <div className="image-import-metrics">
        <div><span>{text.selected}</span><strong>{(current?.totalFiles || 0).toLocaleString()}</strong></div>
        <div><span>{text.matched}</span><strong>{(current?.matched || 0).toLocaleString()}</strong></div>
        <div><span>{text.uploaded}</span><strong>{(current?.uploaded || 0).toLocaleString()}</strong></div>
        <div><span>{text.unmatched}</span><strong>{(current?.unmatched?.length || 0).toLocaleString()}</strong></div>
        <div><span>{text.failed}</span><strong>{(current?.failed || 0).toLocaleString()}</strong></div>
      </div>

      {running || lastSummary ? (
        <div className="image-import-progress" aria-label="Progreso de carga de imagenes">
          <span style={{ width: `${percent}%` }} />
        </div>
      ) : null}

      <p className="muted small-note">{text.note}</p>

      {lastSummary?.unmatched?.length ? (
        <details className="image-import-details">
          <summary>{text.unmatched}: {lastSummary.unmatched.length.toLocaleString()}</summary>
          <p>{lastSummary.unmatched.slice(0, 30).join(", ")}{lastSummary.unmatched.length > 30 ? "..." : ""}</p>
        </details>
      ) : null}

      {lastSummary?.errors?.length ? (
        <details className="image-import-details error">
          <summary>{text.failed}: {lastSummary.errors.length.toLocaleString()}</summary>
          <p>{lastSummary.errors.slice(0, 12).map((item) => `${item.file}: ${item.message}`).join(" | ")}</p>
        </details>
      ) : null}
    </section>
  );
}
