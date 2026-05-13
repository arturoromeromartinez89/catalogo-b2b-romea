import jsPDF from "jspdf";
import { companyInfo } from "../config/companyInfo";
import { makeTranslator } from "../i18n/translations";
import { calculateCartTotals } from "./filters";
import { formatCurrency, formatWeight } from "./formatters";

const blue = [31, 51, 95];
const ink = [29, 36, 51];
const muted = [105, 113, 130];
const line = [226, 231, 240];
const soft = [247, 248, 251];

const page = {
  w: 215.9,
  h: 279.4,
  margin: 14,
  bottom: 252,
};

const tableColumns = (t) => [
  { label: "#", w: 7 },
  { label: languageSafe(t("noPhoto"), "Foto", "Photo"), w: 14, photo: true },
  { label: t("code"), w: 18 },
  { label: t("description"), w: 38 },
  { label: t("pieces"), w: 12 },
  { label: t("grams"), w: 16 },
  { label: t("unit"), w: 12 },
  { label: t("price"), w: 18 },
  { label: t("discountPct"), w: 12 },
  { label: t("net"), w: 18 },
  { label: t("amount"), w: 23 },
];

const languageSafe = (value, es, en) => (value === "Sin foto" ? es : value === "No photo" ? en : value);

const loadImageAsDataUrl = async (url) => {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const addImageSafe = (doc, image, x, y, w, h) => {
  if (!image) return false;
  try {
    const type = String(image).startsWith("data:image/png") ? "PNG" : "JPEG";
    doc.addImage(image, type, x, y, w, h, undefined, "FAST");
    return true;
  } catch {
    return false;
  }
};

const text = (doc, value, x, y, options = {}) => {
  doc.text(String(value || ""), x, y, options);
};

const wrapped = (doc, value, x, y, width, lineHeight = 3.8) => {
  const lines = doc.splitTextToSize(String(value || ""), width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
};

const fieldLine = (label, value) => `${label}: ${value || "-"}`;

const hasShipTo = (customer) =>
  [
    customer.shipToName,
    customer.shipToAddress,
    customer.shipToCity,
    customer.shipToState,
    customer.shipToZip,
    customer.shipToCountry,
    customer.shipToContact,
    customer.shipToPhone,
  ].some(Boolean);

const makeFolio = (date, customer) => {
  if (customer?.numero) return customer.numero;
  const pad = (value) => String(value).padStart(2, "0");
  return `PRE-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
};

const ensureSpace = (doc, y, needed, afterNewPage) => {
  if (y + needed <= page.bottom) return y;
  doc.addPage();
  return afterNewPage ? afterNewPage(18) : 18;
};

const drawTopBrand = async (doc, folio, date, t) => {
  const logo = await loadImageAsDataUrl(companyInfo.logoPath);
  if (!addImageSafe(doc, logo, page.margin, 11, 42, 18)) {
    doc.setTextColor(...blue);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    text(doc, "ROMEA", page.margin, 18);
    doc.setFontSize(9);
  text(doc, t("brand").replace("ROMEA ", ""), page.margin, 24);
  }

  doc.setTextColor(...blue);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  text(doc, t("noteTitle"), 66, 17);
  doc.setFontSize(10);
  text(doc, t("brand"), 66, 24);

  doc.setTextColor(...ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  text(doc, `${t("folio")}: ${folio}`, 154, 15);
  text(doc, `${t("date") || "Fecha"}: ${date.toLocaleString("es-MX")}`, 154, 21);
  doc.setDrawColor(...blue);
  doc.setLineWidth(0.45);
  doc.line(page.margin, 34, page.w - page.margin, 34);
};

const drawSectionTitle = (doc, title, x, y, width) => {
  doc.setFillColor(...soft);
  doc.setDrawColor(...line);
  doc.roundedRect(x, y, width, 8, 1.5, 1.5, "FD");
  doc.setTextColor(...blue);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.3);
  text(doc, title, x + 3, y + 5.5);
};

const drawInfoBox = (doc, title, lines, x, y, width, height) => {
  doc.setDrawColor(...line);
  doc.roundedRect(x, y, width, height, 2, 2, "S");
  drawSectionTitle(doc, title, x, y, width);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  let cursor = y + 14;
  lines.forEach((lineText) => {
    cursor = wrapped(doc, lineText, x + 3, cursor, width - 6, 3.6);
  });
};

const drawPartyBlocks = (doc, customer, t, language) => {
  const providerLines = [
    companyInfo.commercialName,
    t("wholesaleCatalog"),
    `${companyInfo.city}, ${companyInfo.state}, ${companyInfo.country}`,
    fieldLine(t("rfc"), companyInfo.rfc || (language === "en" ? "Configurable" : "Configurable")),
    fieldLine(t("email"), companyInfo.email || "Configurable"),
    fieldLine(t("phone"), companyInfo.phone || "Configurable"),
  ];

  const clientLines = [
    fieldLine(t("customer"), customer.name),
    fieldLine(t("company"), customer.company),
    fieldLine(t("phone"), customer.phone),
    fieldLine(t("email"), customer.email),
    fieldLine(t("rfc"), customer.rfc),
    fieldLine(t("notes"), customer.notes),
  ];

  const shipLines = hasShipTo(customer)
    ? [
        fieldLine(t("recipient"), customer.shipToName),
        fieldLine(t("address"), customer.shipToAddress),
        `${customer.shipToCity || "-"}, ${customer.shipToState || "-"} ${customer.shipToZip || ""}`.trim(),
        fieldLine(t("country"), customer.shipToCountry),
        fieldLine(t("contact"), customer.shipToContact),
        fieldLine(t("phone"), customer.shipToPhone),
      ]
    : [language === "en" ? "Pending confirmation." : "Pendiente por confirmar."];

  drawInfoBox(doc, language === "en" ? "Supplier" : "Proveedor", providerLines, 14, 40, 60, 43);
  drawInfoBox(doc, t("customer"), clientLines, 78, 40, 60, 43);
  drawInfoBox(doc, t("shipTo"), shipLines, 142, 40, 60, 43);
};

const drawOperationBox = (doc, customer, y, t) => {
  const values = [
    [t("series"), customer.serie || "PRE"],
    [t("currency"), customer.currency || "MXN"],
    [t("seller"), customer.seller || "-"],
    [t("concept"), customer.concept || t("preorder")],
    [t("status"), customer.status || "-"],
    [t("branch"), customer.branch || "-"],
  ];
  doc.setDrawColor(...line);
  doc.roundedRect(page.margin, y, 188, 17, 2, 2, "S");
  doc.setFontSize(7.3);
  values.forEach(([label, value], index) => {
    const x = page.margin + 3 + index * 31;
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold");
    text(doc, label, x, y + 6);
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "normal");
    text(doc, String(value), x, y + 12, { maxWidth: 27 });
  });
  return y + 23;
};

const drawTableHeader = (doc, y, t) => {
  const columns = tableColumns(t);
  let x = page.margin;
  doc.setFillColor(...blue);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.7);
  columns.forEach((column) => {
    doc.rect(x, y, column.w, 8, "F");
    text(doc, column.label, x + 1.2, y + 5.2);
    x += column.w;
  });
  return { y: y + 8, columns };
};

const drawProducts = async (doc, cartItems, startY, t) => {
  let header = drawTableHeader(doc, startY, t);
  let y = header.y;
  let columns = header.columns;

  for (let index = 0; index < cartItems.length; index += 1) {
    const item = cartItems[index];
    const product = item.product;
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(product.precioMinimo || 0);
    const amount = quantity * unitPrice;
    const grams = quantity * Number(product.pesoPromedio || 0);
    const descLines = doc.splitTextToSize(String(product.descripcion || "-"), columns[3].w - 3);
    const rowHeight = Math.max(18, 6 + descLines.length * 3.7);
    y = ensureSpace(doc, y, rowHeight, (headerY) => {
      header = drawTableHeader(doc, headerY, t);
      columns = header.columns;
      return header.y;
    });

    let x = page.margin;
    doc.setDrawColor(...line);
    doc.setTextColor(...ink);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.7);
    columns.forEach((column) => {
      doc.rect(x, y, column.w, rowHeight, "S");
      x += column.w;
    });

    x = page.margin;
    text(doc, String(index + 1), x + 1.5, y + 6);
    x += columns[0].w;

    const image = await loadImageAsDataUrl(product.fotoUrl);
    if (!addImageSafe(doc, image, x + 2, y + 3, 10, 10)) {
      doc.setTextColor(...muted);
      text(doc, t("noPhoto"), x + 1.2, y + 7, { maxWidth: columns[1].w - 2 });
      doc.setTextColor(...ink);
    }
    x += columns[1].w;

    const values = [
      product.codigo,
      descLines,
      String(quantity),
      formatWeight(grams),
      product.unidadVenta || "Pza",
      unitPrice ? formatCurrency(unitPrice, product.monedaPrecioMin) : "-",
      "0",
      unitPrice ? formatCurrency(unitPrice, product.monedaPrecioMin) : "-",
      amount ? formatCurrency(amount, product.monedaPrecioMin) : "-",
    ];

    values.forEach((value, valueIndex) => {
      const width = columns[valueIndex + 2].w;
      if (Array.isArray(value)) {
        doc.text(value, x + 1.4, y + 5.3);
      } else {
        doc.text(doc.splitTextToSize(String(value || "-"), width - 2.5), x + 1.4, y + 5.3);
      }
      x += width;
    });

    y += rowHeight;
  }

  return y + 6;
};

const drawTotals = (doc, y, totals, currency, t) => {
  y = ensureSpace(doc, y, 34);
  const subtotal = totals.amount;
  const discount = 0;
  const iva = 0;
  const total = subtotal - discount + iva;

  doc.setDrawColor(...line);
  doc.roundedRect(116, y, 86, 32, 2, 2, "S");
  drawSectionTitle(doc, t("total"), 116, y, 86);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  text(doc, `${t("totalPieces")}: ${totals.pieces}`, 120, y + 14);
  text(doc, `${t("totalGrams")}: ${formatWeight(totals.weight)}`, 158, y + 14);
  text(doc, `${t("subtotal")}: ${subtotal ? formatCurrency(subtotal, currency) : "-"}`, 120, y + 21);
  text(doc, `${t("discount")}: ${discount ? formatCurrency(discount, currency) : "-"}`, 158, y + 21);
  doc.setFont("helvetica", "bold");
  text(doc, `${t("total")}: ${total ? formatCurrency(total, currency) : "-"}`, 120, y + 28);
  text(doc, `${t("iva")}: ${iva ? formatCurrency(iva, currency) : "-"}`, 158, y + 28);
  return y + 39;
};

const drawConfirmation = (doc, y, language) => {
  y = ensureSpace(doc, y, 48);
  drawSectionTitle(doc, language === "en" ? "How to confirm this preorder" : "Cómo confirmar esta preorden", page.margin, y, 188);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let cursor = y + 14;
  const steps =
    language === "en"
      ? [
          "Review codes and quantities.",
          "Send this preorder to your ROMEA sales representative.",
          "Wait for availability and final price confirmation.",
          "Make payment or deposit.",
          "Send proof of payment.",
          "The order is confirmed only after ROMEA validation.",
        ]
      : companyInfo.orderInstructions;
  steps.forEach((step, index) => {
    cursor = wrapped(doc, `${index + 1}. ${step}`, page.margin + 3, cursor, 180, 4);
  });
  return cursor + 4;
};

const drawBanks = (doc, y, language) => {
  y = ensureSpace(doc, y, 28);
  drawSectionTitle(doc, language === "en" ? "Bank accounts" : "Cuentas bancarias", page.margin, y, 188);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const configured = companyInfo.bankAccounts.filter((account) => account.accountNumber || account.clabe);
  if (!configured.length) {
    text(doc, language === "en" ? "Bank details pending confirmation with your sales representative." : "Datos bancarios pendientes por confirmar con su asesor comercial.", page.margin + 3, y + 14);
    return y + 23;
  }
  let cursor = y + 14;
  configured.forEach((account) => {
    cursor = wrapped(
      doc,
      `${account.bank} | Titular: ${account.accountHolder} | Cuenta: ${account.accountNumber || "-"} | CLABE: ${account.clabe || "-"} | Moneda: ${account.currency || "-"}`,
      page.margin + 3,
      cursor,
      180,
      4
    );
  });
  return cursor + 4;
};

const drawTerms = (doc, y, language) => {
  y = ensureSpace(doc, y, 24);
  drawSectionTitle(doc, language === "en" ? "Commercial terms" : "Términos comerciales", page.margin, y, 188);
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const terms =
    language === "en"
      ? "This preorder is not an invoice or confirmed order. Availability, prices, credit terms, delivery times and shipping are subject to confirmation by ROMEA JEWELRY."
      : companyInfo.commercialTerms;
  wrapped(doc, terms, page.margin + 3, y + 14, 180, 4);
};

const drawFooter = (doc, t, language) => {
  const pages = doc.internal.getNumberOfPages();
  for (let current = 1; current <= pages; current += 1) {
    doc.setPage(current);
    doc.setDrawColor(...line);
    doc.line(page.margin, 260, page.w - page.margin, 260);
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    text(doc, `${t("brand")} · ${language === "en" ? "Commercial preorder document" : "Documento generado como preorden comercial"}`, page.margin, 267);
    text(doc, `${language === "en" ? "Page" : "Página"} ${current} ${language === "en" ? "of" : "de"} ${pages}`, 182, 267);
  }
};

export const generatePreorderPdf = async ({ cartItems, customer, language = "es" }) => {
  const t = makeTranslator(language);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const totals = calculateCartTotals(cartItems);
  const now = new Date();
  const folio = makeFolio(now, customer);
  const currency = customer.currency || cartItems[0]?.product.monedaPrecioMin || "MXN";

  await drawTopBrand(doc, folio, now, t);
  drawPartyBlocks(doc, customer, t, language);
  let y = drawOperationBox(doc, customer, 88, t);
  y = await drawProducts(doc, cartItems, y, t);
  y = drawTotals(doc, y, totals, currency, t);
  y = drawConfirmation(doc, y, language);
  y = drawBanks(doc, y, language);
  drawTerms(doc, y, language);
  drawFooter(doc, t, language);

  doc.save(`${folio}.pdf`);
};
