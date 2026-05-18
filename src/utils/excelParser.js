import * as XLSX from "xlsx";
import { resolveImageUrl, toNumber, toOptionalNumber } from "./formatters";
import { normalizeText } from "./textNormalizer";

export const REQUIRED_COLUMNS = [
  "codigo",
  "descripcion",
  "metal",
  "familia",
  "peso_promedio",
  "foto_url",
  "visible_web",
  "tags_busqueda",
];

export const EXPECTED_COLUMNS = [
  "codigo",
  "modelo",
  "descripcion",
  "metal",
  "kilataje",
  "linea",
  "familia",
  "grupo",
  "genero",
  "acabado",
  "piedra",
  "medida",
  "estatus",
  "peso_promedio",
  "unidad_venta",
  "clave_venta",
  "precio_minimo",
  "mano_obra",
  "moneda_precio_min",
  "foto_url",
  "foto_url_2",
  "foto_url_3",
  "visible_web",
  "orden_web",
  "tags_busqueda",
];

export const EXCEL_COLUMNS_BY_LANGUAGE = {
  es: EXPECTED_COLUMNS,
  en: [
    "code",
    "model",
    "description",
    "metal",
    "karat",
    "line",
    "family",
    "group",
    "gender",
    "finish",
    "stone",
    "size",
    "status",
    "average_weight",
    "sales_unit",
    "sales_key",
    "minimum_price",
    "labor_price",
    "minimum_price_currency",
    "photo_url",
    "photo_url_2",
    "photo_url_3",
    "visible_web",
    "web_order",
    "search_tags",
  ],
};

const aliases = {
  codigo: ["codigo", "code"],
  modelo: ["modelo", "model"],
  descripcion: ["descripcion", "description"],
  metal: ["metal"],
  kilataje: ["kilataje", "karat"],
  linea: ["linea", "line"],
  familia: ["familia", "family"],
  grupo: ["grupo", "group"],
  genero: ["genero", "gender"],
  acabado: ["acabado", "finish"],
  piedra: ["piedra", "stone"],
  medida: ["medida", "size"],
  estatus: ["estatus", "status"],
  peso_promedio: ["peso_promedio", "average_weight"],
  unidad_venta: ["unidad_venta", "sales_unit"],
  clave_venta: ["clave_venta", "sales_key"],
  precio_minimo: ["precio_minimo", "minimum_price"],
  mano_obra: ["mano_obra", "labor_price", "labor_cost"],
  moneda_precio_min: ["moneda_precio_min", "minimum_price_currency"],
  foto_url: ["foto_url", "photo_url"],
  foto_url_2: ["foto_url_2", "photo_url_2"],
  foto_url_3: ["foto_url_3", "photo_url_3"],
  visible_web: ["visible_web"],
  orden_web: ["orden_web", "web_order"],
  tags_busqueda: ["tags_busqueda", "search_tags"],
};

const visibleValues = new Set(["1", "si", "sí", "yes", "true", "activo", "active"]);

const valueByColumn = (row, column) => {
  const names = aliases[column] || [column];
  const key = Object.keys(row).find((item) => names.includes(normalizeText(item)));
  return key ? row[key] : "";
};

export const isVisibleValue = (value) => {
  if (value === true) return true;
  if (value === false || value === null || value === undefined || value === "") return false;
  return visibleValues.has(String(value).trim().toLowerCase());
};

