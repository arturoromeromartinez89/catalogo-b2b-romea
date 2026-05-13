import * as XLSX from "xlsx";
import { EXCEL_COLUMNS_BY_LANGUAGE, productToExcelRow } from "./excelParser";

const sampleProductsEs = [
  {
    codigo: "AN-ROMEA-001",
    modelo: "Solitario Alba",
    descripcion: "Anillo solitario con zirconia central",
    metal: "Oro",
    kilataje: "14K",
    linea: "Dama",
    familia: "Anillos",
    grupo: "Zirconia",
    genero: "Mujer",
    acabado: "Pulido",
    piedra: "Zirconia",
    medida: "7",
    estatus: "Activo",
    pesoPromedio: 3.2,
    unidadVenta: "Pieza",
    claveVenta: "PZA",
    precioMinimo: 4800,
    manoObra: 220,
    monedaPrecioMin: "MXN",
    fotoUrl: "/sample-products/an-6205.svg",
    fotoUrl2: "",
    fotoUrl3: "",
    visibleWeb: true,
    ordenWeb: 1,
    tagsBusqueda: "anillo mujer solitario zirconia oro compromiso",
  },
  {
    codigo: "AR-ROMEA-002",
    modelo: "Arracada Diamantada",
    descripcion: "Arracada diamantada mediana",
    metal: "Plata",
    kilataje: "925",
    linea: "Dama",
    familia: "Aretes",
    grupo: "Diamantado",
    genero: "Mujer",
    acabado: "Diamantado",
    piedra: "Sin piedra",
    medida: "Mediana",
    estatus: "Activo",
    pesoPromedio: 4.6,
    unidadVenta: "Par",
    claveVenta: "PAR",
    precioMinimo: 690,
    manoObra: 95,
    monedaPrecioMin: "MXN",
    fotoUrl: "/sample-products/ar-2102.svg",
    fotoUrl2: "",
    fotoUrl3: "",
    visibleWeb: true,
    ordenWeb: 2,
    tagsBusqueda: "arracada diamantada mujer plata arete",
  },
  {
    codigo: "DI-ROMEA-003",
    modelo: "San Benito",
    descripcion: "Dije San Benito acabado liso",
    metal: "Plata",
    kilataje: "925",
    linea: "Unisex",
    familia: "Dijes",
    grupo: "Liso",
    genero: "Unisex",
    acabado: "Liso",
    piedra: "Sin piedra",
    medida: "",
    estatus: "Activo",
    pesoPromedio: 2.1,
    unidadVenta: "Pieza",
    claveVenta: "PZA",
    precioMinimo: 420,
    manoObra: 60,
    monedaPrecioMin: "MXN",
    fotoUrl: "/sample-products/di-3301.svg",
    fotoUrl2: "",
    fotoUrl3: "",
    visibleWeb: true,
    ordenWeb: 3,
    tagsBusqueda: "dije san benito liso plata religioso",
  },
];

const sampleProductsEn = sampleProductsEs.map((product, index) => {
  const translations = [
    {
      modelo: "Alba Solitaire",
      descripcion: "Solitaire ring with center zirconia",
      linea: "Women",
      familia: "Rings",
      grupo: "Zirconia",
      genero: "Women",
      acabado: "Polished",
      piedra: "Zirconia",
      estatus: "Active",
      unidadVenta: "Piece",
      tagsBusqueda: "women ring solitaire zirconia gold engagement",
    },
    {
      modelo: "Diamond Cut Hoop",
      descripcion: "Medium diamond cut hoop earrings",
      linea: "Women",
      familia: "Earrings",
      grupo: "Diamond cut",
      genero: "Women",
      acabado: "Diamond cut",
      piedra: "No stone",
      estatus: "Active",
      unidadVenta: "Pair",
      tagsBusqueda: "hoop earrings diamond cut women silver",
    },
    {
      modelo: "Saint Benedict",
      descripcion: "Saint Benedict pendant with plain finish",
      linea: "Unisex",
      familia: "Pendants",
      grupo: "Plain",
      genero: "Unisex",
      acabado: "Plain",
      piedra: "No stone",
      estatus: "Active",
      unidadVenta: "Piece",
      tagsBusqueda: "saint benedict pendant plain silver religious",
    },
  ];
  return { ...product, ...translations[index] };
});

const instructionText = {
  es: [
    ["Instrucciones"],
    ["Una fila equivale a un producto."],
    ["No combinar celdas."],
    ["No dejar código vacío."],
    ["visible_web debe ser 1 para publicar el producto."],
    ["Si visible_web está vacío o 0, el producto no aparece."],
    ["Si estatus dice Baja, el producto no aparece."],
    ["foto_url debe ser una liga directa a la imagen."],
    ["peso_promedio debe ser numérico."],
    ["precio_minimo debe ser numérico."],
    ["mano_obra permite capturar el costo o precio de mano de obra del producto."],
    ["tags_busqueda mejora búsqueda, chips y filtros."],
    ["Ejemplo de tags: anillo caballero piedra negra plata 925."],
    ["No incluir costos internos ni información confidencial."],
    ["No combinar celdas ni cambiar los encabezados."],
    [],
    ["Significado de columnas"],
  ],
  en: [
    ["Instructions"],
    ["One row equals one product."],
    ["Do not merge cells."],
    ["Do not leave code empty."],
    ["visible_web must be 1 for the product to appear."],
    ["If visible_web is empty or 0, the product will not appear."],
    ["If status is Discontinued or Baja, the product will not appear."],
    ["photo_url must be a direct image link."],
    ["average_weight must be numeric."],
    ["minimum_price must be numeric."],
    ["labor_price allows capturing the product labor price."],
    ["search_tags improves search, chips and filters."],
    ["Tag example: men's ring black stone silver 925."],
    ["Do not include internal costs or confidential information."],
    ["Do not merge cells or change the headers."],
    [],
    ["Column meaning"],
  ],
};

const makeWorkbook = (rows, language = "es") => {
  const columns = EXCEL_COLUMNS_BY_LANGUAGE[language] || EXCEL_COLUMNS_BY_LANGUAGE.es;
  const workbook = XLSX.utils.book_new();
  const catalogSheet = XLSX.utils.json_to_sheet(rows, { header: columns });
  const instructions = [
    ...(instructionText[language] || instructionText.es),
    ...columns.map((column) => [
      column,
      language === "en" ? "Enter the commercial product value." : "Capturar según el dato comercial del producto.",
    ]),
  ];
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
  catalogSheet["!cols"] = columns.map(() => ({ wch: 20 }));
  instructionsSheet["!cols"] = [{ wch: 34 }, { wch: 82 }];
  XLSX.utils.book_append_sheet(workbook, catalogSheet, "Catalogo_Web");
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, language === "en" ? "Instructions" : "Instrucciones");
  return workbook;
};

export const downloadExcelTemplate = (language = "es") => {
  const source = language === "en" ? sampleProductsEn : sampleProductsEs;
  const rows = source.map((product) => productToExcelRow(product, language));
  XLSX.writeFile(makeWorkbook(rows, language), language === "en" ? "romea_catalog_template.xlsx" : "plantilla_catalogo_romea.xlsx");
};

export const downloadCurrentCatalog = (products, language = "es") => {
  const rows = products.map((product) => productToExcelRow(product, language));
  XLSX.writeFile(makeWorkbook(rows, language), language === "en" ? "romea_updated_catalog.xlsx" : "catalogo_romea_actualizado.xlsx");
};
