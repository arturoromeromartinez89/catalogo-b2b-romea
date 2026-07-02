import { normalizeText } from "./textNormalizer";

const PIECE_TYPE_LABELS = {
  BRC: "Pulso",
  CHN: "Cadena",
  IDB: "Esclava",
  IDL: "Militar",
};

const PIECE_TYPE_ORDER = ["CHN", "BRC", "IDB", "IDL"];
const VANGUARDIA_JOYERA_TENANT_ID = "77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb";

const productCodePattern = /^([A-Za-z0-9]+)-([A-Za-z0-9]+)-([A-Za-z0-9]+)-(\d+(?:\.\d+)?MM)$/i;
const ringSizeCodePattern = /^(.+)#(\d+)$/;

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

const isVanguardiaCaballeroRing = (product) =>
  String(product?.tenantId || product?.tenant_id || "") === VANGUARDIA_JOYERA_TENANT_ID &&
  normalizeText(product?.linea) === "008" &&
  normalizeText(product?.familia) === "anillo caballero";

const getRingSizeParts = (product) => {
  if (!isVanguardiaCaballeroRing(product)) return null;
  const code = String(product?.codigo || "").trim();
  if (!code) return null;
  const match = code.match(ringSizeCodePattern);
  return {
    baseCode: match ? match[1] : code,
    size: match ? match[2] : "",
  };
};

const getRingDisplayName = (product, baseCode) => {
  const description = String(product?.descripcion || product?.modelo || baseCode || "")
    .replace(/\s+MAESTRO\b/gi, "")
    .replace(/\s+MEDIDA\s+\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return description || baseCode;
};

const ringVariantSort = (a, b) => {
  const sizeA = Number(a.size || 999);
  const sizeB = Number(b.size || 999);
  if (sizeA !== sizeB) return sizeA - sizeB;
  return String(a.code || "").localeCompare(String(b.code || ""), "es");
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
  const ringGroups = new Map();
  products.forEach((product) => {
    const ringParts = getRingSizeParts(product);
    if (ringParts?.size) {
      const current = ringGroups.get(ringParts.baseCode) || new Set();
      current.add(ringParts.size);
      ringGroups.set(ringParts.baseCode, current);
    }

    const parts = getConfigParts(product);
    if (!parts) return;
    const key = `${parts.collection}-${parts.weaveCode}-${parts.sizeCode}`;
    const current = groups.get(key) || new Set();
    current.add(parts.pieceTypeCode);
    groups.set(key, current);
  });
  return [...groups.values()].some((types) => types.size >= 2) || [...ringGroups.values()].some((sizes) => sizes.size >= 2);
};

export const buildConfigurableCatalogProducts = (products = []) => {
  const groups = new Map();
  const ringGroups = new Map();
  const passthrough = [];

  products.forEach((product) => {
    const ringParts = getRingSizeParts(product);
    if (ringParts) {
      const existing = ringGroups.get(ringParts.baseCode) || {
        baseCode: ringParts.baseCode,
        baseProduct: null,
        variants: [],
        products: [],
      };
      existing.products.push(product);
      if (!ringParts.size) {
        existing.baseProduct = product;
      } else {
        existing.variants.push({
          code: product.codigo,
          label: `Talla ${ringParts.size}`,
          size: ringParts.size,
          product,
        });
      }
      ringGroups.set(ringParts.baseCode, existing);
      return;
    }

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

  const ringSizeGroups = [];
  ringGroups.forEach((group) => {
    const variants = [...group.variants].sort(ringVariantSort);
    if (variants.length < 2) {
      passthrough.push(...group.products);
      return;
    }

    const baseProduct = group.baseProduct || variants[0].product || group.products[0];
    const title = getRingDisplayName(baseProduct, group.baseCode);

    ringSizeGroups.push({
      ...baseProduct,
      id: `ring-size-${group.baseCode}`,
      codigo: `RING-${group.baseCode}`,
      modelo: group.baseCode,
      descripcion: title,
      familia: "ANILLO CABALLERO",
      grupo: baseProduct.grupo || "GPO 8",
      linea: "008",
      searchText: normalizeText([
        group.baseCode,
        title,
        baseProduct.metal,
        baseProduct.kilataje,
        baseProduct.linea,
        baseProduct.familia,
        baseProduct.grupo,
        baseProduct.tagsBusqueda,
        variants.map((variant) => variant.label).join(" "),
        "anillo caballero talla tallas medidas",
      ].join(" ")),
      tagsBusqueda: [
        group.baseCode,
        title,
        "anillo caballero talla tallas medidas",
        variants.map((variant) => variant.label).join(" "),
      ].join(" "),
      isConfigurableGroup: true,
      configurableType: "ring_size",
      configurableKey: group.baseCode,
      configurableBaseCode: group.baseCode,
      configurableTitle: title,
      variants,
    });
  });

  return [...configurableGroups, ...ringSizeGroups, ...passthrough].sort((a, b) => {
    const orderA = Number(a.ordenWeb || 999999);
    const orderB = Number(b.ordenWeb || 999999);
    if (orderA !== orderB) return orderA - orderB;
    return String(a.codigo || "").localeCompare(String(b.codigo || ""));
  });
};
