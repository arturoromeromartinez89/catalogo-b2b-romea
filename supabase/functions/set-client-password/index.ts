// supabase/functions/set-client-password/index.ts
// ---------------------------------------------------------------------------
// Cambia la contraseña de LOGIN de un cliente y guarda una copia en
// clients.access_password (para poder mostrarla en el panel del admin).
//
// Seguridad: solo un admin / tenant_admin / superadmin puede llamarla, y solo
// sobre clientes de SU MISMA empresa (superadmin puede cualquiera). Usa la
// service_role key (que SOLO vive en el servidor, nunca en el navegador).
//
// Desplegar:  supabase functions deploy set-client-password
// (Las variables SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY
//  las inyecta Supabase automáticamente.)
// ---------------------------------------------------------------------------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { clientId, newPassword } = await req.json();
    if (!clientId || !newPassword || String(newPassword).length < 6) {
      return json({ error: "Faltan datos o la contraseña es muy corta (mínimo 6 caracteres)." }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // Identidad del que llama (con su propia sesión)
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await caller.auth.getUser();
    if (userErr || !user) return json({ error: "No autenticado." }, 401);

    // Cliente con permisos de administrador (service_role)
    const admin = createClient(url, serviceKey);

    const { data: callerProfile } = await admin
      .from("profiles").select("role, tenant_id").eq("id", user.id).maybeSingle();
    const role = callerProfile?.role;
    if (!["admin", "tenant_admin", "superadmin"].includes(role)) {
      return json({ error: "Solo un administrador puede cambiar contraseñas." }, 403);
    }

    const { data: client } = await admin
      .from("clients").select("id, email, tenant_id").eq("id", clientId).maybeSingle();
    if (!client) return json({ error: "Cliente no encontrado." }, 404);
    if (role !== "superadmin" && client.tenant_id !== callerProfile.tenant_id) {
      return json({ error: "Ese cliente no pertenece a tu empresa." }, 403);
    }
    if (!client.email) return json({ error: "El cliente no tiene correo registrado." }, 400);

    const email = String(client.email).toLowerCase();
    const { data: clientProfile } = await admin
      .from("profiles").select("id").eq("email", email).eq("role", "client").maybeSingle();
    if (!clientProfile?.id) return json({ error: "El cliente aún no tiene cuenta de acceso." }, 404);

    // Cambiar la contraseña real de login
    const { error: updErr } = await admin.auth.admin.updateUserById(clientProfile.id, { password: newPassword });
    if (updErr) return json({ error: updErr.message }, 400);

    // Guardar la copia visible para el admin
    await admin.from("clients").update({ access_password: newPassword }).eq("id", clientId);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
