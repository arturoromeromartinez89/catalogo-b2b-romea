import { supabase } from "../lib/supabaseClient";

// Centralized helper for private Storage images.
//
// Strategy: sign once, at the data-loading layer (in batch), so component
// render stays synchronous (`product.fotoUrl` is already a usable URL).
// Only objects living in the private `company-assets` bucket are signed;
// external images (Google Drive, data:, blob:, absolute paths) pass through.

const BUCKET = "company-assets";
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const SIGN_MARKER = `/storage/v1/object/sign/${BUCKET}/`;
const DEFAULT_TTL = 60 * 60 * 4; // 4 hours — generous so open catalogs don't break
const SIGN_BATCH = 100;

// Returns the in-bucket path for a value, or null when it is not a
// company-assets object (Drive/external/data/blob/local are not ours to sign).
export const extractStoragePath = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  // Already a public or signed Supabase URL for our bucket → take the path.
  const marker = raw.includes(PUBLIC_MARKER) ? PUBLIC_MARKER : raw.includes(SIGN_MARKER) ? SIGN_MARKER : null;
  if (marker) {
    const after = raw.split(marker)[1] || "";
    const path = after.split("?")[0];
    return path ? decodeURIComponent(path) : null;
  }

  // External or local references are not Storage objects.
  if (/^(https?:|data:|blob:)/i.test(raw) || raw.startsWith("/")) return null;

  // Otherwise treat it as a bare in-bucket path: "{tenant}/products/code.jpg".
  return raw.replace(/^\/+/, "");
};

// Signs a list of paths in batches. Returns Map<path, signedUrl>.
export const signStoragePaths = async (paths = [], expiresIn = DEFAULT_TTL) => {
  const result = new Map();
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length || !supabase) return result;

  for (let i = 0; i < unique.length; i += SIGN_BATCH) {
    const slice = unique.slice(i, i + SIGN_BATCH);
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(slice, expiresIn);
    if (error || !data) continue; // non-fatal: missing images just show placeholder
    data.forEach((entry) => {
      if (entry?.signedUrl && entry?.path) result.set(entry.path, entry.signedUrl);
    });
  }
  return result;
};

// Given a list of objects and the image fields to resolve, replaces each
// Storage reference with a fresh signed URL (in place, returns a new array).
// Non-Storage values are left untouched. One batched round-trip.
export const attachSignedImageUrls = async (
  items = [],
  fields = ["fotoUrl", "fotoUrl2", "fotoUrl3"],
  expiresIn = DEFAULT_TTL,
) => {
  if (!Array.isArray(items) || !items.length) return items;

  // Collect every Storage path that needs signing.
  const pathByItemField = [];
  const pathsToSign = [];
  items.forEach((item, idx) => {
    fields.forEach((field) => {
      const path = extractStoragePath(item?.[field]);
      if (path) {
        pathByItemField.push({ idx, field, path });
        pathsToSign.push(path);
      }
    });
  });

  if (!pathsToSign.length) return items;

  const signed = await signStoragePaths(pathsToSign, expiresIn);
  if (!signed.size) return items;

  // Apply signed URLs back onto a shallow copy of each touched item.
  const out = items.map((item) => ({ ...item }));
  pathByItemField.forEach(({ idx, field, path }) => {
    const url = signed.get(path);
    if (url) out[idx][field] = url;
  });
  return out;
};

// Signs a single path (for one-off cases like a logo or a PDF image).
export const signOnePath = async (value, expiresIn = DEFAULT_TTL) => {
  const path = extractStoragePath(value);
  if (!path) return String(value || ""); // pass through external/local refs
  const map = await signStoragePaths([path], expiresIn);
  return map.get(path) || "";
};
