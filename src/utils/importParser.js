// ── IMPORTADOR DESDE FUENTE (Commercia Gold) ──────────────
// Mapeo de columnas de Commercia Gold al formato interno

const MAPEO_COMMERCIA_GOLD = {
  codigo:          "Código",
  modelo:          "Modelo",
  descripcion:     "Descripción",
  metal:           "Metal",
  kilataje:        "Kilataje",
  linea:           "Línea",
  familia:         "Familia",
  grupo:           "Grupo",
  estatus:         "Estatus",
  peso_promedio:   "Peso Prom",
  unidad_venta:    "Unidad Venta",
  clave_venta:     "Clave de Venta",
  precio_minimo:   "Precio Mínimo",
  moneda_precio_min: "Mon Precio Min",
  mano_obra:       "M de Obra 1",
  visible_web:     "¿Es web?",
  tags_busqueda:   null, // se construye automáticamente
};

const LINEAS_OMITIR = [
  "GPO VARIOS", "GPO COLOR", "GPO CADENA", "GPO CADENA NACIONAL",
  "GPO DF", "GPO IMPORTADO", "GPO MARQUESITA", "GRUPO IMPORTADO 10K",
  "GPO 4", "GPO 5", "GPO 6", "GPO 7", "GPO 8", "GPO 9",
  "GPO 10", "GPO 13", "GPO 15", "GPO 17", "GPO 18",
  "Oro 10K", "Oro 14K", "Oro 18K", "PIEZAS 10K", "PIEZAS 14K",
];

const buildSearchText = (row) => [
  row.codigo, row.modelo, row.descripcion,
  row.metal, row.kilataje, row.linea,
  row.familia, row.grupo, row.tags_busqueda,
].filter(Boolean).join(" ").toLowerCase();

const parseValue = (val, type) => {
  if (val === null || val === undefined) return type === "number" ? 0 : "";
  if (type === "number") return Number(val) || 0;
  if (type === "boolean") {
    if (typeof val === "boolean") return val;
    const s = String(val).trim().toLowerCase();
    return ["1", "si", "sí", "true", "activo", "yes"].includes(s);
  }
  return String(val).trim();
};

export const parseImportFile = async (file) => {
  const { read, utils } = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = read(buffer, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = utils.sheet_to_json(ws, { header: 1, defval: null });

  // Fila 1 = encabezados internos (h1, h2...), Fila 2 = encabezados reales
  const headerRow = raw[1];
  if (!headerRow) throw new Error("No se encontraron encabezados en el archivo");

  // Mapear nombre de columna → índice
  const colIdx = {};
  headerRow.forEach((h, i) => {
    if (h) colIdx[String(h).trim()] = i;
  });

  // Verificar columnas obligatorias
  const required = ["Código", "Descripción", "Estatus"];
  const missing = required.filter((c) => colIdx[c] === undefined);
  if (missing.length) throw new Error(`Columnas faltantes: ${missing.join(", ")}`);

  const get = (row, colName) => row[colIdx[colName]] ?? null;

  const productos = [];
  const omitidos = [];
  const duplicados = new Set();

  for (let i = 2; i < raw.length; i++) {
    const row = raw[i];
    if (!row || !row.some((v) => v !== null)) continue;

    const codigo = parseValue(get(row, "Código"), "string");
    const estatus = parseValue(get(row, "Estatus"), "string");
    const linea = parseValue(get(row, "Línea"), "string");

    // Filtros
    if (!codigo) continue;
    if (estatus.toLowerCase() !== "alta") { omitidos.push({ codigo, razon: "Baja" }); continue; }
    if (LINEAS_OMITIR.includes(linea)) { omitidos.push({ codigo, razon: `Línea omitida: ${linea}` }); continue; }
    if (duplicados.has(codigo)) { omitidos.push({ codigo, razon: "Duplicado" }); continue; }
    duplicados.add(codigo);

    const descripcion = parseValue(get(row, "Descripción"), "string");
    const metal = parseValue(get(row, "Metal"), "string");
    const kilataje = parseValue(get(row, "Kilataje"), "string");
    const familia = parseValue(get(row, "Familia"), "string");
    const grupo = parseValue(get(row, "Grupo"), "string");
    const modelo = parseValue(get(row, "Modelo"), "string");

    const tags = [descripcion, metal, kilataje, familia, grupo, linea]
      .filter(Boolean).join(" ").toLowerCase();

    const producto = {
      codigo,
      modelo,
      descripcion,
      metal,
      kilataje,
      linea,
      familia,
      grupo,
      genero:          "",
      acabado:         "",
      piedra:          "",
      medida:          "",
      estatus:         "Activo",
      peso_promedio:   parseValue(get(row, "Peso Prom"), "number"),
      unidad_venta:    parseValue(get(row, "Unidad Venta"), "string"),
      clave_venta:     parseValue(get(row, "Clave de Venta"), "string"),
      precio_minimo:   parseValue(get(row, "Precio Mínimo"), "number"),
      moneda_precio_min: parseValue(get(row, "Mon Precio Min"), "string") || "MXN",
      mano_obra:       parseValue(get(row, "M de Obra 1"), "number"),
      foto_url:        "",
      foto_url_2:      "",
      foto_url_3:      "",
      visible_web:     true, // siempre true al importar
      orden_web:       i,
      tags_busqueda:   tags,
      search_text:     buildSearchText({ codigo, modelo, descripcion, metal, kilataje, linea, familia, grupo, tags_busqueda: tags }),
    };

    productos.push(producto);
  }

  return { productos, omitidos, total: raw.length - 2 };
};
