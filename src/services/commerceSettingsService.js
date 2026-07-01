import { supabase } from "../lib/supabaseClient";

export const PRICING_MODES = [
  { key: "gram", label: "Por gramo" },
  { key: "piece", label: "Por pieza" },
];

export const CURRENCIES = ["MXN", "USD"];

export const DEFAULT_COMMERCE_SETTINGS = {
  allowed_pricing_modes: ["gram", "piece"],
  allowed_currencies: ["MXN", "USD"],
  hasCustomSettings: false,
};

const validModes = new Set(PRICING_MODES.map((mode) => mode.key));
const validCurrencies = new Set(CURRENCIES);

const uniqueValid = (items, validSet, fallback) => {
  const seen = new Set();
  const next = (Array.isArray(items) ? items : [])
    .filter((item) => validSet.has(item) && !seen.has(item) && seen.add(item));
  return next.length ? next : fallback;
};

export const normalizeCommerceSettings = (settings = null) => ({
  ...DEFAULT_COMMERCE_SETTINGS,
  ...settings,
  allowed_pricing_modes: uniqueValid(
    settings?.allowed_pricing_modes,
    validModes,
    DEFAULT_COMMERCE_SETTINGS.allowed_pricing_modes
  ),
  allowed_currencies: uniqueValid(
    settings?.allowed_currencies,
    validCurrencies,
    DEFAULT_COMMERCE_SETTINGS.allowed_currencies
  ),
  hasCustomSettings: Boolean(settings?.tenant_id || settings?.hasCustomSettings),
});

export const fetchCommerceSettings = async (tenantId = "") => {
  if (!tenantId || !supabase) return DEFAULT_COMMERCE_SETTINGS;
  const { data, error } = await supabase
    .from("tenant_commerce_settings")
    .select("tenant_id, allowed_pricing_modes, allowed_currencies")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !data) return DEFAULT_COMMERCE_SETTINGS;
  return normalizeCommerceSettings(data);
};

// Solo superadmin: la RLS bloquea la escritura a cualquier otro rol.
export const fetchAllCommerceSettings = async () => {
  if (!supabase) return new Map();
  const { data, error } = await supabase
    .from("tenant_commerce_settings")
    .select("tenant_id, allowed_pricing_modes, allowed_currencies");
  if (error) return new Map();
  return new Map((data || []).map((row) => [row.tenant_id, normalizeCommerceSettings(row)]));
};

export const saveCommerceSettings = async (tenantId, settings) => {
  if (!tenantId) throw new Error("No hay empresa activa para guardar reglas de comercio.");
  const normalized = normalizeCommerceSettings(settings);
  const row = {
    tenant_id: tenantId,
    allowed_pricing_modes: normalized.allowed_pricing_modes,
    allowed_currencies: normalized.allowed_currencies,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("tenant_commerce_settings")
    .upsert(row, { onConflict: "tenant_id" })
    .select("tenant_id, allowed_pricing_modes, allowed_currencies")
    .single();
  if (error) throw error;
  return normalizeCommerceSettings(data);
};
