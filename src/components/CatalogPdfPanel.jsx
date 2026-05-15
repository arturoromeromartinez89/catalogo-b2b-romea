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
        <header className="catalog-tool-header">
          <div>
            <span className="tool-eyebrow">Catalogo para enviar</span>
            <h2>Generar catalogo PDF</h2>
            <p>Arma un PDF limpio con los productos seleccionados y la informacion que quieras mostrar.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>x</button>
        </header>
        <div className="catalog-tool-body">
          <section className="tool-summary-strip">
            <div>
              <span>Seleccionados</span>
              <strong>{products.length.toLocaleString()}</strong>
            </div>
            <div>
              <span>Formato</span>
              <strong>{columns} columnas</strong>
            </div>
          </section>

          <section className="tool-section">
            <h3>1. Identificacion</h3>
            <label>
              Nombre del catalogo
              <input value={catalogName} onChange={(event) => setCatalogName(event.target.value)} />
            </label>
          </section>

          <section className="tool-section">
            <h3>2. Informacion del producto</h3>
            <div className="tool-option-grid">
              <label className="tool-switch">
                <input type="checkbox" checked={showPrice} onChange={(event) => setShowPrice(event.target.checked)} />
                <span>
                  <strong>Mostrar precio</strong>
                  <small>Incluye precio integrado cuando exista.</small>
                </span>
              </label>
              <label className="tool-switch">
                <input type="checkbox" checked={showWeight} onChange={(event) => setShowWeight(event.target.checked)} />
                <span>
                  <strong>Mostrar peso</strong>
                  <small>Incluye gramos promedio por pieza.</small>
                </span>
              </label>
            </div>
          </section>

          <section className="tool-section">
            <h3>3. Distribucion</h3>
            <div className="segmented-control">
              {[2, 3, 4].map((value) => (
                <button
                  key={value}
                  className={columns === value ? "active" : ""}
                  type="button"
                  onClick={() => setColumns(value)}
                >
                  {value} columnas
                </button>
              ))}
            </div>
          </section>
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
