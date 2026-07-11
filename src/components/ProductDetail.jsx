import { useEffect, useMemo, useState } from "react";
import { buildPlaceholderUrl, formatCurrency, formatWeight, imageUrlForSize } from "../utils/formatters";
import { useLanguage } from "../i18n/LanguageContext";
import { getCatalogTerminology } from "../utils/catalogTerminology";
import {
  getEstuchesDisplayCode,
  getEstuchesDisplayDescription,
  getEstuchesPackageLabel,
  isEstuchesChavezCatalogExperience,
} from "../config/estuchesChavezCatalog";

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
  showPrice = true,
  estuchesChavezMode: estuchesChavezModeProp = false,
}) {
  const { t, language } = useLanguage();
  const [selectedImage, setSelectedImage] = useState(product?.fotoUrl || "");
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [quantity, setQuantity] = useState(1);
  const terminology = useMemo(() => getCatalogTerminology(product ? [product] : [], language), [product, language]);

  const images = useMemo(
    () => [product?.fotoUrl, product?.fotoUrl2, product?.fotoUrl3].filter(Boolean),
    [product]
  );

  useEffect(() => {
    setSelectedImage(product?.fotoUrl || "");
    setIsZoomed(false);
    setZoomOrigin({ x: 50, y: 50 });
  }, [product?.codigo, product?.fotoUrl]);

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
  const activeImage = selectedImage || images[0] || "";
  const estuchesChavezMode = estuchesChavezModeProp || isEstuchesChavezCatalogExperience();
  const displayCode = estuchesChavezMode ? getEstuchesDisplayCode(product) : product.codigo;
  const displayDescription = estuchesChavezMode ? getEstuchesDisplayDescription(product) : product.descripcion;
  const packageLabel = estuchesChavezMode ? getEstuchesPackageLabel(product) : "";

  const updateZoomOrigin = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    setZoomOrigin({ x, y });
  };

  const toggleZoom = (event) => {
    updateZoomOrigin(event);
    setIsZoomed((current) => !current);
  };

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
          <div
            className={`detail-main-image${isZoomed ? " is-zoomed" : ""}`}
            onClick={toggleZoom}
            onPointerMove={(event) => {
              if (isZoomed) updateZoomOrigin(event);
            }}
            style={{
              "--zoom-x": `${zoomOrigin.x}%`,
              "--zoom-y": `${zoomOrigin.y}%`,
            }}
          >
            <img
              src={mainImage}
              alt={displayDescription || displayCode}
              decoding="async"
              draggable="false"
              onError={(event) => {
                event.currentTarget.src = buildPlaceholderUrl(t("noPhoto"));
              }}
            />
            <button
              aria-label={isZoomed ? "Alejar imagen" : "Acercar imagen"}
              className="detail-zoom-button"
              onClick={(event) => {
                event.stopPropagation();
                setIsZoomed((current) => !current);
              }}
              title={isZoomed ? "Alejar imagen" : "Acercar imagen"}
              type="button"
            >
              {isZoomed ? "-" : "+"}
            </button>
          </div>
          {images.length > 1 ? (
            <div className="thumb-list">
              {images.map((image) => (
                <button
                  className={image === activeImage ? "active" : ""}
                  key={image}
                  type="button"
                  onClick={() => {
                    setSelectedImage(image);
                    setIsZoomed(false);
                    setZoomOrigin({ x: 50, y: 50 });
                  }}
                >
                  <img
                    src={imageUrlForSize(image, 160) || buildPlaceholderUrl(t("noPhoto"))}
                    alt={displayCode}
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
          <h2>{displayDescription}</h2>
          <div className="detail-code">{displayCode}</div>
          {!estuchesChavezMode && product.modelo ? <p className="detail-model">{product.modelo}</p> : null}
          {packageLabel ? <p className="detail-model">{packageLabel}</p> : null}

          {showPrice ? (
            <div className="detail-price">
              {product.precioMinimo ? formatCurrency(product.precioMinimo, product.monedaPrecioMin) : t("priceToConfirm")}
            </div>
          ) : null}

          <dl className="detail-specs">
            <div><dt>{terminology.metal || t("metal")}</dt><dd>{product.metal || "-"}</dd></div>
            <div><dt>{terminology.kilataje || t("karat")}</dt><dd>{product.kilataje || "-"}</dd></div>
            <div><dt>{terminology.linea || t("line")}</dt><dd>{product.linea || "-"}</dd></div>
            <div><dt>{terminology.familia || t("family")}</dt><dd>{product.familia || "-"}</dd></div>
            <div><dt>{terminology.grupo || t("group")}</dt><dd>{product.grupo || "-"}</dd></div>
            <div><dt>{t("gender")}</dt><dd>{product.genero || "-"}</dd></div>
            <div><dt>{t("finish")}</dt><dd>{product.acabado || "-"}</dd></div>
            <div><dt>{t("stone")}</dt><dd>{product.piedra || "-"}</dd></div>
            <div><dt>{t("size")}</dt><dd>{product.medida || "-"}</dd></div>
            <div><dt>{terminology.avgWeight || t("avgWeight")}</dt><dd>{formatWeight(product.pesoPromedio)}</dd></div>
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
