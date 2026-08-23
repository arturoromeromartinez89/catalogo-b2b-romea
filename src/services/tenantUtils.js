export const ADMIN_ROLES = ["admin", "tenant_admin", "superadmin"];

export const getTenantId = (profileOrTenantId) => {
  if (!profileOrTenantId) return "";
  if (typeof profileOrTenantId === "string") return profileOrTenantId;
  return profileOrTenantId.tenant_id || profileOrTenantId.tenantId || "";
};

export const requireTenantId = (profileOrTenantId, action = "continuar") => {
  const tenantId = getTenantId(profileOrTenantId);
  if (!tenantId) {
    throw new Error(`No hay empresa activa para ${action}.`);
  }
  return tenantId;
};

export const isAdminRole = (role) => ADMIN_ROLES.includes(role);

export const isSuperAdmin = (profile) => profile?.role === "superadmin";

export const withTenant = (query, tenantId) => (tenantId ? query.eq("tenant_id", tenantId) : query);

