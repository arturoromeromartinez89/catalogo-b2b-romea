import { normalizeText } from "./textNormalizer";

const COLUMN_ALIASES = {
  codigo: ["codigo", "código", "code", "sku", "clave"],
  modelo: ["modelo", "model"],
  descripcion: ["descripcion", "descripción", "description", "producto", "nombre"],
  metal: ["metal"],
  kilataje: ["kilataje", "karat", "k"],
  linea: ["linea", "línea", "line"],
  familia: ["familia", "family"],
  grupo: ["grupo", "group"],
  proveedor: ["proveedor", "provider", "supplier", "vendor", "fabricante", "marca", "razon social", "razón social", "nombre proveedor", "proveedor nombre"],
  estatus: ["estatus", "status", "estado"],
  pesoPromedio: ["peso prom", "peso prom.", "peso promedio", "peso_promedio", "average weight", "average_weight", "peso"],
  unidadVenta: ["unidad venta", "unidad_venta", "sales unit", "sales_unit"],
  claveVenta: ["clave de venta", "clave venta", "clave_venta", "sales key", "sales_key"],
  precioMinimo: ["precio minimo", "precio mínimo", "precio_minimo", "minimum price", "minimum_price"],
  monedaPrecioMin: ["mon precio min", "moneda precio min", "moneda_precio_min", "currency", "moneda"],
  manoObra: ["m de obra 1", "mano de obra", "mano_obra", "labor price", "labor_price", "labor cost"],
};

const LINEAS_OMITIR = [
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

const ACTIVE_STATUSES = new Set(["alta", "activo", "active", "vigente", "si", "sí", "yes", "true", "1"]);

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
      product.tagsBusqueda,
    ].join(" ")
  );

const findHeaderRowIndex = (rows) => {
  const maxRowsToCheck = Math.min(rows.length, 10);
  for (let index = 0; index < maxRowsToCheck; index += 1) {
    const normalized = rows[index].map(normalizeHeader);
    const hasCode = COLUMN_ALIASES.codigo.some((alias) => normalized.includes(normalizeHeader(alias)));
    const hasDescription = COLUMN_ALIASES.descripcion.some((alias) => normalized.includes(normalizeHeader(alias)));
    const hasStatus = COLUMN_ALIASES.estatus.some((alias) => normalized.includes(normalizeHeader(alias)));
    if (hasCode && hasDescription && hasStatus) return index;
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

export const parseImportFile = async (file) => {
  const { read, utils } = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, { type: "array", cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json(worksheet, { header: 1, defval: null });

  const headerRowIndex = findHeaderRowIndex(rows);
  if (headerRowIndex < 0) {
    throw new Error("No encontré encabezados válidos. Debe existir Código, Descripción y Estatus.");
  }

  const colIdx = buildColumnIndex(rows[headerRowIndex]);
  const missing = ["codigo", "descripcion", "estatus"].filter((field) => colIdx[field] < 0);
  if (missing.length) throw new Error(`Columnas faltantes: ${missing.join(", ")}`);

  const get = (row, field) => (colIdx[field] >= 0 ? row[colIdx[field]] : null);
  const productos = [];
  const omitidos = [];
  const duplicados = new Set();

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row || !row.some((value) => value !== null && value !== "")) continue;

    const codigo = parseString(get(row, "codigo"));
    const estatus = parseString(get(row, "estatus"));
    const linea = parseString(get(row, "linea"));

    if (!codigo) continue;
    if (!ACTIVE_STATUSES.has(normalizeText(estatus))) {
      omitidos.push({ codigo, razon: `Estatus no activo: ${estatus || "vacío"}` });
      continue;
    }
    if (LINEAS_OMITIR.includes(normalizeText(linea))) {
      omitidos.push({ codigo, razon: `Línea omitida: ${linea}` });
      continue;
    }
    if (duplicados.has(codigo)) {
      omitidos.push({ codigo, razon: "Duplicado en archivo" });
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
      proveedor: parseString(get(row, "proveedor")),
      genero: "",
      acabado: "",
      piedra: "",
      medida: "",
      estatus: "Activo",
      pesoPromedio: parseNumber(get(row, "pesoPromedio")),
      unidadVenta: parseString(get(row, "unidadVenta")),
      claveVenta: parseString(get(row, "claveVenta")),
      precioMinimo: parseNumber(get(row, "precioMinimo")),
      monedaPrecioMin: parseString(get(row, "monedaPrecioMin")) || "MXN",
      manoObra: parseNumber(get(row, "manoObra")),
      fotoUrl: "",
      fotoUrl2: "",
      fotoUrl3: "",
      visibleWeb: true,
      ordenWeb: index,
      tagsBusqueda: "",
    };

    producto.tagsBusqueda = [
      producto.descripcion,
      producto.metal,
      producto.kilataje,
      producto.familia,
      producto.grupo,
      producto.linea,
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
  };
};
