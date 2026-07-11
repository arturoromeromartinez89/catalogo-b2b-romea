import ProductDetail from "../ProductDetail";
import { isConfigurableProductGroup } from "../../utils/configurableCatalog";
import { buildPlaceholderUrl, formatCurrency, formatWeight, imageUrlForSize, shortText } from "../../utils/formatters";
import { PRODUCT_CARD_FIELDS } from "../../services/interfaceSettingsService";
import {
  getEstuchesDisplayCode,
  getEstuchesDisplayDescription,
  getEstuchesPackageLabel,
} from "../../config/estuchesChavezCatalog";

const PRODUCT_RENDER_BATCH = 60; // debe coincidir con AdminDashboard

export default function CatalogTab({
  t,
  selectedProductCode,
  setSelectedProductCode,
  selectedProduct,
  filteredProducts,
  renderedProducts,
  allRenderedChecked,
  allFilteredChecked,
  addedCodes,
  checkedIds,
  catalogSelectionIds,
  visibleProductLimit,
  setVisibleProductLimit,
  toggleRenderedChecks,
  toggleFilteredChecks,
  addCheckedToCatalogSelection,
  addCheckedToPreorder,
  addToCart,
  removeFromPreorder,
  addToCatalogSelection,
  removeFromCatalogSelection,
  setProductModal,
  toggleProductCheck,
  interfaceSettings,
  estuchesCategoryMode = false,
  catalogDisplayMode = "full",
  onCatalogDisplayModeChange,
  categoryCards = [],
  selectedCategory = null,
  onSelectCategory,
  onClearCategory,
  showCategoryLanding = false,
  outsideCategoryMatchCount = 0,
  searchBar,
  filterBar,   // Barra de filtros inline — pasada desde AdminDashboard
}) {
  const isSelectedConfigurable = isConfigurableProductGroup(selectedProduct);
  const selectedInCatalog = isSelectedConfigurable
    ? (selectedProduct?.variants || []).some((variant) => catalogSelectionIds.has(variant.product?.codigo))
    : catalogSelectionIds.has(selectedProduct?.codigo);
  const isSummaryMode = estuchesCategoryMode && catalogDisplayMode === "summary";
  const showCatalogControls = !showCategoryLanding;

  return (
    <section className="admin-workspace">
      {!selectedProductCode ? (
        <div className="catalog-page-topbar">
          <div className="catalog-topbar-title">
            <h2>Catálogo administrador</h2>
            <p>
              {showCategoryLanding
                ? `${categoryCards.length.toLocaleString()} categorías disponibles`
                : t("showingFiltered", renderedProducts.length.toLocaleString(), filteredProducts.length.toLocaleString())}
            </p>
          </div>
          {searchBar && !showCategoryLanding ? (
            <div className="catalog-topbar-search">
              {searchBar}
            </div>
          ) : null}
          <div className="catalog-topbar-actions">
            {estuchesCategoryMode ? (
              <div className="catalog-view-toggle" role="group" aria-label="Vista de catálogo">
                <button
                  type="button"
                  className={isSummaryMode ? "active" : ""}
                  onClick={() => onCatalogDisplayModeChange?.("summary")}
                >
                  Versión resumida
                </button>
                <button
                  type="button"
                  className={!isSummaryMode ? "active" : ""}
                  onClick={() => onCatalogDisplayModeChange?.("full")}
                >
                  Vista completa
                </button>
              </div>
            ) : null}
            {showCatalogControls ? (
            <label className="check-row catalog-select-visible">
              <input type="checkbox" checked={allRenderedChecked} onChange={toggleRenderedChecks} />
              Seleccionar pantalla ({renderedProducts.length.toLocaleString()})
            </label>
            ) : null}
            {showCatalogControls && filteredProducts.length > renderedProducts.length ? (
              <button
                className={`selection-action all-filtered ${allFilteredChecked ? "selected" : ""}`}
                type="button"
                onClick={toggleFilteredChecks}
              >
                {allFilteredChecked
                  ? "Quitar todos filtrados"
                  : `Seleccionar todos filtrados (${filteredProducts.length.toLocaleString()})`}
              </button>
            ) : null}
            {showCatalogControls ? (
            <button className="selection-action catalog" type="button" onClick={addCheckedToCatalogSelection} disabled={!checkedIds.size}>
              + Catalogo
            </button>
            ) : null}
            {showCatalogControls ? (
            <button className="selection-action preorder" type="button" onClick={addCheckedToPreorder} disabled={!checkedIds.size}>
              + Pre-orden
            </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showCatalogControls ? filterBar : null}

      {selectedProductCode ? (
        <ProductDetail
          product={selectedProduct}
          onBack={() => setSelectedProductCode("")}
          onAdd={addToCart}
          onRemovePreorder={removeFromPreorder}
          onAddToCatalog={addToCatalogSelection}
          onRemoveFromCatalog={removeFromCatalogSelection}
          inPreorder={isSelectedConfigurable ? false : addedCodes.includes(selectedProduct?.codigo)}
          inCatalogSelection={selectedInCatalog}
          onEdit={isSelectedConfigurable ? null : (product) => setProductModal({ open: true, product, mode: "edit" })}
          onDuplicate={isSelectedConfigurable ? null : (product) => setProductModal({ open: true, product, mode: "duplicate" })}
          estuchesChavezMode={estuchesCategoryMode}
        />
      ) : showCategoryLanding ? (
        <section className="estuches-category-landing estuches-category-landing--admin">
          <div className="estuches-category-titlebar">
            <p className="eyebrow">Versión resumida</p>
            <h2>Categorías</h2>
            <span>Abre una categoría para ver y administrar sus productos.</span>
          </div>
          <div className="estuches-category-grid">
            {categoryCards.map((category) => (
              <article className="estuches-category-card" key={category.key}>
                <button
                  type="button"
                  className="estuches-category-open"
                  onClick={() => onSelectCategory?.(category.key)}
                >
                  <div className="estuches-category-media" aria-hidden="true">
                    {category.products?.length ? (
                      <div className="estuches-category-collage">
                        {category.products.map((product, index) => (
                          <span key={product.id || product.codigo || index}>
                            <img
                              src={imageUrlForSize(product.fotoUrl, 220) || buildPlaceholderUrl(t("noPhoto"))}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              onError={(event) => { event.currentTarget.src = buildPlaceholderUrl(t("noPhoto")); }}
                            />
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="estuches-category-empty-image">Sin foto</div>
                    )}
                  </div>
                  <strong>{category.label}</strong>
                  <small>{category.count.toLocaleString()} producto{category.count !== 1 ? "s" : ""}</small>
                  <span className="estuches-category-cta">+ Ver mas</span>
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : filteredProducts.length ? (
        <>
          {selectedCategory && isSummaryMode ? (
            <div className="estuches-category-header">
              <div>
                <p className="eyebrow">Versión resumida</p>
                <h2>{selectedCategory.label}</h2>
                <span>{filteredProducts.length.toLocaleString()} producto{filteredProducts.length !== 1 ? "s" : ""} visible{filteredProducts.length !== 1 ? "s" : ""}</span>
              </div>
              <button type="button" className="secondary-button compact-action" onClick={() => onClearCategory?.()}>
                Volver a categorías
              </button>
            </div>
          ) : null}
          {outsideCategoryMatchCount ? (
            <div className="estuches-category-notice">
              Hay {outsideCategoryMatchCount.toLocaleString()} producto{outsideCategoryMatchCount !== 1 ? "s" : ""} que coincide{outsideCategoryMatchCount !== 1 ? "n" : ""}, pero pertenece{outsideCategoryMatchCount !== 1 ? "n" : ""} a otra categoría.
            </div>
          ) : null}
          <div className="admin-product-grid">
            {renderedProducts.map((product) => {
              const isConfigurable = isConfigurableProductGroup(product);
              const isRingSizeGroup = product.configurableType === "ring_size";
              const inPreorder = isConfigurable ? false : addedCodes.includes(product.codigo);
              const inCatalogSelection = isConfigurable
                ? (product.variants || []).some((variant) => catalogSelectionIds.has(variant.product?.codigo))
                : catalogSelectionIds.has(product.codigo);
              const priceText = product.precioMinimo
                ? formatCurrency(product.precioMinimo, product.monedaPrecioMin)
                : t("priceToConfirm");
              const customCardEnabled = interfaceSettings?.hasCustomSettings && !isConfigurable;
              const cardConfig = interfaceSettings?.admin_product_card_config || {};
              const visibleButtons = new Set(cardConfig.buttons || []);
              const displayCode = estuchesCategoryMode ? getEstuchesDisplayCode(product) : product.codigo;
              const displayDescription = estuchesCategoryMode ? getEstuchesDisplayDescription(product) : product.descripcion;
              const packageLabel = estuchesCategoryMode ? getEstuchesPackageLabel(product) : "";
              const productFieldValue = (fieldKey) => {
                if (fieldKey === "codigo") return displayCode;
                if (fieldKey === "descripcion") return shortText(displayDescription, 72);
                if (fieldKey === "metal") return product.metal;
                if (fieldKey === "kilataje") return product.kilataje;
                if (fieldKey === "peso") return formatWeight(product.pesoPromedio);
                if (fieldKey === "precio") return priceText;
                if (fieldKey === "mano_obra") return `MO ${formatCurrency(product.manoObra || 0, product.monedaPrecioMin)}`;
                if (fieldKey === "linea") return product.linea;
                if (fieldKey === "familia") return product.familia;
                if (fieldKey === "grupo") return product.grupo;
                return "";
              };
              const renderedFields = (cardConfig.fields || [])
                .map((fieldKey) => ({
                  key: fieldKey,
                  label: PRODUCT_CARD_FIELDS.find((field) => field.key === fieldKey)?.label || fieldKey,
                  value: productFieldValue(fieldKey),
                }))
                .filter((field) => field.value);
              const safeRenderedFields = renderedFields.length
                ? renderedFields
                : [{ key: "codigo", label: "Codigo", value: displayCode }];

              return (
                <article
                  className={`admin-product-card enabled ${customCardEnabled ? `tenant-theme-${interfaceSettings.visual_theme_key || "ejecutivo"}` : ""} ${inPreorder ? "in-preorder" : ""} ${isConfigurable ? "configurable-card" : ""} ${product.fotoUrl ? "" : "no-photo"}`}
                  key={product.id || product.codigo}
                >
                  <label className="product-select-check" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checkedIds.has(product.codigo)}
                      onChange={() => toggleProductCheck(product.codigo)}
                    />
                  </label>
                  {inPreorder ? <span className="preorder-added-badge">En preorden</span> : null}
                  {inCatalogSelection ? <span className="catalog-added-badge">Catalogo</span> : null}
                  {product.fotoUrl ? (
                    <button className="admin-product-image" type="button" onClick={() => setSelectedProductCode(product.codigo)}>
                      <img
                        src={imageUrlForSize(product.fotoUrl, 360)}
                        alt={displayDescription}
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                        onError={(event) => { event.currentTarget.src = buildPlaceholderUrl(t("noPhoto")); }}
                      />
                    </button>
                  ) : null}
                  <div className="admin-product-info">
                    {customCardEnabled ? (
                      <>
                        {safeRenderedFields.map((field, index) => {
                          if (index === 0) return <strong key={field.key}>{field.value}</strong>;
                          if (index === 1) return <h3 key={field.key}>{field.value}</h3>;
                          return (
                            <p className="custom-product-field" key={field.key}>
                              <span>{field.label}</span>
                              <strong>{field.value}</strong>
                            </p>
                          );
                        })}
                        {packageLabel ? <small className="client-product-package">{packageLabel}</small> : null}
                      </>
                    ) : (
                      <>
                        <strong>{isConfigurable ? product.configurableTitle || displayDescription : displayCode}</strong>
                        <h3>
                          {isConfigurable
                            ? `${(product.variants || []).length} ${isRingSizeGroup ? "tallas" : "tipos"} disponibles`
                            : shortText(displayDescription, 72)}
                        </h3>
                        <p>
                          {isConfigurable
                            ? (isRingSizeGroup ? "Selecciona talla al agregar" : "Configura tipo de pieza al agregar")
                            : [product.metal, product.kilataje, formatWeight(product.pesoPromedio)].filter(Boolean).join(" / ")}
                        </p>
                        <span>
                          {isConfigurable ? "Producto configurable" : `${priceText} - MO ${formatCurrency(product.manoObra || 0, product.monedaPrecioMin)}`}
                        </span>
                        {packageLabel ? <small className="client-product-package">{packageLabel}</small> : null}
                      </>
                    )}
                  </div>
                  <div className="admin-product-actions product-action-layout">
                    <div className="product-action-admin">
                      {(!customCardEnabled || visibleButtons.has("ver_detalle")) ? (
                        <button className="secondary-button compact-action" type="button" onClick={() => setSelectedProductCode(product.codigo)}>
                          {t("viewDetail")}
                        </button>
                      ) : null}
                      {!isConfigurable && (!customCardEnabled || visibleButtons.has("editar_producto")) ? (
                        <button className="secondary-button compact-action" type="button" onClick={() => setProductModal({ open: true, product, mode: "edit" })}>
                          {t("editProduct")}
                        </button>
                      ) : null}
                    </div>
                    <div className="product-action-client">
                      {(!customCardEnabled || visibleButtons.has("preorden")) ? (
                        <button
                          className={`action-button preorder ${inPreorder ? "done" : ""}`}
                          type="button"
                          onClick={() => addToCart(product)}
                          disabled={inPreorder}
                        >
                          {t("addPreorderShort")}
                        </button>
                      ) : null}
                      {inPreorder && (!customCardEnabled || visibleButtons.has("preorden")) ? (
                        <button className="action-button undo" type="button" onClick={() => removeFromPreorder(product.codigo)}>
                          {t("undo")}
                        </button>
                      ) : null}
                      {(!customCardEnabled || visibleButtons.has("catalogo")) ? (
                        <button
                          className={`action-button catalog ${inCatalogSelection ? "done" : ""}`}
                          type="button"
                          onClick={() => addToCatalogSelection(product)}
                          disabled={inCatalogSelection}
                        >
                          {t("addCatalogShort")}
                        </button>
                      ) : null}
                      {!isConfigurable && inCatalogSelection && (!customCardEnabled || visibleButtons.has("catalogo")) ? (
                        <button className="action-button undo" type="button" onClick={() => removeFromCatalogSelection(product.codigo)}>
                          {t("undo")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {filteredProducts.length > renderedProducts.length ? (
            <div className="load-more-row">
              <button
                className="secondary-button compact-action"
                type="button"
                onClick={() => setVisibleProductLimit((current) => current + PRODUCT_RENDER_BATCH)}
              >
                Mostrar mas productos ({renderedProducts.length.toLocaleString()} de {filteredProducts.length.toLocaleString()})
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="empty-state">
          <h2>{t("noProducts")}</h2>
          <p>{t("noProductsHelp")}</p>
        </div>
      )}
    </section>
  );
}
