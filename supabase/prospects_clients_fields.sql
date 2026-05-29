-- Campos necesarios para separar Clientes y Prospectos en la misma tabla.
-- Se puede ejecutar varias veces: IF NOT EXISTS evita duplicados.

alter table public.clients
  add column if not exists type text not null default 'cliente';

alter table public.clients
  add column if not exists ciudad text;

alter table public.clients
  add column if not exists comentarios text;

update public.clients
set type = 'cliente'
where type is null or trim(type) = '';

create index if not exists clients_tenant_type_idx
  on public.clients (tenant_id, type);
