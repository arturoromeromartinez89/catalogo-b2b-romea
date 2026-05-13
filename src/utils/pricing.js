export const findPriceRule = (product, priceItems = []) => {
  const normalized = (value) => String(value || "").trim().toLowerCase();
  return (
    priceItems.find(
      (item) =>
        normalized(item.metal) === normalized(product.metal) &&
        normalized(item.kilataje) === normalized(product.kilataje)
    ) ||
    priceItems.find((item) => normalized(item.metal) === normalized(product.metal) && !item.kilataje) ||
    priceItems.find((item) => !item.metal && !item.kilataje)
  );
};

export const calculateClientPrice = (product, priceItems = []) => {
  const rule = findPriceRule(product, priceItems);
  if (!rule) return Number(product.precioMinimo || 0);
  const grams = Number(product.pesoPromedio || 0);
  const labor = Number(product.manoObra || product.laborPrice || 0);
  const markup = Number(rule.labor_markup || 0);
  return grams * Number(rule.price_per_gram || 0) + labor + markup;
};
