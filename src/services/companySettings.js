import { supabase } from "../lib/supabaseClient";
import { validateImageFile } from "../utils/fileLimits";

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

export const fetchPublicCompanySettings = async (tenantId) => {
  if (!tenantId) return defaultSettings;
  const { data, error } = await supabase.rpc("get_public_company_branding", { p_tenant_id: tenantId });
  if (error) throw error;
  return { ...defaultSettings, ...(data || {}) };
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
  validateImageFile(file);
  if (!tenantId) throw new Error("Selecciona una empresa antes de subir el logo.");
  const ext = file.name.split(".").pop();
  const path = `${tenantId}/logos/logo.${ext}`;
  const { error } = await supabase.storage.from("company-assets").upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
};
