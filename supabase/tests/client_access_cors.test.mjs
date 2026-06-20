import assert from "node:assert/strict";

const functionUrl = process.env.EDGE_FUNCTION_URL;
if (!functionUrl) {
  console.error("Set EDGE_FUNCTION_URL to the deployed set-client-password function URL.");
  process.exit(2);
}

const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://www.estucheschavez.com.mx";
const deniedOrigin = process.env.DENIED_ORIGIN || "https://example.invalid";

const allowed = await fetch(functionUrl, {
  method: "OPTIONS",
  headers: { Origin: allowedOrigin, "Access-Control-Request-Method": "POST" },
});
assert.equal(allowed.status, 204);
assert.equal(allowed.headers.get("access-control-allow-origin"), allowedOrigin);

const denied = await fetch(functionUrl, {
  method: "OPTIONS",
  headers: { Origin: deniedOrigin, "Access-Control-Request-Method": "POST" },
});
assert.equal(denied.status, 403);
assert.equal(denied.headers.get("access-control-allow-origin"), null);

const unauthenticated = await fetch(functionUrl, {
  method: "POST",
  headers: { Origin: allowedOrigin, "Content-Type": "application/json" },
  body: JSON.stringify({ clientId: crypto.randomUUID(), action: "invite", redirectTo: `${allowedOrigin}/catalogo/` }),
});
assert.equal(unauthenticated.status, 401);

console.log("PASS: verified database origin, foreign origin and authentication gateway checks");
