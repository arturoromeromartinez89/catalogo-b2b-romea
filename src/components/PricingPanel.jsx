import jsPDF from "jspdf";
import { useEffect, useMemo, useState } from "react";
import ActionNotice from "./ActionNotice";
import {
  buildPriceListName,
  calculateFineSilver,
  calculatePriceListLine,
  duplicateLaborList,
  fetchLaborListLines,
  fetchLaborLists,
  fetchLines,
  inferLaborFromLineCode,
  roundUp2,
  saveLaborList,
  syncProductLinesFromProducts,
  TROY_OUNCE_GRAMS,
  upsertLaborListLines,
} from "../services/pricingService";

const today = () => new Date().toISOString().slice(0, 10);

const blankList = {
  currency: "USD",
  name: "USD -",
  status: "borrador",
  pf_mode: "kitco",
  kitco_usd_oz: "",
  oz_grams: TROY_OUNCE_GRAMS,
  premio_pct: 4,
  tipo_cambio: "",
  plata_fina_value: "",
  exchange_rate_date: today(),
  kitco_date: today(),
  comments: "",
};

const money = (value, currency = "USD") =>
  `${currency === "USD" ? "US$" : "$"}${Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const normalizeList = (list = {}) => ({
  ...blankList,
  ...list,
  currency: list.currency || "MXN",
  status: list.status || "borrador",
  pf_mode: list.pf_mode || "manual",
  oz_grams: Number(list.oz_grams || TROY_OUNCE_GRAMS),
});

const makeDraftLines = (productLines = [], sourceLines = [], list = blankList) => {
  const sourceMap = new Map(sourceLines.map((row) => [row.line_codigo, row]));
  const fineSilver = calculateFineSilver({
    currency: list.currency,
    pfMode: list.pf_mode,
    manualValue: list.plata_fina_value,
    kitcoUsdOz: list.kitco_usd_oz,
    premiumPct: list.premio_pct,
    exchangeRate: list.tipo_cambio,
  });

  return productLines.map((line) => {
    const saved = sourceMap.get(line.codigo);
    const base = saved || {
      line_codigo: line.codigo,
      descripcion: line.descripcion || "",
      labor_mxn: Number(line.mo_base || inferLaborFromLineCode(line.codigo)),
      margin_pct: 20,
    };
    return calculatePriceListLine({
      line: {
        codigo: line.codigo,
        descripcion: line.descripcion || saved?.descripcion || "",
        labor_mxn: base.labor_mxn ?? base.mo_base,
      },
      currency: list.currency,
      exchangeRate: list.tipo_cambio,
      fineSilver,
      marginPct: base.margin_pct,
    });
  });
};

function PriceListPdfButton({ list, lines }) {
  const handlePdf = () => {
    const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait" });
    const blue = [31, 51, 95];
    doc.setFillColor(...blue);
    doc.rect(0, 0, 216, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("LISTA DE PRECIOS INTERNA", 12, 15);
    doc.setFontSize(9);
    doc.text(list.name || "Lista de precios", 12, 22);
    doc.setTextColor(31, 51, 95);
    doc.setFontSize(11);
    doc.text("Historia de calculo", 12, 40);
    doc.setTextColor(55, 65, 81);
    doc.setFontSize(8);
    [
      `Moneda: ${list.currency}`,
      `Estado: ${list.status}`,
      `Tipo de cambio: ${list.tipo_cambio || "-"}`,
      `Fecha TC: ${list.exchange_rate_date || "-"}`,
      `Metodo PF: ${list.pf_mode === "kitco" ? "Kitco" : "Manual"}`,
      `Kitco USD/oz: ${list.kitco_usd_oz || "-"}`,
      `Oz a gramo: ${list.oz_grams || TROY_OUNCE_GRAMS}`,
      `Premio: ${list.premio_pct || 0}%`,
      `PF ${list.currency}/g: ${money(list.plata_fina_value, list.currency)}`,
      `Fecha Kitco: ${list.kitco_date || "-"}`,
      `Comentarios: ${list.comments || "-"}`,
    ].forEach((text, idx) => doc.text(text, 12 + (idx % 2) * 96, 48 + Math.floor(idx / 2) * 5));

    let y = 86;
    doc.setFillColor(240, 244, 252);
    doc.rect(12, y - 5, 192, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    ["Linea", "Labor MXN", "Labor USD", "PF", "Costo", "Utilidad", "Integrado", "Labor final"].forEach((h, i) => {
      doc.text(h, [14, 38, 64, 90, 116, 140, 162, 186][i], y);
    });
    y += 6;
    doc.setFont("helvetica", "normal");
    lines.slice(0, 28).forEach((line) => {
      if (y > 260) return;
      doc.text(String(line.line_codigo || ""), 14, y);
      doc.text(money(line.labor_mxn, "MXN"), 38, y);
      doc.text(money(line.labor_usd, "USD"), 64, y);
      doc.text(money(line.silver_fine, list.currency), 90, y);
      doc.text(money(line.total_cost, list.currency), 116, y);
      doc.text(`${Number(line.margin_pct || 0).toFixed(2)}%`, 140, y);
      doc.text(money(line.integrated_price, list.currency), 162, y);
      doc.text(money(line.final_labor, list.currency), 186, y);
      y += 6;
    });
    doc.setTextColor(130, 130, 130);
    doc.setFontSize(7);
    doc.text("Documento interno. No compartir con cliente final.", 12, 270);
    doc.save(`lista-precios-${(list.name || "interna").replace(/[\\/:*?"<>|]/g, "-")}.pdf`);
  };
  return <button className="secondary-button compact-action" type="button" onClick={handlePdf}>PDF interno</button>;
}

function PriceListEditor({ list, productLines, tenantId, onClose, onSaved, setNotice }) {
  const [draft, setDraft] = useState(() => normalizeList(list));
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const frozen = Boolean(draft.id && draft.status === "activa");

  useEffect(() => {
    const load = async () => {
      const sourceRows = draft.id ? await fetchLaborListLines(draft.id) : [];
      setRows(makeDraftLines(productLines, sourceRows, draft));
    };
    load().catch((error) => setNotice({ type: "error", title: "Error", message: error.message }));
  }, [draft.id, productLines.length]);

  const fineSilver = useMemo(() => calculateFineSilver({
    currency: draft.currency,
    pfMode: draft.pf_mode,
    manualValue: draft.plata_fina_value,
    kitcoUsdOz: draft.kitco_usd_oz,
    premiumPct: draft.premio_pct,
    exchangeRate: draft.tipo_cambio,
  }), [draft.currency, draft.pf_mode, draft.plata_fina_value, draft.kitco_usd_oz, draft.premio_pct, draft.tipo_cambio]);

  const recalcRows = (nextDraft = draft, nextRows = rows) => {
    const nextFine = calculateFineSilver({
      currency: nextDraft.currency,
      pfMode: nextDraft.pf_mode,
      manualValue: nextDraft.plata_fina_value,
      kitcoUsdOz: nextDraft.kitco_usd_oz,
      premiumPct: nextDraft.premio_pct,
      exchangeRate: nextDraft.tipo_cambio,
    });
    setRows(nextRows.map((row) => calculatePriceListLine({
      line: { codigo: row.line_codigo, descripcion: row.descripcion, labor_mxn: row.labor_mxn },
      currency: nextDraft.currency,
      exchangeRate: nextDraft.tipo_cambio,
      fineSilver: nextFine,
      marginPct: row.margin_pct,
    })));
  };

  const setDraftValue = (key, value) => {
    const next = { ...draft, [key]: value };
    if (key === "currency") next.name = buildPriceListName(value, draft.name);
    if (key === "name") next.name = buildPriceListName(draft.currency, value);
    if (key === "pf_mode" || key === "kitco_usd_oz" || key === "premio_pct" || key === "tipo_cambio" || key === "plata_fina_value" || key === "currency") {
      next.plata_fina_value = calculateFineSilver({
        currency: next.currency,
        pfMode: next.pf_mode,
        manualValue: next.plata_fina_value,
        kitcoUsdOz: next.kitco_usd_oz,
        premiumPct: next.premio_pct,
        exchangeRate: next.tipo_cambio,
      });
    }
    setDraft(next);
    window.setTimeout(() => recalcRows(next), 0);
  };

  const setRow = (idx, key, value) => {
    const nextRows = [...rows];
    nextRows[idx] = { ...nextRows[idx], [key]: Number(value || 0) };
    recalcRows(draft, nextRows);
  };

  const applyMarginAll = (value) => {
    const margin = Number(value || 0);
    recalcRows(draft, rows.map((row) => ({ ...row, margin_pct: margin })));
  };

  const handleSave = async (status = draft.status) => {
    setSaving(true);
    try {
      const saved = await saveLaborList({
        ...draft,
        status,
        plata_fina_value: fineSilver,
        source_snapshot: {
          formula: draft.pf_mode === "kitco" ? "PF = (Kitco USD oz / 31.1) * (1 + premio/100)" : "PF manual",
          generated_at: new Date().toISOString(),
        },
      }, tenantId);
      await upsertLaborListLines(saved.id, rows);
      setNotice({ type: "success", title: "Lista guardada", message: `${saved.name} guardada correctamente.` });
      onSaved(saved);
    } catch (error) {
      setNotice({ type: "error", title: "No se pudo guardar", message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async () => {
    const copy = await duplicateLaborList(draft, tenantId);
    setNotice({ type: "success", title: "Version duplicada", message: `${copy.name} creada como borrador.` });
    onSaved(copy, true);
  };

  return (
    <section className="price-editor-page">
      <div className="price-editor-toolbar">
        <div>
          <span className="tool-eyebrow">Lista de precios</span>
          <h2>{draft.name}</h2>
          {frozen ? <p className="muted">Lista activa congelada. Para modificarla, duplica una nueva version.</p> : <p className="muted">Configura la moneda, plata fina, tipo de cambio y utilidad por linea.</p>}
        </div>
        <div className="price-editor-actions">
          <PriceListPdfButton list={{ ...draft, plata_fina_value: fineSilver }} lines={rows} />
          {frozen ? <button className="primary-button compact-action" type="button" onClick={duplicate}>Duplicar version</button> : null}
          {!frozen ? <button className="secondary-button compact-action" type="button" onClick={() => handleSave("borrador")} disabled={saving}>Guardar borrador</button> : null}
          {!frozen ? <button className="primary-button compact-action" type="button" onClick={() => handleSave("activa")} disabled={saving}>Activar lista</button> : null}
          <button className="secondary-button compact-action" type="button" onClick={onClose}>Cerrar</button>
        </div>
      </div>

      <div className="price-config-grid">
        <label>Moneda<select value={draft.currency} onChange={(e) => setDraftValue("currency", e.target.value)} disabled={frozen}><option>USD</option><option>MXN</option></select></label>
        <label>Nombre<input value={draft.name.replace(/^(USD|MXN)\s*-\s*/i, "")} onChange={(e) => setDraftValue("name", e.target.value)} readOnly={frozen} /></label>
        <label>Tipo de cambio<input type="number" step="0.01" value={draft.tipo_cambio || ""} onChange={(e) => setDraftValue("tipo_cambio", e.target.value)} readOnly={frozen} /></label>
        <label>Fecha consulta USD<input type="date" value={draft.exchange_rate_date || ""} onChange={(e) => setDraftValue("exchange_rate_date", e.target.value)} readOnly={frozen} /></label>
        <label>Metodo PF<select value={draft.pf_mode} onChange={(e) => setDraftValue("pf_mode", e.target.value)} disabled={frozen}><option value="manual">Manual</option><option value="kitco">Kitco</option></select></label>
        {draft.pf_mode === "kitco" ? (
          <>
            <label>Kitco USD/oz<input type="number" step="0.01" value={draft.kitco_usd_oz || ""} onChange={(e) => setDraftValue("kitco_usd_oz", e.target.value)} readOnly={frozen} /></label>
            <label>OZ - GR<input className="readonly-pill" value={TROY_OUNCE_GRAMS} readOnly /></label>
            <label>Premio %<input type="number" step="0.1" value={draft.premio_pct || ""} onChange={(e) => setDraftValue("premio_pct", e.target.value)} readOnly={frozen} /></label>
            <label>Fecha Kitco<input type="date" value={draft.kitco_date || ""} onChange={(e) => setDraftValue("kitco_date", e.target.value)} readOnly={frozen} /></label>
          </>
        ) : null}
        <label>PF {draft.currency}/g<input type="number" step="0.01" value={fineSilver || ""} onChange={(e) => setDraftValue("plata_fina_value", e.target.value)} readOnly={frozen || draft.pf_mode === "kitco"} /></label>
        <label className="wide-field">Comentarios<input value={draft.comments || ""} onChange={(e) => setDraftValue("comments", e.target.value)} readOnly={frozen} placeholder="Ej. Cotizacion Rosett 01 de junio 2026" /></label>
      </div>

      {!frozen ? (
        <div className="price-bulk-tools">
          <span>Editar todas las lineas</span>
          <input type="number" step="0.1" placeholder="Utilidad %, ej. 20" onChange={(e) => applyMarginAll(e.target.value)} />
        </div>
      ) : null}

      <div className="responsive-table price-lines-wrap">
        <table className="simple-admin-table price-list-table">
          <thead>
            <tr>
              <th>Linea</th>
              <th className="right">Costo labor MXN</th>
              <th className="right">Costo labor USD</th>
              <th className="right">Costo PF {draft.currency}</th>
              <th className="right">Costo total</th>
              <th className="right">Utilidad</th>
              <th className="right">Precio integrado</th>
              <th className="right">Precio labor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.line_codigo}>
                <td><strong>{row.line_codigo}</strong><small>{row.descripcion}</small></td>
                <td><input type="number" step="0.01" value={row.labor_mxn || ""} onChange={(e) => setRow(idx, "labor_mxn", e.target.value)} readOnly={frozen} /></td>
                <td className="right">{money(row.labor_usd, "USD")}</td>
                <td className="right">{money(row.silver_fine, draft.currency)}</td>
                <td className="right">{money(row.total_cost, draft.currency)}</td>
                <td><input type="number" step="0.1" value={row.margin_pct || ""} onChange={(e) => setRow(idx, "margin_pct", e.target.value)} readOnly={frozen} /></td>
                <td className="right"><strong>{money(row.integrated_price, draft.currency)}</strong></td>
                <td className="right">{money(row.final_labor, draft.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function PricingPanel({ products = [], tenantId = "" }) {
  const [lists, setLists] = useState([]);
  const [productLines, setProductLines] = useState([]);
  const [openList, setOpenList] = useState(null);
  const [notice, setNotice] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    const [nextLists, nextLines] = await Promise.all([fetchLaborLists(tenantId), fetchLines(tenantId)]);
    const withCounts = await Promise.all(nextLists.map(async (list) => {
      const rows = await fetchLaborListLines(list.id).catch(() => []);
      return { ...list, _configured: rows.length };
    }));
    setLists(withCounts);
    setProductLines(nextLines);
  };

  useEffect(() => { load().catch((error) => setNotice({ type: "error", title: "Error", message: error.message })); }, [tenantId]);

  const createNew = () => setOpenList({ ...blankList, name: "USD -" });

  const syncLines = async () => {
    setSyncing(true);
    try {
      const updated = await syncProductLinesFromProducts(products, tenantId);
      setProductLines(updated);
      setNotice({ type: "success", title: "Lineas actualizadas", message: `${updated.length} lineas disponibles.` });
    } catch (error) {
      setNotice({ type: "error", title: "Error", message: error.message });
    } finally {
      setSyncing(false);
    }
  };

  const filtered = lists.filter((list) => statusFilter === "all" || (list.status || "borrador") === statusFilter);

  return (
    <section className="clients-workspace pricing-workspace">
      {openList ? (
        <div className="workspace-tabs">
          <button className="workspace-tab" type="button" onClick={() => setOpenList(null)}>Listas</button>
          <button className="workspace-tab active" type="button">{openList.name || "Nueva lista"} <span>×</span></button>
        </div>
      ) : null}

      {openList ? (
        <PriceListEditor
          list={openList}
          productLines={productLines}
          tenantId={tenantId}
          onClose={() => setOpenList(null)}
          onSaved={(saved, keepOpen = false) => {
            load();
            setOpenList(keepOpen ? saved : null);
          }}
          setNotice={setNotice}
        />
      ) : (
        <>
          <header className="clients-page-header">
            <div>
              <h2>Listas de precios</h2>
              <p>{filtered.length} de {lists.length} listas. Las listas activas se usan en preorden segun moneda.</p>
            </div>
            <button className="primary-button compact-action success-action" type="button" onClick={createNew}>+ Nueva lista</button>
          </header>

          <section className="clients-filter-card pricing-list-filter">
            <div className="price-status-tabs">
              <button className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")} type="button">Todas</button>
              <button className={statusFilter === "borrador" ? "active" : ""} onClick={() => setStatusFilter("borrador")} type="button">Borrador</button>
              <button className={statusFilter === "activa" ? "active" : ""} onClick={() => setStatusFilter("activa")} type="button">Activas</button>
            </div>
            <button className="secondary-button compact-action" type="button" onClick={syncLines} disabled={syncing}>{syncing ? "Actualizando..." : "Actualizar lineas"}</button>
          </section>

          <section className="clients-table-card">
            <div className="responsive-table">
              <table className="simple-admin-table clients-directory-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Moneda</th>
                    <th>Estado</th>
                    <th>TC</th>
                    <th>Kitco</th>
                    <th>PF/g</th>
                    <th>Lineas</th>
                    <th>Fecha</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((list) => (
                    <tr key={list.id}>
                      <td><strong>{list.name}</strong><small>{list.comments || "-"}</small></td>
                      <td>{list.currency || "MXN"}</td>
                      <td><span className={`price-status-badge ${list.status || "borrador"}`}>{list.status || "borrador"}</span></td>
                      <td>{list.tipo_cambio || "-"}</td>
                      <td>{list.kitco_usd_oz || "-"}</td>
                      <td>{money(list.plata_fina_value, list.currency)}</td>
                      <td>{list._configured || 0}</td>
                      <td>{list.created_at ? new Date(list.created_at).toLocaleDateString("es-MX") : "-"}</td>
                      <td><button className="secondary-button compact-action" type="button" onClick={() => setOpenList(list)}>Abrir</button></td>
                    </tr>
                  ))}
                  {!filtered.length ? <tr><td colSpan="9" className="empty-row">Aun no hay listas de precios.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </section>
  );
}
