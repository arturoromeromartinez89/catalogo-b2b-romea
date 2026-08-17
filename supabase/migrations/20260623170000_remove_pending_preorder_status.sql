-- El flujo comercial ya no usa "pendiente" como estado visible/operativo.
-- Toda preorden viva debe estar en revision hasta convertirse en orden.

update public.preorders
set status = 'revision',
    updated_at = now()
where status = 'pendiente';
create or replace function public.normalize_preorder_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'pendiente' then
    new.status := 'revision';
  end if;
  return new;
end;
$$;
drop trigger if exists normalize_preorder_status_before_write on public.preorders;
create trigger normalize_preorder_status_before_write
before insert or update of status on public.preorders
for each row execute function public.normalize_preorder_status();
do $$
declare
  v_sql text;
begin
  if to_regprocedure('public.save_preorder_transaction(jsonb,jsonb,text,boolean)') is not null then
    select pg_get_functiondef('public.save_preorder_transaction(jsonb,jsonb,text,boolean)'::regprocedure)
    into v_sql;
    v_sql := replace(v_sql, '''pendiente''', '''revision''');
    execute v_sql;
  end if;

  if to_regprocedure('public.submit_quote_link_preorder(text,jsonb,jsonb)') is not null then
    select pg_get_functiondef('public.submit_quote_link_preorder(text,jsonb,jsonb)'::regprocedure)
    into v_sql;
    v_sql := replace(v_sql, '''pendiente''', '''revision''');
    execute v_sql;
  end if;

  if to_regprocedure('public.submit_client_preorder(jsonb,jsonb)') is not null then
    select pg_get_functiondef('public.submit_client_preorder(jsonb,jsonb)'::regprocedure)
    into v_sql;
    v_sql := replace(v_sql, '''pendiente''', '''revision''');
    execute v_sql;
  end if;
end $$;
notify pgrst, 'reload schema';
