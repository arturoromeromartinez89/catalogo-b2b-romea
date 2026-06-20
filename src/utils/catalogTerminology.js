import { normalizeText } from "./textNormalizer.js";

const JEWELRY_SIGNALS = [
  "anillo",
  "anillos",
  "arete",
  "aretes",
  "arracada",
  "arracadas",
  "dije",
  "dijes",
  "gargantilla",
  "gargantillas",
  "pulsera",
  "pulseras",
  "collar",
  "collares",
  "oro",
  "plata",
  "zirconia",
  "diamante",
  "diamantado",
  "piedra",
  "10k",
  "14k",
  "18k",
  "925",
];

const looksLikeJewelryCatalog = (products = []) => {
  const sample = products.slice(0, 80);
  if (!sample.length) return true;

  return sample.some((product) => {
    const text = normalizeText([
      product?.descripcion,
      product?.familia,
      product?.grupo,
      product?.linea,
      product?.metal,
      product?.kilataje,
      product?.piedra,
      product?.tagsBusqueda,
    ].filter(Boolean).join(" "));

    return JEWELRY_SIGNALS.some((signal) => text.includes(signal));
  });
};

const labels = {
  jewelry: {
    es: {
      metal: "Metal",
      kilataje: "Kilataje",
      linea: "Linea",
      familia: "Familia",
      grupo: "Grupo",
      minWeight: "Peso minimo",
      maxWeight: "Peso maximo",
      avgWeight: "Peso promedio",
    },
    en: {
      metal: "Metal",
      kilataje: "Karat",
      linea: "Line",
      familia: "Family",
      grupo: "Group",
      minWeight: "Min weight",
      maxWeight: "Max weight",
      avgWeight: "Avg. weight",
    },
  },
  generic: {
    es: {
      metal: "Material",
      kilataje: "Variante",
      linea: "Linea / coleccion",
      familia: "Categoria",
      grupo: "Subcategoria",
      minWeight: "Peso/cantidad min.",
      maxWeight: "Peso/cantidad max.",
      avgWeight: "Peso/cantidad",
    },
    en: {
      metal: "Material",
      kilataje: "Variant",
      linea: "Line / collection",
      familia: "Category",
      grupo: "Subcategory",
      minWeight: "Min weight/qty",
      maxWeight: "Max weight/qty",
      avgWeight: "Weight/qty",
    },
  },
};

export const getCatalogProfile = (products = []) =>
  looksLikeJewelryCatalog(products) ? "jewelry" : "generic";

export const getCatalogTerminology = (products = [], language = "es") => {
  const profile = getCatalogProfile(products);
  return labels[profile][language] || labels[profile].es;
};

export const getTerminologyByProfile = (profile = "generic", language = "es") => {
  const key = profile === "comerciagold" || profile === "jewelry" ? "jewelry" : "generic";
  return labels[key][language] || labels[key].es;
};
