import { jsPDF } from "jspdf";
import { formatCurrency, formatWeight, imageUrlForSize, shortText } from "./formatters";
import { compressImageForPdf, imageAlias } from "./pdfImageCompression";
import { savePdfWithSize } from "./pdfSave";

const page = { w: 216, h: 279, margin: 14 };
const IMAGE_TIMEOUT_MS = 900;
const IMAGE_CONCURRENCY = 10;

const loadImageAsDataUrl = (url, timeoutMs = IMAGE_TIMEOUT_MS) =>
  compressImageForPdf(url, { boxWmm: 52, boxHmm: 52, dpi: 175, quality: 0.6, timeoutMs });

const mapWithConcurrency = async (items, limit, mapper, onProgress) => {
  const results = new Array(items.length).fill(null);
  let nextIndex = 0;
  let completed = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      try {
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      } catch {
        results[currentIndex] = null;
      } finally {
        completed += 1;
        onProgress?.(completed, items.length);
      }
    }
  });
  await Promise.all(workers);
  return results;
};

const addContainedImage = (doc, image, x, y, boxW, boxH) => {
  if (!image?.dataUrl) return false;
  const ratio = Math.min(boxW / Math.max(1, image.width), boxH / Math.max(1, image.height));
  const drawW = Math.max(1, image.width * ratio);
  const drawH = Math.max(1, image.height * ratio);
  const drawX = x + (boxW - drawW) / 2;
  const drawY = y + (boxH - drawH) / 2;
  doc.addImage(image.dataUrl, "JPEG", drawX, drawY, drawW, drawH, image.alias, "SLOW");
  return true;
};

const drawFooter = (doc, companyName) => {
  const totalPages = doc.getNumberOfPages();
  for (let index = 1; index <= totalPages; index += 1) {
    doc.setPage(index);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(145, 153, 171);
    if (companyName) doc.text(companyName, page.margin, page.h - 7);
    doc.text(`${index} / ${totalPages}`, page.w - page.margin, page.h - 7, { align: "right" });
  }
};

