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

const page = { w: 216, h: 279, margin: 14, col: 188 };

const txt = (doc, str, x, y, opts = {}) => {
  if (!str && str !== 0) return;
  doc.text(String(str), x, y, opts);
};

const money = (n, currency = "MXN") => {
  if (!n && n !== 0) return "—";
  return `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Genera folio limpio sin duplicar PRE
const buildFolio = (customer) => {
  const num = customer.numero || "";
  // Si ya tiene formato PRE-XXXXX no agregar serie de nuevo
  if (num.startsWith("PRE-")) return num;
  const serie = customer.serie || "PRE";
  return num ? `${serie}-${num}` : serie;
};

export async function generatePdf(cartItems, customer, language = "es", company = {}) {
  const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait" });
  const brandName = company.brand_name || "Mi Catálogo";
  const t = (es, en) => language === "en" ? en : es;
  const folio = buildFolio(customer);
  const today = new Date().toLocaleDateString(language === "en" ? "en-US" : "es-MX");
  const currency = customer.currency || "MXN";

  // ── HEADER ───────────────────────────────────────────────
  const logo = await loadImageAsDataUrl(company.logo_url);
  doc.setFillColor(31, 51, 95);
  doc.rect(0, 0, page.w, 32, "F");

  if (logo) {
    doc.addImage(logo, "JPEG", page.margin, 4, 40, 24);
  } else {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    txt(doc, brandName, page.margin, 18);
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 195, 220);
  txt(doc, t("Catálogo B2B · Mayorista", "B2B Catalog · Wholesale"), page.margin, 27);

  // Folio
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  txt(doc, folio, page.w - page.margin, 16, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 195, 220);
  txt(doc, t("Preorden", "Preorder"), page.w - page.margin, 22, { align: "right" });
  txt(doc, today, page.w - page.margin, 27, { align: "right" });

  let y = 38;

  // ── INFO PROVEEDOR ────────────────────────────────────────
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  txt(doc, t("PROVEEDOR", "SUPPLIER"), page.margin, y);
  y += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(31, 51, 95);
  txt(doc, brandName, page.margin, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);

  const supplierLines = [
    company.legal_name,
    [company.city, company.state, company.country].filter(Boolean).join(", "),
    company.rfc ? `RFC: ${company.rfc}` : null,
    company.email ? `${t("Correo", "Email")}: ${company.email}` : null,
    company.phone ? `${t("Tel", "Phone")}: ${company.phone}` : null,
  ].filter(Boolean);

  supplierLines.forEach((line) => { txt(doc, line, page.margin, y); y += 4; });

  // ── INFO CLIENTE ──────────────────────────────────────────
  const cx = page.margin + 100;
  let cy = 38;

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  txt(doc, t("CLIENTE", "CUSTOMER"), cx, cy);
  cy += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(31, 51, 95);
  txt(doc, customer.company || customer.name || t("Sin nombre", "No name"), cx, cy);
  cy += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);

  [
    customer.name && customer.company ? customer.name : null,
    customer.email ? `${t("Correo", "Email")}: ${customer.email}` : null,
    customer.phone ? `${t("Tel", "Phone")}: ${customer.phone}` : null,
    customer.rfc ? `RFC: ${customer.rfc}` : null,
  ].filter(Boolean).forEach((line) => { txt(doc, line, cx, cy); cy += 4; });

  y = Math.max(y, cy) + 5;

  // ── DIVISOR ───────────────────────────────────────────────
  doc.setDrawColor(200, 210, 230);
  doc.setLineWidth(0.3);
  doc.line(page.margin, y, page.w - page.margin, y);
  y += 6;

  // ── COLUMNAS DE TABLA ─────────────────────────────────────
  // Total disponible: 216 - 14*2 = 188mm
  // img:16 | código:22 | descripción:68 | peso:16 | precio:22 | cant:10 | total:26 = 180... +8 gaps
  const C = {
    img:   { x: page.margin,      w: 16 },
    cod:   { x: page.margin + 17, w: 22 },
    desc:  { x: page.margin + 40, w: 72 },
    peso:  { x: page.margin + 114, w: 16 },
    precio:{ x: page.margin + 131, w: 24 },
    cant:  { x: page.margin + 156, w: 10 },
    total: { x: page.w - page.margin, w: 0 }, // right-aligned
  };

  // Header tabla
  doc.setFillColor(240, 244, 252);
  doc.rect(page.margin, y - 2, page.col, 8, "F");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 80, 120);
  txt(doc, t("CÓD.", "CODE"),        C.cod.x,    y + 3);
  txt(doc, t("DESCRIPCIÓN", "DESC"), C.desc.x,   y + 3);
  txt(doc, t("PESO", "WEIGHT"),      C.peso.x,   y + 3);
  txt(doc, t("PRECIO/G", "PRICE/G"), C.precio.x, y + 3);
  txt(doc, t("CANT.", "QTY"),        C.cant.x,   y + 3);
  txt(doc, t("TOTAL", "TOTAL"),      C.total.x,  y + 3, { align: "right" });
  y += 10;

  let grandTotal = 0;

  for (const item of cartItems) {
    const { product, quantity } = item;
    const qty = Number(quantity || 1);
    const rowH = 22;

    if (y + rowH > page.h - 45) {
      doc.addPage();
      y = page.margin;
    }

    doc.setDrawColor(225, 230, 242);
    doc.setLineWidth(0.2);
    doc.line(page.margin, y - 1, page.w - page.margin, y - 1);

    // Foto
    const imgData = await loadImageAsDataUrl(product.fotoUrl);
    if (imgData) {
      try { doc.addImage(imgData, "JPEG", C.img.x, y + 1, 14, 14); } catch {}
    }

    // Código
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 51, 95);
    txt(doc, product.codigo, C.cod.x, y + 5);

    // Descripción
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(7.5);
    const descLines = doc.splitTextToSize(product.descripcion || "", C.desc.w);
    txt(doc, descLines.slice(0, 2), C.desc.x, y + 5);

    // Metal/kilataje debajo de descripción
    doc.setFontSize(6.5);
    doc.setTextColor(110, 110, 110);
    const metalLine = [product.metal, product.kilataje].filter(Boolean).join(" ");
    if (metalLine) txt(doc, metalLine, C.desc.x, y + 14);

    // Peso
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    const peso = product.pesoPromedio ? `${Number(product.pesoPromedio).toFixed(2)}g` : "—";
    txt(doc, peso, C.peso.x, y + 9);

    // Precio/g o precio unitario
    const precioUnit = Number(product.precioMinimo || 0);
    txt(doc, precioUnit ? money(precioUnit) : "—", C.precio.x, y + 9);

    // Cantidad
    txt(doc, String(qty), C.cant.x, y + 9);

    // Total línea
    const lineTotal = precioUnit * qty;
    grandTotal += lineTotal;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 51, 95);
    txt(doc, lineTotal ? money(lineTotal) : "—", C.total.x, y + 9, { align: "right" });

    y += rowH;
  }

  // ── TOTALES ───────────────────────────────────────────────
  y += 4;
  doc.setDrawColor(31, 51, 95);
  doc.setLineWidth(0.4);
  doc.line(page.margin + 110, y, page.w - page.margin, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 51, 95);
  txt(doc, t("TOTAL ESTIMADO", "ESTIMATED TOTAL"), page.margin + 110, y);
  txt(doc, `${money(grandTotal)} ${currency}`, page.w - page.margin, y, { align: "right" });

  // Total en USD si hay TC
  if (customer.tipoCambio && Number(customer.tipoCambio) > 0) {
    y += 5;
    const totalUsd = grandTotal / Number(customer.tipoCambio);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    txt(doc, `≈ ${money(totalUsd)} USD (TC $${customer.tipoCambio})`, page.w - page.margin, y, { align: "right" });
  }

  y += 6;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130, 130, 130);
  txt(doc, t("* Precios sujetos a confirmación.", "* Prices subject to confirmation."), page.margin, y);

  // ── INSTRUCCIONES ─────────────────────────────────────────
  y += 8;
  if (y + 35 > page.h - 15) { doc.addPage(); y = page.margin; }

  const instructions = Array.isArray(company.order_instructions) && company.order_instructions.length
    ? company.order_instructions
    : [
        t("Revisar códigos y cantidades.", "Review codes and quantities."),
        t("Enviar esta preorden a su asesor.", "Send this preorder to your sales rep."),
        t("Esperar confirmación de existencia y precio final.", "Wait for availability and final price confirmation."),
        t("Realizar pago o anticipo.", "Make payment or deposit."),
      ];

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 51, 95);
  txt(doc, t("Instrucciones", "Instructions"), page.margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  instructions.forEach((line, i) => { txt(doc, `${i + 1}. ${line}`, page.margin, y); y += 5; });

  // ── TÉRMINOS ──────────────────────────────────────────────
  y += 4;
  const terms = company.commercial_terms ||
    t(
      "Esta preorden no es factura ni orden confirmada. Disponibilidad, precios y tiempos de entrega están sujetos a confirmación.",
      "This preorder is not an invoice or confirmed order. Availability, prices and delivery times are subject to confirmation."
    );
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  const termsLines = doc.splitTextToSize(terms, page.col);
  txt(doc, termsLines, page.margin, y);

  // ── PIE DE PÁGINA ─────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(170, 170, 170);
    txt(doc, `${brandName} · ${t("Documento generado como preorden comercial", "Commercial preorder document")}`, page.margin, page.h - 5);
    txt(doc, `${i} / ${totalPages}`, page.w - page.margin, page.h - 5, { align: "right" });
  }

  doc.save(`preorden-${folio}-${today.replace(/\//g, "-")}.pdf`);
}
