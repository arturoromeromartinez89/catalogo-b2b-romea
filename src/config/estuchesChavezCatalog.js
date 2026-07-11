import { normalizeText } from "../utils/textNormalizer.js";

export const ESTUCHES_CHAVEZ_CATEGORIES = [
  {
    key: "accesorios",
    label: "ACCESORIOS",
    terms: ["accesorio", "accesorios", "limpiador", "relleno", "lazo", "mono", "viruta"],
  },
  {
    key: "bolsa-regalo",
    label: "BOLSA DE REGALO",
    terms: ["bolsa regalo", "bolsas regalo", "regalo", "gift bag"],
  },
  {
    key: "bolsas",
    label: "BOLSAS",
    terms: ["bolsa", "bolsas"],
    exclude: ["tela", "regalo", "terciopelo", "gamuza", "organza"],
  },
  {
    key: "bolsas-tela",
    label: "BOLSAS DE TELA",
    terms: ["bolsa tela", "bolsas tela", "tela", "terciopelo", "gamuza", "organza", "pouch"],
  },
  {
    key: "cajas-carton",
    label: "CAJAS DE CARTON",
    terms: ["caja carton", "cajas carton", "carton"],
  },
  {
    key: "charolas",
    label: "CHAROLAS",
    terms: ["charola", "charolas", "charolero"],
  },
  {
    key: "estuches-plastico",
    label: "ESTUCHES DE PLASTICO",
    terms: ["estuche plastico", "estuches plastico", "plastico"],
  },
  {
    key: "estuches-finos",
    label: "ESTUCHES FINOS",
    terms: ["estuche fino", "estuches finos", "fino", "finos", "piel", "madera", "lujo", "premium", "terciopelo"],
  },
];

export const ESTUCHES_CHAVEZ_OTHER_CATEGORY = {
  key: "otros",
  label: "OTROS PRODUCTOS",
  terms: [],
};

export const isEstuchesChavezCatalogExperience = () => {
  const mode = String(import.meta.env?.MODE || "").toLowerCase();
  if (mode === "chavez") return true;
  if (typeof window === "undefined") return false;
  const host = String(window.location?.hostname || "").toLowerCase();
  const path = String(window.location?.pathname || "").toLowerCase();
  return /(^|\.)estucheschavez\.com\.mx$/.test(host) && path.startsWith("/catalogo");
};

export const isEstuchesChavezTenantContext = ({ tenant = {}, company = {} } = {}) => {
  if (isEstuchesChavezCatalogExperience()) return true;
  const text = normalizeText(compact([
    tenant.slug,
    tenant.name,
    company.slug,
    company.brand_name,
    company.legal_name,
    company.name,
    company.nombre,
  ]).join(" "));
  return text.includes("estuches chavez") || text.includes("estuches-chavez");
};

const compact = (values) =>
  values
    .map((value) => String(value || "").trim())
    .filter(Boolean);

export const getEstuchesProductText = (product = {}) =>
  normalizeText(compact([
    product.modelo,
    product.codigo,
    product.descripcion,
    product.linea,
    product.familia,
    product.grupo,
    product.tagsBusqueda,
    product.proveedor,
    product.medida,
    product.acabado,
  ]).join(" "));

export const productMatchesEstuchesCategory = (product, category) => {
  if (!category || category.key === ESTUCHES_CHAVEZ_OTHER_CATEGORY.key) return false;
  const text = getEstuchesProductText(product);
  if (!text) return false;
  if ((category.exclude || []).some((term) => text.includes(normalizeText(term)))) return false;
  return (category.terms || []).some((term) => text.includes(normalizeText(term)));
};

export const getEstuchesProductCategory = (product, categories = ESTUCHES_CHAVEZ_CATEGORIES) =>
  categories.find((category) => productMatchesEstuchesCategory(product, category)) || null;

export const getEstuchesDisplayCode = (productOrItem = {}, productByCode = null) => {
  const internalCode = productOrItem.codigo || productOrItem.producto_codigo || "";
  const product = productByCode?.get?.(normalizeText(internalCode)) || productOrItem;
  return String(product?.modelo || product?.model || product?.producto_modelo || internalCode || "").trim();
};

