# Storage rollout — private buckets + tenant isolation

Status: **prepared, not applied.** Migration `supabase/migrations/20260612150000_secure_storage.sql`
is ready to validate in `staging-security`. Do **not** apply in production until the
public-quote image story (section 5) is resolved.

## 1. Goal

Today `company-assets` is a single **public** bucket: anyone with a URL reads any
tenant's photos, there is no size/MIME limit, and write policies use a global
`is_admin()` without checking the tenant path. This rollout makes the bucket
**private** and scopes every object to its tenant through RLS on
`storage.objects`.

## 2. Unified path contract (decided)

Object paths were inconsistent (tenant id in different positions):

| Asset | Old path | New path |
|---|---|---|
| Product photo | `products/{tenant}/{code}.ext` | `{tenant}/products/{code}.ext` |
| Company logo | `logos/{tenant}/logo.ext` | `{tenant}/logos/logo.ext` |
| Component photo | `{tenant}/components/{code}-{ts}.ext` | `{tenant}/components/{code}-{ts}.ext` (already correct) |

**Rule:** the **first** folder segment is always the tenant id. The RLS policy
keys off `(storage.foldername(name))[1] = current_tenant_id()`. One policy set
covers all asset types.

## 3. Frontend changes required (deploy AFTER the migration)

All three upload helpers must (a) write under the new `{tenant}/...` prefix and
(b) stop persisting public URLs. Persist the **path**; sign on read.

- `src/services/productImageService.js` → path `${tenantId}/products/${code}.${ext}`; store `foto_url` = path (or a `foto_path` column).
- `src/services/companySettings.js` (`uploadLogo`) → path `${tenantId}/logos/logo.${ext}`.
- `src/services/productComponentsAdminService.js` (`uploadComponentPhoto`) → keep `${tenantId}/components/...`.

Add one shared resolver (new `src/services/storageImages.js`):

```js
// Returns a short-lived signed URL for a stored object path.
export const signedImageUrl = async (path, expiresIn = 3600) => {
  if (!path) return "";
  const { data, error } = await supabase
    .storage.from("company-assets").createSignedUrl(path, expiresIn);
  return error ? "" : data.signedUrl;
};
// Batch variant (createSignedUrls) for the product grid.
```

Render points to migrate from "use stored public URL" to "sign the path":
catalog grid (`ProductCard`/`ProductGrid`), product detail, client portal
(`ClientCatalogApp`), and the PDF generators (sign just before drawing —
jsPDF downloads the bytes, so a fresh signed URL works).

## 4. Interaction with Codex's RPCs (must coordinate)

`get_client_catalog()` and `get_client_preorders()` currently return
`foto_url`. Once the bucket is private those stored public URLs break. Options:

- **A (recommended):** RPC returns the **path**; the authenticated client signs
  it in the browser (the read policy already allows a client to read its own
  tenant's objects).
- B: RPC signs server-side — not natively available from SQL; needs the Edge
  Function from section 5 anyway.

Pick A for the authenticated portal. Update both RPCs to return the path.

## 5. Public quote images — the production blocker

Public quote links (`/cotizacion/{token}`) show photos to **anonymous** visitors.
A private bucket cannot be read by `anon`, and `anon` cannot create signed URLs.
**Therefore making the bucket private breaks public-quote images** unless we add
a signing path for anonymous viewers:

- **Recommended:** a small **Edge Function** `sign-public-image` that, given a
  quote token + object path, verifies the token server-side (reusing
  `get_quote_link_by_token`) and returns a short-lived signed URL using the
  service role. This is the first concrete piece of Phase 3's Edge Functions.
- Alternative (faster, weaker): keep ONLY quote-linked images in a separate
  small public bucket. Leaves an intentional public surface; acceptable only if
  the catalog is not considered confidential.

**Decision needed before production.** Staging validation does not need this
(no public traffic there).

## 6. Data migration for existing objects (production)

Existing objects sit under the old prefixes and `products.foto_url` /
`company_settings.logo_url` hold permanent public URLs. Before/at production
cutover:

1. Move objects to the new `{tenant}/...` prefixes (storage move API or a
   one-off script with the service role).
2. Backfill the DB: rewrite `foto_url`/`logo_url`/component URLs to the stored
   **path** form.
3. Verify counts match (objects moved == rows rewritten).

Run this in a maintenance window; it is the step most likely to break catalog
and PDF images if done partially. Staging has no production rows, so create a
few disposable objects to rehearse it.

## 7. Acceptance tests (add to full_security_acceptance.sql)

Using the existing two-tenant fixtures, assert:

1. tenant_admin A **reads** an object under `A/products/...` → allowed.
2. tenant_admin A **reads** an object under `B/products/...` → 0 rows.
3. tenant_admin A **inserts** under `A/...` → allowed.
4. tenant_admin A **inserts** under `B/...` → blocked.
5. active client of A **reads** `A/products/...` → allowed; `B/...` → 0 rows.
6. `anon` **reads** any object → 0 rows.
7. superadmin reads objects of both tenants → allowed.

## 8. Order of operations

1. Apply `20260612150000_secure_storage.sql` in `staging-security`.
2. Create disposable buckets/objects in staging (the preview branch did not
   clone Storage) and run the section-7 assertions.
3. Land the frontend path + signed-URL changes and the RPC path change.
4. Build the `sign-public-image` Edge Function (section 5) — production blocker.
5. Production: backup → move objects + backfill URLs (section 6) → apply
   migration → deploy frontend → smoke test catalog, portal, PDFs, quote links.
