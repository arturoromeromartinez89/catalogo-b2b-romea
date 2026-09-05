import assert from "node:assert/strict";
import {
  canPublishPurchase,
  getPurchaseStage,
  normalizeLineCode,
  suggestInternalSku,
  suggestLineFromCost,
} from "../src/utils/purchasingWorkflow.js";

assert.equal(suggestInternalSku({ codeMode: "supplier_equivalent", supplierPrefix: "rj", supplierPartNumber: "drp257" }), "RJDRP257");
assert.equal(suggestInternalSku({ codeMode: "internal_sequence", supplierPrefix: "jr", supplierPartNumber: "255" }), "JR255");
assert.equal(suggestInternalSku({ codeMode: "supplier_catalog", supplierPartNumber: "ch-900" }), "CH-900");
assert.equal(normalizeLineCode("10"), "010");
assert.equal(suggestLineFromCost("10"), "010");
assert.equal(suggestLineFromCost("10.5"), "");
assert.equal(getPurchaseStage({}), "proposal");
assert.equal(getPurchaseStage({ approvedAt: "2026-09-05" }), "registration");
assert.equal(getPurchaseStage({ approvedAt: "x", erpRegisteredAt: "x" }), "media");

const complete = {
  approvedAt: "x",
  internalSku: "RJDRP257",
  description: "DIJE",
  lineCode: "010",
  weightGrams: 2.5,
  erpRegisteredAt: "x",
  photoUrl: "https://example.test/photo.jpg",
  cedisLocation: "010-A-03",
};
assert.equal(getPurchaseStage(complete), "ready");
assert.equal(canPublishPurchase(complete), true);
assert.equal(canPublishPurchase({ ...complete, photoUrl: "" }), false);

console.log("PASS: purchasing workflow rules");
