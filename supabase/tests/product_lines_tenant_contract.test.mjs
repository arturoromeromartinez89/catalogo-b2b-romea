import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { requireTenantId } from "../../src/services/tenantUtils.js";

test("requireTenantId rejects writes without an active tenant", () => {
  assert.throws(
    () => requireTenantId("", "guardar productos"),
    /No hay empresa activa para guardar productos/,
  );
  assert.equal(requireTenantId({ tenant_id: "tenant-a" }), "tenant-a");
  assert.equal(requireTenantId({ tenantId: "tenant-b" }), "tenant-b");
});

test("product and product-line writes use tenant-scoped conflicts", async () => {
  const [pricing, catalog] = await Promise.all([
    readFile(new URL("../../src/services/pricingService.js", import.meta.url), "utf8"),
    readFile(new URL("../../src/services/supabaseCatalog.js", import.meta.url), "utf8"),
  ]);

  for (const source of [pricing, catalog]) {
    assert.doesNotMatch(source, /tenantId\s*\?\s*["']tenant_id,codigo["']\s*:\s*["']codigo["']/);
  }
  assert.match(pricing, /onConflict:\s*["']tenant_id,codigo["']/);
  assert.match(catalog, /onConflict:\s*["']tenant_id,codigo["']/);
});
