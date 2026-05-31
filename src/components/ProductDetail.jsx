import { useMemo, useState } from "react";
import { buildPlaceholderUrl, formatCurrency, formatWeight, imageUrlForSize } from "../utils/formatters";
import { useLanguage } from "../i18n/LanguageContext";

export default function ProductDetail({
  product,
  onBack,
  onAdd,
  onRemovePreorder,
  onAddToCatalog,
  onRemoveFromCatalog,
  inPreorder = false,
  inCatalogSelection = false,
  onEdit,
  onDuplicate,
}) {
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

  const mainImage = imageUrlForSize(selectedImage || images[0], 1200) || buildPlaceholderUrl(t("noPhoto"));

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
              decoding="async"
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
                  <img
                    src={imageUrlForSize(image, 160) || buildPlaceholderUrl(t("noPhoto"))}
                    alt={product.codigo}
                    loading="lazy"
                    decoding="async"
                  />
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

          <div className="detail-buy-box detail-action-panel">
            <label>
              {t("quantity")}
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value || 1)))}
              />
            </label>
            <div className="detail-action-grid">
              <button
                className={`action-button preorder ${inPreorder ? "done" : ""}`}
                type="button"
                onClick={() => onAdd(product, quantity)}
                disabled={inPreorder}
              >
                {t("addPreorderShort")}
              </button>
              {inPreorder ? (
                <button className="action-button undo" type="button" onClick={() => onRemovePreorder?.(product.codigo)}>
                  {t("undoPreorder")}
                </button>
              ) : null}
              {onAddToCatalog ? (
                <button
                  className={`action-button catalog ${inCatalogSelection ? "done" : ""}`}
                  type="button"
                  onClick={() => onAddToCatalog(product)}
                  disabled={inCatalogSelection}
                >
                  {t("addCatalogShort")}
                </button>
              ) : null}
              {onRemoveFromCatalog && inCatalogSelection ? (
                <button className="action-button undo" type="button" onClick={() => onRemoveFromCatalog?.(product.codigo)}>
                  {t("undoCatalog")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
