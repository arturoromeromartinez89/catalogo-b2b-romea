import PdfButton from "./PdfButton";
import { useLanguage } from "../i18n/LanguageContext";
import { useCompany } from "../contexts/CompanyContext";
import { calculateCartTotals } from "../utils/filters";
import { formatCurrency, formatWeight, shortText } from "../utils/formatters";

const generalFields = [
  ["serie", "series", "PRE"],
  ["numero", "number", "automatic"],
  ["name", "customer", "customerName"],
  ["company", "company", "company"],
  ["branch", "branch", "branch"],
  ["currency", "currency", "currency"],
  ["tipoCambio", "exchangeRate", "exchangeRate"],
  ["seller", "seller", "seller"],
  ["concept", "concept", "concept"],
  ["status", "status", "status"],
  ["phone", "phone", "phone"],
  ["email", "email", "email"],
  ["rfc", "rfc", "rfc"],
];

const shipFields = [
  ["shipToName", "recipient", "recipient"],
  ["shipToAddress", "address", "address"],
  ["shipToCity", "city", "city"],
  ["shipToState", "state", "state"],
  ["shipToZip", "zip", "zip"],
  ["shipToCountry", "country", "country"],
  ["shipToContact", "contact", "contact"],
  ["shipToPhone", "phone", "phone"],
];

const makeFolio = () => {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
};

