export default function SearchBar({ value, onChange }) {
  return (
    <div className="search-wrap">
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Buscar por código, descripción, familia, piedra, terminado, metal…"
      />
    </div>
  );
}
