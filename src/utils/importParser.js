import { normalizeText } from "./textNormalizer.js";
import { getNombreProveedor } from "../data/proveedores.js";

const COLUMN_ALIASES = {
  codigo: ["codigo", "code", "sku", "clave", "clave producto", "id producto", "item", "referencia", "modelo proveedor"],
  modelo: ["modelo", "model", "estilo", "style"],
  descripcion: ["descripcion", "description", "producto", "nombre", "nombre producto", "articulo", "item description"],
  metal: ["metal", "material", "composicion"],
  kilataje: ["kilataje", "karat", "k", "calibre"],
  linea: ["linea", "line", "departamento", "division", "coleccion", "temporada"],
  familia: ["familia", "family", "categoria", "category", "tipo", "tipo producto", "product type", "rubro"],
  grupo: ["grupo", "group", "subcategoria", "subcategory", "sub tipo", "subtipo", "clase"],
  proveedor: ["proveedor", "provider", "supplier", "vendor", "fabricante", "marca", "brand", "razon social", "nombre proveedor", "proveedor nombre"],
  estatus: ["estatus", "status", "estado"],
  pesoPromedio: ["peso prom", "peso prom.", "peso promedio", "peso_promedio", "average weight", "average_weight", "peso"],
  unidadVenta: ["unidad venta", "unidad_venta", "sales unit", "sales_unit", "unidad", "unit", "uom"],
  claveVenta: ["clave de venta", "clave venta", "clave_venta", "sales key", "sales_key"],
  precioMinimo: ["precio minimo", "precio_minimo", "minimum price", "minimum_price", "precio", "price", "precio venta", "precio publico"],
  monedaPrecioMin: ["mon precio min", "moneda precio min", "moneda_precio_min", "currency", "moneda"],
  manoObra: ["m de obra 1", "mano de obra", "mano_obra", "labor price", "labor_price", "labor cost"],
  numProveed: ["num proveed", "num prov", "numero proveedor"],
  fotoUrl: ["foto_url", "photo_url", "imagen", "image", "url imagen", "url foto", "foto"],
  tagsBusqueda: ["tags", "tags_busqueda", "search tags", "palabras clave", "keywords"],
};

const LINEAS_OMITIR_COMERCIAGOLD = [
  "GPO VARIOS",
  "GPO COLOR",
  "GPO CADENA",
  "GPO CADENA NACIONAL",
  "GPO DF",
  "GPO IMPORTADO",
  "GPO MARQUESITA",
  "GRUPO IMPORTADO 10K",
  "GPO 4",
  "GPO 5",
  "GPO 6",
  "GPO 7",
  "GPO 8",
  "GPO 9",
  "GPO 10",
  "GPO 13",
  "GPO 15",
  "GPO 17",
  "GPO 18",
  "Oro 10K",
  "Oro 14K",
  "Oro 18K",
  "PIEZAS 10K",
  "PIEZAS 14K",
].map(normalizeText);

const ACTIVE_STATUSES = new Set(["alta", "activo", "active", "vigente", "si", "yes", "true", "1"]);
const INACTIVE_STATUSES = new Set(["baja", "inactivo", "inactive", "discontinued", "no", "false", "0"]);

const normalizeHeader = (value) => normalizeText(String(value || "").replace(/[_-]+/g, " "));

const parseNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
};

const parseString = (value) => String(value ?? "").trim();

const buildSearchText = (product) =>
  normalizeText(
    [
      product.codigo,
      product.modelo,
      product.descripcion,
      product.metal,
      product.kilataje,
      product.linea,
      product.familia,
      product.grupo,
      product.proveedor,
      product.tagsBusqueda,
    ].join(" ")
  );

const includesAlias = (headers, field) =>
  COLUMN_ALIASES[field].some((alias) => headers.includes(normalizeHeader(alias)));

const findHeaderRowIndex = (rows) => {
  const maxRowsToCheck = Math.min(rows.length, 10);
  for (let index = 0; index < maxRowsToCheck; index += 1) {
    const normalized = rows[index].map(normalizeHeader);
    if (includesAlias(normalized, "codigo") && includesAlias(normalized, "descripcion")) return index;
  }
  return -1;
};

const buildColumnIndex = (headerRow) => {
  const normalizedHeader = headerRow.map(normalizeHeader);
  return Object.entries(COLUMN_ALIASES).reduce((indexByField, [field, aliases]) => {
    const index = aliases
      .map(normalizeHeader)
      .map((alias) => normalizedHeader.indexOf(alias))
      .find((position) => position >= 0);
    indexByField[field] = index ?? -1;
    return indexByField;
  }, {});
};

const detectImportProfile = (colIdx) =>
  colIdx.numProveed >= 0 || colIdx.manoObra >= 0 || colIdx.claveVenta >= 0
    ? "comerciagold"
    : "generic";

const shouldImportStatus = (estatus, hasStatus) => {
  if (!hasStatus) return true;
  const normalized = normalizeText(estatus);
  if (!normalized) return true;
  if (INACTIVE_STATUSES.has(normalized)) return false;
  return ACTIVE_STATUSES.has(normalized) || !INACTIVE_STATUSES.has(normalized);
};