export default function CartDrawer({
  isOpen,
  cartItems,
  customer,
  onCustomerChange,
  onQuantityChange,
  onRemove,
  onClear,
  onClose,
  onOpen,
}) {
  const { t } = useLanguage();
  const company = useCompany();
  const totals = calculateCartTotals(cartItems);
  const currency = customer.currency || cartItems[0]?.product.monedaPrecioMin || "MXN";
  const exchangeRate = Number(customer.tipoCambio || 0);
  const moneyValue = (value) => currency === "USD" && exchangeRate > 0 ? Number(value || 0) / exchangeRate : Number(value || 0);
  const subtotal = totals.amount;
  const discount = 0;
  const iva = 0;
  const total = subtotal - discount + iva;
  const folio = customer.numero || makeFolio();

  const updateCustomer = (key, value) => {
    onCustomerChange({ ...customer, [key]: value });
  };

  return (
    <>
      <button
        className="preorder-tab"
        type="button"
        onMouseEnter={onOpen}
        onClick={isOpen ? onClose : onOpen}
        aria-label={t("openPreorder")}
      >
        {t("preorder")}
      </button>

      {isOpen ? <button className="drawer-backdrop" type="button" aria-label={t("closePreorder")} onClick={onClose} /> : null}

      <aside className={`preorder-sheet ${isOpen ? "open" : ""}`} aria-hidden={!isOpen}>
        <header className="sheet-header">
          <div>
            <p className="eyebrow">{t("brand")}</p>
            <h2>{t("noteTitle")}</h2>
            <span>{t("folio")} {folio}</span>
          </div>
          <div className="sheet-brand">
            <strong>{company?.brand_name || "Mi Catálogo"}</strong>
            
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t("closePreorder")}>
            ×
          </button>
        </header>

        <div className="sheet-body">
          <section className="note-section">
            <div className="section-title-row">
              <h3>{t("generalData")}</h3>
              <span>{new Date().toLocaleString("es-MX")}</span>
            </div>
            <div className="note-grid general-grid">
              {generalFields.map(([key, labelKey, placeholderKey]) => (
                <label key={key}>
                  {t(labelKey)}
                  <input
                    value={key === "numero" ? folio : customer[key] || ""}
                    onChange={(event) => updateCustomer(key, event.target.value)}
                    placeholder={t(placeholderKey)}
                    readOnly={key === "numero"}
                  />
                </label>
              ))}
              <label className="wide">
                {t("notes")}
                <textarea
                  rows="2"
                  value={customer.notes || ""}
                  onChange={(event) => updateCustomer("notes", event.target.value)}
                  placeholder={t("notes")}
                />
              </label>
            </div>
          </section>

          <section className="note-section">
            <div className="section-title-row">
              <h3>{t("shipTo")}</h3>
            </div>
            <div className="note-grid ship-grid">
              {shipFields.map(([key, labelKey, placeholderKey]) => (
                <label key={key}>
                  {t(labelKey)}
                  <input
                    value={customer[key] || ""}
                    onChange={(event) => updateCustomer(key, event.target.value)}
                    placeholder={t(placeholderKey)}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="note-section products-note-section">
            <div className="section-title-row">
              <h3>{t("products")}</h3>
              <span>{totals.pieces} {t("pieces").toLowerCase()}</span>
            </div>
            <div className="order-table-wrap">
              <table className="order-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t("noPhoto")}</th>
                    <th>SKU</th>
                    <th>{t("pieces")}</th>
                    <th>{t("description")}</th>
                    <th>{t("unitWeight")}</th>
                    <th>{t("totalWeight")}</th>
                    <th>{t("laborPrice")}</th>
                    <th>{t("fineSilver")}</th>
                    <th>{t("integratedPrice")}</th>
                    <th>{t("unit")}</th>
                    <th>{t("discountPct")}</th>
                    <th>{t("amount")}</th>
                    <th>{t("delete")}</th>
                  </tr>
                </thead>
                <tbody>
                  {cartItems.length ? (
                    cartItems.map((item, index) => {
                      const product = item.product;
                      const quantity = Number(item.quantity || 0);
                      const grams = quantity * Number(product.pesoPromedio || 0);
                      const pricePerGram = Number(product.precioMinimo || product.quotePricePerGram || 0);
                      const laborPerGram = Number(product.quoteLaborPerGram || 0);
                      const fineSilver = Math.max(0, pricePerGram - laborPerGram);
                      const amount = grams * pricePerGram;
                      return (
                        <tr key={product.codigo}>
                          <td>{index + 1}</td>
                          <td>
                            <img
                              src={product.fotoUrl}
                              alt={product.codigo}
                              style={{ width: 42, height: 42, objectFit: "contain", borderRadius: 6 }}
                            />
                          </td>
                          <td><strong>{product.codigo}</strong></td>
                          <td>
                            <input
                              className="quantity-cell"
                              type="number"
                              min="1"
                              value={quantity}
                              onChange={(event) => onQuantityChange(product.codigo, event.target.value)}
                            />
                          </td>
                          <td>{shortText(product.descripcion, 92)}</td>
                          <td>{formatWeight(product.pesoPromedio)}</td>
                          <td>{formatWeight(grams)}</td>
                          <td>{laborPerGram ? formatCurrency(moneyValue(laborPerGram), currency) : "-"}</td>
                          <td>{fineSilver ? formatCurrency(moneyValue(fineSilver), currency) : "-"}</td>
                          <td>{pricePerGram ? formatCurrency(moneyValue(pricePerGram), currency) : "-"}</td>
                          <td>{product.unidadVenta || "Pza"}</td>
                          <td>0</td>
                          <td>{amount ? formatCurrency(moneyValue(amount), currency) : "-"}</td>
                          <td>
                            <button className="table-delete" type="button" onClick={() => onRemove(product.codigo)}>
                              {t("delete")}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="13" className="empty-row">{t("emptyPreorder")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <footer className="sheet-footer">
          <div className="note-totals">
            <div><span>{t("totalPieces")}</span><strong>{totals.pieces}</strong></div>
            <div><span>{t("totalGrams")}</span><strong>{formatWeight(totals.weight)}</strong></div>
            <div><span>{t("subtotal")}</span><strong>{subtotal ? formatCurrency(moneyValue(subtotal), currency) : "-"}</strong></div>
            <div><span>{t("discount")}</span><strong>{discount ? formatCurrency(moneyValue(discount), currency) : "-"}</strong></div>
            <div><span>{t("iva")}</span><strong>{iva ? formatCurrency(moneyValue(iva), currency) : "-"}</strong></div>
            <div><span>{t("total")}</span><strong>{total ? formatCurrency(moneyValue(total), currency) : "-"}</strong></div>
          </div>
          <div className="sheet-actions">
            <PdfButton cartItems={cartItems} customer={{ ...customer, numero: folio }} />
            <button className="secondary-button" type="button" onClick={onClear}>{t("clearPreorder")}</button>
            <button className="secondary-button" type="button" onClick={() => window.alert(t("savedPreorder"))}>
              {t("confirmPreorder")}
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
