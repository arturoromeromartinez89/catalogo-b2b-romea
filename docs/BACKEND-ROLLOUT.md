# Backend rollout

## Environments

Use three independent Supabase projects: development, staging, and production. Never link the local CLI to production for routine development.

Required project references and secrets belong in the local environment or GitHub environment secrets, never in `VITE_*` variables or Git:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_REF_DEV`
- `SUPABASE_PROJECT_REF_STAGING`
- `SUPABASE_PROJECT_REF_PRODUCTION`

## Current limitation

The CLI structure is initialized, but this repository does not yet contain a verified baseline migration that can rebuild the historical production schema from an empty database. Do not run `supabase db reset` expecting a complete environment yet. Docker is also not installed on the current workstation.

The baseline must be generated only after comparing the production snapshot with the legacy SQL files. Until then, the timestamped migrations in `supabase/migrations` are deployment deltas, not a complete schema history.

## Staging status - 2026-06-12

A Supabase preview branch named `staging-security` (`vafqcvpzksjlrborxoos`) is active. The four security migrations below were applied successfully and `supabase/tests/full_security_acceptance.sql` passed. Production was not modified.

The branch cloned schema but not production rows or Storage buckets. See `docs/staging-security-validation-2026-06-12.md` for the exact checks and remaining limitations.

## First production inventory

1. Run `supabase/diagnostics/production_security_snapshot.sql` in the production SQL Editor.
2. Export every result grid before changing policies.
3. Compare the live policies and functions with the versioned migrations.
4. Resolve client profiles reported with missing or cross-tenant links.

## Migration order

1. Completed in staging: apply the four security migrations in timestamp order.
2. Completed in staging: run `supabase/tests/full_security_acceptance.sql` with disposable fixtures for two tenants, admins and clients.
3. Pending: protect and test Storage with private tenant paths and signed URLs.
4. Pending: run UI smoke tests with persistent staging accounts.
5. Pending: back up production, schedule a maintenance window, apply the same migrations, and repeat smoke tests.

Do not deploy the frontend RPC changes before the matching database migration is active. Deploy database first, verify RPCs, then deploy Vercel.
