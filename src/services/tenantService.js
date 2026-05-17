import { supabase } from "../lib/supabaseClient";

const slugify = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

export const makeTenantSlug = (name = "") => slugify(name) || `empresa-${Date.now()}`;

export const fetchTenants = async () => {
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .order("name");
  if (error) throw error;
  return data || [];
};

export const saveTenant = async (tenant) => {
  const row = {
    ...tenant,
    slug: makeTenantSlug(tenant.slug || tenant.name),
    status: tenant.status || "active",
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("tenants")
    .upsert(row, { onConflict: "slug" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
};
