do $$
declare
  v_user constant uuid := '97777777-0000-4000-8000-000000000001';
  v_count integer;
begin
  delete from auth.users where id = v_user;
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_user, 'authenticated', 'authenticated', 'auth-trigger-test@example.invalid',
    '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  );

  select count(*) into v_count
  from public.profiles
  where id = v_user and role = 'client' and tenant_id is null and client_id is null;
  if v_count <> 1 then raise exception 'FAIL: Auth user did not receive a safe profile'; end if;

  delete from auth.users where id = v_user;
  raise notice 'PASS: Auth trigger creates an unassigned client profile';
end $$;
