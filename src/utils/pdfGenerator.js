import jsPDF from "jspdf";

const loadImageAsDataUrl = (url) =>
  new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

const page = { w: 216, h: 279, margin: 12, col: 192 };

const txt = (doc, str, x, y, opts = {}) => {
  if (!str && str !== 0) return;
  doc.text(String(str), x, y, opts);
};

const money = (n) => {
  if (!n && n !== 0) return "—";
  return `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait" });
  const brandName = company.brand_name || "Mi Catálogo";
  const t = (es, en) => language === "en" ? en : es;
  const folio = buildFolio(customer);
  const today = new Date().toLocaleDateString(language === "en" ? "en-US" : "es-MX");
  const currency = customer.currency || "MXN";
  const exchangeRate = Number(customer.tipoCambio || 0);
  const useUsd = currency === "USD" && exchangeRate > 0;
  const displayMoney = (value) => (useUsd ? Number(value || 0) / exchangeRate : Number(value || 0));
  const showGramos = opts.showGramos !== false;
  const showBreakdown = opts.showBreakdown !== false;
  const applyIva = Boolean(opts.applyIva || customer.applyIva);
  const IVA_RATE = 0.16;

  // ── HEADER ───────────────────────────────────────────────
  const logo = await loadImageAsDataUrl(company.logo_url);
  doc.setFillColor(31, 51, 95);
  doc.rect(0, 0, page.w, 32, "F");

  if (logo) {
    doc.addImage(logo, "JPEG", page.margin, 4, 40, 24);
  } else {
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(255,255,255);
    txt(doc, brandName, page.margin, 18);
  }
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(180,195,220);
  txt(doc, t("Catálogo B2B · Mayorista", "B2B Catalog · Wholesale"), page.margin, 27);

  doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(255,255,255);
  txt(doc, folio, page.w - page.margin, 16, { align: "right" });
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(180,195,220);
  txt(doc, t("Preorden", "Preorder"), page.w - page.margin, 22, { align: "right" });
  txt(doc, today, page.w - page.margin, 27, { align: "right" });

  let y = 38;

  // ── PROVEEDOR ─────────────────────────────────────────────
  doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(100,100,100);
  txt(doc, t("PROVEEDOR", "SUPPLIER"), page.margin, y); y += 4;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(31,51,95);
  txt(doc, brandName, page.margin, y); y += 4;
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

  y = Math.max(y, cy) + 5;
  doc.setDrawColor(200,210,230); doc.setLineWidth(0.3);
  doc.line(page.margin, y, page.w - page.margin, y); y += 6;

  // ── COLUMNAS ──────────────────────────────────────────────
  const C = {
    img:    page.margin,
    cod:    page.margin + 14,
    desc:   page.margin + 35,
    pzs:    page.margin + 80,
    gpz:    page.margin + 93,
    gtot:   page.margin + 108,
    labor:  page.margin + 124,
    pf:     page.margin + 141,
    pgr:    page.margin + 158,
    sub:    page.w - page.margin,
  };

  // Header
  doc.setFillColor(240,244,252);
  doc.rect(page.margin, y - 2, page.col, 8, "F");
  doc.setFontSize(5.5); doc.setFont("helvetica","bold"); doc.setTextColor(60,80,120);
  txt(doc, t("CÓD.","CODE"),       C.cod,   y+3);
  txt(doc, t("DESCRIPCIÓN","DESC"),C.desc,  y+3);
  txt(doc, t("PZS","QTY"),         C.pzs,   y+3);
  txt(doc, t("G/PZA","G/PC"),      C.gpz,   y+3);
  txt(doc, t("G.TOTAL","G.TOTAL"), C.gtot,  y+3);
  if (showBreakdown) {
    txt(doc, t("LABOR","LABOR"),     C.labor, y+3);
    txt(doc, t("PF","FS"),           C.pf,    y+3);
    txt(doc, t("LAB+PF","LAB+FS"),   C.pgr,  y+3);
  } else {
    txt(doc, t("PRECIO/G","PRICE/G"), C.pgr, y+3);
  }
  txt(doc, t("SUBTOTAL","SUBTOTAL"),C.sub,  y+3, { align: "right" });
  y += 10;

  let grandTotal = 0;
  let grandGramos = 0;
  let grandPiezas = 0;

  for (const item of cartItems) {
    const qty = Number(item.quantity || 1);
    const gPieza = Number(item.product?.pesoPromedio || item.gramos_por_pieza || 0);
    const gTotal = Number(item.gramos_total || (gPieza * qty));
    const labor = Number(item.labor_mxn || item.product?.quoteLaborPerGram || 0);
    const pGramo = Number(item.precio_gramo_mxn || item.product?.precioMinimo || 0);
    const plataFina = Number(item.plata_fina_mxn || Math.max(0, pGramo - labor));
    const subtotal = Number(item.subtotal_mxn || (gTotal * pGramo));
    grandTotal += subtotal;
    grandGramos += gTotal;
    grandPiezas += qty;

    const rowH = 20;
    if (y + rowH > page.h - 50) { doc.addPage(); y = page.margin; }
    doc.setDrawColor(225,230,242); doc.setLineWidth(0.2);
    doc.line(page.margin, y - 1, page.w - page.margin, y - 1);

    const imgData = await loadImageAsDataUrl(item.product?.fotoUrl);
    if (imgData) { try { doc.addImage(imgData, "JPEG", C.img, y+1, 12, 12); } catch {} }

    doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.setTextColor(31,51,95);
    txt(doc, item.product?.codigo || item.producto_codigo, C.cod, y+5);

    doc.setFont("helvetica","normal"); doc.setTextColor(40,40,40); doc.setFontSize(7);
    const descLines = doc.splitTextToSize(item.product?.descripcion || item.producto_descripcion || "", 58);
    txt(doc, descLines.slice(0,2), C.desc, y+5);

    doc.setFontSize(6); doc.setTextColor(110,110,110);
    const metalLine = [item.product?.metal || item.producto_metal, item.product?.kilataje || item.producto_kilataje].filter(Boolean).join(" ");
    if (metalLine) txt(doc, metalLine, C.desc, y+14);

    doc.setFontSize(6.4); doc.setTextColor(50,50,50);
    txt(doc, String(qty),                    C.pzs,   y+9);
    txt(doc, `${gPieza.toFixed(2)}g`,        C.gpz,   y+9);
    txt(doc, `${gTotal.toFixed(2)}g`,        C.gtot,  y+9);
    if (showBreakdown) {
    txt(doc, labor ? money(displayMoney(labor)) : "—", C.labor, y+9);
    txt(doc, plataFina ? money(displayMoney(plataFina)) : "—", C.pf, y+9);
    }
    txt(doc, pGramo ? money(displayMoney(pGramo)) : "—", C.pgr, y+9);

    doc.setFont("helvetica","bold"); doc.setTextColor(31,51,95);
    txt(doc, subtotal ? money(displayMoney(subtotal)) : "—", C.sub, y+9, { align: "right" });
    y += rowH;
  }

  // ── TOTALES ───────────────────────────────────────────────
  y += 4;
  doc.setDrawColor(31,51,95); doc.setLineWidth(0.4);
  doc.line(page.margin + 80, y, page.w - page.margin, y); y += 5;

  // Total gramos — muy visible
  doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(31,51,95);
  txt(doc, t("TOTAL GRAMOS","TOTAL GRAMS"), page.margin + 80, y);
  txt(doc, `${grandGramos.toFixed(2)} g`, page.w - page.margin, y, { align: "right" });
  y += 6;

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
  if (y + 35 > page.h - 15) { doc.addPage(); y = page.margin; }
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
    txt(doc, `${brandName} · ${t("Documento generado como preorden comercial","Commercial preorder document")}`, page.margin, page.h - 5);
    txt(doc, `${i} / ${totalPages}`, page.w - page.margin, page.h - 5, { align: "right" });
  }

  doc.save(`preorden-${folio}-${today.replace(/\//g,"-")}.pdf`);
}
