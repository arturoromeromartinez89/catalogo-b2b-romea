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

export const fetchProfiles = async () => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,role,tenant_id,client_id,created_at")
    .order("email");
  if (error) throw error;
  return data || [];
};

export const updateProfileAccess = async (profileId, changes) => {
  const row = {
    role: changes.role,
    tenant_id: changes.tenant_id || null,
    client_id: changes.client_id || null,
  };
  const { data, error } = await supabase
    .from("profiles")
    .update(row)
    .eq("id", profileId)
    .select("id,email,role,tenant_id,client_id,created_at")
    .single();
  if (error) throw error;
  return data;
};

export const createAdminUser = async ({ email, password, role, tenant_id }) => {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("Tu sesión expiró. Cierra sesión y vuelve a entrar.");

  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-admin-user`, {
    method: "POST",
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      role,
      tenant_id: role === "superadmin" ? null : tenant_id || null,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Error HTTP ${response.status}`);
  if (data?.error) throw new Error(data.error);
  return data;
};

export const fetchTenantMetrics = async (tenants = []) => {
  const metrics = await Promise.all(tenants.map(async (tenant) => {
    const [products, clients, preorders] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
      supabase.from("preorders").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
    ]);

    [products, clients, preorders].forEach(({ error }) => {
      if (error) throw error;
    });

    return {
      tenantId: tenant.id,
      products: products.count || 0,
      clients: clients.count || 0,
      preorders: preorders.count || 0,
    };
  }));

  return metrics.reduce((index, item) => {
    index[item.tenantId] = item;
    return index;
  }, {});
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
