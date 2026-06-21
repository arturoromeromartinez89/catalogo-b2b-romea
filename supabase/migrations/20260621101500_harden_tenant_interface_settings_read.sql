drop policy if exists "tenant admins read interface settings" on public.tenant_interface_settings;
create policy "tenant admins read interface settings"
on public.tenant_interface_settings for select to authenticated
using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);