const PACKAGE_NUMBER_PATTERN = String.raw`\d{1,3}(?:[,.]\d{3})*|\d+`;
const PACKAGE_UNIT_PATTERN = String.raw`piezas?|pzas?\.?|pzs?\.?|pz\.?|pcs?\.?|etiquetas?|bolsas?|monitos?|monos?|ganchos?`;
const DEFAULT_UNIT_PATTERN = /^(pieza|pza|pz|pc|pcs|unidad|un)$/i;
const ESTUCHES_PACKAGE_OVERRIDES = new Map([
  ["1171", "Caja con 48 piezas"],
  ["1172", "Caja con 48 piezas"],
  ["1173", "Caja con 16 piezas"],
  ["1174", "Caja con 16 piezas"],
  ["1175", "Caja con 8 piezas"],
  ["1176", "Caja con 8 piezas"],
  ["1177", "Caja con 8 piezas"],
  ["1178", "Caja con 8 piezas"],
  ["1179", "Caja con 8 piezas"],
  ["1240", "Paquete con 10 piezas"],
  ["1242", "Paquete con 10 piezas"],
  ["1243", "Paquete con 10 piezas"],
  ["1244", "Paquete con 10 piezas"],
  ["1251", "Paquete con 10 piezas"],
  ["1252", "Paquete con 10 piezas"],
  ["1253", "Paquete con 10 piezas"],
  ["1254", "Paquete con 10 piezas"],
  ["1273", "Paquete con 24 piezas"],
  ["1284", "Paquete con 24 piezas"],
  ["1300", "Caja con 48 piezas"],
  ["1301", "Caja con 48 piezas"],
  ["1302", "Caja con 48 piezas"],
  ["1303", "Caja con 48 piezas"],
  ["1305", "Caja con 48 piezas"],
  ["1308", "Caja con 48 piezas"],
  ["1309", "Caja con 48 piezas"],
  ["1325.negro", "Paquete con 5 piezas"],
  ["1326", "Paquete con 5 piezas"],
  ["1327", "Paquete con 5 piezas"],
  ["1328", "Paquete con 5 piezas"],
  ["1329", "Paquete con 5 piezas"],
  ["1330", "Paquete con 5 piezas"],
  ["1331", "Paquete con 5 piezas"],
  ["1332", "Paquete con 5 piezas"],
  ["1333", "Paquete con 5 piezas"],
  ["1334", "Paquete con 5 piezas"],
  ["1336", "Paquete con 5 piezas"],
  ["1421", "Caja con 48 piezas"],
  ["1422", "Caja con 48 piezas"],
  ["1423", "Caja con 24 piezas"],
  ["1424", "Caja con 24 piezas"],
  ["1701", "Caja con 48 piezas"],
  ["1702", "Caja con 48 piezas"],
  ["1703", "Caja con 48 piezas"],
  ["1704", "Caja con 24 piezas"],
  ["1705", "Caja con 24 piezas"],
  ["1706", "Caja con 12 piezas"],
  ["1707", "Caja con 24 piezas"],
  ["1951", "Caja con 48 piezas"],
  ["1952", "Caja con 48 piezas"],
  ["1953", "Caja con 48 piezas"],
  ["1954", "Caja con 24 piezas"],
  ["1955", "Caja con 24 piezas"],
  ["1956", "Caja con 12 piezas"],
  ["1957", "Caja con 24 piezas"],
  ["1958", "Caja con 24 piezas"],
  ["205", "Paquete con 50 piezas"],
  ["2600", "Caja con 1,000 piezas"],
  ["2760", "Paquete con 100 piezas"],
  ["2761", "Paquete con 100 piezas"],
  ["2762", "Paquete con 100 piezas"],
  ["2763", "Paquete con 100 piezas"],
  ["2764", "Paquete con 100 piezas"],
  ["2765", "Paquete con 100 piezas"],
  ["2766", "Paquete con 100 piezas"],
  ["2767", "Paquete con 100 piezas"],
  ["2768", "Paquete con 100 piezas"],
  ["2769", "Paquete con 100 piezas"],
  ["2770", "Paquete con 100 piezas"],
  ["2771", "Paquete con 100 piezas"],
  ["2772", "Paquete con 100 piezas"],
  ["2773", "Paquete con 100 piezas"],
  ["2774", "Paquete con 100 piezas"],
  ["2775", "Paquete con 100 piezas"],
  ["2782", "Paquete con 100 piezas"],
  ["2783", "Paquete con 100 piezas"],
  ["2784", "Paquete con 100 piezas"],
  ["2785", "Paquete con 100 piezas"],
  ["2786", "Paquete con 100 piezas"],
  ["2787", "Paquete con 100 piezas"],
  ["2788", "Paquete con 100 piezas"],
  ["2789", "Paquete con 100 piezas"],
  ["2790", "Paquete con 100 piezas"],
  ["2791", "Paquete con 100 piezas"],
  ["2792", "Paquete con 100 piezas"],
  ["2873", "Bolsita surtida con 50 monitos"],
  ["3450", "Paquete con 20 piezas"],
  ["3451", "Paquete con 20 piezas"],
  ["4727", "Paquete con 1,000 etiquetas"],
  ["4728", "Paquete con 1,000 etiquetas"],
  ["4729", "Paquete con 1,000 etiquetas"],
  ["4730", "Paquete con 2,000 etiquetas"],
  ["4731", "Paquete con 2,000 etiquetas"],
  ["4732", "Paquete con 2,000 etiquetas"],
  ["4913", "Paquete con 10 piezas"],
  ["5367", "Paquete con 50 piezas"],
  ["ac-eti-001", "Paquete con 1,200 etiquetas"],
  ["ac-eti-002", "Paquete con 2,000 etiquetas"],
  ["ac-eti-003", "Paquete con 2,000 etiquetas"],
  ["ac-eti-004", "Paquete con 2,000 etiquetas"],
  ["ac-eti-005", "Paquete con 100 etiquetas"],
  ["ac-eti-006", "Paquete con 100 etiquetas"],
  ["ac-eti-007", "Paquete con 1,000 etiquetas"],
  ["ac-eti-008", "Paquete con 1,000 etiquetas"],
  ["ac-eti-009", "Paquete con 1,000 etiquetas"],
  ["ac-mon-001", "Bolsita surtida con 50 monitos"],
  ["ac-pin-001", "Caja con 1,000 piezas"],
  ["ar-acr-003", "Paquete con 50 piezas"],
  ["ar-acr-005", "Paquete con 10 piezas"],
  ["ar-acr-006", "Paquete con 10 piezas"],
  ["ar-acr-007", "Paquete con 10 piezas"],
  ["ar-acr-008", "Paquete con 10 piezas"],
  ["ar-acr-011", "Paquete con 10 piezas"],
  ["ar-acr-012", "Paquete con 10 piezas"],
  ["ar-acr-014", "Paquete con 10 piezas"],
  ["ar-acr-015", "Paquete con 10 piezas"],
  ["be-leochica", "Paquete con 100 bolsas"],
  ["be-leogrande", "Paquete con 100 bolsas"],
  ["be-leomediana", "Paquete con 100 bolsas"],
  ["be-leomini", "Paquete con 100 bolsas"],
  ["be-zebchica", "Paquete con 100 bolsas"],
  ["be-zebgrande", "Paquete con 100 bolsas"],
  ["be-zebmed", "Paquete con 100 bolsas"],
  ["be-zebmini", "Paquete con 100 bolsas"],
  ["bo-boc-001", "Paquete con 100 piezas"],
  ["bo-boc-002", "Paquete con 100 piezas"],
  ["bo-boc-003", "Paquete con 100 piezas"],
  ["bo-boc-004", "Paquete con 100 piezas"],
  ["bo-boc-005", "Paquete con 100 piezas"],
  ["bo-boc-006", "Paquete con 100 piezas"],
  ["bo-boc-007", "Paquete con 100 piezas"],
  ["bo-boc-008", "Paquete con 100 piezas"],
  ["bo-boc-009", "Paquete con 100 piezas"],
  ["bo-boc-010", "Paquete con 100 piezas"],
  ["bo-boc-011", "Paquete con 100 piezas"],
  ["bo-boc-012", "Paquete con 100 piezas"],
  ["bo-boc-013", "Paquete con 100 piezas"],
  ["bo-boc-014", "Paquete con 100 piezas"],
  ["bo-boc-015", "Paquete con 100 piezas"],
  ["bo-boc-016", "Paquete con 100 piezas"],
  ["bo-bpa-001", "Paquete con 100 bolsas"],
  ["bo-bpa-002", "Paquete con 100 bolsas"],
  ["bo-bpa-003", "Paquete con 100 bolsas"],
  ["bo-bpa-004", "Paquete con 100 bolsas"],
  ["bo-bpa-005", "Paquete con 100 bolsas"],
  ["bo-bpa-006", "Paquete con 100 bolsas"],
  ["bo-bpa-007", "Paquete con 100 bolsas"],
  ["bo-bpa-008", "Paquete con 100 bolsas"],
  ["ca-bri-001", "Caja con 48 piezas"],
  ["ca-bri-002", "Caja con 48 piezas"],
  ["ca-bri-003", "Caja con 24 piezas"],
  ["ca-bri-004", "Caja con 24 piezas"],
  ["ca-fan-001", "Caja con 48 piezas"],
  ["ca-fan-002", "Caja con 16 piezas"],
  ["ca-fan-003", "Caja con 8 piezas"],
  ["ca-fan-004", "Caja con 16 piezas"],
  ["ca-fan-005", "Caja con 48 piezas"],
  ["ca-fan-006", "Caja con 8 piezas"],
  ["ca-fan-007", "Caja con 8 piezas"],
  ["ca-fan-008", "Caja con 8 piezas"],
  ["ca-fan-009", "Caja con 8 piezas"],
  ["ca-fas-001", "Caja con 24 piezas"],
  ["ca-fas-002", "Caja con 48 piezas"],
  ["ca-fas-003", "Caja con 48 piezas"],
  ["ca-fas-004", "Caja con 48 piezas"],
  ["ca-fas-005", "Caja con 24 piezas"],
  ["ca-fas-006", "Caja con 12 piezas"],
  ["ca-fas-007", "Caja con 24 piezas"],
  ["ca-fas-008", "Caja con 24 piezas"],
  ["ca-pas-001", "Caja con 48 piezas"],
  ["ca-pas-002", "Caja con 48 piezas"],
  ["ca-pas-003", "Caja con 24 piezas"],
  ["ca-pas-004", "Caja con 48 piezas"],
  ["ca-pas-005", "Caja con 12 piezas"],
  ["ca-pas-006", "Caja con 24 piezas"],
  ["ca-pas-007", "Caja con 24 piezas"],
  ["et-hilo-ch", "Paquete con 100 etiquetas"],
  ["et-hilo-gde", "Paquete con 100 etiquetas"],
  ["et-lesa", "Paquete con 1,200 etiquetas"],
  ["ex-atr-021", "Paquete con 50 piezas"],
  ["ex-ins-001", "Paquete con 100 piezas"],
  ["ex-ins-002", "Paquete con 100 piezas"],
  ["ex-ins-003", "Paquete con 100 piezas"],
  ["ex-ins-004", "Paquete con 100 piezas"],
  ["ex-ins-005", "Paquete con 100 piezas"],
  ["ex-ins-006", "Paquete con 100 piezas"],
  ["ex-ins-007", "Paquete con 100 piezas"],
  ["ex-ins-008", "Paquete con 100 piezas"],
  ["ex-ins-009", "Paquete con 100 piezas"],
  ["ex-ins-010", "Paquete con 100 piezas"],
  ["ex-ins-011", "Paquete con 100 piezas"],
  ["ex-ins-012", "Paquete con 20 piezas"],
  ["ex-ins-013", "Paquete con 20 piezas"],
  ["ex-vel-004", "Paquete con 10 piezas"],
  ["fs-for-001", "Caja con 48 piezas"],
  ["fs-for-002", "Caja con 48 piezas"],
  ["fs-for-003", "Caja con 48 piezas"],
  ["fs-for-004", "Caja con 48 piezas"],
  ["fs-for-005", "Caja con 48 piezas"],
  ["fs-for-006", "Caja con 48 piezas"],
  ["fs-for-007", "Caja con 48 piezas"],
  ["pl-pex-001", "Paquete con 24 piezas"],
  ["pl-pex-002", "Paquete con 24 piezas"],
  ["rg-bob-001", "Paquete con 5 piezas"],
  ["rg-bob-002", "Paquete con 5 piezas"],
  ["rg-bob-003", "Paquete con 5 piezas"],
  ["rg-bob-004", "Paquete con 5 piezas"],
  ["rg-bob-005", "Paquete con 5 piezas"],
  ["rg-bob-006", "Paquete con 5 piezas"],
  ["rg-bob-007", "Paquete con 5 piezas"],
  ["rg-bob-008", "Paquete con 5 piezas"],
  ["rg-bob-009", "Paquete con 5 piezas"],
  ["rg-bob-010", "Paquete con 5 piezas"],
  ["rg-bob-011", "Paquete con 5 piezas"],
]);

