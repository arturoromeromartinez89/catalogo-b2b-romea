import { normalizeText } from "./textNormalizer";

export { normalizeText };

export const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value).replace(/,/g, "").trim();
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
};

export const toOptionalNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  return toNumber(value);
};

export const formatWeight = (value) =>
  `${Number(value || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} g`;

export const formatCurrency = (value, currency = "MXN") => {
  const number = Number(value || 0);
  if (!number) return "";
  return number.toLocaleString("es-MX", {
    style: "currency",
    currency: currency || "MXN",
    minimumFractionDigits: 2,
  });
};

export const shortText = (value, max = 72) => {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
};

export const buildPlaceholderUrl = (code = "Sin foto") =>
  `https://placehold.co/640x640/f7f5f2/1f335f?text=${encodeURIComponent(code || "Sin foto")}`;
