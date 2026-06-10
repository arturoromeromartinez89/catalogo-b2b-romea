import jsPDF from "jspdf";
import { useEffect, useMemo, useState } from "react";
import ActionNotice from "./ActionNotice";
import { compressImageForPdf, imageAlias } from "../utils/pdfImageCompression";
import { savePdfWithSize } from "../utils/pdfSave";
import { fetchCompanySettings } from "../services/companySettings";
import {
  buildPriceListName,
  calculatePiecePriceListItem,
  calculateFineSilver,
  calculatePriceListLine,
  duplicateLaborList,
  duplicatePiecePriceList,
  fetchLaborListLines,
  fetchLaborLists,
  fetchLines,
  fetchPiecePriceListItems,
  fetchPiecePriceLists,
  inferLaborFromLineCode,
  roundUp2,
  saveLaborList,
  savePiecePriceList,
  syncProductLinesFromProducts,
  TROY_OUNCE_GRAMS,
  upsertLaborListLines,
  upsertPiecePriceListItems,
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
  prepared_by: "",
};

const blankPieceList = {
  currency: "MXN",
  name: "MXN -",
  status: "borrador",
  margin_pct: 20,
  tipo_cambio: "",
  comments: "",
  prepared_by: "",
};

const money = (value, currency = "USD") =>
  `${currency === "USD" ? "US$" : "$"}${Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const loadImageAsDataUrl = (url) =>
  compressImageForPdf(url, { boxWmm: 42, boxHmm: 22, dpi: 120, quality: 0.52, timeoutMs: 3500 });

const addContainedImage = (doc, image, x, y, maxW, maxH) => {
  try {
    const props = doc.getImageProperties(image.dataUrl);
    const ratio = Math.min(maxW / props.width, maxH / props.height);
    const width = props.width * ratio;
    const height = props.height * ratio;
    doc.addImage(image.dataUrl, "JPEG", x + (maxW - width) / 2, y + (maxH - height) / 2, width, height, image.alias, "SLOW");
  } catch {
    // If the image cannot be read, leave the header clean.
  }
};

const pdfText = (value) => String(value ?? "-");

const normalizeList = (list = {}) => ({
  ...blankList,
  ...list,
  currency: list.currency || "MXN",
  status: list.status || "borrador",
  pf_mode: list.pf_mode || "manual",
  oz_grams: Number(list.oz_grams || TROY_OUNCE_GRAMS),
  prepared_by: list.prepared_by || list.source_snapshot?.prepared_by || "",
});

const normalizePieceList = (list = {}) => ({
  ...blankPieceList,
  ...list,
  currency: list.currency || "MXN",
  status: list.status || "borrador",
  margin_pct: Number(list.margin_pct || 0),
  prepared_by: list.prepared_by || list.source_snapshot?.prepared_by || "",
});

const normalizeHeader = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const readFirst = (row, aliases) => {
  const entries = Object.entries(row || {});
  const found = entries.find(([key]) => aliases.includes(normalizeHeader(key)));
  return found ? found[1] : "";
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const clean = String(value).replace(/[$,\s]/g, "");
  const number = Number(clean);
  return Number.isFinite(number) ? number : 0;
};

const parsePieceCostExcel = async (file) => {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows
    .map((row) => ({
      codigo: String(readFirst(row, ["codigo", "sku", "code", "modelo"])).trim(),
      descripcion: String(readFirst(row, ["descripcion", "description", "desc"])).trim(),
      cost_mxn: toNumber(readFirst(row, ["costo_pieza", "costo_pieza_mxn", "costo", "cost", "cost_mxn", "precio_costo"])),
    }))
    .filter((row) => row.codigo);
};

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

function PriceListPdfButton({ list, lines, company, profile }) {
  const handlePdf = () => {
    try {
      const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait", compress: true });
      const blue = [31, 51, 95];
      const orange = [217, 119, 6];
      const gray = [105, 113, 130];
      const lineGray = [226, 231, 240];
      const createdAt = list.created_at ? new Date(list.created_at).toLocaleDateString("es-MX") : new Date().toLocaleDateString("es-MX");
      const storedLogo = typeof localStorage !== "undefined" ? localStorage.getItem("romea-logo-data") : "";
      const logo = [company?.logoDataUrl, company?.logo_data_url, storedLogo]
        .find((value) => String(value || "").startsWith("data:image"));

      const centerText = (text, x, y, width) => {
        const value = pdfText(text);
        doc.text(value, x + Math.max(0, (width - doc.getTextWidth(value)) / 2), y);
      };
      const valueOrDash = (value) => (value === 0 || value ? pdfText(value) : "-");

      doc.setTextColor(...blue);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.text("DESGLOSE DE LISTA DE PRECIOS", 12, 16);
      doc.setFontSize(10);
      doc.text(`Lista de precios: ${pdfText(list.name || "Lista de precios")}`, 12, 24);
      doc.setTextColor(...gray);
      doc.setFontSize(8);
      doc.text(`Fecha de elaboracion: ${createdAt}`, 12, 30);
      if (logo) addContainedImage(doc, logo, 156, 7, 44, 24);
      doc.setDrawColor(...lineGray);
      doc.line(12, 36, 204, 36);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...blue);
      doc.setFontSize(12);
      doc.text("Historia del calculo", 12, 46);

      const drawBox = (x, y, w, title, rows, accent) => {
        doc.setDrawColor(...lineGray);
        doc.setFillColor(247, 248, 251);
        doc.rect(x, y, w, 34, "F");
        doc.rect(x, y, w, 34, "S");
        doc.setFillColor(...accent);
        doc.rect(x, y, w, 8, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        centerText(title, x, y + 5.4, w);
        rows.forEach((row, index) => {
          const rowY = y + 8 + index * 8;
          doc.setDrawColor(...lineGray);
          doc.line(x, rowY, x + w, rowY);
          doc.line(x + w / 2, rowY, x + w / 2, rowY + 8);
          doc.setTextColor(...gray);
          doc.setFontSize(6.2);
          doc.setFont("helvetica", "bold");
          centerText(row[0], x, rowY + 3, w / 2);
          doc.setTextColor(...blue);
          doc.setFontSize(7.5);
          centerText(row[1], x + w / 2, rowY + 5.7, w / 2);
        });
      };

      drawBox(12, 52, 86, "TC Y MONEDA", [
        ["Moneda", valueOrDash(list.currency)],
        ["Tipo de cambio", valueOrDash(list.tipo_cambio)],
        ["Fecha consulta USD", valueOrDash(list.exchange_rate_date)],
      ], blue);

      drawBox(108, 52, 96, "DESGLOSE DEL PRECIO DE LA PLATA", [
        ["KITCO USD/OZ", valueOrDash(list.kitco_usd_oz)],
        ["Premio / Fecha", `${valueOrDash(list.premio_pct)}% / ${valueOrDash(list.kitco_date)}`],
        ["Valor PF resultante", `${money(list.plata_fina_value, list.currency)}/g`],
      ], orange);

      doc.setTextColor(...gray);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const comments = doc.splitTextToSize(`Comentarios: ${pdfText(list.comments || "-")}`, 180);
      doc.text(comments.slice(0, 2), 12, 96);

      const headerY = 112;
      doc.setFillColor(240, 244, 252);
      doc.rect(12, headerY - 6, 192, 10, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.6);
      [
        ["Linea", 14, blue],
        ["Labor MXN\n(costo)", 37, orange],
        ["Labor USD\n(costo)", 63, orange],
        ["PF\n(costo)", 91, orange],
        ["Costo total\n(costo)", 115, orange],
        ["Margen", 142, gray],
        ["Precio integrado", 160, blue],
        ["Precio labor", 187, blue],
      ].forEach(([label, x, color]) => {
        doc.setTextColor(...color);
        doc.text(label, x, headerY - 1);
      });
      doc.setDrawColor(...lineGray);
      doc.line(12, headerY + 5, 204, headerY + 5);

      let y = headerY + 11;
      const rowHeight = Math.max(3.6, Math.min(5.3, (264 - y) / Math.max(lines.length, 1)));
      doc.setFont("helvetica", "bold");
      doc.setFontSize(rowHeight < 4.1 ? 5.2 : 6.3);
      lines.forEach((line, idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(250, 251, 253);
          doc.rect(12, y - rowHeight + 1, 192, rowHeight, "F");
        }
        doc.setTextColor(...blue);
        doc.text(pdfText(line.line_codigo), 14, y);
        doc.setTextColor(35, 45, 65);
        doc.text(money(line.labor_mxn, "MXN"), 37, y);
        doc.text(money(line.labor_usd, "USD"), 63, y);
        doc.text(money(line.silver_fine, list.currency), 91, y);
        doc.text(money(line.total_cost, list.currency), 115, y);
        doc.text(`${Number(line.margin_pct || 0).toFixed(2)}%`, 142, y);
        doc.text(money(line.integrated_price, list.currency), 160, y);
        doc.text(money(line.final_labor, list.currency), 187, y);
        y += rowHeight;
      });

      doc.setTextColor(130, 130, 130);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`Elaborado por: ${pdfText(list.prepared_by || profile?.email || "usuario no identificado")}`, 12, 270);
      doc.text("Documento interno. No compartir con cliente final.", 12, 276);
      doc.text("1 / 1", 202, 276);
      const sizeMb = savePdfWithSize(doc, `lista-precios-${(list.name || "interna").replace(/[\\/:*?"<>|]/g, "-")}.pdf`);
      window.alert(`PDF generado. Peso: ${sizeMb.toFixed(2)} MB.`);
    } catch (error) {
      console.error("Error generating price list PDF", error);
      window.alert(`No se pudo generar el PDF interno: ${error.message || "error desconocido"}`);
    }
  };
  return <button className="secondary-button compact-action" type="button" onClick={handlePdf}>PDF interno</button>;
}

