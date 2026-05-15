import jsPDF from "jspdf";
import { buildPlaceholderUrl, formatCurrency, formatWeight, shortText } from "./formatters";

const page = { w: 216, h: 279, margin: 14 };

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
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = source;
  });

const drawFooter = (doc, companyName) => {
  const totalPages = doc.getNumberOfPages();
  for (let index = 1; index <= totalPages; index += 1) {
    doc.setPage(index);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(145, 153, 171);
    doc.text(companyName, page.margin, page.h - 7);
    doc.text(`${index} / ${totalPages}`, page.w - page.margin, page.h - 7, { align: "right" });
  }
};

const drawCover = async (doc, { catalogName, company }) => {
  const brandName = company.brand_name || "ROMEA JOYERIA";
  const logo = await loadImageAsDataUrl(company.logo_url);
  doc.setFillColor(31, 51, 95);
  doc.rect(0, 0, page.w, 64, "F");

  if (logo) {
    doc.addImage(logo, "JPEG", page.margin, 12, 48, 28);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text(brandName, page.margin, 30);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(31, 51, 95);
  doc.text(catalogName || "Catalogo seleccionado", page.margin, 92);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(94, 105, 127);
  doc.text(brandName, page.margin, 102);
  doc.text(new Date().toLocaleDateString("es-MX"), page.margin, 109);
};

export const generateCatalogPdf = async (products, options = {}, company = {}) => {
  const doc = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait" });
  const catalogName = options.catalogName || "Catalogo seleccionado";
  const columns = Number(options.columns || 3);
  const showPrice = options.showPrice !== false;
  const showWeight = options.showWeight !== false;
  const brandName = company.brand_name || "ROMEA JOYERIA";

  await drawCover(doc, { catalogName, company });
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
        doc.addImage(img, "JPEG", x + 3, y + 3, cardW - 6, imgH - 6);
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
    const desc = doc.splitTextToSize(shortText(product.descripcion || "", 82), cardW - 8);
    doc.text(desc.slice(0, 2), x + 4, y + imgH + 11);

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
