import { useEffect, useMemo, useState } from "react";
import BrandLogo from "../components/BrandLogo";
import LanguageToggle from "../components/LanguageToggle";
import { useCompany } from "../contexts/CompanyContext";
import { fetchQuoteLinkByToken, submitQuoteLinkSelection } from "../services/quoteLinkService";
import { buildPlaceholderUrl, formatCurrency, formatWeight, shortText } from "../utils/formatters";

const readToken = () => {
  const match = window.location.pathname.match(/\/cotizacion\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};

export default function QuotePage() {
  const company = useCompany();
  const token = readToken();
  const [quote, setQuote] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [customer, setCustomer] = useState({ name: "", company: "", email: "", phone: "", rfc: "" });
  const [status, setStatus] = useState("Cargando cotizacion...");
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState("");

  useEffect(() => {
    fetchQuoteLinkByToken(token)
      .then((data) => {
        setQuote(data);
        setStatus("");
      })
      .catch(() => setStatus("La liga no existe o ya expiro."));
  }, [token]);

  const products = Array.isArray(quote?.products) ? quote.products : [];
  const selectedItems = useMemo(
    () => products
      .map((product) => ({ product, quantity: Number(quantities[product.codigo] || 0) }))
      .filter((item) => item.quantity > 0),
    [products, quantities]
  );

  const setQuantity = (code, value) => {
    setQuantities((current) => ({ ...current, [code]: Math.max(0, Number(value || 0)) }));
  };

  const submit = async () => {
    if (!customer.name && !customer.company) {
      setStatus("Captura nombre o empresa para enviar la seleccion.");
      return;
    }
    if (!customer.email && !customer.phone) {
      setStatus("Captura correo o telefono para poder contactarte.");
      return;
    }
    if (!selectedItems.length) {
      setStatus("Selecciona al menos una pieza.");
      return;
    }
    setSubmitting(true);
    setStatus("Enviando seleccion...");
    try {
      const id = await submitQuoteLinkSelection({ token, customer, items: selectedItems });
      setSubmittedId(id);
      setStatus("Seleccion enviada correctamente. ROMEA revisara disponibilidad y precio final.");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!quote && status) {
    return <section className="quote-public-screen"><div className="setup-card">{status}</div></section>;
  }

  return (
    <div className="quote-public-screen">
      <header className="quote-public-header">
        <div>
          <BrandLogo />
          <p>{company.brand_name || "Catalogo B2B"}</p>
        </div>
        <LanguageToggle />
      </header>

      <main className="quote-public-main">
        <section className="quote-public-title">
          <p className="eyebrow">Cotizacion seleccionada</p>
          <h1>Selecciona cantidades</h1>
          <span>{products.length.toLocaleString()} productos disponibles en esta liga.</span>
        </section>

        <section className="quote-public-grid">
          {products.map((product) => (
            <article className="quote-public-card" key={product.codigo}>
              <img
                src={product.fotoUrl || buildPlaceholderUrl()}
                alt={product.descripcion}
                onError={(event) => { event.currentTarget.src = buildPlaceholderUrl(); }}
              />
              <div>
                <strong>{product.codigo}</strong>
                <h3>{shortText(product.descripcion, 78)}</h3>
                <p>{[product.metal, product.kilataje, quote.show_weight ? formatWeight(product.pesoPromedio) : ""].filter(Boolean).join(" / ")}</p>
                {quote.show_price ? <span>{product.precioMinimo ? formatCurrency(product.precioMinimo, product.monedaPrecioMin) : "Precio por confirmar"}</span> : null}
              </div>
              <label>
                Cantidad
                <input type="number" min="0" value={quantities[product.codigo] || ""} onChange={(event) => setQuantity(product.codigo, event.target.value)} />
              </label>
            </article>
          ))}
        </section>

        <section className="quote-public-form">
          <h2>Enviar mi seleccion</h2>
          <div className="form-grid">
            <input placeholder="Nombre" value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} />
            <input placeholder="Empresa" value={customer.company} onChange={(event) => setCustomer({ ...customer, company: event.target.value })} />
            <input placeholder="Correo" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} />
            <input placeholder="Telefono" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} />
          </div>
          {status ? <p className="status info">{status}</p> : null}
          {submittedId ? <p className="status success">Folio interno creado. Gracias.</p> : null}
          <button className="primary-button compact-action" type="button" onClick={submit} disabled={submitting || Boolean(submittedId)}>
            {submitting ? "Enviando..." : "Enviar mi seleccion"}
          </button>
        </section>
      </main>
    </div>
  );
}
