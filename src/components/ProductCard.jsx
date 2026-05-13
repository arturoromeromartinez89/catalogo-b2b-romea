import { buildPlaceholderUrl, formatCurrency, formatWeight, shortText } from "../utils/formatters";
import { useLanguage } from "../i18n/LanguageContext";

export default function ProductCard({ product, onAdd, onOpenDetail }) {
  const { t } = useLanguage();
  const imageUrl = product.fotoUrl || buildPlaceholderUrl(t("noPhoto"));

  return (
    <article className="product-card">
      <button className="product-image-button" type="button" onClick={() => onOpenDetail(product.codigo)}>
        <img
          src={imageUrl}
          alt={product.descripcion || product.codigo}
          onError={(event) => {
                event.currentTarget.src = buildPlaceholderUrl(t("noPhoto"));
          }}
        />
      </button>
      <div className="product-info">
        <div className="product-code">{product.codigo}</div>
        <h3>{shortText(product.descripcion, 82)}</h3>
        <p className="product-brief">
          {[product.metal, product.kilataje, formatWeight(product.pesoPromedio)].filter(Boolean).join(" / ")}
        </p>
        <strong className="product-price">
          {product.precioMinimo ? formatCurrency(product.precioMinimo, product.monedaPrecioMin) : t("priceToConfirm")}
        </strong>
      </div>
      <div className="product-actions">
        <button className="secondary-button" type="button" onClick={() => onOpenDetail(product.codigo)}>
          {t("viewDetail")}
        </button>
        <button className="primary-button" type="button" onClick={() => onAdd(product)}>
          {t("addToPreorder")}
        </button>
      </div>
    </article>
  );
}
