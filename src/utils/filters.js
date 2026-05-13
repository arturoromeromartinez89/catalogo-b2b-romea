import { normalizeText, termsFromQuery } from "./textNormalizer";

const textFilters = ["metal", "kilataje", "linea", "familia", "grupo"];

export const emptyFilters = {
  metal: "",
  kilataje: "",
  linea: "",
  familia: "",
  grupo: "",
  minWeight: "",
  maxWeight: "",
  minPrice: "",
  maxPrice: "",
};

export const quickFilterDefinitions = [
  { id: "anillos", labels: { es: "Anillos", en: "Rings" }, terms: [["anillo"], ["anillos"], ["ring"], ["rings"]] },
  { id: "aretes", labels: { es: "Aretes", en: "Earrings" }, terms: [["arete"], ["aretes"], ["arracada"], ["arracadas"], ["earring"], ["earrings"]] },
  { id: "dijes", labels: { es: "Dijes", en: "Pendants" }, terms: [["dije"], ["dijes"], ["pendant"], ["pendants"]] },
  { id: "gargantillas", labels: { es: "Gargantillas", en: "Necklaces" }, terms: [["gargantilla"], ["gargantillas"], ["necklace"], ["necklaces"]] },
  { id: "pulseras", labels: { es: "Pulseras", en: "Bracelets" }, terms: [["pulsera"], ["pulseras"], ["bracelet"], ["bracelets"]] },
  { id: "mujer", labels: { es: "Mujer", en: "Women" }, terms: [["mujer"], ["dama"], ["femenino"], ["woman"], ["women"], ["female"]] },
  { id: "hombre", labels: { es: "Hombre", en: "Men" }, terms: [["hombre"], ["caballero"], ["masculino"], ["man"], ["men"], ["male"]] },
  { id: "infantil", labels: { es: "Infantil", en: "Kids" }, terms: [["infantil"], ["niña"], ["nina"], ["niño"], ["nino"], ["kids"], ["children"]] },
  { id: "sin-piedra", labels: { es: "Sin piedra", en: "No stone" }, custom: "withoutStone" },
  { id: "con-piedra", labels: { es: "Con piedra", en: "With stone" }, terms: [["piedra"], ["stone"], ["zirconia"], ["perla"], ["pearl"], ["cristal"], ["crystal"], ["gema"], ["gem"], ["onix"], ["diamante"], ["diamond"]] },
  { id: "liso", labels: { es: "Liso", en: "Plain" }, terms: [["liso"], ["lisa"], ["plain"], ["smooth"]] },
  { id: "diamantado", labels: { es: "Diamantado", en: "Diamond cut" }, terms: [["diamantado"], ["diamantada"], ["diamond cut"]] },
  { id: "rodio", labels: { es: "Rodio", en: "Rhodium" }, terms: [["rodio"], ["rodiado"], ["rodiada"], ["rhodium"], ["rhodium plated"]] },
  { id: "plata", labels: { es: "Plata", en: "Silver" }, terms: [["plata"], ["silver"], [".925"], ["925"]] },
  { id: "oro", labels: { es: "Oro", en: "Gold" }, terms: [["oro"], ["gold"], ["10k"], ["14k"], ["18k"]] },
];

export const buildFilterOptions = (products) =>
  textFilters.reduce((options, key) => {
    options[key] = [...new Set(products.map((product) => product[key]).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "es")
    );
    return options;
  }, {});

const matchesTerms = (searchText, query) => {
  const terms = termsFromQuery(query);
  if (!terms.length) return true;
  return terms.every((term) => searchText.includes(term));
};

const matchesQuickFilter = (product, filterId) => {
  const definition = quickFilterDefinitions.find((filter) => filter.id === filterId);
  if (!definition) return true;

  if (definition.custom === "withoutStone") {
    return (
      product.searchText.includes("sin piedra") ||
      product.searchText.includes("no stone") ||
      product.searchText.includes("liso") ||
      product.searchText.includes("plain") ||
      (!product.searchText.includes("piedra") &&
        !product.searchText.includes("stone") &&
        !product.searchText.includes("zirconia") &&
        !product.searchText.includes("perla") &&
        !product.searchText.includes("pearl") &&
        !product.searchText.includes("cristal") &&
        !product.searchText.includes("crystal") &&
        !product.searchText.includes("gema") &&
        !product.searchText.includes("gem") &&
        !product.searchText.includes("onix") &&
        !product.searchText.includes("diamante") &&
        !product.searchText.includes("diamond"))
    );
  }

  return definition.terms.some((termGroup) => termGroup.every((term) => product.searchText.includes(normalizeText(term))));
};

export const productMatchesSearch = (product, query, searchChips = []) =>
  matchesTerms(product.searchText, query) && searchChips.every((chip) => matchesTerms(product.searchText, chip));

export const applyFilters = (products, query, filters, quickFilters = [], searchChips = []) =>
  products.filter((product) => {
    if (!product.visibleWeb) return false;
    if (normalizeText(product.estatus) === "baja" || normalizeText(product.estatus) === "discontinued") return false;
    if (!productMatchesSearch(product, query, searchChips)) return false;
    if (quickFilters.length && !quickFilters.every((filterId) => matchesQuickFilter(product, filterId))) return false;

    for (const key of textFilters) {
      if (filters[key] && product[key] !== filters[key]) return false;
    }

    const minWeight = Number(filters.minWeight || 0);
    const maxWeight = Number(filters.maxWeight || 0);
    const minPrice = Number(filters.minPrice || 0);
    const maxPrice = Number(filters.maxPrice || 0);

    if (minWeight && product.pesoPromedio < minWeight) return false;
    if (maxWeight && product.pesoPromedio > maxWeight) return false;
    if (minPrice && product.precioMinimo < minPrice) return false;
    if (maxPrice && product.precioMinimo > maxPrice) return false;

    return true;
  });

const addSuggestionParts = (values, rawValue) => {
  const value = String(rawValue || "").trim();
  if (!value) return;
  values.add(value);

  const words = value.split(/\s+/).filter((word) => word.length > 2);
  words.forEach((word) => values.add(word));
  for (let index = 0; index < words.length - 1; index += 1) {
    values.add(`${words[index]} ${words[index + 1]}`);
  }
};

export const buildSearchSuggestions = (products, query, activeChips = []) => {
  const term = normalizeText(query);
  if (!term) return [];

  const values = new Set();
  products.forEach((product) => {
    [
      product.familia,
      product.linea,
      product.grupo,
      product.metal,
      product.kilataje,
      product.genero,
      product.acabado,
      product.piedra,
      product.medida,
      product.descripcion,
      ...String(product.tagsBusqueda || "").split(/[;,]/),
    ].forEach((value) => addSuggestionParts(values, value));
  });

  const normalizedActive = activeChips.map(normalizeText);
  return [...values]
    .filter((value) => normalizeText(value).includes(term))
    .filter((value) => !normalizedActive.includes(normalizeText(value)))
    .sort((a, b) => a.length - b.length || a.localeCompare(b, "es"))
    .slice(0, 8);
};

export const calculateCartTotals = (items) =>
  items.reduce(
    (totals, item) => {
      const quantity = Number(item.quantity || 0);
      totals.models += 1;
      totals.pieces += quantity;
      totals.weight += quantity * Number(item.product.pesoPromedio || 0);
      totals.amount += quantity * Number(item.product.precioMinimo || 0);
      return totals;
    },
    { models: 0, pieces: 0, weight: 0, amount: 0 }
  );
