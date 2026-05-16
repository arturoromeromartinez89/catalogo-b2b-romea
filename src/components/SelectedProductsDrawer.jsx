import { buildPlaceholderUrl, formatCurrency, formatWeight, shortText } from "../utils/formatters";

export default function SelectedProductsDrawer({
  products,
  isOpen,
  onOpen,
  onClose,
  onRemove,
  onClear,
  onCatalogPdf,
  onQuoteLink,
}) {
  const count = products.length;
  if (!count) return null;

  return (
    <>
      {!isOpen ? (
        <button className="selection-drawer-tab" type="button" onClick={onOpen}>
          <span>{count}</span>
          Seleccion
        </button>
      ) : null}

      <aside className={`selection-drawer ${isOpen ? "open" : ""}`}>
        <header className="selection-drawer-header">
          <div>
            <span className="tool-eyebrow">Productos marcados</span>
            <h2>Seleccion actual</h2>
            <p>{count.toLocaleString()} productos listos para catalogo o liga.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>x</button>
        </header>

        <div className="selection-drawer-actions">
          <button className="primary-button compact-action" type="button" onClick={onCatalogPdf}>
            Generar catalogo PDF
          </button>
          <button className="secondary-button compact-action" type="button" onClick={onQuoteLink}>
            Generar liga
          </button>
          <button className="secondary-button compact-action" type="button" onClick={onClear}>
            Limpiar
          </button>
        </div>

        <div className="selection-drawer-list">
          {products.map((product) => (
            <article className="selection-drawer-item" key={product.codigo}>
              <img
                src={product.fotoUrl || buildPlaceholderUrl()}
                alt={product.descripcion}
                onError={(event) => { event.currentTarget.src = buildPlaceholderUrl(); }}
              />
              <div>
                <strong>{product.codigo}</strong>
                <span>{shortText(product.descripcion, 62)}</span>
                <small>
                  {[product.linea, formatWeight(product.pesoPromedio), product.precioMinimo ? formatCurrency(product.precioMinimo, product.monedaPrecioMin) : ""]
                    .filter(Boolean)
                    .join(" / ")}
                </small>
              </div>
              <button className="table-delete" type="button" onClick={() => onRemove(product.codigo)}>x</button>
            </article>
          ))}
        </div>
      </aside>
    </>
  );
}
