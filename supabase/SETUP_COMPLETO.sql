-- ============================================================
-- PASO 1: Ejecuta TODO este archivo en el SQL Editor de Supabase
-- Settings → SQL Editor → New query → pegar → Run
-- ============================================================

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'client' check (role in ('admin', 'client')),
  client_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text unique not null,
  phone text,
  rfc text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_client_id_fkey'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_client_id_fkey foreign key (client_id) references public.clients(id) on delete set null;
  end if;
end $$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  modelo text,
  descripcion text not null,
  metal text,
  kilataje text,
  linea text,
  familia text,
  grupo text,
  genero text,
  acabado text,
  piedra text,
  medida text,
  estatus text default 'Activo',
  peso_promedio numeric default 0,
  unidad_venta text,
  clave_venta text,
  precio_minimo numeric default 0,
  mano_obra numeric default 0,
  moneda_precio_min text default 'MXN',
  foto_url text,
  foto_url_2 text,
  foto_url_3 text,
  visible_web boolean default true,
  orden_web numeric default 0,
  tags_busqueda text,
  search_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalogs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.catalog_products (
  catalog_id uuid references public.catalogs(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  primary key (catalog_id, product_id)
);

create table if not exists public.price_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'MXN',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid references public.price_lists(id) on delete cascade,
  metal text,
  kilataje text,
  price_per_gram numeric not null default 0,
  labor_markup numeric not null default 0
);

create table if not exists public.client_catalogs (
  client_id uuid references public.clients(id) on delete cascade,
  catalog_id uuid references public.catalogs(id) on delete cascade,
  active boolean not null default true,
  primary key (client_id, catalog_id)
);

create table if not exists public.client_price_lists (
  client_id uuid references public.clients(id) on delete cascade,
  price_list_id uuid references public.price_lists(id) on delete cascade,
  active boolean not null default true,
  primary key (client_id, price_list_id)
);

-- Trigger: crea perfil automáticamente cuando alguien se registra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  matched_client uuid;
begin
  select id into matched_client from public.clients where lower(email) = lower(new.email) limit 1;
  insert into public.profiles (id, email, role, client_id)
  values (new.id, new.email, 'client', matched_client)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Activar RLS
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.products enable row level security;
alter table public.catalogs enable row level security;
alter table public.catalog_products enable row level security;
alter table public.price_lists enable row level security;
alter table public.price_list_items enable row level security;
alter table public.client_catalogs enable row level security;
alter table public.client_price_lists enable row level security;

-- Función helper para verificar si es admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Políticas de seguridad
drop policy if exists "profiles own or admin" on public.profiles;
drop policy if exists "admins manage profiles" on public.profiles;
create policy "profiles own or admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "admins manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage clients" on public.clients;
drop policy if exists "clients read own client" on public.clients;
create policy "admins manage clients" on public.clients for all using (public.is_admin()) with check (public.is_admin());
create policy "clients read own client" on public.clients for select using (id in (select client_id from public.profiles where id = auth.uid()));

drop policy if exists "admins manage products" on public.products;
drop policy if exists "clients read visible products" on public.products;
create policy "admins manage products" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "clients read visible products" on public.products for select using (
  visible_web = true
  and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'client')
);

drop policy if exists "admins manage catalogs" on public.catalogs;
drop policy if exists "clients read assigned catalogs" on public.catalogs;
create policy "admins manage catalogs" on public.catalogs for all using (public.is_admin()) with check (public.is_admin());
create policy "clients read assigned catalogs" on public.catalogs for select using (
  active = true and id in (
    select cc.catalog_id from public.client_catalogs cc
    join public.profiles p on p.client_id = cc.client_id
    where p.id = auth.uid() and cc.active = true
  )
);

drop policy if exists "admins manage catalog products" on public.catalog_products;
drop policy if exists "clients read catalog products" on public.catalog_products;
create policy "admins manage catalog products" on public.catalog_products for all using (public.is_admin()) with check (public.is_admin());
create policy "clients read catalog products" on public.catalog_products for select using (true);

drop policy if exists "admins manage price lists" on public.price_lists;
drop policy if exists "clients read assigned price lists" on public.price_lists;
create policy "admins manage price lists" on public.price_lists for all using (public.is_admin()) with check (public.is_admin());
create policy "clients read assigned price lists" on public.price_lists for select using (
  active = true and id in (
    select cpl.price_list_id from public.client_price_lists cpl
    join public.profiles p on p.client_id = cpl.client_id
    where p.id = auth.uid() and cpl.active = true
  )
);

drop policy if exists "admins manage price items" on public.price_list_items;
drop policy if exists "clients read price items" on public.price_list_items;
create policy "admins manage price items" on public.price_list_items for all using (public.is_admin()) with check (public.is_admin());
create policy "clients read price items" on public.price_list_items for select using (
  price_list_id in (
    select cpl.price_list_id from public.client_price_lists cpl
    join public.profiles p on p.client_id = cpl.client_id
    where p.id = auth.uid() and cpl.active = true
  )
);

drop policy if exists "admins manage client catalogs" on public.client_catalogs;
drop policy if exists "clients read own catalog assignments" on public.client_catalogs;
create policy "admins manage client catalogs" on public.client_catalogs for all using (public.is_admin()) with check (public.is_admin());
create policy "clients read own catalog assignments" on public.client_catalogs for select using (
  client_id in (select client_id from public.profiles where id = auth.uid())
);

drop policy if exists "admins manage client price lists" on public.client_price_lists;
drop policy if exists "clients read own price assignments" on public.client_price_lists;
create policy "admins manage client price lists" on public.client_price_lists for all using (public.is_admin()) with check (public.is_admin());
create policy "clients read own price assignments" on public.client_price_lists for select using (
  client_id in (select client_id from public.profiles where id = auth.uid())
);

-- ============================================================
-- PASO 2: Después de registrarte en la app, corre SOLO esta línea
-- (cambia el correo por el tuyo)
-- ============================================================
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'tu@correo.com';
