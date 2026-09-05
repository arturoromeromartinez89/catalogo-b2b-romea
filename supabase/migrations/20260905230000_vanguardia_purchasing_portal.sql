-- Portal operativo de Compras para el catálogo maestro.
-- Mantiene el alta y su auditoría separadas del catálogo comercial.

alter table public.tenant_features
  add column if not exists modulo_compras boolean not null default false;

create table if not exists public.purchasing_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  area_role text not null check (area_role in ('director', 'purchasing', 'marketing', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, profile_id)
);

create table if not exists public.purchase_product_intakes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  supplier_name text not null check (char_length(trim(supplier_name)) between 1 and 160),
  supplier_prefix text not null default '',
  supplier_part_number text not null default '',
  internal_sku text not null check (char_length(trim(internal_sku)) between 1 and 80),
  code_mode text not null default 'internal_sequence'
    check (code_mode in ('supplier_equivalent', 'internal_sequence', 'supplier_catalog')),
  description text not null check (char_length(trim(description)) between 1 and 500),
  metal text not null default 'Plata',
  karat text not null default '925',
  supplier_cost_mxn numeric(14, 2) check (supplier_cost_mxn is null or supplier_cost_mxn >= 0),
  line_code text not null check (char_length(trim(line_code)) between 1 and 24),
  family text not null default '',
  group_name text not null default '',
  weight_grams numeric(12, 3) not null check (weight_grams > 0),
  proposal_source text not null default 'other'
    check (proposal_source in ('rafael', 'sales', 'supplier', 'other')),
  proposed_by_name text not null default '',
  notes text not null default '',
  status text not null default 'proposal'
    check (status in ('proposal', 'registration', 'media', 'ready', 'published', 'rejected')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  erp_registered_by uuid references public.profiles(id) on delete set null,
  erp_registered_at timestamptz,
  photo_url text,
  photo_storage_path text,
  photo_completed_by uuid references public.profiles(id) on delete set null,
  photo_completed_at timestamptz,
  cedis_location text not null default '',
  cedis_location_by uuid references public.profiles(id) on delete set null,
  cedis_location_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, internal_sku),
  check (photo_url is null or photo_url ~* '^https://')
);

create table if not exists public.purchase_intake_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  intake_id uuid not null references public.purchase_product_intakes(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  event_data jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchase_intakes_tenant_status
  on public.purchase_product_intakes (tenant_id, status, created_at desc);
create index if not exists idx_purchase_intakes_supplier
  on public.purchase_product_intakes (tenant_id, supplier_name, supplier_part_number);
create index if not exists idx_purchase_intake_events_intake
  on public.purchase_intake_events (intake_id, created_at desc);

create or replace function public.is_purchasing_member(p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.purchasing_members member
      on member.profile_id = p.id and member.tenant_id = p.tenant_id
    where p.id = auth.uid()
      and p.active is true
      and member.active is true
      and (p_roles is null or member.area_role = any (p_roles))
  );
$$;

revoke all on function public.is_purchasing_member(text[]) from public, anon;
grant execute on function public.is_purchasing_member(text[]) to authenticated;

create or replace function public.purchase_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.log_purchase_intake_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.purchase_intake_events (
    tenant_id,
    intake_id,
    event_type,
    from_status,
    to_status,
    event_data,
    actor_id
  ) values (
    new.tenant_id,
    new.id,
    case when tg_op = 'INSERT' then 'created' when old.status is distinct from new.status then 'status_changed' else 'updated' end,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    jsonb_build_object(
      'internal_sku', new.internal_sku,
      'supplier_name', new.supplier_name,
      'photo_complete', new.photo_url is not null,
      'cedis_location', new.cedis_location
    ),
    auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists purchase_members_touch_updated_at on public.purchasing_members;
create trigger purchase_members_touch_updated_at
before update on public.purchasing_members
for each row execute function public.purchase_touch_updated_at();

drop trigger if exists purchase_intakes_touch_updated_at on public.purchase_product_intakes;
create trigger purchase_intakes_touch_updated_at
before update on public.purchase_product_intakes
for each row execute function public.purchase_touch_updated_at();

drop trigger if exists purchase_intakes_audit on public.purchase_product_intakes;
create trigger purchase_intakes_audit
after insert or update on public.purchase_product_intakes
for each row execute function public.log_purchase_intake_event();

alter table public.purchasing_members enable row level security;
alter table public.purchase_product_intakes enable row level security;
alter table public.purchase_intake_events enable row level security;

create policy "purchasing members read same tenant"
on public.purchasing_members for select to authenticated
using (
  public.is_superadmin()
  or (tenant_id = public.current_tenant_id() and (public.is_tenant_admin() or public.is_purchasing_member()))
);

create policy "tenant admins manage purchasing members"
on public.purchasing_members for all to authenticated
using (public.is_superadmin() or (tenant_id = public.current_tenant_id() and public.is_tenant_admin()))
with check (public.is_superadmin() or (tenant_id = public.current_tenant_id() and public.is_tenant_admin()));

create policy "purchasing team reads intakes"
on public.purchase_product_intakes for select to authenticated
using (
  public.is_superadmin()
  or (tenant_id = public.current_tenant_id() and (public.is_tenant_admin() or public.is_purchasing_member()))
);

create policy "purchasing team creates intakes"
on public.purchase_product_intakes for insert to authenticated
with check (
  public.is_superadmin()
  or (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_admin() or public.is_purchasing_member(array['director', 'purchasing']))
  )
);

create policy "purchasing leads update intakes"
on public.purchase_product_intakes for update to authenticated
using (
  public.is_superadmin()
  or (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_admin() or public.is_purchasing_member(array['director', 'purchasing']))
  )
)
with check (
  public.is_superadmin()
  or (
    tenant_id = public.current_tenant_id()
    and (public.is_tenant_admin() or public.is_purchasing_member(array['director', 'purchasing']))
  )
);

