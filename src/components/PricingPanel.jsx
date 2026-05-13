import { useEffect, useState } from "react";
import {
  fetchLines, fetchMetalPrices, saveMetalPrices, saveLine,
  fetchClientMargins, saveClientMargin, calcPrecioGramo
} from "../services/pricingService";

export default function PricingPanel({ clients }) {
  const [metalPrices, setMetalPrices] = useState({ kitco_usd_oz: "", tipo_cambio: "", premio_pct: 4 });
  const [lines, setLines] = useState([]);
  const [margins, setMargins] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [savingMetal, setSavingMetal] = useState(false);
  const [status, setStatus] = useState("");
  const [tcOutput, setTcOutput] = useState("");

  useEffect(() => {
    fetchMetalPrices().then(setMetalPrices);
    fetchLines().then(setLines);
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      fetchClientMargins(selectedClientId).then(setMargins);
    }
  }, [selectedClientId]);

  const plataFina = metalPrices.plata_fina_mxn ||
    ((Number(metalPrices.kitco_usd_oz) / 31.1035) * (1 + Number(metalPrices.premio_pct) / 100) * Number(metalPrices.tipo_cambio));

  const handleSaveMetal = async () => {
    setSavingMetal(true);
    try {
      await saveMetalPrices(metalPrices);
      const updated = await fetchMetalPrices();
      setMetalPrices(updated);
      setStatus("✓ Precios de metal guardados");
    } catch (e) { setStatus("Error: " + e.message); }
    finally { setSavingMetal(false); }
  };

  const handleSaveLine = async (line) => {
    try {
      await saveLine(line);
      setLines((prev) => prev.map((l) => l.codigo === line.codigo ? line : l));
      setStatus("✓ Línea guardada");
    } catch (e) { setStatus("Error: " + e.message); }
  };

  const handleSaveMargin = async (lineCodigo, margenPct) => {
    if (!selectedClientId) return;
    try {
      await saveClientMargin(selectedClientId, lineCodigo, margenPct);
      setMargins((prev) => {
        const exists = prev.find((m) => m.line_codigo === lineCodigo);
        if (exists) return prev.map((m) => m.line_codigo === lineCodigo ? { ...m, margen_pct: Number(margenPct) } : m);
        return [...prev, { client_id: selectedClientId, line_codigo: lineCodigo, margen_pct: Number(margenPct) }];
      });
      setStatus("✓ Margen guardado");
    } catch (e) { setStatus("Error: " + e.message); }
  };

  const getMargen = (lineCodigo) =>
    margins.find((m) => m.line_codigo === lineCodigo)?.margen_pct ?? "";

  const tc = Number(tcOutput) || 1;

  return (
    <section className="admin-workspace">

      {/* ── PRECIOS DE METAL ── */}
      <div className="admin-soft-panel compact-panel" style={{ marginBottom: 24 }}>
        <h2>Precios de metal vigentes</h2>
        <p className="muted" style={{ marginBottom: 12 }}>Actualiza cuando cambie el precio del mercado.</p>
        <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <label>
            KITCO (USD/oz)
            <input
              type="number" step="0.01"
              placeholder="ej. 31.50"
              value={metalPrices.kitco_usd_oz || ""}
              onChange={(e) => setMetalPrices({ ...metalPrices, kitco_usd_oz: e.target.value })}
            />
          </label>
          <label>
            Tipo de cambio (MXN/USD)
            <input
              type="number" step="0.01"
              placeholder="ej. 17.25"
              value={metalPrices.tipo_cambio || ""}
              onChange={(e) => setMetalPrices({ ...metalPrices, tipo_cambio: e.target.value })}
            />
          </label>
          <label>
            Premio %
            <input
              type="number" step="0.1"
              placeholder="ej. 4"
              value={metalPrices.premio_pct || ""}
              onChange={(e) => setMetalPrices({ ...metalPrices, premio_pct: e.target.value })}
            />
          </label>
        </div>
        <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--color-background-secondary)", borderRadius: 8, display: "flex", gap: 24 }}>
          <span>Plata fina: <strong>${plataFina.toFixed(4)} MXN/g</strong></span>
          {Number(metalPrices.tipo_cambio) > 0 && (
            <span>= <strong>${(plataFina / Number(metalPrices.tipo_cambio)).toFixed(4)} USD/g</strong></span>
          )}
        </div>
        {status ? <p className="status info" style={{ marginTop: 8 }}>{status}</p> : null}
        <button className="primary-button compact-action" onClick={handleSaveMetal} disabled={savingMetal} style={{ marginTop: 12 }}>
          {savingMetal ? "Guardando..." : "Guardar precios de metal"}
        </button>
      </div>

      {/* ── TABLA DE LÍNEAS Y MO ── */}
      <div className="admin-soft-panel compact-panel" style={{ marginBottom: 24 }}>
        <h2>Costo MO por línea</h2>
        <p className="muted" style={{ marginBottom: 12 }}>El costo de mano de obra base en MXN/g para cada línea.</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500 }}>Línea</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500 }}>Descripción</th>
                <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500 }}>MO MXN/g</th>
                <th style={{ padding: "8px 12px" }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <LineRow key={line.codigo} line={line} onSave={handleSaveLine} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MÁRGENES POR CLIENTE ── */}
      <div className="admin-soft-panel compact-panel">
        <h2>Márgenes por cliente</h2>
        <p className="muted" style={{ marginBottom: 12 }}>Define el % de margen por línea para cada cliente.</p>

        <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-end" }}>
          <label style={{ flex: 1 }}>
            Cliente
            <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
              <option value="">Selecciona un cliente</option>
              {(clients || []).map((c) => (
                <option key={c.id} value={c.id}>{c.company || c.name} — {c.email}</option>
              ))}
            </select>
          </label>
          <label style={{ width: 160 }}>
            Ver precios en USD (TC)
            <input
              type="number" step="0.01"
              placeholder="ej. 17.25"
              value={tcOutput}
              onChange={(e) => setTcOutput(e.target.value)}
            />
          </label>
        </div>

        {selectedClientId ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--color-background-secondary)" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500 }}>Línea</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500 }}>MO base</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500 }}>Margen %</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500 }}>Plata fina</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500 }}>MO cliente</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 500 }}>Integrado/g</th>
                  <th style={{ padding: "8px 12px" }}></th>
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
                      onSave={(v) => handleSaveMargin(line.codigo, v)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">Selecciona un cliente para configurar sus márgenes.</p>
        )}
      </div>
    </section>
  );
}

