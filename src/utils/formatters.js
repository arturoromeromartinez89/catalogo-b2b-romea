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

export const resolveImageUrl = (value) => {
  const url = String(value || "").trim();
  if (!url) return "";
  if (url.startsWith("data:image/") || url.startsWith("/") || url.startsWith("blob:")) return url;

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("drive.google.com")) return url;

    if (parsed.pathname.includes("/folders/")) return "";

    const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    const id = fileMatch?.[1] || parsed.searchParams.get("id");
    if (!id) return url;

    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1000`;
  } catch {
    return url;
  }
};

export const buildPlaceholderUrl = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
      <rect width="640" height="640" fill="#f4f6fb"/>
      <g fill="none" stroke="#c5cfe0" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
        <path d="M214 250h42l28-34h72l28 34h42c25 0 45 20 45 45v105c0 25-20 45-45 45H214c-25 0-45-20-45-45V295c0-25 20-45 45-45z"/>
        <circle cx="320" cy="346" r="62"/>
      </g>
      <text x="320" y="505" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#1f335f">Sin foto</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};
