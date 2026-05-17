import { supabase } from "../lib/supabaseClient";

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
  const { data, error } = await query.maybeSingle();
  if (error) return defaultSettings;
  return { ...defaultSettings, ...data };
};

export const saveCompanySettings = async (settings, tenantId = "") => {
  const row = { ...settings };
  if (tenantId) row.tenant_id = tenantId;
  let query = supabase.from("company_settings").select("id").limit(1);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data: existing } = await query.maybeSingle();
  if (existing?.id) {
    const { error } = await supabase.from("company_settings").update(row).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("company_settings").insert(row);
    if (error) throw error;
  }
};

export const uploadLogo = async (file) => {
  const ext = file.name.split(".").pop();
  const path = `logos/logo.${ext}`;
  const { error } = await supabase.storage.from("company-assets").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("company-assets").getPublicUrl(path);
  return data.publicUrl;
};
