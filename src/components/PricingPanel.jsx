import { useEffect, useMemo, useState } from "react";
import {
  calcPrecioGramo,
  fetchLines,
  fetchMetalPrices,
  getSilverFinePrice,
  saveLine,
  saveMetalPrices,
  syncProductLinesFromProducts,
} from "../services/pricingService";

export default function PricingPanel({ products = [] }) {
  const [metalPrices, setMetalPrices] = useState({ kitco_usd_oz: "", tipo_cambio: "", premio_pct: 4 });
  const [lines, setLines] = useState([]);
  const [savingMetal, setSavingMetal] = useState(false);
  const [syncingLines, setSyncingLines] = useState(false);
  const [status, setStatus] = useState("");
  const [tcOutput, setTcOutput] = useState("");

  const loadPricing = async () => {
    const [metal, nextLines] = await Promise.all([fetchMetalPrices(), fetchLines()]);
    setMetalPrices(metal);
    setLines(nextLines);
  };

  useEffect(() => {
    loadPricing().catch((error) => setStatus(`Error: ${error.message}`));
  }, []);

  const plataFina = useMemo(() => getSilverFinePrice(metalPrices), [metalPrices]);
  const tc = Number(tcOutput) || 1;

  const handleSaveMetal = async () => {
    setSavingMetal(true);
    setStatus("");
    try {
      await saveMetalPrices(metalPrices);
      const updated = await fetchMetalPrices();
      setMetalPrices(updated);
      setStatus("Precio de plata fina guardado.");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setSavingMetal(false);
    }
  };

  const handleSyncLines = async () => {
    setSyncingLines(true);
    setStatus("");
    try {
      const updated = await syncProductLinesFromProducts(products);
      setLines(updated);
      setStatus(`Lineas sincronizadas: ${updated.length}. Revisa la labor por gramo antes de cotizar.`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setSyncingLines(false);
    }
  };

  const handleSaveLine = async (line) => {
    try {
      await saveLine(line);
      setLines((current) => current.map((item) => (item.codigo === line.codigo ? { ...item, ...line } : item)));
      setStatus("Labor por linea guardada.");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <section className="admin-workspace">
      <div className="admin-soft-panel compact-panel" style={{ marginBottom: 20 }}>
        <h2>Menu de precios para cotizar</h2>
        <p className="muted">
          Politica actual: cada producto toma su precio por gramo desde su linea. No se usa margen.
        </p>
        <div className="pricing-formula-box">
          <strong>Formula:</strong>
          <span>Precio integrado/g = labor por linea + plata fina.</span>
          <span>Subtotal = piezas x gramos por pieza x precio integrado/g.</span>
        </div>
        {status ? <p className="status info">{status}</p> : null}
      </div>

      <div className="admin-soft-panel compact-panel" style={{ marginBottom: 20 }}>
        <h2>1. Plata fina vigente</h2>
        <p className="muted">
          Todos los productos usan este mismo valor de plata fina. En una preorden de admin tambien puedes ajustarlo manualmente.
        </p>
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          <label>
            KITCO plata (USD/oz)
            <input
              type="number"
              step="0.01"
              placeholder="Ej. 31.50"
              value={metalPrices.kitco_usd_oz || ""}
              onChange={(event) => setMetalPrices({ ...metalPrices, kitco_usd_oz: event.target.value })}
            />
          </label>
          <label>
            Tipo de cambio (MXN/USD)
            <input
              type="number"
              step="0.01"
              placeholder="Ej. 17.25"
              value={metalPrices.tipo_cambio || ""}
              onChange={(event) => setMetalPrices({ ...metalPrices, tipo_cambio: event.target.value })}
            />
          </label>
          <label>
            Premio %
            <input
              type="number"
              step="0.1"
              placeholder="Ej. 4"
              value={metalPrices.premio_pct || ""}
              onChange={(event) => setMetalPrices({ ...metalPrices, premio_pct: event.target.value })}
            />
          </label>
        </div>
        <div className="pricing-result-row">
          <span>Plata fina calculada</span>
          <strong>${plataFina.toFixed(4)} MXN/g</strong>
        </div>
        <button className="primary-button compact-action" type="button" onClick={handleSaveMetal} disabled={savingMetal}>
          {savingMetal ? "Guardando..." : "Guardar plata fina"}
        </button>
      </div>

      <div className="admin-soft-panel compact-panel">
        <div className="section-title-row">
          <div>
            <h2>2. Labor por linea</h2>
            <p className="muted">
              La linea del producto manda. Si un SKU trae linea 0112, se cotiza con la labor configurada para 0112.
            </p>
          </div>
          <button className="secondary-button compact-action" type="button" onClick={handleSyncLines} disabled={syncingLines}>
            {syncingLines ? "Sincronizando..." : "Crear lineas desde productos"}
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <label style={{ width: 180 }}>
            Vista USD con TC
            <input
              type="number"
              step="0.01"
              placeholder="Ej. 17.25"
              value={tcOutput}
              onChange={(event) => setTcOutput(event.target.value)}
            />
          </label>
        </div>

        <div className="responsive-table">
          <table className="simple-admin-table">
            <thead>
              <tr>
                <th>Linea</th>
                <th>Descripcion</th>
                <th className="right">Labor MXN/g</th>
                <th className="right">Plata fina</th>
                <th className="right">Labor + PF</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.length ? (
                lines.map((line) => {
                  const price = calcPrecioGramo({
                    mo_base: line.mo_base,
                    plata_fina_mxn: plataFina,
                    tipo_cambio_output: tc,
                  });
                  return (
                    <LineRow
                      key={line.codigo}
                      line={line}
                      price={price}
                      currency={tcOutput ? "USD" : "MXN"}
                      onSave={handleSaveLine}
                    />
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="empty-row">
                    No hay lineas configuradas. Presiona "Crear lineas desde productos".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function LineRow({ line, price, currency, onSave }) {
  const [mo, setMo] = useState(line.mo_base);
  const [desc, setDesc] = useState(line.descripcion || "");
  const dirty = Number(mo || 0) !== Number(line.mo_base || 0) || desc !== (line.descripcion || "");
  const money = (number) => (Number(number) > 0 ? `$${Number(number).toFixed(4)}` : "-");

  return (
    <tr>
      <td><strong>{line.codigo}</strong></td>
      <td>
        <input value={desc} onChange={(event) => setDesc(event.target.value)} placeholder="Descripcion de la linea" />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          value={mo}
          onChange={(event) => setMo(event.target.value)}
          style={{ textAlign: "right" }}
        />
      </td>
      <td className="right">{money(price.plata_fina)} {currency}</td>
      <td className="right"><strong>{money(price.integrado)} {currency}</strong></td>
      <td>
        {dirty ? (
          <button className="primary-button compact-action" type="button" onClick={() => onSave({ ...line, mo_base: Number(mo || 0), descripcion: desc })}>
            Guardar
          </button>
        ) : null}
      </td>
    </tr>
  );
}
