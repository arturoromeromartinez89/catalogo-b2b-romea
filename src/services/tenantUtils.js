export const ADMIN_ROLES = ["admin", "tenant_admin", "superadmin"];

export const getTenantId = (profileOrTenantId) => {
  if (!profileOrTenantId) return "";
  if (typeof profileOrTenantId === "string") return profileOrTenantId;
  return profileOrTenantId.tenant_id || profileOrTenantId.tenantId || "";
};

export const isAdminRole = (role) => ADMIN_ROLES.includes(role);

// Rol comercial: entra al portal admin pero solo con Inicio y Agenda.
export const isComercialRole = (role) => role === "comercial";

export const isSuperAdmin = (profile) => profile?.role === "superadmin";

export const withTenant = (query, tenantId) => (tenantId ? query.eq("tenant_id", tenantId) : query);

