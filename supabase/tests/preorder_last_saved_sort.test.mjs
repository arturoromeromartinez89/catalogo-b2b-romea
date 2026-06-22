import assert from "node:assert/strict";
import { preorderSavedAt, sortPreordersByLastSaved } from "../../src/utils/preorderSorting.js";

const oldDraft = {
  folio: "PRE-OLD-DRAFT",
  created_at: "2026-06-01T09:00:00.000Z",
  updated_at: "2026-06-22T18:30:00.000Z",
};

const newButNotEdited = {
  folio: "PRE-NEW-CREATED",
  created_at: "2026-06-21T12:00:00.000Z",
  updated_at: "2026-06-21T12:00:00.000Z",
};

const sorted = sortPreordersByLastSaved([newButNotEdited, oldDraft]);

assert.equal(preorderSavedAt(oldDraft), "2026-06-22T18:30:00.000Z");
assert.equal(sorted[0].folio, "PRE-OLD-DRAFT");
assert.equal(sorted[1].folio, "PRE-NEW-CREATED");

console.log("PASS preorder_last_saved_sort");
