import assert from "node:assert/strict";

const target = new URL(process.argv[2] || "https://www.estucheschavez.com.mx/catalogo/");
const expectedPath = target.pathname.endsWith("/") ? target.pathname : `${target.pathname}/`;

const response = await fetch(target, { redirect: "manual" });
assert.equal(response.status, 200, `${target} returned ${response.status}`);

const html = await response.text();
assert.match(html, /<div id="root"><\/div>/, "The response is not the catalog application");

const assetMatch = html.match(/(?:src|href)="([^"]*\/assets\/[^"]+)"/);
assert.ok(assetMatch, "No compiled asset was found in the catalog HTML");
const assetUrl = new URL(assetMatch[1], target);
assert.ok(
  assetUrl.pathname.startsWith(`${expectedPath}assets/`),
  `Asset escaped the proxy path: ${assetUrl.pathname}`,
);

const assetResponse = await fetch(assetUrl, { redirect: "manual" });
assert.equal(assetResponse.status, 200, `${assetUrl} returned ${assetResponse.status}`);

const requiredHeaders = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
  "permissions-policy",
];
for (const name of requiredHeaders) {
  assert.ok(response.headers.get(name), `Missing security header: ${name}`);
}

console.log(`PASS: proxy, catalog HTML, asset path and security headers at ${target}`);