function LineRow({ line, onSave }) {
  const [mo, setMo] = useState(line.mo_base);
  const [desc, setDesc] = useState(line.descripcion || "");
  const dirty = Number(mo) !== Number(line.mo_base) || desc !== (line.descripcion || "");

  return (
    <tr style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}>
      <td style={{ padding: "6px 12px", fontWeight: 500 }}>{line.codigo}</td>
      <td style={{ padding: "6px 12px" }}>
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          style={{ width: "100%" }}
          placeholder="Descripción"
        />
      </td>
      <td style={{ padding: "6px 12px" }}>
        <input
          type="number" step="0.01"
          value={mo}
          onChange={(e) => setMo(e.target.value)}
          style={{ width: 90, textAlign: "right" }}
        />
      </td>
      <td style={{ padding: "6px 12px" }}>
        {dirty && (
          <button
            className="primary-button compact-action"
            onClick={() => onSave({ ...line, mo_base: Number(mo), descripcion: desc })}
            style={{ fontSize: 12, padding: "4px 10px" }}
          >
            Guardar
          </button>
        )}
      </td>
    </tr>
  );
}

function MarginRow({ line, margen, precio, moneda, onSave }) {
  const [val, setVal] = useState(margen);
  const dirty = String(val) !== String(margen);

  const fmt = (n) => n > 0 ? `$${Number(n).toFixed(4)}` : "—";

  return (
    <tr style={{ borderBottom: "1px solid var(--color-border-tertiary)" }}>
      <td style={{ padding: "6px 12px", fontWeight: 500 }}>{line.codigo}</td>
      <td style={{ padding: "6px 12px", textAlign: "right" }}>${Number(line.mo_base).toFixed(2)}</td>
      <td style={{ padding: "6px 12px" }}>
        <input
          type="number" step="0.1" min="0" max="99"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          style={{ width: 70, textAlign: "right" }}
          placeholder="0"
        />
        <span style={{ marginLeft: 4 }}>%</span>
      </td>
      <td style={{ padding: "6px 12px", textAlign: "right", color: "var(--color-text-secondary)" }}>{fmt(precio.plata_fina)} {moneda}</td>
      <td style={{ padding: "6px 12px", textAlign: "right", color: "var(--color-text-secondary)" }}>{fmt(precio.mo_visible)} {moneda}</td>
      <td style={{ padding: "6px 12px", textAlign: "right", fontWeight: 500 }}>{fmt(precio.integrado)} {moneda}</td>
      <td style={{ padding: "6px 12px" }}>
        {dirty && (
          <button
            className="primary-button compact-action"
            onClick={() => onSave(val)}
            style={{ fontSize: 12, padding: "4px 10px" }}
          >
            Guardar
          </button>
        )}
      </td>
    </tr>
  );
}
