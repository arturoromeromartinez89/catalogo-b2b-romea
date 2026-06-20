-- The function is versioned separately; this migration guarantees that Auth
-- actually invokes it on every newly-created user in every environment.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
