import jsPDF from "jspdf";
import { buildPlaceholderUrl, formatCurrency, formatWeight, shortText } from "./formatters";

const page = { w: 216, h: 279, margin: 14 };

const getImageFormat = (dataUrl) => {
  const match = String(dataUrl || "").match(/^data:image\/([^;]+)/i);
  const format = match?.[1]?.toUpperCase();
  if (format === "JPG") return "JPEG";
  return format || "JPEG";
};

const loadImageAsDataUrl = (url) =>
  new Promise((resolve) => {
    const source = url || buildPlaceholderUrl();
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 320;
        canvas.height = img.naturalHeight || 320;
        canvas.getContext("2d").drawImage(img, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          height: canvas.height,
          width: canvas.width,
        });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = source;
  });

const addContainedImage = (doc, image, x, y, boxW, boxH) => {
  if (!image?.dataUrl) return false;
  const ratio = Math.min(boxW / Math.max(1, image.width), boxH / Math.max(1, image.height));
  const drawW = Math.max(1, image.width * ratio);
  const drawH = Math.max(1, image.height * ratio);
  const drawX = x + (boxW - drawW) / 2;
  const drawY = y + (boxH - drawH) / 2;
  doc.addImage(image.dataUrl, getImageFormat(image.dataUrl), drawX, drawY, drawW, drawH);
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

const drawClientBlock = (doc, client, x, y, w) => {
  if (!client) return;
  const rows = [
    ["Cliente", client.name],
    ["Empresa", client.company],
    ["RFC", client.rfc],
    ["Telefono", client.phone],
    ["Correo", client.email],
    ["Ciudad", client.ciudad],
  ].filter(([, value]) => String(value || "").trim());

  if (!rows.length) return;

  doc.setDrawColor(224, 230, 241);
  doc.setFillColor(247, 248, 251);
  doc.roundedRect(x, y, w, 44, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(31, 51, 95);
  doc.text("CLIENTE", x + 4, y + 7);

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

const drawCover = async (doc, { catalogName, company, client }) => {
  const brandName = company.brand_name || company.legal_name || "";
  const logo = await loadImageAsDataUrl(company.logo_url);
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
  drawClientBlock(doc, client, page.margin, 122, page.w - page.margin * 2);
};

export const generateCatalogPdf = async (products, options = {}, company = {}) => {
  const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait" });
  const catalogName = options.catalogName || "Catalogo seleccionado";
  const columns = Number(options.columns || 3);
  const showPrice = options.showPrice !== false;
  const showWeight = options.showWeight !== false;
  const brandName = company.brand_name || company.legal_name || "";
  const client = options.client || null;

  await drawCover(doc, { catalogName, company, client });
  doc.addPage();

  const usableW = page.w - page.margin * 2;
  const gap = 5;
  const cardW = (usableW - gap * (columns - 1)) / columns;
  const imgH = Math.min(cardW, 48);
  const cardH = imgH + 35;
  let x = page.margin;
  let y = page.margin;
  let col = 0;

  const imageResults = await Promise.allSettled(products.map((product) => loadImageAsDataUrl(product.fotoUrl)));
  const images = imageResults.map((result) => (result.status === "fulfilled" ? result.value : null));

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

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(47, 55, 74);
    const descriptionLines = doc.splitTextToSize(shortText(product.descripcion || "", 70), cardW - 8);
    doc.text(descriptionLines.slice(0, 2), x + 4, y + imgH + 11);

    if (product.linea) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(94, 105, 127);
      doc.text(`Linea: ${String(product.linea)}`, x + 4, y + imgH + 22);
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
  doc.save(`${catalogName.replace(/[\\/:*?"<>|]/g, "-")}.pdf`);
};