const formatPackageQuantity = (value = "") => {
  const clean = String(value || "").replace(/[^\d]/g, "");
  const number = Number(clean);
  if (!Number.isFinite(number) || number <= 0) return String(value || "").trim();
  return number.toLocaleString("en-US");
};

const normalizePackageUnit = (unit = "") => {
  const text = normalizeText(String(unit || "").replace(/\./g, ""));
  if (!text) return "piezas";
  if (/^(pza|pzas|pz|pzs|pieza|piezas|pc|pcs)$/.test(text)) return "piezas";
  if (text.startsWith("etiqueta")) return "etiquetas";
  if (text.startsWith("bolsa")) return "bolsas";
  if (text.startsWith("mon")) return "monitos";
  if (text.startsWith("gancho")) return "ganchos";
  return text;
};

const packagePatterns = [
  {
    label: "Paquete con",
    regex: new RegExp(String.raw`\b(?:paquetes?|paq\.?|packs?)\s*(?:de|con)?\s*(${PACKAGE_NUMBER_PATTERN})\s*(${PACKAGE_UNIT_PATTERN})`, "i"),
  },
  {
    label: "Caja con",
    regex: new RegExp(String.raw`\bcaja\s*(?:de|con)?\s*(${PACKAGE_NUMBER_PATTERN})\s*(${PACKAGE_UNIT_PATTERN})`, "i"),
  },
  {
    label: "Bolsita surtida con",
    regex: new RegExp(String.raw`\bbolsita\s+surtida\s*(?:de|con)?\s*(${PACKAGE_NUMBER_PATTERN})\s*(${PACKAGE_UNIT_PATTERN})`, "i"),
  },
  {
    label: "Bolsa con",
    regex: new RegExp(String.raw`\bbolsa\s*(?:de|con)?\s*(${PACKAGE_NUMBER_PATTERN})\s*(${PACKAGE_UNIT_PATTERN})`, "i"),
  },
];

