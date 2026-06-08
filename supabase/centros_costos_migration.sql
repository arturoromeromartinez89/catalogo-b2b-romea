-- ============================================================
-- Migración: centros_costos
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Tabla principal
create table if not exists public.centros_costos (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  nombre      text not null,
  codigo      text,
  tipo        text not null check (tipo in ('operativo','administrativo','produccion','ventas')),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. Índice
create index if not exists centros_costos_tenant_idx on public.centros_costos(tenant_id);

-- 3. Updated-at trigger (reutiliza la función si ya existe en el proyecto)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists centros_costos_updated_at on public.centros_costos;
create trigger centros_costos_updated_at
  before update on public.centros_costos
  for each row execute function public.set_updated_at();

-- 4. RLS
alter table public.centros_costos enable row level security;

-- Lectura: miembros del tenant o superadmin
create policy "centros_costos_select"
  on public.centros_costos for select
  using (
    public.is_superadmin()
    or tenant_id = public.current_tenant_id()
  );

-- Insertar / actualizar / borrar: admins del tenant o superadmin
create policy "centros_costos_insert"
  on public.centros_costos for insert
  with check (
    public.is_superadmin()
    or (tenant_id = public.current_tenant_id() and public.is_tenant_admin())
  );

create policy "centros_costos_update"
  on public.centros_costos for update
  using (
    public.is_superadmin()
    or (tenant_id = public.current_tenant_id() and public.is_tenant_admin())
  );

create policy "centros_costos_delete"
  on public.centros_costos for delete
  using (
    public.is_superadmin()
    or (tenant_id = public.current_tenant_id() and public.is_tenant_admin())
  );

-- 5. Actualizar constraint de estado en remisiones (si la tabla ya existe)
--    Cambia de estados de pago a estados de entrega
alter table public.remisiones
  drop constraint if exists remisiones_estado_check;

alter table public.remisiones
  add constraint remisiones_estado_check
  check (estado in ('borrador', 'emitida', 'entregada', 'cancelada'));

-- Migrar registros existentes con estados obsoletos
update public.remisiones set estado = 'entregada' where estado = 'cobrada';
update public.remisiones set estado = 'entregada' where estado = 'parcial';