function PriceListEditor({ list, productLines, tenantId, profile, company, onClose, onSaved, setNotice }) {
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
      let saved;
      try {
        saved = await saveLaborList({
          ...draft,
          status,
          plata_fina_value: fineSilver,
          source_snapshot: {
            formula: draft.pf_mode === "kitco" ? "PF = (Kitco USD oz / 31.1) * (1 + premio/100)" : "PF manual",
            generated_at: new Date().toISOString(),
            prepared_by: draft.prepared_by || profile?.email || "",
          },
        }, tenantId);
      } catch (error) {
        throw new Error(`No se pudo guardar el encabezado de la lista. ${error.message || error}`);
      }

      try {
        await upsertLaborListLines(saved.id, rows);
      } catch (error) {
        throw new Error(`La lista se guardo, pero fallaron las lineas. ${error.message || error}`);
      }

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
          <PriceListPdfButton list={{ ...draft, plata_fina_value: fineSilver }} lines={rows} company={company} profile={profile} />
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
        <label>Elaborado por<input value={draft.prepared_by || ""} onChange={(e) => setDraftValue("prepared_by", e.target.value)} readOnly={frozen} placeholder="Nombre de quien elaboro la lista" /></label>
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

function PiecePriceListEditor({ list, tenantId, profile, onClose, onSaved, setNotice }) {
  const [draft, setDraft] = useState(() => normalizePieceList(list));
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const frozen = Boolean(draft.id && draft.status === "activa");

  const recalcRows = (nextDraft = draft, nextRows = rows) => {
    setRows(nextRows.map((row) => calculatePiecePriceListItem({
      item: row,
      currency: nextDraft.currency,
      exchangeRate: nextDraft.tipo_cambio,
      marginPct: row.margin_pct ?? nextDraft.margin_pct,
    })));
  };

  useEffect(() => {
    const load = async () => {
      const sourceRows = draft.id ? await fetchPiecePriceListItems(draft.id) : [];
      setRows(sourceRows.map((row) => calculatePiecePriceListItem({
        item: row,
        currency: draft.currency,
        exchangeRate: draft.tipo_cambio,
        marginPct: row.margin_pct ?? draft.margin_pct,
      })));
    };
    load().catch((error) => setNotice({ type: "error", title: "Error", message: error.message }));
  }, [draft.id]);

  const setDraftValue = (key, value) => {
    const next = { ...draft, [key]: value };
    if (key === "currency") next.name = buildPriceListName(value, draft.name);
    if (key === "name") next.name = buildPriceListName(draft.currency, value);
    setDraft(next);
    window.setTimeout(() => recalcRows(next), 0);
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const imported = await parsePieceCostExcel(file);
      const nextRows = imported.map((row) => calculatePiecePriceListItem({
        item: { ...row, margin_pct: draft.margin_pct },
        currency: draft.currency,
        exchangeRate: draft.tipo_cambio,
        marginPct: draft.margin_pct,
      }));
      setRows(nextRows);
      setNotice({ type: "success", title: "Costos cargados", message: `${nextRows.length} SKUs importados desde Excel.` });
    } catch (error) {
      setNotice({ type: "error", title: "No se pudo leer el Excel", message: error.message });
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const setRow = (idx, key, value) => {
    if (frozen) return;
    const nextRows = [...rows];
    nextRows[idx] = { ...nextRows[idx], [key]: key === "descripcion" ? value : Number(value || 0) };
    recalcRows(draft, nextRows);
  };

  const applyMarginAll = (value) => {
    const margin = Number(value || 0);
    setDraft((current) => ({ ...current, margin_pct: margin }));
    recalcRows({ ...draft, margin_pct: margin }, rows.map((row) => ({ ...row, margin_pct: margin })));
  };

  const handleSave = async (status = draft.status) => {
    if (!rows.length) {
      setNotice({ type: "error", title: "Sin SKUs", message: "Carga primero un Excel con codigo y costo por pieza." });
      return;
    }
    setSaving(true);
    try {
      const saved = await savePiecePriceList({
        ...draft,
        status,
        source_snapshot: {
          formula: draft.currency === "USD"
            ? "Precio = (costo MXN / tipo de cambio) / (1 - margen%)"
            : "Precio = costo MXN / (1 - margen%)",
          generated_at: new Date().toISOString(),
          prepared_by: draft.prepared_by || profile?.email || "",
        },
      }, tenantId);
      await upsertPiecePriceListItems(saved.id, rows, saved);
      setNotice({ type: "success", title: "Lista por pieza guardada", message: `${saved.name} guardada correctamente.` });
      onSaved(saved);
    } catch (error) {
      setNotice({ type: "error", title: "No se pudo guardar", message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const duplicate = async () => {
    const copy = await duplicatePiecePriceList(draft, tenantId);
    setNotice({ type: "success", title: "Version duplicada", message: `${copy.name} creada como borrador.` });
    onSaved(copy, true);
  };

  return (
    <section className="price-editor-page">
      <div className="price-editor-toolbar">
        <div>
          <span className="tool-eyebrow">Lista por pieza</span>
          <h2>{draft.name}</h2>
          {frozen ? <p className="muted">Lista activa congelada. Duplica para modificar costos, margen o tipo de cambio.</p> : <p className="muted">Importa costos por SKU y calcula precio final por pieza con margen.</p>}
        </div>
        <div className="price-editor-actions">
          {frozen ? <button className="primary-button compact-action" type="button" onClick={duplicate}>Duplicar version</button> : null}
          {!frozen ? <button className="secondary-button compact-action" type="button" onClick={() => handleSave("borrador")} disabled={saving}>Guardar borrador</button> : null}
          {!frozen ? <button className="primary-button compact-action" type="button" onClick={() => handleSave("activa")} disabled={saving}>Activar lista</button> : null}
          <button className="secondary-button compact-action" type="button" onClick={onClose}>Cerrar</button>
        </div>
      </div>

      <div className="price-config-grid">
        <label>Moneda<select value={draft.currency} onChange={(e) => setDraftValue("currency", e.target.value)} disabled={frozen}><option>MXN</option><option>USD</option></select></label>
        <label>Nombre<input value={draft.name.replace(/^(USD|MXN)\s*-\s*/i, "")} onChange={(e) => setDraftValue("name", e.target.value)} readOnly={frozen} /></label>
        <label>Tipo de cambio<input type="number" step="0.01" value={draft.tipo_cambio || ""} onChange={(e) => setDraftValue("tipo_cambio", e.target.value)} readOnly={frozen} placeholder="Requerido para USD" /></label>
        <label>Margen general %<input type="number" step="0.1" value={draft.margin_pct || ""} onChange={(e) => applyMarginAll(e.target.value)} readOnly={frozen} /></label>
        <label>Elaborado por<input value={draft.prepared_by || ""} onChange={(e) => setDraftValue("prepared_by", e.target.value)} readOnly={frozen} placeholder="Nombre de quien elaboro la lista" /></label>
        <label className="wide-field">Comentarios<input value={draft.comments || ""} onChange={(e) => setDraftValue("comments", e.target.value)} readOnly={frozen} placeholder="Ej. Lista por pieza para cliente mayorista" /></label>
      </div>

      {!frozen ? (
        <div className="price-bulk-tools piece-import-tools">
          <div>
            <span>Excel de costos por SKU</span>
            <small>Columnas aceptadas: codigo / sku, descripcion, costo_pieza o costo.</small>
          </div>
          <label className="secondary-button compact-action file-action">
            {importing ? "Leyendo..." : "Cargar Excel de costos"}
            <input type="file" accept=".xlsx,.xls" onChange={handleImport} />
          </label>
          <input type="number" step="0.1" placeholder="Aplicar margen a todos, ej. 20" onChange={(e) => applyMarginAll(e.target.value)} />
        </div>
      ) : null}

      <div className="responsive-table price-lines-wrap">
        <table className="simple-admin-table price-list-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Descripcion</th>
              <th className="right">Costo pieza MXN</th>
              <th className="right">Costo pieza USD</th>
              <th className="right">Margen</th>
              <th className="right">Precio final {draft.currency}</th>
              <th className="right">Precio final MXN</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.codigo}-${idx}`}>
                <td><strong>{row.codigo}</strong></td>
                <td><input value={row.descripcion || ""} onChange={(e) => setRow(idx, "descripcion", e.target.value)} readOnly={frozen} /></td>
                <td><input type="number" step="0.01" value={row.cost_mxn || ""} onChange={(e) => setRow(idx, "cost_mxn", e.target.value)} readOnly={frozen} /></td>
                <td className="right">{money(row.cost_usd, "USD")}</td>
                <td><input type="number" step="0.1" value={row.margin_pct || ""} onChange={(e) => setRow(idx, "margin_pct", e.target.value)} readOnly={frozen} /></td>
                <td className="right"><strong>{money(row.unit_price, draft.currency)}</strong></td>
                <td className="right">{money(row.unit_price_mxn, "MXN")}</td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan="7" className="empty-row">Carga un Excel con codigo y costo por pieza.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function PricingPanel({ products = [], tenantId = "", profile }) {
  const [priceMode, setPriceMode] = useState("gram");
  const [lists, setLists] = useState([]);
  const [pieceLists, setPieceLists] = useState([]);
  const [productLines, setProductLines] = useState([]);
  const [openList, setOpenList] = useState(null);
  const [notice, setNotice] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [company, setCompany] = useState({});

  const load = async () => {
    const [nextLists, nextPieceLists, nextLines, nextCompany] = await Promise.all([
      fetchLaborLists(tenantId),
      fetchPiecePriceLists(tenantId).catch((error) => {
        if (/piece_price_lists|schema cache|does not exist/i.test(error.message || "")) return [];
        throw error;
      }),
      fetchLines(tenantId),
      fetchCompanySettings(tenantId),
    ]);
    const withCounts = await Promise.all(nextLists.map(async (list) => {
      const rows = await fetchLaborListLines(list.id).catch(() => []);
      return { ...list, _configured: rows.length };
    }));
    const pieceWithCounts = await Promise.all(nextPieceLists.map(async (list) => {
      const rows = await fetchPiecePriceListItems(list.id).catch(() => []);
      return { ...list, _configured: rows.length };
    }));
    setLists(withCounts);
    setPieceLists(pieceWithCounts);
    setProductLines(nextLines);
    setCompany(nextCompany || {});
    if (nextCompany?.logo_url) {
      loadImageAsDataUrl(nextCompany.logo_url)
        .then((logoImage) => {
          if (logoImage) setCompany((current) => ({
            ...current,
            logoDataUrl: { ...logoImage, alias: imageAlias(nextCompany.logo_url) },
          }));
        })
        .catch(() => {});
    }
  };

  useEffect(() => { load().catch((error) => setNotice({ type: "error", title: "Error", message: error.message })); }, [tenantId]);

  const createNew = () => setOpenList(priceMode === "piece"
    ? { ...blankPieceList, name: "MXN -", pricing_kind: "piece" }
    : { ...blankList, name: "USD -", pricing_kind: "gram" });

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

  const activeLists = priceMode === "piece" ? pieceLists : lists;
  const filtered = activeLists.filter((list) => statusFilter === "all" || (list.status || "borrador") === statusFilter);
  const openKind = openList?.pricing_kind || priceMode;

  return (
    <section className="clients-workspace pricing-workspace">
      {openList ? (
        <div className="workspace-tabs">
          <button className="workspace-tab" type="button" onClick={() => setOpenList(null)}>Listas</button>
          <button className="workspace-tab active" type="button">{openList.name || "Nueva lista"} <span>×</span></button>
        </div>
      ) : null}

      {openList && openKind === "piece" ? (
        <PiecePriceListEditor
          list={openList}
          tenantId={tenantId}
          profile={profile}
          onClose={() => setOpenList(null)}
          onSaved={(saved, keepOpen = false) => {
            load();
            setOpenList(keepOpen ? { ...saved, pricing_kind: "piece" } : null);
          }}
          setNotice={setNotice}
        />
      ) : openList ? (
        <PriceListEditor
          list={openList}
          productLines={productLines}
          tenantId={tenantId}
          profile={profile}
          company={company}
          onClose={() => setOpenList(null)}
          onSaved={(saved, keepOpen = false) => {
            load();
            setOpenList(keepOpen ? { ...saved, pricing_kind: "gram" } : null);
          }}
          setNotice={setNotice}
        />
      ) : (
        <>
          <header className="clients-page-header">
            <div>
              <h2>Listas de precios</h2>
              <p>{filtered.length} de {activeLists.length} listas. Las listas activas se usan en preorden segun moneda y tipo de cotizacion.</p>
            </div>
            <button className="primary-button compact-action success-action" type="button" onClick={createNew}>+ Nueva lista {priceMode === "piece" ? "por pieza" : "por gramo"}</button>
          </header>

          <section className="clients-filter-card pricing-list-filter">
            <div className="price-status-tabs">
              <button className={priceMode === "gram" ? "active" : ""} onClick={() => { setPriceMode("gram"); setOpenList(null); }} type="button">Por gramo</button>
              <button className={priceMode === "piece" ? "active" : ""} onClick={() => { setPriceMode("piece"); setOpenList(null); }} type="button">Por pieza</button>
            </div>
            <div className="price-status-tabs">
              <button className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")} type="button">Todas</button>
              <button className={statusFilter === "borrador" ? "active" : ""} onClick={() => setStatusFilter("borrador")} type="button">Borrador</button>
              <button className={statusFilter === "activa" ? "active" : ""} onClick={() => setStatusFilter("activa")} type="button">Activas</button>
            </div>
            {priceMode === "gram" ? (
              <button className="secondary-button compact-action" type="button" onClick={syncLines} disabled={syncing}>{syncing ? "Actualizando..." : "Actualizar lineas"}</button>
            ) : (
              <p className="muted">Excel requerido: codigo, descripcion y costo por pieza en MXN.</p>
            )}
          </section>

          <section className="clients-table-card">
            <div className="responsive-table">
              <table className="simple-admin-table clients-directory-table">
                <thead>
                  {priceMode === "piece" ? (
                    <tr>
                      <th>Nombre</th>
                      <th>Moneda</th>
                      <th>Estado</th>
                      <th>TC</th>
                      <th>Margen</th>
                      <th>SKUs</th>
                      <th>Fecha</th>
                      <th>Acciones</th>
                    </tr>
                  ) : (
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
                  )}
                </thead>
                <tbody>
                  {filtered.map((list) => priceMode === "piece" ? (
                    <tr key={list.id}>
                      <td><strong>{list.name}</strong><small>{list.comments || "-"}</small></td>
                      <td>{list.currency || "MXN"}</td>
                      <td><span className={`price-status-badge ${list.status || "borrador"}`}>{list.status || "borrador"}</span></td>
                      <td>{list.tipo_cambio || "-"}</td>
                      <td>{Number(list.margin_pct || 0).toFixed(2)}%</td>
                      <td>{list._configured || 0}</td>
                      <td>{list.created_at ? new Date(list.created_at).toLocaleDateString("es-MX") : "-"}</td>
                      <td><button className="secondary-button compact-action" type="button" onClick={() => setOpenList({ ...list, pricing_kind: "piece" })}>Abrir</button></td>
                    </tr>
                  ) : (
                    <tr key={list.id}>
                      <td><strong>{list.name}</strong><small>{list.comments || "-"}</small></td>
                      <td>{list.currency || "MXN"}</td>
                      <td><span className={`price-status-badge ${list.status || "borrador"}`}>{list.status || "borrador"}</span></td>
                      <td>{list.tipo_cambio || "-"}</td>
                      <td>{list.kitco_usd_oz || "-"}</td>
                      <td>{money(list.plata_fina_value, list.currency)}</td>
                      <td>{list._configured || 0}</td>
                      <td>{list.created_at ? new Date(list.created_at).toLocaleDateString("es-MX") : "-"}</td>
                      <td><button className="secondary-button compact-action" type="button" onClick={() => setOpenList({ ...list, pricing_kind: "gram" })}>Abrir</button></td>
                    </tr>
                  ))}
                  {!filtered.length ? <tr><td colSpan={priceMode === "piece" ? "8" : "9"} className="empty-row">Aun no hay listas de precios {priceMode === "piece" ? "por pieza" : "por gramo"}.</td></tr> : null}
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
