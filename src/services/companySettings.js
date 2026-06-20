import { supabase } from "../lib/supabaseClient";

const ASSET_BUCKET = "company-assets";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

export const defaultSettings = {
  brand_name: "",
  legal_name: "",
  rfc: "",
  phone: "",
  email: "",
  city: "",
  state: "",
  country: "México",
  logo_url: "",
  bank_accounts: [],
  order_instructions: [],
  commercial_terms: "",
};

const imageExtension = (fileName = "") => {
  const ext = String(fileName).split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return ext;
  return "png";
};

const signedAssetUrl = async (path) => {
  const { data, error } = await supabase.storage
    .from(ASSET_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
};

export const fetchCompanySettings = async (tenantId = "") => {
  let query = supabase
    .from("company_settings")
    .select("*")
    .limit(1);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  else query = query.is("tenant_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) return defaultSettings;
  return { ...defaultSettings, ...data };
};

export const saveCompanySettings = async (settings, tenantId = "") => {
  const row = { ...settings };
  if (tenantId) row.tenant_id = tenantId;
  let query = supabase.from("company_settings").select("id").limit(1);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  else query = query.is("tenant_id", null);
  const { data: existing } = await query.maybeSingle();
  if (existing?.id) {
    const { error } = await supabase.from("company_settings").update(row).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("company_settings").insert(row);
    if (error) throw error;
  }
};

export const uploadLogo = async (file, tenantId = "") => {
  if (!tenantId) throw new Error("No hay empresa activa para subir el logo.");
  const ext = imageExtension(file.name);
  const path = `${tenantId}/logos/logo.${ext}`;
  const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || `image/${ext}`,
    upsert: true,
  });
  if (error) throw error;
  return signedAssetUrl(path);
};
