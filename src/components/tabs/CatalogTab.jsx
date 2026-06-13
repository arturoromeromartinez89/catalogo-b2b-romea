import ProductDetail from "../ProductDetail";
import { isConfigurableProductGroup } from "../../utils/configurableCatalog";
import { buildPlaceholderUrl, formatCurrency, formatWeight, imageUrlForSize, shortText } from "../../utils/formatters";
import StorageImage from "../StorageImage";

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
  filterBar,   // Barra de filtros inline — pasada desde AdminDashboard
}) {
  const isSelectedConfigurable = isConfigurableProductGroup(selectedProduct);
  const selectedInCatalog = isSelectedConfigurable
    ? (selectedProduct?.variants || []).some((variant) => catalogSelectionIds.has(variant.product?.codigo))
    : catalogSelectionIds.has(selectedProduct?.codigo);

  return (
    <section className="admin-workspace">
      {!selectedProductCode ? (
        <div className="catalog-page-topbar">
          <div>
            <span className="tool-eyebrow">Catalogo</span>
            <h2>Catalogo administrador</h2>
            <p>{t("showingFiltered", renderedProducts.length.toLocaleString(), filteredProducts.length.toLocaleString())}</p>
          </div>
          <div className="catalog-topbar-actions">
            <label className="check-row catalog-select-visible">
              <input type="checkbox" checked={allRenderedChecked} onChange={toggleRenderedChecks} />
              Seleccionar pantalla ({renderedProducts.length.toLocaleString()})
            </label>
            {filteredProducts.length > renderedProducts.length ? (
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
            <button className="selection-action catalog" type="button" onClick={addCheckedToCatalogSelection} disabled={!checkedIds.size}>
              + Catalogo
            </button>
            <button className="selection-action preorder" type="button" onClick={addCheckedToPreorder} disabled={!checkedIds.size}>
              + Pre-orden
            </button>
          </div>
        </div>
      ) : null}

      {filterBar}

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
        />
      ) : filteredProducts.length ? (
        <>
          <div className="admin-product-grid">
            {renderedProducts.map((product) => {
              const isConfigurable = isConfigurableProductGroup(product);
              const inPreorder = isConfigurable ? false : addedCodes.includes(product.codigo);
              const inCatalogSelection = isConfigurable
                ? (product.variants || []).some((variant) => catalogSelectionIds.has(variant.product?.codigo))
                : catalogSelectionIds.has(product.codigo);
              const priceText = product.precioMinimo
                ? formatCurrency(product.precioMinimo, product.monedaPrecioMin)
                : t("priceToConfirm");

              return (
                <article
                  className={`admin-product-card enabled ${inPreorder ? "in-preorder" : ""} ${isConfigurable ? "configurable-card" : ""}`}
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
                  <button className="admin-product-image" type="button" onClick={() => setSelectedProductCode(product.codigo)}>
                    <StorageImage
                      src={product.fotoUrl}
                      width={360}
                      fallback={imageUrlForSize(product.fotoUrl, 360) || buildPlaceholderUrl(t("noPhoto"))}
                      alt={product.descripcion}
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                    />
                  </button>
                  <div className="admin-product-info">
                    <strong>{isConfigurable ? product.configurableTitle || product.descripcion : product.codigo}</strong>
                    <h3>
                      {isConfigurable
                        ? `${(product.variants || []).length} tipos disponibles`
                        : shortText(product.descripcion, 72)}
                    </h3>
                    <p>
                      {isConfigurable
                        ? "Configura tipo de pieza al agregar"
                        : [product.metal, product.kilataje, formatWeight(product.pesoPromedio)].filter(Boolean).join(" / ")}
                    </p>
                    <span>
                      {isConfigurable ? "Producto configurable" : `${priceText} - MO ${formatCurrency(product.manoObra || 0, product.monedaPrecioMin)}`}
                    </span>
                  </div>
                  <div className="admin-product-actions product-action-layout">
                    <div className="product-action-admin">
                      <button className="secondary-button compact-action" type="button" onClick={() => setSelectedProductCode(product.codigo)}>
                        {t("viewDetail")}
                      </button>
                      {!isConfigurable ? (
                        <button className="secondary-button compact-action" type="button" onClick={() => setProductModal({ open: true, product, mode: "edit" })}>
                          {t("editProduct")}
                        </button>
                      ) : null}
                    </div>
                    <div className="product-action-client">
                      <button
                        className={`action-button preorder ${inPreorder ? "done" : ""}`}
                        type="button"
                        onClick={() => addToCart(product)}
                        disabled={inPreorder}
                      >
                        {t("addPreorderShort")}
                      </button>
                      {inPreorder ? (
                        <button className="action-button undo" type="button" onClick={() => removeFromPreorder(product.codigo)}>
                          {t("undo")}
                        </button>
                      ) : null}
                      <button
                        className={`action-button catalog ${inCatalogSelection ? "done" : ""}`}
                        type="button"
                        onClick={() => addToCatalogSelection(product)}
                        disabled={inCatalogSelection}
                      >
                        {t("addCatalogShort")}
                      </button>
                      {!isConfigurable && inCatalogSelection ? (
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
