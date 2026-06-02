import { useEffect, useMemo, useState } from "react";
import BrandLogo from "../components/BrandLogo";
import LanguageToggle from "../components/LanguageToggle";
import { useCompany } from "../contexts/CompanyContext";
import { useLanguage } from "../i18n/LanguageContext";
import { fetchCompanySettings } from "../services/companySettings";
import { fetchQuoteLinkByToken, submitQuoteLinkSelection } from "../services/quoteLinkService";
import { buildPlaceholderUrl, formatCurrency, formatWeight, imageUrlForSize, shortText } from "../utils/formatters";

const readToken = () => {
  const match = window.location.pathname.match(/\/cotizacion\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};

export default function QuotePage() {
  const { t } = useLanguage();
  const company = useCompany();
  const token = readToken();
  const [quote, setQuote] = useState(null);
  const [tenantCompany, setTenantCompany] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [customer, setCustomer] = useState({ name: "", company: "", email: "", phone: "", rfc: "" });
  const [status, setStatus] = useState(() => t("quoteLoading"));
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState("");

  useEffect(() => {
    fetchQuoteLinkByToken(token)
      .then((data) => {
        setQuote(data);
        setStatus("");
      })
      .catch(() => setStatus(t("quoteNotFound")));
  }, [token]);

  useEffect(() => {
    if (!quote?.tenant_id) {
      setTenantCompany(null);
      return;
    }
    fetchCompanySettings(quote.tenant_id).then(setTenantCompany).catch(() => setTenantCompany(null));
  }, [quote?.tenant_id]);

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
      setStatus(t("quoteValidateName"));
      return;
    }
    if (!customer.email && !customer.phone) {
      setStatus(t("quoteValidateContact"));
      return;
    }
    if (!selectedItems.length) {
      setStatus(t("quoteValidateItems"));
      return;
    }
    setSubmitting(true);
    setStatus(t("quoteSending"));
    try {
      const id = await submitQuoteLinkSelection({ token, customer, items: selectedItems });
      setSubmittedId(id);
      setStatus(t("quoteSentStatus"));
    } catch (error) {
      setStatus(`${t("quoteErrorPrefix")} ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!quote && status) {
    return <section className="quote-public-screen"><div className="setup-card">{status}</div></section>;
  }

  const activeCompany = quote?.tenant_id ? (tenantCompany || {}) : company;

  return (
    <div className="quote-public-screen">
      <header className="quote-public-header">
        <div>
          <BrandLogo company={activeCompany} />
          <p>{t("quoteHeader")}</p>
        </div>
        <LanguageToggle />
      </header>

      <main className="quote-public-main">
        <section className="quote-public-title">
          <p className="eyebrow">{t("quoteEyebrow")}</p>
          <h1>{t("quoteTitle")}</h1>
          <span>{t("quoteProductsAvailable", products.length.toLocaleString())}</span>
        </section>

        <section className="quote-public-grid">
          {products.map((product) => (
            <article className="quote-public-card" key={product.codigo}>
              <img
                src={imageUrlForSize(product.fotoUrl, 360) || buildPlaceholderUrl()}
                alt={product.descripcion}
                loading="lazy"
                decoding="async"
                onError={(event) => { event.currentTarget.src = buildPlaceholderUrl(); }}
              />
              <div>
                <strong>{product.codigo}</strong>
                <h3>{shortText(product.descripcion, 78)}</h3>
                <p>{[product.metal, product.kilataje, quote.show_weight ? formatWeight(product.pesoPromedio) : ""].filter(Boolean).join(" / ")}</p>
                {quote.show_price ? (
                  <span>
                    {product.precioMinimo
                      ? formatCurrency(product.precioMinimo, product.monedaPrecioMin)
                      : t("quotePriceToConfirm")}
                  </span>
                ) : null}
              </div>
              <label>
                {t("quoteQuantity")}
                <input
                  type="number"
                  min="0"
                  value={quantities[product.codigo] || ""}
                  onChange={(event) => setQuantity(product.codigo, event.target.value)}
                />
              </label>
            </article>
          ))}
        </section>

        <section className="quote-public-form">
          <h2>{t("quoteSendTitle")}</h2>
          <div className="form-grid">
            <input
              placeholder={t("quotePlaceholderName")}
              value={customer.name}
              onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
            />
            <input
              placeholder={t("quotePlaceholderCompany")}
              value={customer.company}
              onChange={(event) => setCustomer({ ...customer, company: event.target.value })}
            />
            <input
              placeholder={t("quotePlaceholderEmail")}
              value={customer.email}
              onChange={(event) => setCustomer({ ...customer, email: event.target.value })}
            />
            <input
              placeholder={t("quotePlaceholderPhone")}
              value={customer.phone}
              onChange={(event) => setCustomer({ ...customer, phone: event.target.value })}
            />
          </div>
          {status ? <p className="status info">{status}</p> : null}
          {submittedId ? <p className="status success">{t("quoteSentConfirm")}</p> : null}
          <button
            className="primary-button compact-action"
            type="button"
            onClick={submit}
            disabled={submitting || Boolean(submittedId)}
          >
            {submitting ? t("quoteSending") : t("quoteSendButton")}
          </button>
        </section>
      </main>
    </div>
  );
}