create policy "tenant admins delete intakes"
on public.purchase_product_intakes for delete to authenticated
using (public.is_superadmin() or (tenant_id = public.current_tenant_id() and public.is_tenant_admin()));

create policy "purchasing team reads audit events"
on public.purchase_intake_events for select to authenticated
using (
  public.is_superadmin()
  or (tenant_id = public.current_tenant_id() and (public.is_tenant_admin() or public.is_purchasing_member()))
);

create or replace function public.approve_purchase_intake(p_intake_id uuid)
returns public.purchase_product_intakes
language plpgsql
security definer
set search_path = ''
as $$
declare result public.purchase_product_intakes;
begin
  select * into result from public.purchase_product_intakes where id = p_intake_id for update;
  if result.id is null then raise exception 'Producto no encontrado'; end if;
  if not (
    public.is_superadmin()
    or (result.tenant_id = public.current_tenant_id() and (public.is_tenant_admin() or public.is_purchasing_member(array['director', 'purchasing'])))
  ) then raise exception 'No tienes permiso para aprobar productos'; end if;
  if result.internal_sku = '' or result.description = '' or result.line_code = '' or result.weight_grams <= 0 then
    raise exception 'Completa SKU, descripción, línea y peso antes de aprobar';
  end if;
  update public.purchase_product_intakes
  set status = 'registration', approved_by = auth.uid(), approved_at = now()
  where id = p_intake_id returning * into result;
  return result;
end;
$$;

create or replace function public.confirm_purchase_erp_registration(p_intake_id uuid)
returns public.purchase_product_intakes
language plpgsql
security definer
set search_path = ''
as $$
declare result public.purchase_product_intakes;
begin
  select * into result from public.purchase_product_intakes where id = p_intake_id for update;
  if result.id is null then raise exception 'Producto no encontrado'; end if;
  if not (
    public.is_superadmin()
    or (result.tenant_id = public.current_tenant_id() and (public.is_tenant_admin() or public.is_purchasing_member(array['director', 'purchasing'])))
  ) then raise exception 'No tienes permiso para confirmar el registro'; end if;
  if result.approved_at is null then raise exception 'Beto debe aprobar el producto antes del registro'; end if;
  update public.purchase_product_intakes
  set status = 'media', erp_registered_by = auth.uid(), erp_registered_at = now()
  where id = p_intake_id returning * into result;
  return result;
end;
$$;

create or replace function public.complete_purchase_media(
  p_intake_id uuid,
  p_cedis_location text,
  p_photo_url text default null,
  p_photo_storage_path text default null
)
returns public.purchase_product_intakes
language plpgsql
security definer
set search_path = ''
as $$
declare result public.purchase_product_intakes;
declare next_photo text;
declare next_path text;
declare next_location text;
begin
  select * into result from public.purchase_product_intakes where id = p_intake_id for update;
  if result.id is null then raise exception 'Producto no encontrado'; end if;
  if not (
    public.is_superadmin()
    or (
      result.tenant_id = public.current_tenant_id()
      and (public.is_tenant_admin() or public.is_purchasing_member(array['director', 'purchasing', 'marketing']))
    )
  ) then raise exception 'No tienes permiso para completar fotografía y CEDIS'; end if;
  if result.erp_registered_at is null then raise exception 'Primero confirma el registro individual en ERP'; end if;
  next_photo := coalesce(nullif(trim(p_photo_url), ''), result.photo_url);
  next_path := coalesce(nullif(trim(p_photo_storage_path), ''), result.photo_storage_path);
  next_location := coalesce(nullif(trim(p_cedis_location), ''), result.cedis_location);
  if next_photo is null or next_location = '' then raise exception 'La fotografía profesional y la ubicación CEDIS son obligatorias'; end if;
  update public.purchase_product_intakes
  set
    status = 'ready',
    photo_url = next_photo,
    photo_storage_path = next_path,
    photo_completed_by = auth.uid(),
    photo_completed_at = now(),
    cedis_location = next_location,
    cedis_location_by = auth.uid(),
    cedis_location_at = now()
  where id = p_intake_id returning * into result;
  return result;
