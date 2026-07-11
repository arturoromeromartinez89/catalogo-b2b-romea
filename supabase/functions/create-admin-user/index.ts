import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const defaultPlatformOrigins = [
  "https://catalogo-b2b-romea.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173",
];

const configuredPlatformOrigins = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const platformOrigins = new Set(configuredPlatformOrigins.length ? configuredPlatformOrigins : defaultPlatformOrigins);

const corsHeaders = (origin: string | null, allowed: boolean) => ({
  ...(origin && allowed ? { "Access-Control-Allow-Origin": origin } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

type AdminClient = ReturnType<typeof createClient>;

const getOriginPolicy = async (origin: string | null, admin: AdminClient) => {
  if (!origin) return { allowed: true };
  try {
    const url = new URL(origin);
    if (url.origin !== origin) return { allowed: false };
    if (platformOrigins.has(origin)) return { allowed: true };
    if (url.protocol !== "https:" || url.port) return { allowed: false };

    const { data, error } = await admin
      .from("tenant_domains")
      .select("hostname")
      .eq("hostname", url.hostname.toLowerCase())
      .eq("status", "active")
      .not("verified_at", "is", null)
      .limit(1);
    if (error) throw error;
    return { allowed: Boolean(data?.length) };
  } catch {
    return { allowed: false };
  }
};

const jsonResponse = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

const findUserIdByEmail = async (admin: AdminClient, email: string) => {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((item) => String(item.email || "").toLowerCase() === email);
    if (user) return user.id;
    if (data.users.length < 1000) break;
  }
  return null;
};

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const originPolicy = await getOriginPolicy(origin, admin);
  const headers = corsHeaders(origin, originPolicy.allowed);
  const json = (body: unknown, status = 200) => jsonResponse(body, status, headers);

  if (req.method === "OPTIONS") {
    return origin && !originPolicy.allowed
      ? json({ error: "Origen no autorizado." }, 403)
      : new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") return json({ error: "Metodo no permitido." }, 405);
  if (origin && !originPolicy.allowed) return json({ error: "Origen no autorizado." }, 403);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await caller.auth.getUser();
    if (userError || !user) return json({ error: "No autenticado." }, 401);

    const { data: callerProfile, error: callerError } = await admin
      .from("profiles")
      .select("role, active")
      .eq("id", user.id)
      .maybeSingle();
    if (callerError) throw callerError;
    if (callerProfile?.role !== "superadmin" || callerProfile?.active === false) {
      return json({ error: "Solo superadmin puede crear usuarios." }, 403);
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "client");
    const tenantId = body.tenant_id ? String(body.tenant_id) : null;
    const allowedRoles = new Set(["superadmin", "tenant_admin", "admin", "client"]);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Correo invalido." }, 400);
    if (password.length < 10) return json({ error: "La contrasena debe tener al menos 10 caracteres." }, 400);
    if (!allowedRoles.has(role)) return json({ error: "Rol invalido." }, 400);
    if (role !== "superadmin" && !tenantId) return json({ error: "Selecciona una empresa para este rol." }, 400);

    if (tenantId) {
      const { data: tenant, error: tenantError } = await admin
        .from("tenants")
        .select("id")
        .eq("id", tenantId)
        .eq("status", "active")
        .maybeSingle();
      if (tenantError) throw tenantError;
      if (!tenant) return json({ error: "Empresa no encontrada o inactiva." }, 404);
    }

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    let userId = existingProfile?.id || await findUserIdByEmail(admin, email);

    if (userId) {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        email,
        password,
        email_confirm: true,
        user_metadata: { email_verified: true },
      });
      if (error) return json({ error: error.message }, 400);
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { email_verified: true },
      });
      if (error) return json({ error: error.message }, 400);
      userId = created.user?.id;
    }
    if (!userId) return json({ error: "No se pudo crear el usuario." }, 500);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .upsert({
        id: userId,
        email,
        role,
        tenant_id: role === "superadmin" ? null : tenantId,
        client_id: null,
        active: true,
      }, { onConflict: "id" })
      .select("id,email,role,tenant_id,client_id,created_at")
      .single();
    if (profileError) throw profileError;

    return json({ ok: true, profile });
  } catch (error) {
    return json({ error: String((error as Error)?.message || error) }, 500);
  }
});
