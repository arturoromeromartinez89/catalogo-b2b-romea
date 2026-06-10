import jsPDF from "jspdf";
import { imageUrlForSize } from "./formatters";
import { compressImageForPdf, imageAlias } from "./pdfImageCompression";
import { savePdfWithSize } from "./pdfSave";

const withTimeout = (promise, ms = 4000) =>
  Promise.race([
    promise,
    new Promise((resolve) => window.setTimeout(() => resolve(null), ms)),
  ]);

const loadImageAsDataUrl = async (url, options = {}) => {
  if (!url) return null;
  const compressed = await withTimeout(compressImageForPdf(url, options));
  return compressed?.dataUrl || null;
};

const page = { w: 216, h: 279, margin: 12, col: 192 };
const footerReserve = 12;

const txt = (doc, str, x, y, opts = {}) => {
  if (!str && str !== 0) return;
  doc.text(String(str), x, y, opts);
};

const money = (n) => {
  if (!n && n !== 0) return "—";
  return `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const imageFormat = (dataUrl = "") => {
  const value = String(dataUrl).toLowerCase();
  if (value.startsWith("data:image/png")) return "PNG";
  if (value.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
};

const addContainedImage = (doc, dataUrl, x, y, maxW, maxH, alias = undefined) => {
  if (!dataUrl) return;
  try {
    const props = doc.getImageProperties(dataUrl);
    const ratio = props.width && props.height ? Math.min(maxW / props.width, maxH / props.height) : 1;
    const w = Math.max(1, props.width * ratio);
    const h = Math.max(1, props.height * ratio);
    doc.addImage(dataUrl, imageFormat(dataUrl), x + (maxW - w) / 2, y + (maxH - h) / 2, w, h, alias, "SLOW");
  } catch {
    try { doc.addImage(dataUrl, imageFormat(dataUrl), x, y, maxW, maxH, alias, "SLOW"); } catch {}
  }
};

const buildFolio = (customer) => {
  const num = customer.numero || "";
  if (num.startsWith("PRE-")) return num;
  const serie = customer.serie || "PRE";
  if (num) return `${serie}-${num}`;
  const d = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${serie}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};

export async function generatePdf(cartItems, customer, language = "es", company = {}, opts = {}) {
  const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait", compress: true, precision: 2, putOnlyUsedFonts: true });
  const brandName = company.brand_name || company.legal_name || "";
  const t = (es, en) => language === "en" ? en : es;
  const folio = buildFolio(customer);
  const today = new Date().toLocaleDateString(language === "en" ? "en-US" : "es-MX");
  const currency = customer.currency || "MXN";
  const exchangeRate = Number(customer.tipoCambio || 0);
  const useUsd = currency === "USD" && exchangeRate > 0;
  const displayMoney = (value) => (useUsd ? Number(value || 0) / exchangeRate : Number(value || 0));
  const showGramos = opts.showGramos !== false;
  const showBreakdown = opts.showBreakdown !== false;
  const isPiecePricing = opts.pricingMode === "piece"
    || customer.pricingMode === "piece"
    || cartItems.some((item) => (item.pricing_mode || item.product?.pricing_mode) === "piece");
  const applyIva = Boolean(opts.applyIva || customer.applyIva);
  const IVA_RATE = 0.16;
  const isDraft = (opts.status || customer.status || "").toLowerCase() === "borrador";
  const documentNotes = customer.notes || customer.notas || customer.observations || customer.observaciones || "";
  const pfMode = opts.pfMode || customer.pfMode || customer.pf_mode || "";
  const kitcoUsdOz = Number(opts.kitcoUsdOz || customer.kitcoUsdOz || customer.kitco_usd_oz || 0);
  const premiumPct = Number(opts.premiumPct || customer.premiumPct || customer.premio_pct || 0);
  const silverFineMxn = Number(opts.silverFineMxn || customer.silverFineMxn || customer.plataFinaMxn || customer.plata_fina_mxn || 0);
  const silverFineDisplay = silverFineMxn ? displayMoney(silverFineMxn) : 0;
  const hasSilverInfo = !isPiecePricing && (kitcoUsdOz || premiumPct || silverFineMxn || pfMode);

  // ── HEADER ───────────────────────────────────────────────
  const storedLogo = typeof localStorage !== "undefined" ? localStorage.getItem("romea-logo-data") : "";
  const logoSource = company.logo_data_url || company.logoDataUrl || company.logo_url || company.logoPath || storedLogo;
  const logo = await loadImageAsDataUrl(logoSource, { boxWmm: 42, boxHmm: 24, dpi: 150, quality: 0.62 });
  doc.setFillColor(31, 51, 95);
  doc.rect(0, 0, page.w, 32, "F");

  if (logo) addContainedImage(doc, logo, page.margin, 4, 42, 24, imageAlias(logoSource || "logo"));
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(180,195,220);
  txt(doc, t("Catálogo B2B · Mayorista", "B2B Catalog · Wholesale"), page.margin, 27);

  doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(255,255,255);
  txt(doc, folio, page.w - page.margin, 16, { align: "right" });
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(180,195,220);
  txt(doc, t("Preorden", "Preorder"), page.w - page.margin, 22, { align: "right" });
  txt(doc, today, page.w - page.margin, 27, { align: "right" });
  if (isDraft) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(52);
    doc.setTextColor(235, 240, 248);
    doc.text("BORRADOR", page.w / 2, page.h / 2, { align: "center", angle: 35 });
  }

  let y = 38;

  // ── PROVEEDOR ─────────────────────────────────────────────
  doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(100,100,100);
  txt(doc, t("PROVEEDOR", "SUPPLIER"), page.margin, y); y += 4;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(31,51,95);
  txt(doc, brandName, page.margin, y);
  if (brandName) y += 4;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(60,60,60);
  [
    company.legal_name,
    [company.city, company.state, company.country].filter(Boolean).join(", "),
    company.rfc ? `RFC: ${company.rfc}` : null,
    company.email ? `${t("Correo","Email")}: ${company.email}` : null,
    company.phone ? `Tel: ${company.phone}` : null,
  ].filter(Boolean).forEach((l) => { txt(doc, l, page.margin, y); y += 4; });

  // ── CLIENTE ───────────────────────────────────────────────
  const cx = page.margin + 100; let cy = 38;
  doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(100,100,100);
  txt(doc, t("CLIENTE","CUSTOMER"), cx, cy); cy += 4;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(31,51,95);
  txt(doc, customer.company || customer.name || t("Sin nombre","No name"), cx, cy); cy += 4;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(60,60,60);
  [
    customer.name && customer.company ? customer.name : null,
    customer.email ? `${t("Correo","Email")}: ${customer.email}` : null,
    customer.phone ? `Tel: ${customer.phone}` : null,
    customer.rfc ? `RFC: ${customer.rfc}` : null,
  ].filter(Boolean).forEach((l) => { txt(doc, l, cx, cy); cy += 4; });
  if (hasSilverInfo) {
    cy += 2;
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(100,100,100);
    txt(doc, t("VALORIZACION DE PLATA FINA", "FINE SILVER VALUATION"), cx, cy); cy += 4;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(60,60,60);
    const pfLines = [
      kitcoUsdOz ? `KITCO SILVER: ${money(kitcoUsdOz)} USD/OZ` : t("KITCO SILVER: pendiente", "KITCO SILVER: pending"),
      `+ PREMIUM: ${Number.isFinite(premiumPct) ? premiumPct : 0}%`,
      silverFineMxn
        ? `${t("VALOR PF", "FS VALUE")}: ${money(silverFineDisplay)} ${currency}/g`
        : t("VALOR PF: pendiente por confirmar", "FS VALUE: pending confirmation"),
    ];
    pfLines.forEach((l) => { txt(doc, l, cx, cy); cy += 4; });
  }

  y = Math.max(y, cy) + 5;
  doc.setDrawColor(200,210,230); doc.setLineWidth(0.3);
  doc.line(page.margin, y, page.w - page.margin, y); y += 6;

  const drawInfoBox = ({ x, boxY, w, title, lines, accent = [100, 100, 100] }) => {
    const wrapped = (lines || [])
      .filter(Boolean)
      .flatMap((line) => doc.splitTextToSize(String(line), w - 8));
    const h = Math.max(20, 12 + wrapped.length * 4);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(220, 228, 240);
    doc.roundedRect(x, boxY, w, h, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...accent);
    txt(doc, title, x + 4, boxY + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    txt(doc, wrapped, x + 4, boxY + 10);
    return h;
  };

  if (documentNotes) {
    if (y + 24 > page.h - footerReserve) { doc.addPage(); y = page.margin; }
    const noteH = drawInfoBox({
      x: page.margin,
      boxY: y,
      w: page.col,
      title: t("COMENTARIOS", "COMMENTS"),
      lines: [documentNotes],
      accent: [100, 100, 100],
    });
    y += noteH + 6;
  }

  // ── COLUMNAS ──────────────────────────────────────────────
  const C = {
    img:    page.margin,
    cod:    page.margin + 28,
    desc:   page.margin + 47,
    pzs:    page.margin + 86,
    gpz:    page.margin + 99,
    gtot:   page.margin + 114,
    labor:  page.margin + 130,
    pf:     page.margin + 145,
    pgr:    page.margin + 160,
    sub:    page.w - page.margin,
  };

  const drawTableHeader = (headerY) => {
    doc.setFillColor(240,244,252);
    doc.rect(page.margin, headerY - 2, page.col, 8, "F");
    doc.setFontSize(5.5); doc.setFont("helvetica","bold"); doc.setTextColor(60,80,120);
    const y = headerY;
  txt(doc, t("FOTO","PHOTO"),       C.img,   y+3);
  txt(doc, t("CÓD.","CODE"),       C.cod,   y+3);
  txt(doc, t("DESCRIPCIÓN","DESC"),C.desc,  y+3);
  txt(doc, t("PZS","QTY"),         C.pzs,   y+3);
  if (isPiecePricing) {
    txt(doc, t("PRECIO/PZA","PRICE/PC"), C.gtot, y+3);
  } else {
    txt(doc, t("G/PZA","G/PC"),      C.gpz,   y+3);
    txt(doc, t("G.TOTAL","G.TOTAL"), C.gtot,  y+3);
  }
  if (!isPiecePricing && showBreakdown) {
    txt(doc, t("LABOR","LABOR"),     C.labor, y+3);
    txt(doc, t("PF","FS"),           C.pf,    y+3);
    txt(doc, t("LAB+PF","LAB+FS"),   C.pgr,  y+3);
  } else if (!isPiecePricing) {
    txt(doc, t("PRECIO/G","PRICE/G"), C.pgr, y+3);
  }
    txt(doc, t("SUBTOTAL","SUBTOTAL"),C.sub,  y+3, { align: "right" });
    return headerY + 10;
  };
  y = drawTableHeader(y);

  let grandTotal = 0;
  let grandGramos = 0;
  let grandPiezas = 0;

  for (const item of cartItems) {
    const qty = Number(item.quantity || 1);
    const gPieza = Number(item.product?.pesoPromedio || item.gramos_por_pieza || 0);
    const gTotal = Number(item.gramos_total || (gPieza * qty));
    const labor = Number(item.labor_mxn || item.product?.quoteLaborPerGram || 0);
    const pGramo = Number(item.precio_gramo_mxn || item.product?.precioMinimo || 0);
    const pPieza = Number(item.precio_pieza_mxn || item.product?.precioPieza || 0);
    const plataFina = Number(item.plata_fina_mxn || Math.max(0, pGramo - labor));
    const subtotal = Number(item.subtotal_mxn || (isPiecePricing ? qty * pPieza : gTotal * pGramo));
    grandTotal += subtotal;
    grandGramos += gTotal;
    grandPiezas += qty;

    const rowH = 28;
    if (y + rowH > page.h - footerReserve) {
      doc.addPage();
      y = drawTableHeader(page.margin);
    }
    doc.setDrawColor(225,230,242); doc.setLineWidth(0.2);
    doc.line(page.margin, y - 1, page.w - page.margin, y - 1);

    const imageSource = imageUrlForSize(item.product?.fotoUrl || item.producto_foto_url, 360);
    const imgData = await loadImageAsDataUrl(imageSource, { boxWmm: 24, boxHmm: 24, dpi: 170, quality: 0.58 });
    if (imgData) {
      addContainedImage(doc, imgData, C.img, y + 2, 24, 24, imageAlias(imageSource));
    } else {
      doc.setDrawColor(225,230,242);
      doc.setFillColor(248,250,252);
      doc.roundedRect(C.img, y + 2, 24, 24, 1.5, 1.5, "FD");
      doc.setFontSize(5.2);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(120,130,150);
      txt(doc, t("Sin imagen", "No image"), C.img + 12, y + 15, { align: "center" });
    }

    doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.setTextColor(31,51,95);
    txt(doc, item.product?.codigo || item.producto_codigo, C.cod, y+6);

    doc.setFont("helvetica","normal"); doc.setTextColor(40,40,40); doc.setFontSize(7);
    const descLines = doc.splitTextToSize(item.product?.descripcion || item.producto_descripcion || "", 38);
    txt(doc, descLines.slice(0,3), C.desc, y+6);
    if (item.comentarios) {
      doc.setFontSize(5.6);
      doc.setTextColor(120, 80, 40);
      txt(doc, doc.splitTextToSize(`Nota: ${item.comentarios}`, 38).slice(0, 2), C.desc, y + 19);
    }

    doc.setFontSize(6); doc.setTextColor(110,110,110);
    const metalLine = [item.product?.metal || item.producto_metal, item.product?.kilataje || item.producto_kilataje].filter(Boolean).join(" ");
    if (metalLine) txt(doc, metalLine, C.desc, y+25);

    doc.setFontSize(6.4); doc.setTextColor(50,50,50);
    const rowMidY = y + 14;
    txt(doc, String(qty),                    C.pzs,   rowMidY);
    if (isPiecePricing) {
      txt(doc, pPieza ? money(displayMoney(pPieza)) : "—", C.gtot, rowMidY);
    } else {
      txt(doc, `${gPieza.toFixed(2)}g`,        C.gpz,   rowMidY);
      txt(doc, `${gTotal.toFixed(2)}g`,        C.gtot,  rowMidY);
      if (showBreakdown) {
        txt(doc, labor ? money(displayMoney(labor)) : "—", C.labor, rowMidY);
        txt(doc, plataFina ? money(displayMoney(plataFina)) : "—", C.pf, rowMidY);
      }
      txt(doc, pGramo ? money(displayMoney(pGramo)) : "—", C.pgr, rowMidY);
    }

    doc.setFont("helvetica","bold"); doc.setTextColor(31,51,95);
    txt(doc, subtotal ? money(displayMoney(subtotal)) : "—", C.sub, rowMidY, { align: "right" });
    y += rowH;
  }

  // ── TOTALES ───────────────────────────────────────────────
  if (y + 48 > page.h - footerReserve) {
    doc.addPage();
    y = page.margin;
  }
  y += 4;
  doc.setDrawColor(31,51,95); doc.setLineWidth(0.4);
  doc.line(page.margin + 80, y, page.w - page.margin, y); y += 5;

  // Total gramos — muy visible
  if (showGramos && !isPiecePricing) {
    doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(31,51,95);
    txt(doc, t("TOTAL GRAMOS","TOTAL GRAMS"), page.margin + 80, y);
    txt(doc, `${grandGramos.toFixed(2)} g`, page.w - page.margin, y, { align: "right" });
    y += 6;
  }

  doc.setFontSize(9);
  txt(doc, t("TOTAL PIEZAS","TOTAL PIECES"), page.margin + 80, y);
  txt(doc, `${grandPiezas} pz`, page.w - page.margin, y, { align: "right" });
  y += 6;

  doc.setFontSize(9);
  txt(doc, t("SUBTOTAL","SUBTOTAL"), page.margin + 80, y);
  txt(doc, `${money(displayMoney(grandTotal))} ${currency}`, page.w - page.margin, y, { align: "right" });
  y += 6;

  const iva = applyIva ? grandTotal * IVA_RATE : 0;
  txt(doc, t("IVA 16%","VAT 16%"), page.margin + 80, y);
  txt(doc, applyIva ? `${money(displayMoney(iva))} ${currency}` : "—", page.w - page.margin, y, { align: "right" });
  y += 6;

  doc.setFontSize(10);
  txt(doc, t("TOTAL ESTIMADO","ESTIMATED TOTAL"), page.margin + 80, y);
  txt(doc, `${money(displayMoney(grandTotal + iva))} ${currency}`, page.w - page.margin, y, { align: "right" });

  if (!useUsd && customer.tipoCambio && Number(customer.tipoCambio) > 0) {
    y += 5;
    const usd = (grandTotal + iva) / Number(customer.tipoCambio);
    doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100);
    txt(doc, `Aprox. ${money(usd)} USD (TC $${customer.tipoCambio})`, page.w - page.margin, y, { align: "right" });
  }

  y += 6;
  doc.setFontSize(7); doc.setFont("helvetica","normal"); doc.setTextColor(130,130,130);
  txt(doc, t("* Precios sujetos a confirmación.","* Prices subject to confirmation."), page.margin, y);

  // ── INSTRUCCIONES ─────────────────────────────────────────
  y += 8;
  if (y + 35 > page.h - footerReserve) { doc.addPage(); y = page.margin; }
  const instructions = Array.isArray(company.order_instructions) && company.order_instructions.length
    ? company.order_instructions
    : [
        t("Revisar códigos y cantidades.","Review codes and quantities."),
        t("Enviar esta preorden a su asesor.","Send this preorder to your sales rep."),
        t("Esperar confirmación de existencia y precio final.","Wait for availability and final price confirmation."),
        t("Realizar pago o anticipo.","Make payment or deposit."),
      ];
  doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(31,51,95);
  txt(doc, t("Instrucciones","Instructions"), page.margin, y); y += 5;
  doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(60,60,60);
  instructions.forEach((l, i) => { txt(doc, `${i+1}. ${l}`, page.margin, y); y += 5; });

  y += 4;
  const terms = company.commercial_terms ||
    t("Esta preorden no es factura ni orden confirmada. Disponibilidad, precios y tiempos de entrega están sujetos a confirmación.",
      "This preorder is not an invoice or confirmed order. Availability, prices and delivery times are subject to confirmation.");
  doc.setFontSize(6.5); doc.setTextColor(150,150,150);
  txt(doc, doc.splitTextToSize(terms, page.col), page.margin, y);

  // ── PIE ───────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5); doc.setFont("helvetica","normal"); doc.setTextColor(170,170,170);
    txt(doc, [brandName, t("Documento generado como preorden comercial","Commercial preorder document")].filter(Boolean).join(" · "), page.margin, page.h - 5);
    txt(doc, `${i} / ${totalPages}`, page.w - page.margin, page.h - 5, { align: "right" });
  }

  return savePdfWithSize(doc, `preorden-${folio}-${today.replace(/\//g,"-")}.pdf`);
}
