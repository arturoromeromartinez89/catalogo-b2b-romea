# Production security snapshot - 2026-06-12

Project: `romea-catalogo` (`pyignizeoevafifzfnik`), production branch `main`.

This inventory was collected with read-only SQL in the Supabase SQL Editor. No production data or policies were modified.

## Verified state

- Two active tenants: ROMEA and Vanguardia Joyera.
- 37 public tables; all 37 have RLS enabled.
- Five active user profiles: one `superadmin`, one `tenant_admin`, one legacy `admin`, and two clients.
- One active client profile has a tenant but no linked `clients` row. There is no client record with the same email. The privilege migration will deactivate this orphan instead of guessing a link.
- The secure client RPCs (`get_client_catalog`, `submit_client_preorder`, `get_client_preorders`) are not installed in production yet.
- Role helpers are `SECURITY DEFINER`, but the live versions do not check `profiles.active` or `tenants.status` and most do not pin `search_path`.

## Confirmed critical findings

### Tenant administrators are globally authorized

Seventeen live `ALL` policies use `is_admin()` without a tenant predicate:

- `catalog_products`
- `catalogs`
- `client_catalogs`
- `client_line_margins`
- `client_price_lists`
- `clients`
- `company_settings`
- `labor_list_lines`
- `labor_lists`
- `metal_prices`
- `preorder_items`
- `preorders`
- `price_list_items`
- `price_lists`
- `product_lines`
- `products`
- `quote_links`

Because `is_admin()` returns true for a tenant administrator, a direct PostgREST request can currently operate rows belonging to another tenant. Migration `20260612125000_enforce_tenant_admin_isolation.sql` replaces these policies with tenant-scoped checks.

### Clients can read internal pricing tables

Live policies allow any authenticated user to read `product_lines`, `metal_prices`, and company settings. Clients can also read their line margins. Migration `20260612130000_secure_client_portal.sql` now drops the exact live policy names and exposes only sanitized RPC results.

### Clients can alter pending preorders

Production has separate client `INSERT` and `UPDATE` policies on both `preorders` and `preorder_items`. The update checks only that the current status is `pendiente`; it does not protect prices, totals, status changes, or item contents. The secure portal migration now drops every exact live policy name and moves submission to server-side recalculation.

### Storage is public and not tenant-scoped

Bucket `company-assets` is public, has no file-size limit and no MIME allowlist. Public reads cover the entire bucket. Upload/update policies use global `is_admin()` and do not validate the tenant path. Storage must be migrated separately because existing database rows contain permanent public URLs and changing the bucket to private immediately would break catalog and PDF images.

## Deployment conclusion

Do not apply only the frontend changes. Required order in staging is:

1. Resolve or accept deactivation of the orphan client profile.
2. Apply `20260612120000_lock_down_profile_privileges.sql`.
3. Apply `20260612125000_enforce_tenant_admin_isolation.sql`.
4. Apply `20260612130000_secure_client_portal.sql`.
5. Apply `20260612140000_harden_public_quotes.sql`.
6. Run all SQL tests with two tenant administrators and two clients.
7. Deploy the matching frontend only after the RPCs pass.
