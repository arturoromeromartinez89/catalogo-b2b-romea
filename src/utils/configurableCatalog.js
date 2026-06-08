import { normalizeText } from "./textNormalizer";

const PIECE_TYPE_LABELS = {
  BRC: "Pulso",
  CHN: "Cadena",
  IDB: "Esclava",
  IDL: "Militar",
};

const PIECE_TYPE_ORDER = ["CHN", "BRC", "IDB", "IDL"];

const productCodePattern = /^([A-Za-z0-9]+)-([A-Za-z0-9]+)-([A-Za-z0-9]+)-(\d+(?:\.\d+)?MM)$/i;

const toTitleCase = (value) =>
  String(value || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const getConfigParts = (product) => {
  const match = String(product?.codigo || "").match(productCodePattern);
  if (!match) return null;
  const [, collection, weaveCode, pieceTypeCode, sizeCode] = match;
  if (!PIECE_TYPE_LABELS[pieceTypeCode?.toUpperCase()]) return null;
  return {
    collection,
    weaveCode: weaveCode.toUpperCase(),
    pieceTypeCode: pieceTypeCode.toUpperCase(),
    sizeCode: sizeCode.toUpperCase(),
  };
};

const getWeaveName = (product, parts) => {
  const description = String(product?.descripcion || product?.modelo || "");
  const sizePattern = new RegExp(`\\s*${parts.sizeCode.replace(".", "\\.")}\\b.*$`, "i");
  const withoutSize = description.replace(sizePattern, "").trim();
  const withoutType = withoutSize
    .replace(/\b(bracelet|chain|id bracelet|id lock|pulso|cadena|esclava|militar)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return toTitleCase(withoutType || product?.linea || parts.weaveCode);
};

export const isConfigurableCatalogCompany = ({ activeTenant, activeCompany, supportTenantName } = {}) => {
  const identity = normalizeText([
    activeTenant?.slug,
    activeTenant?.name,
    activeCompany?.brand_name,
    activeCompany?.commercial_name,
    activeCompany?.legal_name,
    supportTenantName,
  ].filter(Boolean).join(" "));

  return /\bromea\b/.test(identity);
};

export const isConfigurableProductGroup = (product) => Boolean(product?.isConfigurableGroup);

export const hasConfigurableCatalogProducts = (products = []) => {
  const groups = new Map();
  products.forEach((product) => {
    const parts = getConfigParts(product);
    if (!parts) return;
    const key = `${parts.collection}-${parts.weaveCode}-${parts.sizeCode}`;
    const current = groups.get(key) || new Set();
    current.add(parts.pieceTypeCode);
    groups.set(key, current);
  });
  return [...groups.values()].some((types) => types.size >= 2);
};

export const buildConfigurableCatalogProducts = (products = []) => {
  const groups = new Map();
  const passthrough = [];

  products.forEach((product) => {
    const parts = getConfigParts(product);
    if (!parts) {
      passthrough.push(product);
      return;
    }

    const key = `${parts.collection}-${parts.weaveCode}-${parts.sizeCode}`;
    const weaveName = getWeaveName(product, parts);
    const existing = groups.get(key);
    const variant = {
      code: parts.pieceTypeCode,
      label: PIECE_TYPE_LABELS[parts.pieceTypeCode],
      product,
    };

    if (!existing) {
      groups.set(key, {
        ...product,
        id: `configurable-${key}`,
        codigo: `CFG-${key}`,
        modelo: `${weaveName} ${parts.sizeCode}`,
        descripcion: `${weaveName} ${parts.sizeCode}`,
        familia: "Configurable",
        grupo: "Tejido configurable",
        linea: parts.weaveCode,
        medida: product.medida || parts.sizeCode,
        searchText: normalizeText([
          weaveName,
          parts.weaveCode,
          parts.sizeCode,
          product.tagsBusqueda,
          product.tags_busqueda,
          "cadena pulso esclava militar configurable",
        ].join(" ")),
        tagsBusqueda: [
          weaveName,
          parts.weaveCode,
          parts.sizeCode,
          "cadena pulso esclava militar configurable",
        ].join(" "),
        isConfigurableGroup: true,
        configurableKey: key,
        configurableParts: parts,
        configurableTitle: `${weaveName} ${parts.sizeCode}`,
        variants: [variant],
      });
      return;
    }

    existing.variants.push(variant);
    if (!existing.fotoUrl && product.fotoUrl) existing.fotoUrl = product.fotoUrl;
    if (!existing.fotoUrl2 && product.fotoUrl2) existing.fotoUrl2 = product.fotoUrl2;
    if (!existing.fotoUrl3 && product.fotoUrl3) existing.fotoUrl3 = product.fotoUrl3;
    existing.pesoPromedio = Math.min(Number(existing.pesoPromedio || product.pesoPromedio || 0), Number(product.pesoPromedio || existing.pesoPromedio || 0)) || existing.pesoPromedio;
  });

  const configurableGroups = [...groups.values()].map((group) => ({
    ...group,
    variants: [...group.variants].sort((a, b) => {
      const orderA = PIECE_TYPE_ORDER.indexOf(a.code);
      const orderB = PIECE_TYPE_ORDER.indexOf(b.code);
      return (orderA < 0 ? 99 : orderA) - (orderB < 0 ? 99 : orderB);
    }),
  }));

  return [...configurableGroups, ...passthrough].sort((a, b) => {
    const orderA = Number(a.ordenWeb || 999999);
    const orderB = Number(b.ordenWeb || 999999);
    if (orderA !== orderB) return orderA - orderB;
    return String(a.codigo || "").localeCompare(String(b.codigo || ""));
  });
};
