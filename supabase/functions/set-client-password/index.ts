import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { clientId, newPassword } = await req.json();
    if (!clientId || !newPassword || String(newPassword).length < 6) {
      return json({ error: "Faltan datos o la contrasena es muy corta (minimo 6 caracteres)." }, 400);
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
      .select("role, tenant_id")
      .eq("id", user.id)
      .maybeSingle();
    const role = callerProfile?.role;
    if (!["admin", "tenant_admin", "superadmin"].includes(role)) {
      return json({ error: "Solo un administrador puede crear o cambiar accesos." }, 403);
    }

    const { data: client } = await admin
      .from("clients")
      .select("id, email, tenant_id")
      .eq("id", clientId)
      .maybeSingle();
    if (!client) return json({ error: "Cliente no encontrado." }, 404);
    if (role !== "superadmin" && client.tenant_id !== callerProfile?.tenant_id) {
      return json({ error: "Ese cliente no pertenece a tu empresa." }, 403);
    }
    if (!client.email) return json({ error: "El cliente no tiene correo registrado." }, 400);

    const email = String(client.email).trim().toLowerCase();
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, tenant_id, client_id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile && (existingProfile.client_id !== client.id || existingProfile.tenant_id !== client.tenant_id)) {
      return json({ error: "Este correo ya pertenece a otro cliente." }, 409);
    }

    let userId = existingProfile?.id;
    if (!userId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: String(newPassword),
        email_confirm: true,
      });
      if (createErr) return json({ error: createErr.message }, 400);
      userId = created.user?.id;
      if (!userId) return json({ error: "No se pudo crear la cuenta del cliente." }, 500);
    } else {
      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
        password: String(newPassword),
        email_confirm: true,
      });
      if (updateErr) return json({ error: updateErr.message }, 400);
    }

    const { error: profileErr } = await admin
      .from("profiles")
      .upsert({
        id: userId,
        email,
        role: "client",
        client_id: client.id,
        tenant_id: client.tenant_id,
        active: true,
      }, { onConflict: "id" });
    if (profileErr) return json({ error: "No se pudo vincular la cuenta con el cliente." }, 500);

    await admin.from("clients").update({ access_password: String(newPassword) }).eq("id", clientId);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
