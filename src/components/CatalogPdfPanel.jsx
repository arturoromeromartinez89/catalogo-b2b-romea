import { useState } from "react";
import { generateCatalogPdf } from "../utils/catalogPdfGenerator";

export default function CatalogPdfPanel({ products, company, onClose }) {
  const [catalogName, setCatalogName] = useState("Catalogo ROMEA");
  const [showPrice, setShowPrice] = useState(true);
  const [showWeight, setShowWeight] = useState(true);
  const [columns, setColumns] = useState(3);
  const [status, setStatus] = useState("");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    setStatus("Generando PDF...");
    try {
      await generateCatalogPdf(products, { catalogName, showPrice, showWeight, columns }, company);
      setStatus("PDF generado correctamente.");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <section className="catalog-tool-panel">
        <header className="modal-header">
          <div>
            <h2>Generar catalogo PDF</h2>
            <p className="muted">{products.length.toLocaleString()} productos seleccionados</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>x</button>
        </header>
        <div className="catalog-tool-body">
          <label>
            Nombre del catalogo
            <input value={catalogName} onChange={(event) => setCatalogName(event.target.value)} />
          </label>
          <label className="check-row">
            <input type="checkbox" checked={showPrice} onChange={(event) => setShowPrice(event.target.checked)} />
            Mostrar precio
          </label>
          <label className="check-row">
            <input type="checkbox" checked={showWeight} onChange={(event) => setShowWeight(event.target.checked)} />
            Mostrar peso
          </label>
          <label>
            Columnas por fila
            <select value={columns} onChange={(event) => setColumns(Number(event.target.value))}>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>
          {status ? <p className="status info">{status}</p> : null}
        </div>
        <footer className="modal-actions">
          <button className="secondary-button compact-action" type="button" onClick={onClose}>Cerrar</button>
          <button className="primary-button compact-action" type="button" onClick={handleGenerate} disabled={generating}>
            {generating ? "Generando..." : "Generar PDF"}
          </button>
        </footer>
      </section>
    </div>
  );
}