export const normalizeProduct = (row) => {
  const product = {
    codigo: String(valueByColumn(row, "codigo") ?? "").trim(),
    modelo: String(valueByColumn(row, "modelo") ?? "").trim(),
    descripcion: String(valueByColumn(row, "descripcion") ?? "").trim(),
    metal: String(valueByColumn(row, "metal") ?? "").trim(),
    kilataje: String(valueByColumn(row, "kilataje") ?? "").trim(),
    linea: String(valueByColumn(row, "linea") ?? "").trim(),
    familia: String(valueByColumn(row, "familia") ?? "").trim(),
    grupo: String(valueByColumn(row, "grupo") ?? "").trim(),
    genero: String(valueByColumn(row, "genero") ?? "").trim(),
    acabado: String(valueByColumn(row, "acabado") ?? "").trim(),
    piedra: String(valueByColumn(row, "piedra") ?? "").trim(),
    medida: String(valueByColumn(row, "medida") ?? "").trim(),
    estatus: String(valueByColumn(row, "estatus") ?? "").trim(),
    pesoPromedio: toNumber(valueByColumn(row, "peso_promedio")),
    unidadVenta: String(valueByColumn(row, "unidad_venta") ?? "").trim(),
    claveVenta: String(valueByColumn(row, "clave_venta") ?? "").trim(),
    precioMinimo: toOptionalNumber(valueByColumn(row, "precio_minimo")),
    manoObra: toOptionalNumber(valueByColumn(row, "mano_obra")),
    monedaPrecioMin: String(valueByColumn(row, "moneda_precio_min") || "MXN").trim(),
    fotoUrl: resolveImageUrl(valueByColumn(row, "foto_url")),
    fotoUrl2: resolveImageUrl(valueByColumn(row, "foto_url_2")),
    fotoUrl3: resolveImageUrl(valueByColumn(row, "foto_url_3")),
    visibleWeb: isVisibleValue(valueByColumn(row, "visible_web")),
    ordenWeb: toOptionalNumber(valueByColumn(row, "orden_web")),
    tagsBusqueda: String(valueByColumn(row, "tags_busqueda") ?? "").trim(),
  };

  product.searchText = normalizeText(
    [
      product.codigo,
      product.modelo,
      product.descripcion,
      product.metal,
      product.kilataje,
      product.linea,
      product.familia,
      product.grupo,
      product.genero,
      product.acabado,
      product.piedra,
      product.medida,
      product.tagsBusqueda,
    ].join(" ")
  );

  return product;
};

const getSheet = (workbook) => {
  const preferred = workbook.SheetNames.find((name) => normalizeText(name) === "catalogo_web");
  const sheetName = preferred || workbook.SheetNames[0];
  return { sheetName, sheet: workbook.Sheets[sheetName] };
};

export const sortProducts = (products) => {
  const hasOrder = products.some((product) => Number(product.ordenWeb) > 0);
  return [...products].sort((a, b) => {
    if (hasOrder) {
      const orderA = a.ordenWeb || Number.MAX_SAFE_INTEGER;
      const orderB = b.ordenWeb || Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.codigo.localeCompare(b.codigo, "es");
    }
    const familyOrder = a.familia.localeCompare(b.familia, "es");
    return familyOrder || a.codigo.localeCompare(b.codigo, "es");
  });
};

export const validateColumns = (headers) => {
  const normalizedHeaders = headers.map((header) => normalizeText(header));
  return REQUIRED_COLUMNS.filter((column) => {
    const names = aliases[column] || [column];
    return !names.some((name) => normalizedHeaders.includes(name));
  });
};

export const parseExcelFile = async (file) => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });

  if (!workbook.SheetNames.length) throw new Error("El archivo Excel no contiene hojas.");

  const { sheetName, sheet } = getSheet(workbook);
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!rows.length) throw new Error("El Excel no contiene productos en la hoja seleccionada.");

  const missingColumns = validateColumns(Object.keys(rows[0]));
  if (missingColumns.length) throw new Error(`Faltan columnas obligatorias: ${missingColumns.join(", ")}.`);

  const normalizedProducts = rows.map(normalizeProduct);
  const products = normalizedProducts
    .filter((product) => product.visibleWeb)
    .filter((product) => normalizeText(product.estatus) !== "baja" && normalizeText(product.estatus) !== "discontinued");

  return {
    sheetName,
    products: sortProducts(products),
    totalRows: rows.length,
    excludedRows: normalizedProducts.length - products.length,
  };
};

const productValues = (product) => [
  product.codigo,
  product.modelo,
  product.descripcion,
  product.metal,
  product.kilataje,
  product.linea,
  product.familia,
  product.grupo,
  product.genero,
  product.acabado,
  product.piedra,
  product.medida,
  product.estatus,
  product.pesoPromedio,
  product.unidadVenta,
  product.claveVenta,
  product.precioMinimo,
  product.manoObra,
  product.monedaPrecioMin,
  product.fotoUrl,
  product.fotoUrl2,
  product.fotoUrl3,
  product.visibleWeb ? 1 : 0,
  product.ordenWeb,
  product.tagsBusqueda,
];

export const productToExcelRow = (product, language = "es") => {
  const columns = EXCEL_COLUMNS_BY_LANGUAGE[language] || EXCEL_COLUMNS_BY_LANGUAGE.es;
  return columns.reduce((row, column, index) => {
    row[column] = productValues(product)[index] ?? "";
    return row;
  }, {});
};
