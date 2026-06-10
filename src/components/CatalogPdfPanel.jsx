import { useState } from "react";
import ActionNotice from "./ActionNotice";
import { generateCatalogPdf } from "../utils/catalogPdfGenerator";

export default function CatalogPdfPanel({ products, company, clients = [], onClose }) {
  const [catalogName, setCatalogName] = useState("Catalogo seleccionado");
  const [recipientType, setRecipientType] = useState("cliente");
  const [clientId, setClientId] = useState("");
  const [showPrice, setShowPrice] = useState(true);
  const [showWeight, setShowWeight] = useState(true);
  const [visibleFields, setVisibleFields] = useState({
    description: true,
    line: true,
    family: false,
    group: false,
  });
  const [columns, setColumns] = useState(3);
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState(null);
  const [generating, setGenerating] = useState(false);

  const isProspect = (client) =>
    (client.type || "") === "prospecto" ||
    String(client.email || "").endsWith("@prospect.local") ||
    Boolean(client.badge_raw);
  const recipientOptions = clients.filter((client) => recipientType === "prospecto" ? isProspect(client) : !isProspect(client));
  const selectedClient = recipientOptions.find((client) => client.id === clientId) || null;
  const displayEmail = (email) => String(email || "").endsWith("@prospect.local") ? "" : email || "";
  const optionLabel = (client) =>
    [client.company, client.name, displayEmail(client.email), client.phone]
      .filter(Boolean)
      .join(" - ") || "Contacto sin nombre";
  const toggleField = (field) => {
    setVisibleFields((current) => ({ ...current, [field]: !current[field] }));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setStatus("Generando PDF...");
    try {
      const sizeMb = await generateCatalogPdf(
        products,
        {
          catalogName,
          showPrice,
          showWeight,
          columns,
          client: selectedClient,
          recipientType,
          visibleFields,
          onProgress: (stage, current, total) => {
            if (stage === "cover") setStatus("Preparando portada...");
            if (stage === "images") setStatus("Cargando imagenes del catalogo...");
            if (stage === "image" && total) setStatus(`Cargando imagenes ${current}/${total}...`);
            if (stage === "pages") setStatus("Armando paginas del catalogo...");
            if (stage === "download") setStatus("Descargando PDF...");
          },
        },
        company
      );
      const sizeText = Number.isFinite(sizeMb) ? ` Peso: ${sizeMb.toFixed(2)} MB.` : "";
      setStatus(`PDF generado correctamente.${sizeText}`);
      setNotice({ type: "success", title: "PDF generado", message: `El catalogo PDF se genero correctamente y ya se descargo.${sizeText}` });
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      setNotice({ type: "error", title: "No se pudo generar", message: `Error: ${error.message}` });
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
            <div>
              <span>PDF</span>
              <strong>Legible</strong>
            </div>
          </section>

          <section className="tool-section">
            <h3>1. Identificacion</h3>
            <label>
              Nombre del catalogo
              <input value={catalogName} onChange={(event) => setCatalogName(event.target.value)} />
            </label>
            <label>
              Tipo de destinatario
              <select value={recipientType} onChange={(event) => {
                setRecipientType(event.target.value);
                setClientId("");
              }}>
                <option value="cliente">Cliente</option>
                <option value="prospecto">Prospecto</option>
              </select>
            </label>
            <label>
              {recipientType === "prospecto" ? "Prospecto" : "Cliente"}
              <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
                <option value="">Sin {recipientType === "prospecto" ? "prospecto" : "cliente"} asignado</option>
                {recipientOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    {optionLabel(client)}
                  </option>
                ))}
              </select>
              {!recipientOptions.length ? (
                <small>No hay {recipientType === "prospecto" ? "prospectos" : "clientes"} registrados para esta empresa.</small>
              ) : null}
            </label>
          </section>

          <section className="tool-section">
            <h3>2. Informacion del producto</h3>
            <div className="tool-option-grid">
              <label className={`tool-switch ${visibleFields.description ? "active" : ""}`}>
                <input type="checkbox" checked={visibleFields.description} onChange={() => toggleField("description")} />
                <span>
                  <strong>Descripcion</strong>
                  <small>Muestra el nombre o descripcion comercial.</small>
                </span>
              </label>
              <label className={`tool-switch ${visibleFields.line ? "active" : ""}`}>
                <input type="checkbox" checked={visibleFields.line} onChange={() => toggleField("line")} />
                <span>
                  <strong>Linea</strong>
                  <small>Incluye la linea del producto.</small>
                </span>
              </label>
              <label className={`tool-switch ${visibleFields.family ? "active" : ""}`}>
                <input type="checkbox" checked={visibleFields.family} onChange={() => toggleField("family")} />
                <span>
                  <strong>Familia</strong>
                  <small>Incluye familia comercial.</small>
                </span>
              </label>
              <label className={`tool-switch ${visibleFields.group ? "active" : ""}`}>
                <input type="checkbox" checked={visibleFields.group} onChange={() => toggleField("group")} />
                <span>
                  <strong>Grupo</strong>
                  <small>Incluye grupo o subclasificacion.</small>
                </span>
              </label>
              <label className={`tool-switch ${showPrice ? "active" : ""}`}>
                <input type="checkbox" checked={showPrice} onChange={(event) => setShowPrice(event.target.checked)} />
                <span>
                  <strong>Mostrar precio</strong>
                  <small>Incluye precio integrado cuando exista.</small>
                </span>
              </label>
              <label className={`tool-switch ${showWeight ? "active" : ""}`}>
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
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
