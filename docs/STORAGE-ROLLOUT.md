# Storage rollout — private buckets + tenant isolation

Status: **database validated in staging; frontend and Edge Function implemented locally.**
Migration `supabase/migrations/20260612150000_secure_storage.sql` passed in
`staging-security`. The remaining staging step is deploying and smoke-testing
`supabase/functions/sign-public-images`. Do **not** apply in production yet.

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

All three upload helpers now write under the new `{tenant}/...` prefix and persist
the path instead of a public URL.

- `src/services/productImageService.js` → path `${tenantId}/products/${code}.${ext}`; store `foto_url` = path (or a `foto_path` column).
- `src/services/companySettings.js` (`uploadLogo`) → path `${tenantId}/logos/logo.${ext}`.
- `src/services/productComponentsAdminService.js` (`uploadComponentPhoto`) → keep `${tenantId}/components/...`.

The shared resolver lives in `src/services/storageImages.js`. It batches and
caches signed URLs. `StorageImage.jsx` resolves only rendered images, avoiding a
request for every product in a large admin catalog.

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

- **Implemented locally:** Edge Function `sign-public-images` receives a quote
  token and object paths, verifies the token server-side, only accepts paths
  present in that quote or its tenant logo, and returns ten-minute signed URLs
  using the service role.
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

1. Apply `20260612150000_secure_storage.sql` in `staging-security`. The migration
   creates the disposable bucket when it does not exist and replaces only the
   three legacy policies verified in production; it does not remove policies
   belonging to other buckets.
2. Run `supabase/tests/full_security_acceptance.sql`; its disposable fixtures
   include the section-7 Storage assertions.
3. Completed locally: frontend path + signed-URL changes. Existing RPCs already
   return the stored `foto_url` value, so they return paths once paths are stored.
4. Deploy and smoke-test `sign-public-images` in staging — production blocker.
5. Production: backup → move objects + backfill URLs (section 6) → apply
   migration → deploy frontend → smoke test catalog, portal, PDFs, quote links.
