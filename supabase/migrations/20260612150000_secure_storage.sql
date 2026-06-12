-- Secure Storage: make `company-assets` private and scope every object to a
-- tenant through RLS on storage.objects.
--
-- Requires 20260612130000_secure_client_portal.sql (tenant/role helpers:
-- public.is_superadmin(), public.is_tenant_admin(), public.current_tenant_id()).
--
-- PATH CONTRACT (unified): every object path MUST start with the tenant id:
--   {tenant_id}/products/{code}.{ext}
--   {tenant_id}/logos/logo.{ext}
--   {tenant_id}/components/{code}-{ts}.{ext}
-- The first folder segment, (storage.foldername(name))[1], is the tenant id.
-- The frontend upload helpers must be updated to this contract before deploy,
-- and existing objects must be moved into it (see docs/STORAGE-ROLLOUT.md).
--
-- PUBLIC QUOTE IMAGES: anonymous visitors cannot sign private URLs. Serving
-- catalog photos on public quote links requires a signing Edge Function. This
-- migration is safe to validate in staging (no public traffic); do NOT apply in
-- production until the public-image story is resolved (see STORAGE-ROLLOUT.md).

-- 1. Create the bucket when rebuilding a disposable environment, or harden the
--    existing production bucket in place.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'company-assets',
  'company-assets',
  false,
  10485760,                                                       -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. Replace only the three legacy policies verified in production. Never drop
--    every storage.objects policy: other buckets may gain independent rules.
drop policy if exists "admin update assets" on storage.objects;
drop policy if exists "admin upload assets" on storage.objects;
drop policy if exists "public read assets" on storage.objects;

-- Keep the migration idempotent in disposable preview branches.
drop policy if exists "company-assets read within tenant" on storage.objects;
drop policy if exists "company-assets insert by tenant admin" on storage.objects;
drop policy if exists "company-assets update by tenant admin" on storage.objects;
drop policy if exists "company-assets delete by tenant admin" on storage.objects;

-- 3. READ: superadmin everywhere; tenant admins and active clients may read the
--    objects that live under their own tenant prefix. Anonymous role gets
--    nothing (public quote images handled separately by an Edge Function).
create policy "company-assets read within tenant"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'company-assets'
  and (
    public.is_superadmin()
    or (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
);

-- 4. INSERT: superadmin everywhere; tenant admins only under their tenant prefix.
create policy "company-assets insert by tenant admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'company-assets'
  and (
    public.is_superadmin()
    or (
      public.is_tenant_admin()
      and (storage.foldername(name))[1] = public.current_tenant_id()::text
    )
  )
);

-- 5. UPDATE: same rule on both the existing row and the new row.
create policy "company-assets update by tenant admin"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'company-assets'
  and (
    public.is_superadmin()
    or (
      public.is_tenant_admin()
      and (storage.foldername(name))[1] = public.current_tenant_id()::text
    )
  )
)
with check (
  bucket_id = 'company-assets'
  and (
    public.is_superadmin()
    or (
      public.is_tenant_admin()
      and (storage.foldername(name))[1] = public.current_tenant_id()::text
    )
  )
);

-- 6. DELETE: superadmin everywhere; tenant admins only under their tenant prefix.
create policy "company-assets delete by tenant admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'company-assets'
  and (
    public.is_superadmin()
    or (
      public.is_tenant_admin()
      and (storage.foldername(name))[1] = public.current_tenant_id()::text
    )
  )
);
