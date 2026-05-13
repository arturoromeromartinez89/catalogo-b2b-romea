const labels = {
  metal: "Metal",
  kilataje: "Kilataje",
  linea: "Línea",
  familia: "Familia",
  grupo: "Grupo",
};

export default function Filters({ filters, options, onChange, onClear, showing, total }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <section className="panel filters">
      <div className="filters-header">
        <strong>Mostrando {showing} de {total} productos</strong>
        <button className="link-button" type="button" onClick={onClear}>
          Limpiar filtros
        </button>
      </div>

      <div className="filter-grid">
        {Object.keys(labels).map((key) => (
          <label key={key}>
            {labels[key]}
            <select value={filters[key]} onChange={(event) => update(key, event.target.value)}>
              <option value="">Todos</option>
              {(options[key] || []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}

        <label>
          Peso mínimo
          <input type="number" min="0" step="0.01" value={filters.minWeight} onChange={(event) => update("minWeight", event.target.value)} />
        </label>
        <label>
          Peso máximo
          <input type="number" min="0" step="0.01" value={filters.maxWeight} onChange={(event) => update("maxWeight", event.target.value)} />
        </label>
        <label>
          Precio mínimo
          <input type="number" min="0" step="0.01" value={filters.minPrice} onChange={(event) => update("minPrice", event.target.value)} />
        </label>
        <label>
          Precio máximo
          <input type="number" min="0" step="0.01" value={filters.maxPrice} onChange={(event) => update("maxPrice", event.target.value)} />
        </label>
      </div>
    </section>
  );
}
