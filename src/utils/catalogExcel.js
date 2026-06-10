/**
 * Excel maestro del sistema — formato estándar compatible con:
 *   • Descarga de preorden (PreorderEditor)
 *   • Carga de catálogo personalizado por cliente (ClientSkuPanel)
 *   • Selección de catálogo en admin (SelectedProductsDrawer)
 *
 * Regla de oro: la hoja siempre se llama "Preorden" y siempre tiene
 * la columna "codigo" — así cualquier Excel del sistema puede cargarse
 * en cualquier otro punto que lo consuma.
 */

const safeFilename = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "archivo";

const triggerDownload = (XLSX, workbook, fileName) => {
  const buf = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Descarga la selección de productos del catálogo en el Excel maestro.
 *
 * @param {Array}  products - Productos seleccionados ({codigo, descripcion, linea, metal, kilataje, ...})
 * @param {string} [label]  - Etiqueta para el nombre del archivo (ej. nombre del cliente o "seleccion")
 */
export const downloadCatalogSelectionExcel = async (products, label = "") => {
  if (!products?.length) return;

  const XLSX = await import("xlsx");

  // ── Hoja "Preorden" — estructura idéntica a la descarga de preorden ─────────
  const rows = products.map((p, idx) => ({
    "#": idx + 1,
    codigo: p.codigo || "",
    cantidad: 1,
    descripcion: p.descripcion || "",
    linea: p.linea || "",
    metal: p.metal || "",
    kilataje: p.kilataje || "",
  }));

  // ── Hoja "Info" — metadatos del archivo ─────────────────────────────────────
  const now = new Date();
  const infoRows = [
    {
      campo: "Generado",
      valor: now.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }),
    },
    { campo: "Total productos", valor: products.length },
    { campo: "Descripción", valor: label || "Selección catálogo" },
    {
      campo: "Compatibilidad",
      valor: "Catálogo personalizado cliente · Preorden · Referencia interna",
    },
  ];

  const workbook = XLSX.utils.book_new();
  const preordenSheet = XLSX.utils.json_to_sheet(rows);
  const infoSheet = XLSX.utils.json_to_sheet(infoRows);

  preordenSheet["!cols"] = [
    { wch: 4 },   // #
    { wch: 18 },  // codigo
    { wch: 8 },   // cantidad
    { wch: 44 },  // descripcion
    { wch: 20 },  // linea
    { wch: 10 },  // metal
    { wch: 10 },  // kilataje
  ];
  infoSheet["!cols"] = [{ wch: 20 }, { wch: 44 }];

  XLSX.utils.book_append_sheet(workbook, preordenSheet, "Preorden");
  XLSX.utils.book_append_sheet(workbook, infoSheet, "Info");

  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const fileName = `catalogo-${safeFilename(label || "seleccion")}-${date}.xlsx`;
  triggerDownload(XLSX, workbook, fileName);
};
