import ProductDetail from "../ProductDetail";
import { buildPlaceholderUrl, formatCurrency, formatWeight, imageUrlForSize, shortText } from "../../utils/formatters";

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
}) {
  return (
    <section className="admin-workspace">
      {!selectedProductCode ? (
        <div className="catalog-page-topbar">
          <div>
            <span className="tool-eyebrow">Catálogo</span>
            <h2>Catálogo administrador</h2>
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
              + Catálogo
            </button>
            <button className="selection-action preorder" type="button" onClick={addCheckedToPreorder} disabled={!checkedIds.size}>
              + Pre-orden
            </button>
          </div>
        </div>
      ) : null}

      {selectedProductCode ? (
        <ProductDetail
          product={selectedProduct}
          onBack={() => setSelectedProductCode("")}
          onAdd={addToCart}
          onRemovePreorder={removeFromPreorder}
          onAddToCatalog={addToCatalogSelection}
          onRemoveFromCatalog={removeFromCatalogSelection}
          inPreorder={addedCodes.includes(selectedProduct?.codigo)}
          inCatalogSelection={catalogSelectionIds.has(selectedProduct?.codigo)}
          onEdit={(product) => setProductModal({ open: true, product, mode: "edit" })}
          onDuplicate={(product) => setProductModal({ open: true, product, mode: "duplicate" })}
        />
      ) : filteredProducts.length ? (
        <>
          <div className="admin-product-grid">
            {renderedProducts.map((product) => (
              <article
                className={`admin-product-card enabled ${addedCodes.includes(product.codigo) ? "in-preorder" : ""}`}
                key={product.id || product.codigo}
              >
                <label className="product-select-check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={checkedIds.has(product.codigo)}
                    onChange={() => toggleProductCheck(product.codigo)}
                  />
                </label>
                {addedCodes.includes(product.codigo) ? <span className="preorder-added-badge">✓ En preorden</span> : null}
                {catalogSelectionIds.has(product.codigo) ? <span className="catalog-added-badge">✓ Catálogo</span> : null}
                <button className="admin-product-image" type="button" onClick={() => setSelectedProductCode(product.codigo)}>
                  <img
                    src={imageUrlForSize(product.fotoUrl, 360) || buildPlaceholderUrl(t("noPhoto"))}
                    alt={product.descripcion}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    onError={(event) => { event.currentTarget.src = buildPlaceholderUrl(t("noPhoto")); }}
                  />
                </button>
                <div className="admin-product-info">
                  <strong>{product.codigo}</strong>
                  <h3>{shortText(product.descripcion, 72)}</h3>
                  <p>{[product.metal, product.kilataje, formatWeight(product.pesoPromedio)].filter(Boolean).join(" / ")}</p>
                  <span>
                    {product.precioMinimo
                      ? formatCurrency(product.precioMinimo, product.monedaPrecioMin)
                      : t("priceToConfirm")} · MO {formatCurrency(product.manoObra || 0, product.monedaPrecioMin)}
                  </span>
                </div>
                <div className="admin-product-actions product-action-layout">
                  <div className="product-action-admin">
                    <button className="secondary-button compact-action" type="button" onClick={() => setSelectedProductCode(product.codigo)}>
                      {t("viewDetail")}
                    </button>
                    <button className="secondary-button compact-action" type="button" onClick={() => setProductModal({ open: true, product, mode: "edit" })}>
                      {t("editProduct")}
                    </button>
                  </div>
                  <div className="product-action-client">
                    <button
                      className={`action-button preorder ${addedCodes.includes(product.codigo) ? "done" : ""}`}
                      type="button"
                      onClick={() => addToCart(product)}
                      disabled={addedCodes.includes(product.codigo)}
                    >
                      {t("addPreorderShort")}
                    </button>
                    {addedCodes.includes(product.codigo) ? (
                      <button className="action-button undo" type="button" onClick={() => removeFromPreorder(product.codigo)}>
                        {t("undo")}
                      </button>
                    ) : null}
                    <button
                      className={`action-button catalog ${catalogSelectionIds.has(product.codigo) ? "done" : ""}`}
                      type="button"
                      onClick={() => addToCatalogSelection(product)}
                      disabled={catalogSelectionIds.has(product.codigo)}
                    >
                      {t("addCatalogShort")}
                    </button>
                    {catalogSelectionIds.has(product.codigo) ? (
                      <button className="action-button undo" type="button" onClick={() => removeFromCatalogSelection(product.codigo)}>
                        {t("undo")}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {filteredProducts.length > renderedProducts.length ? (
            <div className="load-more-row">
              <button
                className="secondary-button compact-action"
                type="button"
                onClick={() => setVisibleProductLimit((current) => current + PRODUCT_RENDER_BATCH)}
              >
                Mostrar más productos ({renderedProducts.length.toLocaleString()} de {filteredProducts.length.toLocaleString()})
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
