import { useState } from "react";
import { createQuoteLink } from "../services/quoteLinkService";

export default function QuoteLinkPanel({ products, clients = [], profile, tenantId = "", onClose }) {
  const [showPrice, setShowPrice] = useState(true);
  const [showWeight, setShowWeight] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [clientId, setClientId] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const friendlyError = (message = "") => {
    if (message.includes("quote_links")) {
      return "Falta activar la tabla de ligas en Supabase. Ejecuta el archivo supabase/quote_links.sql en SQL Editor.";
    }
    return message;
  };

  const handleCreate = async () => {
    setSaving(true);
    setStatus("Generando liga...");
    try {
      const result = await createQuoteLink({
        products,
        showPrice,
        showWeight,
        expiresInDays,
        clientId,
        createdBy: profile?.id || null,
        tenantId,
      });
      setResultUrl(result.url);
      setStatus("Liga generada correctamente.");
    } catch (error) {
      setStatus(`Error: ${friendlyError(error.message)}`);
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!resultUrl) return;
    await navigator.clipboard.writeText(resultUrl);
    setStatus("Liga copiada.");
  };

  return (
    <div className="modal-backdrop">
      <section className="catalog-tool-panel">
        <header className="catalog-tool-header">
          <div>
            <span className="tool-eyebrow">Cotizacion publica</span>
            <h2>Generar liga para cliente</h2>
            <p>Comparte una liga privada para que el cliente capture cantidades sin iniciar sesion.</p>
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
              <span>Vigencia</span>
              <strong>{expiresInDays || 30} dias</strong>
            </div>
          </section>

          <section className="tool-section">
            <h3>1. Informacion visible</h3>
            <div className="tool-option-grid">
              <label className="tool-switch">
                <input type="checkbox" checked={showPrice} onChange={(event) => setShowPrice(event.target.checked)} />
                <span>
                  <strong>Precio integrado</strong>
                  <small>El cliente ve labor + plata fina como un solo precio.</small>
                </span>
              </label>
              <label className="tool-switch">
                <input type="checkbox" checked={showWeight} onChange={(event) => setShowWeight(event.target.checked)} />
                <span>
                  <strong>Peso por pieza</strong>
                  <small>Muestra gramos promedio para cada producto.</small>
                </span>
              </label>
            </div>
          </section>

          <section className="tool-section">
            <h3>2. Datos de la liga</h3>
            <div className="tool-form-grid">
              <label>
                Expira en dias
                <input type="number" min="1" max="120" value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} />
              </label>
              <label>
                Cliente asociado opcional
                <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
                  <option value="">Sin cliente asociado</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.company || client.name} - {client.email}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {resultUrl ? (
            <div className="quote-link-result">
              <strong>Liga lista para enviar</strong>
              <span>{resultUrl}</span>
              <button className="secondary-button compact-action" type="button" onClick={copyLink}>Copiar liga</button>
            </div>
          ) : null}
          {status ? <p className="status info">{status}</p> : null}
        </div>
        <footer className="modal-actions">
          <button className="secondary-button compact-action" type="button" onClick={onClose}>Cerrar</button>
          <button className="primary-button compact-action" type="button" onClick={handleCreate} disabled={saving}>
            {saving ? "Generando..." : "Generar liga"}
          </button>
        </footer>
      </section>
    </div>
  );
}
