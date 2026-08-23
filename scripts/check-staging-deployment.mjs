const expectedHost = "catalogo-b2b-staging-security.vercel.app";
const target = process.argv[2] || `https://${expectedHost}/catalogo/`;
const url = new URL(target);

if (url.protocol !== "https:" || url.hostname !== expectedHost) {
  throw new Error(`BLOQUEADO: la verificacion solo admite el staging aprobado (${expectedHost}).`);
}

const response = await fetch(url, {
  redirect: "follow",
  headers: { "user-agent": "nexor-phase4-post-deploy-check" },
});

if (!response.ok) {
  throw new Error(`Staging respondio HTTP ${response.status}.`);
}

const html = await response.text();
if (!html.includes("<div id=\"root\"></div>")) {
  throw new Error("Staging respondio, pero no contiene el punto de montaje de la aplicacion.");
}

const contentType = response.headers.get("content-type") || "";
if (!contentType.includes("text/html")) {
  throw new Error(`Content-Type inesperado: ${contentType || "ausente"}.`);
}

console.log(`PASS: ${url.href} respondio ${response.status} con la aplicacion esperada.`);

