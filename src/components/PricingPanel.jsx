import { useEffect, useMemo, useState } from "react";
import {
  calcPrecioGramo,
  fetchClientMargins,
  fetchLines,
  fetchMetalPrices,
  getSilverFinePrice,
  saveClientMargin,
  saveLine,
  saveMetalPrices,
  syncProductLinesFromProducts,
} from "../services/pricingService";

export default function PricingPanel({ clients, products = [] }) {
  const [metalPrices, setMetalPrices] = useState({ kitco_usd_oz: "", tipo_cambio: "", premio_pct: 4 });
  const [lines, setLines] = useState([]);
  const [margins, setMargins] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
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

  useEffect(() => {
    if (!selectedClientId) {
      setMargins([]);
      return;
    }
    fetchClientMargins(selectedClientId)
      .then(setMargins)
      .catch((error) => setStatus(`Error: ${error.message}`));
  }, [selectedClientId]);

  const plataFina = useMemo(() => getSilverFinePrice(metalPrices), [metalPrices]);
  const tc = Number(tcOutput) || 1;

  const handleSaveMetal = async () => {
    setSavingMetal(true);
    setStatus("");
    try {
      await saveMetalPrices(metalPrices);
      const updated = await fetchMetalPrices();
      setMetalPrices(updated);
      setStatus("Precios de metal guardados.");
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
      setStatus(`Lineas sincronizadas: ${updated.length}. Revisa la mano de obra por linea antes de cotizar.`);
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
      setStatus("Linea guardada.");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  const handleSaveMargin = async (lineCodigo, margenPct) => {
    if (!selectedClientId) return;
    try {
      await saveClientMargin(selectedClientId, lineCodigo, margenPct);
      setMargins((current) => {
        const exists = current.find((item) => item.line_codigo === lineCodigo);
        if (exists) {
          return current.map((item) =>
            item.line_codigo === lineCodigo ? { ...item, margen_pct: Number(margenPct || 0) } : item
          );
        }
        return [...current, { client_id: selectedClientId, line_codigo: lineCodigo, margen_pct: Number(margenPct || 0) }];
      });
      setStatus("Margen guardado.");
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  const getMargen = (lineCodigo) =>
    margins.find((item) => item.line_codigo === lineCodigo)?.margen_pct ?? "";

  return (
    <section className="admin-workspace">
      <div className="admin-soft-panel compact-panel" style={{ marginBottom: 20 }}>
        <h2>Menu de precios para cotizar</h2>
        <p className="muted">
          Regla unica: precio por gramo integrado = plata fina + mano de obra por linea + margen del cliente.
        </p>
        <div className="pricing-formula-box">
          <strong>Formula:</strong>
          <span>Subtotal de partida = piezas x gramos por pieza x precio integrado por gramo.</span>
        </div>
        {status ? <p className="status info">{status}</p> : null}
      </div>

      <div className="admin-soft-panel compact-panel" style={{ marginBottom: 20 }}>
        <h2>1. Precio de metal vigente</h2>
        <p className="muted">Actualiza estos valores cuando cambie el mercado. El sistema calcula la plata fina MXN/g.</p>
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
          {savingMetal ? "Guardando..." : "Guardar precio de metal"}
        </button>
      </div>

      <div className="admin-soft-panel compact-panel" style={{ marginBottom: 20 }}>
        <div className="section-title-row">
          <div>
            <h2>2. Mano de obra por linea</h2>
            <p className="muted">Cada SKU usa su campo Linea. Si no existe una linea aqui, no se podra cotizar automaticamente.</p>
          </div>
          <button className="secondary-button compact-action" type="button" onClick={handleSyncLines} disabled={syncingLines}>
            {syncingLines ? "Sincronizando..." : "Crear lineas desde productos"}
          </button>
        </div>
        <div className="responsive-table">
          <table className="simple-admin-table">
            <thead>
              <tr>
                <th>Linea</th>
                <th>Descripcion</th>
                <th className="right">MO base MXN/g</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.length ? (
                lines.map((line) => <LineRow key={line.codigo} line={line} onSave={handleSaveLine} />)
              ) : (
                <tr>
                  <td colSpan="4" className="empty-row">
                    No hay lineas configuradas. Presiona "Crear lineas desde productos".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-soft-panel compact-panel">
        <h2>3. Margen por cliente</h2>
        <p className="muted">Selecciona un cliente y define su margen por linea. Si dejas 0%, el precio sera costo integrado sin margen.</p>

        <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-end" }}>
          <label style={{ flex: 1 }}>
            Cliente
            <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
              <option value="">Selecciona un cliente</option>
              {(clients || []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company || client.name} - {client.email}
                </option>
              ))}
            </select>
          </label>
          <label style={{ width: 180 }}>
            Ver en USD usando TC
            <input
              type="number"
              step="0.01"
              placeholder="Ej. 17.25"
              value={tcOutput}
              onChange={(event) => setTcOutput(event.target.value)}
            />
          </label>
        </div>

        {selectedClientId ? (
          <div className="responsive-table">
            <table className="simple-admin-table">
              <thead>
                <tr>
                  <th>Linea</th>
                  <th className="right">MO base</th>
                  <th className="right">Margen %</th>
                  <th className="right">Plata fina</th>
                  <th className="right">MO cliente</th>
                  <th className="right">Precio integrado/g</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const margen = getMargen(line.codigo);
                  const precio = calcPrecioGramo({
                    mo_base: line.mo_base,
                    plata_fina_mxn: plataFina,
                    margen_pct: Number(margen) || 0,
                    tipo_cambio_output: tc,
                  });
                  const moneda = tcOutput ? "USD" : "MXN";
                  return (
                    <MarginRow
                      key={line.codigo}
                      line={line}
                      margen={margen}
                      precio={precio}
                      moneda={moneda}
                      onSave={(value) => handleSaveMargin(line.codigo, value)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Selecciona un cliente para ver o modificar sus margenes.</p>
        )}
      </div>
    </section>
  );
}

function LineRow({ line, onSave }) {
  const [mo, setMo] = useState(line.mo_base);
  const [desc, setDesc] = useState(line.descripcion || "");
  const dirty = Number(mo || 0) !== Number(line.mo_base || 0) || desc !== (line.descripcion || "");

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

function MarginRow({ line, margen, precio, moneda, onSave }) {
  const [value, setValue] = useState(margen);
  const dirty = String(value) !== String(margen);
  const money = (number) => (Number(number) > 0 ? `$${Number(number).toFixed(4)}` : "-");

  return (
    <tr>
      <td><strong>{line.codigo}</strong></td>
      <td className="right">${Number(line.mo_base || 0).toFixed(2)}</td>
      <td className="right">
        <input
          type="number"
          step="0.1"
          min="0"
          max="99"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          style={{ maxWidth: 90, textAlign: "right" }}
          placeholder="0"
        /> %
      </td>
      <td className="right">{money(precio.plata_fina)} {moneda}</td>
      <td className="right">{money(precio.mo_visible)} {moneda}</td>
      <td className="right"><strong>{money(precio.integrado)} {moneda}</strong></td>
      <td>
        {dirty ? (
          <button className="primary-button compact-action" type="button" onClick={() => onSave(value)}>
            Guardar
          </button>
        ) : null}
      </td>
    </tr>
  );
}