const drawClientBlock = (doc, client, x, y, w, recipientType = "cliente") => {
  if (!client) return;
  const visibleEmail = String(client.email || "").endsWith("@prospect.local") ? "" : client.email;
  const rows = [
    ["Cliente", client.name],
    ["Empresa", client.company],
    ["RFC", client.rfc],
    ["Telefono", client.phone],
    ["Correo", visibleEmail],
    ["Ciudad", client.ciudad],
  ].filter(([, value]) => String(value || "").trim());

  if (!rows.length) return;

  doc.setDrawColor(224, 230, 241);
  doc.setFillColor(247, 248, 251);
  doc.roundedRect(x, y, w, 44, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(31, 51, 95);
  doc.text(recipientType === "prospecto" ? "PROSPECTO" : "CLIENTE", x + 4, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(47, 55, 74);
  rows.slice(0, 5).forEach(([label, value], index) => {
    const rowY = y + 14 + index * 5.2;
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, x + 4, rowY);
    doc.setFont("helvetica", "normal");
    doc.text(shortText(String(value), 48), x + 25, rowY);
  });
};

const drawCover = async (doc, { catalogName, company, client, recipientType }) => {
  const brandName = company.brand_name || company.legal_name || "";
  const logo = await compressImageForPdf(company.logo_url, { boxWmm: 48, boxHmm: 34, dpi: 150, quality: 0.62, timeoutMs: 2500 });
  if (logo) logo.alias = imageAlias(company.logo_url || "catalog-logo");
  doc.setFillColor(31, 51, 95);
  doc.rect(0, 0, page.w, 64, "F");

  if (logo) {
    addContainedImage(doc, logo, page.margin, 10, 48, 34);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(31, 51, 95);
  doc.text(catalogName || "Catalogo seleccionado", page.margin, 92);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(94, 105, 127);
  if (brandName) doc.text(brandName, page.margin, 102);
  doc.text(new Date().toLocaleDateString("es-MX"), page.margin, brandName ? 109 : 102);
  drawClientBlock(doc, client, page.margin, 122, page.w - page.margin * 2, recipientType);
};

export const generateCatalogPdf = async (products, options = {}, company = {}) => {
  const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait", compress: true, precision: 2, putOnlyUsedFonts: true });
  const catalogName = options.catalogName || "Catalogo seleccionado";
  const columns = Number(options.columns || 3);
  const showPrice = options.showPrice !== false;
  const showWeight = options.showWeight !== false;
  const visibleFields = {
    description: true,
    line: true,
    family: false,
    group: false,
    ...(options.visibleFields || {}),
  };
  const brandName = company.brand_name || company.legal_name || "";
  const client = options.client || null;
  const recipientType = options.recipientType || "cliente";
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : null;

  onProgress?.("cover", products.length);
  await drawCover(doc, { catalogName, company, client, recipientType });
  doc.addPage();

  const usableW = page.w - page.margin * 2;
  const gap = 5;
  const cardW = (usableW - gap * (columns - 1)) / columns;
  const imgH = Math.min(cardW, 48);
  const cardH = imgH + 46;
  let x = page.margin;
  let y = page.margin;
  let col = 0;

  onProgress?.("images", products.length);
  const images = await mapWithConcurrency(
    products,
    IMAGE_CONCURRENCY,
    async (product) => {
      const source = imageUrlForSize(product.fotoUrl, 360);
      const image = await loadImageAsDataUrl(source);
      if (image) image.alias = imageAlias(source || product.codigo);
      return image;
    },
    (loaded, total) => onProgress?.("image", loaded, total)
  );

  onProgress?.("pages", products.length);
  products.forEach((product, index) => {
    if (y + cardH > page.h - 16) {
      doc.addPage();
      x = page.margin;
      y = page.margin;
      col = 0;
    }

    doc.setDrawColor(224, 230, 241);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");

    const img = images[index];
    if (img) {
      try {
        addContainedImage(doc, img, x + 3, y + 3, cardW - 6, imgH - 6);
      } catch {
        doc.setFontSize(8);
        doc.setTextColor(145, 153, 171);
        doc.text("Sin foto", x + cardW / 2, y + imgH / 2, { align: "center" });
      }
    } else {
      doc.setFontSize(8);
      doc.setTextColor(145, 153, 171);
      doc.text("Sin foto", x + cardW / 2, y + imgH / 2, { align: "center" });
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(31, 51, 95);
    doc.text(String(product.codigo || ""), x + 4, y + imgH + 5);

    let textY = y + imgH + 11;
    if (visibleFields.description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(47, 55, 74);
      const descriptionLines = doc.splitTextToSize(shortText(product.descripcion || "", 70), cardW - 8);
      const visibleDescription = descriptionLines.slice(0, 2);
      doc.text(visibleDescription, x + 4, textY);
      textY += visibleDescription.length * 4 + 2;
    }

    const detailLines = [];
    if (visibleFields.line && product.linea) detailLines.push(`Linea: ${product.linea}`);
    if (visibleFields.family && product.familia) detailLines.push(`Familia: ${product.familia}`);
    if (visibleFields.group && product.grupo) detailLines.push(`Grupo: ${product.grupo}`);
    if (detailLines.length) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(94, 105, 127);
      doc.text(doc.splitTextToSize(detailLines.join("  |  "), cardW - 8).slice(0, 2), x + 4, textY);
    }

    const meta = [];
    if (showWeight) meta.push(formatWeight(product.pesoPromedio));
    if (showPrice && product.precioMinimo) meta.push(formatCurrency(product.precioMinimo, product.monedaPrecioMin));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(31, 51, 95);
    doc.text(meta.filter(Boolean).join("  |  ") || "Precio por confirmar", x + 4, y + cardH - 5);

    col += 1;
    if (col >= columns) {
      col = 0;
      x = page.margin;
      y += cardH + gap;
    } else {
      x += cardW + gap;
    }
  });

  drawFooter(doc, brandName);
  onProgress?.("download", products.length);
  return savePdfWithSize(doc, `${catalogName.replace(/[\\/:*?"<>|]/g, "-")}.pdf`);
};
