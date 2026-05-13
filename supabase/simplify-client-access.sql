drop policy if exists "clients read assigned products" on public.products;

create policy "clients read visible products"
on public.products
for select
using (
  visible_web = true
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'client'
  )
);

-- Optional repair: link an existing auth user to an existing client with the same email.
update public.profiles p
set client_id = c.id
from public.clients c
where lower(p.email) = lower(c.email)
  and p.role = 'client'
  and p.client_id is null;
