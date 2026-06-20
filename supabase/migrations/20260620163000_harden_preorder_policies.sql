-- Remove legacy global-admin and tenant-unaware client policies.
drop policy if exists "admin manage preorders" on public.preorders;
drop policy if exists "admins manage preorders" on public.preorders;
drop policy if exists "clients manage own preorders" on public.preorders;
drop policy if exists "clients read own preorders" on public.preorders;
drop policy if exists "clients insert own preorders" on public.preorders;
drop policy if exists "clients update own preorders" on public.preorders;
drop policy if exists "clients delete own preorders" on public.preorders;
create policy "admins manage preorders" on public.preorders
for all to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
)
with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);
create policy "clients read own preorders" on public.preorders
for select to authenticated
using (
  tenant_id = public.current_tenant_id()
  and client_id in (
    select client_id from public.profiles
    where id = auth.uid() and tenant_id = public.current_tenant_id() and role = 'client'
  )
);
create policy "clients insert own preorders" on public.preorders
for insert to authenticated
with check (
  tenant_id = public.current_tenant_id()
  and created_by = auth.uid()
  and status in ('pendiente', 'revision')
  and client_id in (
    select client_id from public.profiles
    where id = auth.uid() and tenant_id = public.current_tenant_id() and role = 'client'
  )
);
create policy "clients update own preorders" on public.preorders
for update to authenticated
using (
  tenant_id = public.current_tenant_id()
  and status in ('pendiente', 'revision')
  and client_id in (
    select client_id from public.profiles
    where id = auth.uid() and tenant_id = public.current_tenant_id() and role = 'client'
  )
)
with check (
  tenant_id = public.current_tenant_id()
  and status in ('pendiente', 'revision')
  and client_id in (
    select client_id from public.profiles
    where id = auth.uid() and tenant_id = public.current_tenant_id() and role = 'client'
  )
);
create policy "clients delete own preorders" on public.preorders
for delete to authenticated
using (
  tenant_id = public.current_tenant_id()
  and created_by = auth.uid()
  and status in ('pendiente', 'revision')
  and client_id in (
    select client_id from public.profiles
    where id = auth.uid() and tenant_id = public.current_tenant_id() and role = 'client'
  )
);
notify pgrst, 'reload schema';
