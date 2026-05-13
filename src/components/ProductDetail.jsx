import { useMemo, useState } from "react";
import { buildPlaceholderUrl, formatCurrency, formatWeight } from "../utils/formatters";
import { useLanguage } from "../i18n/LanguageContext";

export default function ProductDetail({ product, onBack, onAdd, onEdit, onDuplicate }) {
  const { t } = useLanguage();
  const [selectedImage, setSelectedImage] = useState(product?.fotoUrl || "");
  const [quantity, setQuantity] = useState(1);

  const images = useMemo(
    () => [product?.fotoUrl, product?.fotoUrl2, product?.fotoUrl3].filter(Boolean),
    [product]
  );

  if (!product) {
    return (
      <section className="product-detail empty-state">
        <h2>{t("productNotFound")}</h2>
        <p>{t("productNotFoundText")}</p>
        <button className="primary-button" type="button" onClick={onBack}>
          {t("backToCatalog")}
        </button>
      </section>
    );
  }

  const mainImage = selectedImage || images[0] || buildPlaceholderUrl(t("noPhoto"));

  return (
    <section className="product-detail">
      <div className="detail-toolbar">
        <button className="secondary-button" type="button" onClick={onBack}>
          {t("backToCatalog")}
        </button>
        {onEdit ? (
          <button className="secondary-button" type="button" onClick={() => onEdit(product)}>
            {t("editProduct")}
          </button>
        ) : null}
        {onDuplicate ? (
          <button className="secondary-button" type="button" onClick={() => onDuplicate(product)}>
            {t("duplicateProduct")}
          </button>
        ) : null}
      </div>

      <div className="detail-layout">
        <div className="detail-gallery">
          <div className="detail-main-image">
            <img
              src={mainImage}
              alt={product.descripcion || product.codigo}
              onError={(event) => {
                event.currentTarget.src = buildPlaceholderUrl(t("noPhoto"));
              }}
            />
          </div>
          {images.length > 1 ? (
            <div className="thumb-list">
              {images.map((image) => (
                <button
                  className={image === mainImage ? "active" : ""}
                  key={image}
                  type="button"
                  onClick={() => setSelectedImage(image)}
                >
                  <img src={image} alt={product.codigo} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="detail-info">
          <p className="eyebrow">{t("productDetail")}</p>
          <h2>{product.descripcion}</h2>
          <div className="detail-code">{product.codigo}</div>
          {product.modelo ? <p className="detail-model">{product.modelo}</p> : null}

          <div className="detail-price">
            {product.precioMinimo ? formatCurrency(product.precioMinimo, product.monedaPrecioMin) : t("priceToConfirm")}
          </div>

          <dl className="detail-specs">
            <div><dt>{t("metal")}</dt><dd>{product.metal || "-"}</dd></div>
            <div><dt>{t("karat")}</dt><dd>{product.kilataje || "-"}</dd></div>
            <div><dt>{t("line")}</dt><dd>{product.linea || "-"}</dd></div>
            <div><dt>{t("family")}</dt><dd>{product.familia || "-"}</dd></div>
            <div><dt>{t("group")}</dt><dd>{product.grupo || "-"}</dd></div>
            <div><dt>{t("gender")}</dt><dd>{product.genero || "-"}</dd></div>
            <div><dt>{t("finish")}</dt><dd>{product.acabado || "-"}</dd></div>
            <div><dt>{t("stone")}</dt><dd>{product.piedra || "-"}</dd></div>
            <div><dt>{t("size")}</dt><dd>{product.medida || "-"}</dd></div>
            <div><dt>{t("avgWeight")}</dt><dd>{formatWeight(product.pesoPromedio)}</dd></div>
          </dl>

          {product.tagsBusqueda ? (
            <div className="tag-box">
              <span>{t("tags")}</span>
              <p>{product.tagsBusqueda}</p>
            </div>
          ) : null}

          <div className="detail-buy-box">
            <label>
              {t("quantity")}
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value || 1)))}
              />
            </label>
            <button className="primary-button full" type="button" onClick={() => onAdd(product, quantity)}>
              {t("addToPreorder")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