const detectExplicitPackageLabel = (text = "") => {
  const source = String(text || "");
  if (!source.trim()) return "";
  for (const pattern of packagePatterns) {
    const match = source.match(pattern.regex);
    if (!match) continue;
    const quantity = formatPackageQuantity(match[1]);
    const unit = normalizePackageUnit(match[2]);
    if (quantity) return `${pattern.label} ${quantity} ${unit}`;
  }
  return "";
};

const getEstuchesPackageOverride = (product = {}) => {
  const keys = compact([
    product?.codigo,
    product?.producto_codigo,
    product?.modelo,
    product?.model,
    product?.producto_modelo,
    product?.codigoOriginal,
    product?.codigo_original,
  ]).map(normalizeText);
  for (const key of keys) {
    const label = ESTUCHES_PACKAGE_OVERRIDES.get(key);
    if (label) return label;
  }
  return "";
};

export const getEstuchesPackageLabel = (product = {}) => {
  const raw = String(product?.unidadVenta || product?.claveVenta || "").trim();
  const override = getEstuchesPackageOverride(product);
  if (override) return override;

  const productText = compact([
    product?.descripcion,
    product?.producto_descripcion,
    product?.modelo,
    product?.linea,
    product?.familia,
    product?.grupo,
    product?.tagsBusqueda,
    raw,
  ]).join(" ");

  const detected = detectExplicitPackageLabel(productText);
  if (detected) return detected;

  if (!raw || DEFAULT_UNIT_PATTERN.test(raw)) return "";
  const numericMatch = raw.match(/\d+/);
  if (/^\d+$/.test(raw)) return `Paquete con ${formatPackageQuantity(raw)} piezas`;
  if (/paquete/i.test(raw)) return raw.length <= 42 ? raw : "";
  if (numericMatch && /pieza|pza|pz|pcs|pack|paquete/i.test(raw)) {
    return `Paquete con ${formatPackageQuantity(numericMatch[0])} piezas`;
  }
  if (raw.length > 34) return "";
  return raw;
};

export const getEstuchesDisplayDescription = (product = {}) => {
  const base = String(product?.descripcion || product?.producto_descripcion || "").trim();
  const packageLabel = getEstuchesPackageLabel(product);
  if (!packageLabel) return base;
  const normalizedBase = normalizeText(base);
  const normalizedPackage = normalizeText(packageLabel);
  if (normalizedBase.includes(normalizedPackage)) return base;
  return [base, packageLabel].filter(Boolean).join(" - ");
};
