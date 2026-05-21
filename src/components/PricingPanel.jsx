import { useEffect, useState } from "react";
import ActionNotice from "./ActionNotice";
import { fetchLines, saveLine, syncProductLinesFromProducts } from "../services/pricingService";

export default function PricingPanel({ products = [], tenantId = "" }) {
  const [lines, setLines] = useState([]);
  const [syncingLines, setSyncingLines] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadLines = async () => {
    const nextLines = await fetchLines(tenantId);
    setLines(nextLines);
  };

  useEffect(() => {
    loadLines().catch((error) => setNotice({ type: "error", title: "Error", message: error.message }));
  }, [tenantId]);

  const handleSyncLines = async () => {
    setSyncingLines(true);
    try {
      const updated = await syncProductLinesFromProducts(products, tenantId);
      setLines(updated);
      setNotice({ type: "success", title: "Líneas sincronizadas", message: `${updated.length} líneas listas para configurar labor.` });
    } catch (error) {
      setNotice({ type: "error", title: "No se pudo sincronizar", message: error.message });
    } finally {
      setSyncingLines(false);
    }
  };

  const handleSaveLine = async (line) => {
    try {
      await saveLine(line, tenantId);
      setLines((current) => current.map((item) => (item.codigo === line.codigo ? { ...item, ...line } : item)));
      setNotice({ type: "success", title: "Línea actualizada", message: `Labor de la línea ${line.codigo} guardada.` });
    } catch (error) {
      setNotice({ type: "error", title: "No se pudo guardar", message: error.message });
    }
  };

  const noPhoto = lines.filter((l) => !l.mo_base || Number(l.mo_base) === 0).length;
  const configured = lines.length - noPhoto;

  return (
    <section className="database-health-dashboard" style={{ padding: "20px 24px" }}>

      {/* Métricas de estado */}
      <div className="database-executive-row" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)" }}>
        <article className="database-health-card">
          <span className="tool-eyebrow">Líneas de producto</span>
          <h2>Labor por línea</h2>
          <div className="database-metric-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <div><span>Total líneas</span><strong>{lines.length}</strong></div>
            <div><span>Configuradas</span><strong style={{ color: "var(--color-success)" }}>{configured}</strong></div>
            <div><span>Sin labor</span><strong className="warning-number">{noPhoto}</strong></div>
          </div>
        </article>

        <article className="database-health-card">
          <span className="tool-eyebrow">Plata fina</span>
          <h2>Precio por preorden</h2>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
            El precio de plata fina se configura individualmente en cada preorden.
            Aquí solo se define la <strong>mano de obra por línea</strong>.
          </p>
        </article>

        <article className="database-health-card">
          <span className="tool-eyebrow">Acciones</span>
          <h2>Sincronizar líneas</h2>
          <p className="muted" style={{ fontSize: 13 }}>
            Crea o actualiza las líneas basándose en los productos del catálogo.
          </p>
          <button
            className="secondary-button compact-action"
            type="button"
            onClick={handleSyncLines}
            disabled={syncingLines}
          >
            {syncingLines ? "Sincronizando..." : "Crear líneas desde productos"}
          </button>
        </article>
      </div>

      {/* Tabla de labor */}
      <article className="database-health-card">
        <div className="database-card-header">
          <h2>Mano de obra por línea</h2>
          <span className="database-badge">{lines.length} líneas · MXN/g</span>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          La línea del producto determina su mano de obra. El precio de plata fina se ajusta en la preorden.
        </p>
        <div className="database-table-wrap">
          <table className="database-health-table pricing-labor-table">
            <thead>
              <tr>
                <th>Línea</th>
                <th>Descripción</th>
                <th style={{ textAlign: "right" }}>Labor MXN/g</th>
                <th style={{ width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {lines.length ? (
                lines.map((line) => (
                  <LaborRow key={line.codigo} line={line} onSave={handleSaveLine} />
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="empty-row">
                    No hay líneas configuradas. Presiona "Crear líneas desde productos".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </section>
  );
}

function LaborRow({ line, onSave }) {
  const [mo, setMo] = useState(line.mo_base ?? "");
  const [desc, setDesc] = useState(line.descripcion || "");
  const dirty =
    String(mo) !== String(line.mo_base ?? "") ||
    desc !== (line.descripcion || "");

  return (
    <tr>
      <td><strong>{line.codigo}</strong></td>
      <td>
        <input
          value={desc}
          onChange={(event) => setDesc(event.target.value)}
          placeholder="Descripción de la línea"
        />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          min="0"
          value={mo}
          onChange={(event) => setMo(event.target.value)}
          style={{ textAlign: "right" }}
          placeholder="0.00"
        />
      </td>
      <td>
        {dirty ? (
          <button
            className="primary-button compact-action"
            type="button"
            onClick={() =>
              onSave({ ...line, mo_base: Number(mo || 0), descripcion: desc })
            }
          >
            Guardar
          </button>
        ) : null}
      </td>
    </tr>
  );
}
