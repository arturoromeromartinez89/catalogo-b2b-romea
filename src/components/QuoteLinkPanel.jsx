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
      setStatus(`Error: ${error.message}`);
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
        <header className="modal-header">
          <div>
            <h2>Generar liga para cliente</h2>
            <p className="muted">{products.length.toLocaleString()} productos seleccionados</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>x</button>
        </header>
        <div className="catalog-tool-body">
          <label className="check-row">
            <input type="checkbox" checked={showPrice} onChange={(event) => setShowPrice(event.target.checked)} />
            Mostrar precio integrado
          </label>
          <label className="check-row">
            <input type="checkbox" checked={showWeight} onChange={(event) => setShowWeight(event.target.checked)} />
            Mostrar peso
          </label>
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
          {resultUrl ? (
            <div className="quote-link-result">
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