end;
$$;

create or replace function public.publish_purchase_intake(p_intake_id uuid)
returns public.purchase_product_intakes
language plpgsql
security definer
set search_path = ''
as $$
declare result public.purchase_product_intakes;
declare saved_product_id uuid;
begin
  select * into result from public.purchase_product_intakes where id = p_intake_id for update;
  if result.id is null then raise exception 'Producto no encontrado'; end if;
  if not (
    public.is_superadmin()
    or (result.tenant_id = public.current_tenant_id() and (public.is_tenant_admin() or public.is_purchasing_member(array['director', 'purchasing'])))
  ) then raise exception 'No tienes permiso para publicar productos'; end if;
  if result.approved_at is null or result.erp_registered_at is null or result.photo_url is null or result.cedis_location = '' then
    raise exception 'El producto todavía no cumple todos los controles de liberación';
  end if;

  insert into public.products (
    tenant_id, codigo, modelo, descripcion, metal, kilataje, linea, familia, grupo,
    proveedor, estatus, peso_promedio, unidad_venta, foto_url, visible_web, updated_at
  ) values (
    result.tenant_id, result.internal_sku, result.internal_sku, result.description,
    result.metal, result.karat, result.line_code, result.family, result.group_name,
    result.supplier_name, 'Alta', result.weight_grams, 'Gr', result.photo_url, true, now()
  )
  on conflict (tenant_id, codigo) do update set
    modelo = excluded.modelo,
    descripcion = excluded.descripcion,
    metal = excluded.metal,
    kilataje = excluded.kilataje,
    linea = excluded.linea,
    familia = excluded.familia,
    grupo = excluded.grupo,
    proveedor = excluded.proveedor,
    estatus = excluded.estatus,
    peso_promedio = excluded.peso_promedio,
    unidad_venta = excluded.unidad_venta,
    foto_url = excluded.foto_url,
    visible_web = true,
    updated_at = now()
  returning id into saved_product_id;

  update public.purchase_product_intakes
  set product_id = saved_product_id, status = 'published', published_by = auth.uid(), published_at = now()
  where id = p_intake_id returning * into result;
  return result;
end;
$$;

revoke all on function public.approve_purchase_intake(uuid) from public, anon;
revoke all on function public.confirm_purchase_erp_registration(uuid) from public, anon;
revoke all on function public.complete_purchase_media(uuid, text, text, text) from public, anon;
revoke all on function public.publish_purchase_intake(uuid) from public, anon;
grant execute on function public.approve_purchase_intake(uuid) to authenticated;
grant execute on function public.confirm_purchase_erp_registration(uuid) to authenticated;
grant execute on function public.complete_purchase_media(uuid, text, text, text) to authenticated;
grant execute on function public.publish_purchase_intake(uuid) to authenticated;

grant select, insert, update, delete on public.purchasing_members to authenticated;
grant select, insert, update, delete on public.purchase_product_intakes to authenticated;
grant select on public.purchase_intake_events to authenticated;
grant usage, select on sequence public.purchase_intake_events_id_seq to authenticated;

drop policy if exists "company-assets insert by purchasing media" on storage.objects;
create policy "company-assets insert by purchasing media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
  and (storage.foldername(name))[2] = 'purchasing'
  and public.is_purchasing_member(array['director', 'purchasing', 'marketing'])
);

drop policy if exists "company-assets update by purchasing media" on storage.objects;
create policy "company-assets update by purchasing media"
on storage.objects for update to authenticated
using (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
  and (storage.foldername(name))[2] = 'purchasing'
  and public.is_purchasing_member(array['director', 'purchasing', 'marketing'])
)
with check (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
  and (storage.foldername(name))[2] = 'purchasing'
  and public.is_purchasing_member(array['director', 'purchasing', 'marketing'])
);

insert into public.tenant_features (tenant_id, modulo_compras)
select id, true from public.tenants where slug = 'vanguardia-joyera'
on conflict (tenant_id) do update set modulo_compras = true, updated_at = now();

notify pgrst, 'reload schema';

