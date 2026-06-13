import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "company-assets";
const MAX_REFERENCES = 100;
const SIGNED_URL_TTL_SECONDS = 10 * 60;
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const SIGN_MARKER = `/storage/v1/object/sign/${BUCKET}/`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const extractStoragePath = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const marker = raw.includes(PUBLIC_MARKER)
    ? PUBLIC_MARKER
    : raw.includes(SIGN_MARKER)
      ? SIGN_MARKER
      : null;
  if (marker) {
    const path = (raw.split(marker)[1] || "").split("?")[0];
    return path ? decodeURIComponent(path) : null;
  }
  if (/^(https?:|data:|blob:)/i.test(raw) || raw.startsWith("/")) return null;
  return raw.replace(/^\/+/, "");
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Server configuration missing" }, 500);

    const body = await request.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    const references = Array.isArray(body?.references) ? body.references.slice(0, MAX_REFERENCES) : [];
    if (!token || token.length > 200 || !references.length) return json({ error: "Invalid request" }, 400);

    const publicClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: quoteData, error: quoteError } = await publicClient.rpc("get_quote_link_by_token", {
      p_token: token,
    });
    const quote = Array.isArray(quoteData) ? quoteData[0] : quoteData;
    if (quoteError || !quote) return json({ error: "Quote not found" }, 404);

    const { data: branding } = await publicClient.rpc("get_public_company_branding", {
      p_tenant_id: quote.tenant_id,
    });

    const allowedReferences = [
      ...(Array.isArray(quote.products) ? quote.products.map((product: Record<string, unknown>) => product.fotoUrl) : []),
      branding?.logo_url,
    ];
    const allowedPaths = new Set(allowedReferences.map(extractStoragePath).filter(Boolean));
    const requestedPaths = [...new Set(references.map(extractStoragePath).filter((path) => path && allowedPaths.has(path)))];
    if (!requestedPaths.length) return json({ signed: [] });

    const { data: signedData, error: signedError } = await adminClient.storage
      .from(BUCKET)
      .createSignedUrls(requestedPaths, SIGNED_URL_TTL_SECONDS);
    if (signedError) return json({ error: "Unable to sign images" }, 500);

    return json({
      signed: (signedData || [])
        .filter((entry) => entry.path && entry.signedUrl)
        .map((entry) => ({ path: entry.path, signedUrl: entry.signedUrl })),
      expiresIn: SIGNED_URL_TTL_SECONDS,
    });
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
});
