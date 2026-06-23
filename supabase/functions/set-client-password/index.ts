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
const platformOrigins = new Set(
  configuredPlatformOrigins.length ? configuredPlatformOrigins : defaultPlatformOrigins,
);

const corsHeaders = (origin: string | null, allowed: boolean) => ({
  ...(origin && allowed ? { "Access-Control-Allow-Origin": origin } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

type AdminClient = ReturnType<typeof createClient>;

const getOriginPolicy = async (origin: string | null, admin: AdminClient) => {
  if (!origin) return { allowed: true, pathPrefixes: [] as string[] };
  try {
    const url = new URL(origin);
    if (url.origin !== origin) return { allowed: false, pathPrefixes: [] as string[] };
    if (platformOrigins.has(origin)) return { allowed: true, pathPrefixes: [""] };
    if (url.protocol !== "https:" || url.port) {
      return { allowed: false, pathPrefixes: [] as string[] };
    }

    const { data, error } = await admin
      .from("tenant_domains")
      .select("path_prefix")
      .eq("hostname", url.hostname.toLowerCase())
      .eq("status", "active")
      .not("verified_at", "is", null);
    if (error) throw error;
    const pathPrefixes = (data || []).map((row) => String(row.path_prefix));
    return { allowed: pathPrefixes.length > 0, pathPrefixes };
  } catch {
    return { allowed: false, pathPrefixes: [] as string[] };
  }
};

const isAllowedRedirect = async (
  value: string,
  requestOrigin: string | null,
  admin: AdminClient,
) => {
  try {
    const url = new URL(value);
    if (requestOrigin && url.origin !== requestOrigin) return false;
    const policy = await getOriginPolicy(url.origin, admin);
    if (!policy.allowed) return false;
    return policy.pathPrefixes.some((prefix) => url.pathname === `${prefix}/`);
  } catch {
    return false;
  }
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
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

  if (req.method === "OPTIONS") {
    return origin && !originPolicy.allowed
      ? json({ error: "Origen no autorizado." }, 403)
      : new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  if (origin && !originPolicy.allowed) return json({ error: "Origen no autorizado." }, 403);

  try {
    const { clientId, action, redirectTo, password } = await req.json();
    if (!clientId || !["invite", "reset", "set_password"].includes(action)) {
      return json({ error: "Solicitud de acceso inválida." }, 400);
    }
    if (action !== "set_password" && !(await isAllowedRedirect(String(redirectTo || ""), origin, admin))) {
      return json({ error: "Dirección de retorno no autorizada." }, 400);
    }
    if (action === "set_password" && String(password || "").length < 6) {
      return json({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);
    }

    const authHeader = req.headers.get("Authorization") || "";

    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await caller.auth.getUser();
    if (userError || !user) return json({ error: "No autenticado." }, 401);

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role, tenant_id, active")
      .eq("id", user.id)
      .maybeSingle();
    const role = callerProfile?.role;
    if (callerProfile?.active === false || !["admin", "tenant_admin", "superadmin"].includes(role)) {
      return json({ error: "No tienes permiso para administrar accesos." }, 403);
    }

    const { data: client } = await admin
      .from("clients")
      .select("id, email, tenant_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!client) return json({ error: "Cliente no encontrado." }, 404);
    if (role !== "superadmin" && client.tenant_id !== callerProfile.tenant_id) {
      return json({ error: "Ese cliente pertenece a otra empresa." }, 403);
    }
    if (!client.email || String(client.email).endsWith("@prospect.local")) {
      return json({ error: "El cliente no tiene un correo válido." }, 400);
    }

    const email = String(client.email).trim().toLowerCase();
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, tenant_id, client_id")
      .eq("email", email)
      .maybeSingle();

    if (action === "invite") {
      if (existingProfile) return json({ error: "Este correo ya tiene cuenta. Envía una recuperación." }, 409);
      const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
      });
      if (error) return json({ error: error.message }, 400);
      if (!invited.user?.id) return json({ error: "No se pudo crear la cuenta invitada." }, 500);
      const { error: profileError } = await admin
        .from("profiles")
        .update({ role: "client", client_id: client.id, tenant_id: client.tenant_id, active: true })
        .eq("id", invited.user.id);
      if (profileError) {
        await admin.auth.admin.deleteUser(invited.user.id);
        return json({ error: "No se pudo vincular la cuenta con el cliente." }, 500);
      }
      return json({ ok: true, action: "invite" });
    }

    if (action === "set_password") {
      if (existingProfile && (existingProfile.client_id !== client.id || existingProfile.tenant_id !== client.tenant_id)) {
        return json({ error: "Este correo ya pertenece a otro cliente." }, 409);
      }

      let userId = existingProfile?.id;
      if (!userId) {
        const { data: created, error } = await admin.auth.admin.createUser({
          email,
          password: String(password),
          email_confirm: true,
        });
        if (error) return json({ error: error.message }, 400);
        userId = created.user?.id;
        if (!userId) return json({ error: "No se pudo crear la cuenta del cliente." }, 500);
      } else {
        const { error } = await admin.auth.admin.updateUserById(userId, {
          password: String(password),
          email_confirm: true,
        });
        if (error) return json({ error: error.message }, 400);
      }

      const { error: profileError } = await admin
        .from("profiles")
        .upsert({
          id: userId,
          email,
          role: "client",
          client_id: client.id,
          tenant_id: client.tenant_id,
          active: true,
        }, { onConflict: "id" });
      if (profileError) return json({ error: "No se pudo vincular la cuenta con el cliente." }, 500);
      return json({ ok: true, action: "set_password" });
    }

    if (!existingProfile || existingProfile.client_id !== client.id || existingProfile.tenant_id !== client.tenant_id) {
      return json({ error: "No existe una cuenta válida para este cliente." }, 404);
    }
    const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, action: "reset" });
  } catch (error) {
    return json({ error: String((error as Error)?.message || error) }, 500);
  }
});
