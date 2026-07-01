import { supabase } from "../lib/supabaseClient";

const ASSET_BUCKET = "company-assets";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;
const COMPANY_SETTINGS_COLUMNS = [
  "id",
  "tenant_id",
  "brand_name",
  "legal_name",
  "rfc",
  "phone",
  "email",
  "city",
  "state",
  "country",
  "logo_url",
  "bank_accounts",
  "order_instructions",
  "commercial_terms",
].join(",");

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
    .select(COMPANY_SETTINGS_COLUMNS)
    .limit(1);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  else query = query.is("tenant_id", null);
  let { data, error } = await query.maybeSingle();
  if (error && tenantId) {
    const rpc = await supabase.rpc("get_public_company_branding", { p_tenant_id: tenantId });
    data = rpc.error ? null : rpc.data;
    error = rpc.error;
  }
  if (error) return defaultSettings;

  return {
    ...defaultSettings,
    ...data,
  };
};

export const saveCompanySettings = async (settings, tenantId = "") => {
  const { client_portal_config, ...companySettings } = settings || {};
  const row = { ...companySettings };
  if (tenantId) row.tenant_id = tenantId;
  let query = supabase.from("company_settings").select("id").limit(1);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  else query = query.is("tenant_id", null);
  const { data: existing } = await query.maybeSingle();
  const writeRow = async (payload) => {
    if (existing?.id) return supabase.from("company_settings").update(payload).eq("id", existing.id);
    return supabase.from("company_settings").insert(payload);
  };
  const { error } = await writeRow(row);
  if (error) throw error;
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
