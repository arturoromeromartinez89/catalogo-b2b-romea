import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const adminRoles = new Set(["tenant_admin", "admin"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { email, password, tenantId, role = "tenant_admin" } = await req.json();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "");
    const cleanTenantId = String(tenantId || "").trim();
    const cleanRole = String(role || "tenant_admin");

    if (!cleanEmail || !cleanEmail.includes("@")) {
      return json({ error: "Correo invalido." }, 400);
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      return json({ error: "La contrasena debe tener al menos 6 caracteres." }, 400);
    }
    if (!cleanTenantId) {
      return json({ error: "Selecciona una empresa para este usuario." }, 400);
    }
    if (!adminRoles.has(cleanRole)) {
      return json({ error: "Rol no permitido para este flujo." }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await caller.auth.getUser();
    if (userErr || !user) return json({ error: "No autenticado." }, 401);

    const admin = createClient(url, serviceKey);
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (callerProfile?.role !== "superadmin") {
      return json({ error: "Solo el superadmin puede crear administradores de empresa." }, 403);
    }

    const { data: tenant } = await admin
      .from("tenants")
      .select("id")
      .eq("id", cleanTenantId)
      .maybeSingle();
    if (!tenant) return json({ error: "Empresa no encontrada." }, 404);

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, role, tenant_id, client_id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingProfile?.client_id) {
      return json({ error: "Este correo ya pertenece a una cuenta de cliente comprador." }, 409);
    }
    if (existingProfile?.role === "superadmin" && cleanRole !== "superadmin") {
      return json({ error: "No se puede convertir un superadmin desde este flujo." }, 409);
    }

    let userId = existingProfile?.id;
    if (!userId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password: cleanPassword,
        email_confirm: true,
      });
      if (createErr) return json({ error: createErr.message }, 400);
      userId = created.user?.id;
      if (!userId) return json({ error: "No se pudo crear el usuario." }, 500);
    } else {
      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
        password: cleanPassword,
        email_confirm: true,
      });
      if (updateErr) return json({ error: updateErr.message }, 400);
    }

    const { error: profileErr } = await admin
      .from("profiles")
      .upsert({
        id: userId,
        email: cleanEmail,
        role: cleanRole,
        tenant_id: cleanTenantId,
        client_id: null,
        active: true,
      }, { onConflict: "id" });

    if (profileErr) return json({ error: "No se pudo vincular el usuario con la empresa." }, 500);

    return json({ ok: true, userId, email: cleanEmail, role: cleanRole, tenantId: cleanTenantId });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
