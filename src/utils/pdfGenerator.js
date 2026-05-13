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

const pt = (mm) => mm * 2.8346;

const page = {
  w: 216,
  h: 279,
  margin: 14,
  col: 188,
};

const doc_text = (doc, str, x, y, opts = {}) => {
  if (!str) return;
  doc.text(String(str), x, y, opts);
};

const fieldLine = (label, value) => `${label}: ${value || "—"}`;

export async function generatePdf(cartItems, customer, language = "es", company = {}) {
  const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait" });

  const brandName = company.brand_name || "Mi Catálogo";
  const t = (es, en) => language === "en" ? en : es;

  // ── HEADER ──────────────────────────────────────────────
  const logo = await loadImageAsDataUrl(company.logo_url);
  doc.setFillColor(31, 51, 95);
  doc.rect(0, 0, page.w, 32, "F");

  if (logo) {
    doc.addImage(logo, "JPEG", page.margin, 4, 40, 24);
  } else {
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc_text(doc, brandName, page.margin, 18);
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 195, 220);
  doc_text(doc, t("Catálogo B2B · Mayorista", "B2B Catalog · Wholesale"), page.margin, 27);

  // Número de preorden
  const docNum = [customer.serie, customer.numero].filter(Boolean).join("-") || "PRE-001";
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc_text(doc, docNum, page.w - page.margin, 16, { align: "right" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 195, 220);
  doc_text(doc, t("Preorden", "Preorder"), page.w - page.margin, 22, { align: "right" });
  const today = new Date().toLocaleDateString(language === "en" ? "en-US" : "es-MX");
  doc_text(doc, today, page.w - page.margin, 27, { align: "right" });

  let y = 38;

  // ── INFO PROVEEDOR ──────────────────────────────────────
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc_text(doc, t("PROVEEDOR", "SUPPLIER"), page.margin, y);

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(31, 51, 95);
  doc_text(doc, brandName, page.margin, y);

  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  const supplierLines = [
    company.legal_name,
    [company.city, company.state, company.country].filter(Boolean).join(", "),
    company.rfc ? fieldLine(t("RFC", "Tax ID"), company.rfc) : null,
    company.email ? fieldLine(t("Correo", "Email"), company.email) : null,
    company.phone ? fieldLine(t("Tel", "Phone"), company.phone) : null,
  ].filter(Boolean);

  supplierLines.forEach((line) => {
    doc_text(doc, line, page.margin, y);
    y += 4;
  });

  // ── INFO CLIENTE ────────────────────────────────────────
  const clientX = page.margin + 95;
  let clientY = 38;

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc_text(doc, t("CLIENTE", "CUSTOMER"), clientX, clientY);

  clientY += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(31, 51, 95);
  doc_text(doc, customer.company || customer.name || t("Sin nombre", "No name"), clientX, clientY);

  clientY += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  const clientLines = [
    customer.name && customer.company ? customer.name : null,
    customer.email ? fieldLine(t("Correo", "Email"), customer.email) : null,
    customer.phone ? fieldLine(t("Tel", "Phone"), customer.phone) : null,
    customer.rfc ? fieldLine(t("RFC", "Tax ID"), customer.rfc) : null,
  ].filter(Boolean);

  clientLines.forEach((line) => {
    doc_text(doc, line, clientX, clientY);
    clientY += 4;
  });

  y = Math.max(y, clientY) + 4;

  // ── DIVISOR ─────────────────────────────────────────────
  doc.setDrawColor(200, 210, 230);
  doc.setLineWidth(0.3);
  doc.line(page.margin, y, page.w - page.margin, y);
  y += 6;

  // ── TABLA DE PRODUCTOS ──────────────────────────────────
  const cols = {
    img: { x: page.margin, w: 18 },
    code: { x: page.margin + 20, w: 22 },
    desc: { x: page.margin + 44, w: 72 },
    weight: { x: page.margin + 118, w: 18 },
    price: { x: page.margin + 138, w: 24 },
    qty: { x: page.margin + 164, w: 12 },
    total: { x: page.margin + 178, w: 24 },
  };

  // Header tabla
  doc.setFillColor(240, 244, 252);
  doc.rect(page.margin, y - 2, page.col, 8, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 80, 120);
  doc_text(doc, t("CÓD.", "CODE"), cols.code.x, y + 3);
  doc_text(doc, t("DESCRIPCIÓN", "DESCRIPTION"), cols.desc.x, y + 3);
  doc_text(doc, t("PESO", "WEIGHT"), cols.weight.x, y + 3);
  doc_text(doc, t("PRECIO", "PRICE"), cols.price.x, y + 3);
  doc_text(doc, t("CANT.", "QTY"), cols.qty.x, y + 3);
  doc_text(doc, t("TOTAL", "TOTAL"), cols.total.x + cols.total.w, y + 3, { align: "right" });
  y += 10;

  let grandTotal = 0;
  const currency = customer.currency || "MXN";

  for (const item of cartItems) {
    const { product, quantity } = item;
    const rowH = 20;

    if (y + rowH > page.h - 40) {
      doc.addPage();
      y = page.margin;
    }

    // Línea separadora
    doc.setDrawColor(230, 235, 245);
    doc.setLineWidth(0.2);
    doc.line(page.margin, y - 1, page.w - page.margin, y - 1);

    // Foto
    const imgData = await loadImageAsDataUrl(product.fotoUrl);
    if (imgData) {
      try { doc.addImage(imgData, "JPEG", cols.img.x, y, 16, 16); } catch {}
    }

    // Datos
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 51, 95);
    doc_text(doc, product.codigo, cols.code.x, y + 5);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    const descLines = doc.splitTextToSize(product.descripcion || "", cols.desc.w);
    doc_text(doc, descLines.slice(0, 2), cols.desc.x, y + 5);

    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    const metalLine = [product.metal, product.kilataje].filter(Boolean).join(" ");
    if (metalLine) doc_text(doc, metalLine, cols.desc.x, y + 13);

    const weight = product.pesoPromedio ? `${Number(product.pesoPromedio).toFixed(2)}g` : "—";
    doc_text(doc, weight, cols.weight.x, y + 8);

    const price = Number(product.precioMinimo || 0);
    doc_text(doc, price ? `$${price.toFixed(2)}` : "—", cols.price.x, y + 8);

    doc_text(doc, String(quantity), cols.qty.x, y + 8);

    const lineTotal = price * Number(quantity);
    grandTotal += lineTotal;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 51, 95);
    doc_text(doc, lineTotal ? `$${lineTotal.toFixed(2)}` : "—", cols.total.x + cols.total.w, y + 8, { align: "right" });

    y += rowH;
  }

  // ── TOTALES ─────────────────────────────────────────────
  y += 4;
  doc.setDrawColor(31, 51, 95);
  doc.setLineWidth(0.5);
  doc.line(page.margin + 120, y, page.w - page.margin, y);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 51, 95);
  doc_text(doc, t("TOTAL ESTIMADO", "ESTIMATED TOTAL"), page.margin + 120, y);
  doc_text(doc, `$${grandTotal.toFixed(2)} ${currency}`, page.w - page.margin, y, { align: "right" });

  y += 8;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc_text(doc, t("* Precios sujetos a confirmación.", "* Prices subject to confirmation."), page.margin, y);

  // ── INSTRUCCIONES ────────────────────────────────────────
  const instructions = company.order_instructions?.length
    ? company.order_instructions
    : [
        t("Revisar códigos y cantidades.", "Review codes and quantities."),
        t("Enviar esta preorden a su asesor.", "Send this preorder to your sales rep."),
        t("Esperar confirmación de existencia y precio final.", "Wait for availability and final price confirmation."),
        t("Realizar pago o anticipo.", "Make payment or deposit."),
      ];

  y += 8;
  if (y + 30 > page.h - 20) { doc.addPage(); y = page.margin; }

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 51, 95);
  doc_text(doc, t("Instrucciones", "Instructions"), page.margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(7.5);
  instructions.forEach((line, i) => {
    doc_text(doc, `${i + 1}. ${line}`, page.margin, y);
    y += 5;
  });

  // ── TÉRMINOS ─────────────────────────────────────────────
  const terms = company.commercial_terms ||
    t(
      "Esta preorden no es factura ni orden confirmada. Disponibilidad, precios y tiempos de entrega están sujetos a confirmación.",
      "This preorder is not an invoice or confirmed order. Availability, prices and delivery times are subject to confirmation."
    );

  y += 4;
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  const termsLines = doc.splitTextToSize(terms, page.col);
  doc_text(doc, termsLines, page.margin, y);

  // ── PIE ──────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 160, 160);
    doc_text(doc, `${brandName} · ${t("Documento generado como preorden comercial", "Commercial preorder document")}`, page.margin, page.h - 6);
    doc_text(doc, `${i} / ${totalPages}`, page.w - page.margin, page.h - 6, { align: "right" });
  }

  doc.save(`preorden-${docNum}-${today.replace(/\//g, "-")}.pdf`);
}
