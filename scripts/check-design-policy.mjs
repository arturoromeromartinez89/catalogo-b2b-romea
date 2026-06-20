import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const target = new URL(process.argv[2] || "https://catalogo-b2b-staging-security.vercel.app/catalogo/");

const response = await fetch(target);
assert.equal(response.status, 200, `${target} returned ${response.status}`);

const html = await response.text();
const cssMatches = [...html.matchAll(/href="([^"]*\/assets\/[^"]+\.css)"/g)];
assert.ok(cssMatches.length, "No compiled CSS asset was found");

const css = (
  await Promise.all(cssMatches.map(async ([, href]) => {
    const cssUrl = new URL(href, target);
    const cssResponse = await fetch(cssUrl);
    assert.equal(cssResponse.status, 200, `${cssUrl} returned ${cssResponse.status}`);
    return cssResponse.text();
  }))
).join("\n");

const sourceCss = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

const requiredSourceRules = [
  [".admin-catalog-shell .database-admin-card .database-action-grid > button", "database action buttons are governed"],
  [".login-brand-orb", "decorative login orbs are governed"],
  [".quote-public-screen", "public quote surface is governed"],
  [".app-shell h1", "client shell headings are governed"],
  [".qf-move button", "quick-filter reorder controls are governed"],
];

const requiredPublishedRules = [
  ["min-height:42px", "database action buttons keep equal height"],
  ["width:100%", "database action buttons fill their grid cells"],
  ["display:none", "decorative login orbs are hidden"],
  ["height:26px", "quick-filter reorder controls are readable"],
  ['font-family:var(--font-sans)', "published CSS contains the unified font policy"],
];

for (const [needle, label] of requiredSourceRules) {
  assert.ok(sourceCss.includes(needle), `Missing source design policy rule: ${label}`);
}

for (const [needle, label] of requiredPublishedRules) {
  assert.ok(css.includes(needle), `Missing design policy rule: ${label}`);
}

const finalPolicyMarker = "Cross-surface design policy: client, finance, public quote and legacy panels.";
const finalPolicyIndex = sourceCss.indexOf(finalPolicyMarker);
assert.ok(finalPolicyIndex > -1, "Missing final cross-surface design policy layer");

const finalPolicy = sourceCss.slice(finalPolicyIndex);
assert.doesNotMatch(
  finalPolicy,
  /font-family:\s*var\(--font-serif\)|font-family:\s*Georgia/i,
  "A serif font rule appears after the final design policy layer",
);

console.log(`PASS: visual design policy CSS is present at ${target}`);