const countBy = (items, field) => {
  const counts = new Map();
  items.forEach((item) => {
    const value = parseString(item[field]) || "Sin dato";
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
};

const countOmittedByReason = (omitidos) => {
  const counts = new Map();
  omitidos.forEach((item) => {
    const reason = String(item.razon || "Omitido");
    const key = reason.startsWith("Estatus no activo")
      ? "Estatus no activo"
      : reason.startsWith("Linea omitida")
        ? "Linea omitida"
        : reason;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, "es"));
};

const buildQuickFilterSuggestions = (productos, profile) => {
  const categories = countBy(productos, "familia").filter((item) => item.name !== "Sin dato");
  const fallbackField = profile === "comerciagold" ? "familia" : "grupo";
  const fallback = countBy(productos, fallbackField).filter((item) => item.name !== "Sin dato");
  const source = categories.length ? categories : fallback;

  return source.slice(0, 8).map((item) => ({
    label: item.name,
    count: item.count,
    matchField: categories.length ? "familia" : fallbackField,
  }));
};

const buildAnalysis = ({ productos, omitidos, total, profile, duplicateCodes }) => ({
  totalRows: total,
  importableCount: productos.length,
  omittedCount: omitidos.length,
  duplicateCount: duplicateCodes.length,
  duplicateCodes: duplicateCodes.slice(0, 25),
  omittedByReason: countOmittedByReason(omitidos),
  columns: {
    categories: countBy(productos, "familia").slice(0, 20),
    subcategories: countBy(productos, "grupo").slice(0, 20),
    materials: countBy(productos, "metal").slice(0, 20),
    lines: countBy(productos, "linea").slice(0, 20),
    providers: countBy(productos, "proveedor").slice(0, 20),
  },
  quickFilterSuggestions: buildQuickFilterSuggestions(productos, profile),
  notes: [
    "Los codigos nuevos se agregan al catalogo.",
    "Si un codigo ya existe en la base, se actualiza con la informacion del Excel.",
    "Los codigos repetidos dentro del mismo archivo se omiten despues de la primera aparicion.",
  ],
});

export const parseImportFile = async (file) => {
  const { read, utils } = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: "array", cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json(worksheet, { header: 1, defval: null });

  const headerRowIndex = findHeaderRowIndex(rows);
  if (headerRowIndex < 0) {
    throw new Error("No encontre encabezados validos. Debe existir codigo/SKU y descripcion/nombre.");
  }

  const colIdx = buildColumnIndex(rows[headerRowIndex]);
  const missing = ["codigo", "descripcion"].filter((field) => colIdx[field] < 0);
  if (missing.length) throw new Error(`Columnas faltantes: ${missing.join(", ")}`);

  const get = (row, field) => (colIdx[field] >= 0 ? row[colIdx[field]] : null);
  const profile = detectImportProfile(colIdx);
  const hasStatus = colIdx.estatus >= 0;
  const productos = [];
  const omitidos = [];
  const duplicados = new Set();
  const duplicateCodes = [];

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || !row.some((value) => value !== null && value !== "")) continue;

    const codigo = parseString(get(row, "codigo"));
    const estatus = parseString(get(row, "estatus"));
    const linea = parseString(get(row, "linea"));

    if (!codigo) continue;
    if (!shouldImportStatus(estatus, hasStatus)) {
      omitidos.push({ codigo, razon: `Estatus no activo: ${estatus || "vacio"}` });
      continue;
    }
    if (profile === "comerciagold" && LINEAS_OMITIR_COMERCIAGOLD.includes(normalizeText(linea))) {
      omitidos.push({ codigo, razon: `Linea omitida: ${linea}` });
      continue;
    }
    if (duplicados.has(codigo)) {
      omitidos.push({ codigo, razon: "Duplicado en archivo" });
      duplicateCodes.push(codigo);
      continue;
    }
    duplicados.add(codigo);

    const producto = {
      codigo,
      modelo: parseString(get(row, "modelo")),
      descripcion: parseString(get(row, "descripcion")),
      metal: parseString(get(row, "metal")),
      kilataje: parseString(get(row, "kilataje")),
      linea,
      familia: parseString(get(row, "familia")),
      grupo: parseString(get(row, "grupo")),
      proveedor: parseString(get(row, "proveedor")) || getNombreProveedor(get(row, "numProveed")),
      genero: "",
      acabado: "",
      piedra: "",
      medida: "",
      estatus: "Activo",
      pesoPromedio: parseNumber(get(row, "pesoPromedio")),
      unidadVenta: parseString(get(row, "unidadVenta")) || "pieza",
      claveVenta: parseString(get(row, "claveVenta")),
      precioMinimo: parseNumber(get(row, "precioMinimo")),
      monedaPrecioMin: parseString(get(row, "monedaPrecioMin")) || "MXN",
      manoObra: parseNumber(get(row, "manoObra")),
      fotoUrl: parseString(get(row, "fotoUrl")),
      fotoUrl2: "",
      fotoUrl3: "",
      visibleWeb: true,
      ordenWeb: index,
      tagsBusqueda: parseString(get(row, "tagsBusqueda")),
    };

    producto.tagsBusqueda = producto.tagsBusqueda || [
      producto.descripcion,
      producto.metal,
      producto.kilataje,
      producto.familia,
      producto.grupo,
      producto.linea,
      producto.proveedor,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    producto.searchText = buildSearchText(producto);

    productos.push(producto);
  }

  return {
    productos,
    omitidos,
    total: Math.max(0, rows.length - headerRowIndex - 1),
    profile,
    analysis: buildAnalysis({
      productos,
      omitidos,
      total: Math.max(0, rows.length - headerRowIndex - 1),
      profile,
      duplicateCodes,
    }),
  };
};
