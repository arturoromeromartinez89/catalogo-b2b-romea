-- Client passwords are managed only by Supabase Auth. Never keep a readable copy.
alter table public.clients drop column if exists access_password;
-- A browser signup can never choose its own tenant. The trusted Edge Function
-- binds invited users to a client only after validating the tenant admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, client_id, tenant_id)
  values (new.id, new.email, 'client', null, null)
  on conflict (id) do nothing;

  return new;
end;
$$;
