-- Remove legacy permissive policies that remained alongside tenant-safe ones.
-- PostgreSQL ORs permissive RLS policies, so a single global policy defeats the
-- newer tenant-scoped policy even when that newer policy is correct.
drop policy if exists "admin manage margins" on public.client_line_margins;
drop policy if exists "clients read own margins" on public.client_line_margins;
drop policy if exists "admin manage company settings" on public.company_settings;
drop policy if exists "clients read company settings" on public.company_settings;
drop policy if exists "admin manage metal prices" on public.metal_prices;
drop policy if exists "all read metal prices" on public.metal_prices;
drop policy if exists "admin manage lines" on public.product_lines;
drop policy if exists "all read lines" on public.product_lines;
drop policy if exists "admin manage preorder items" on public.preorder_items;
drop policy if exists "clients manage own preorder items" on public.preorder_items;
drop policy if exists "clients read own preorder items" on public.preorder_items;
drop policy if exists "clients insert own preorder items" on public.preorder_items;
drop policy if exists "clients update own preorder items" on public.preorder_items;
drop policy if exists "clients delete own preorder items" on public.preorder_items;
create policy "clients read own preorder items" on public.preorder_items
for select to authenticated
using (
  preorder_id in (
    select po.id
    from public.preorders po
    join public.profiles p on p.client_id = po.client_id
    where p.id = auth.uid()
      and p.role = 'client'
      and p.tenant_id = public.current_tenant_id()
      and po.tenant_id = public.current_tenant_id()
  )
);
create policy "clients insert own preorder items" on public.preorder_items
for insert to authenticated
with check (
  preorder_id in (
    select po.id
    from public.preorders po
    join public.profiles p on p.client_id = po.client_id
    where p.id = auth.uid()
      and p.role = 'client'
      and p.tenant_id = public.current_tenant_id()
      and po.tenant_id = public.current_tenant_id()
      and po.status in ('pendiente', 'revision')
  )
);
create policy "clients update own preorder items" on public.preorder_items
for update to authenticated
using (
  preorder_id in (
    select po.id
    from public.preorders po
    join public.profiles p on p.client_id = po.client_id
    where p.id = auth.uid()
      and p.role = 'client'
      and p.tenant_id = public.current_tenant_id()
      and po.tenant_id = public.current_tenant_id()
      and po.status in ('pendiente', 'revision')
  )
)
with check (
  preorder_id in (
    select po.id
    from public.preorders po
    join public.profiles p on p.client_id = po.client_id
    where p.id = auth.uid()
      and p.role = 'client'
      and p.tenant_id = public.current_tenant_id()
      and po.tenant_id = public.current_tenant_id()
      and po.status in ('pendiente', 'revision')
  )
);
create policy "clients delete own preorder items" on public.preorder_items
for delete to authenticated
using (
  preorder_id in (
    select po.id
    from public.preorders po
    join public.profiles p on p.client_id = po.client_id
    where p.id = auth.uid()
      and p.role = 'client'
      and p.tenant_id = public.current_tenant_id()
      and po.tenant_id = public.current_tenant_id()
      and po.status in ('pendiente', 'revision')
  )
);
notify pgrst, 'reload schema';
