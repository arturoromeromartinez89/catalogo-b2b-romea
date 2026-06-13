-- Add the minimum payable metadata required by Gastos 2.0.

alter table public.gastos
  add column if not exists fecha_vencimiento date,
  add column if not exists numero_documento text,
  add column if not exists moneda text not null default 'MXN';

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.gastos'::regclass
      and c.conname = 'gastos_moneda_mxn_chk'
  ) then
    alter table public.gastos
      add constraint gastos_moneda_mxn_chk check (moneda = 'MXN');
  end if;
end
$$;

create index if not exists idx_gastos_tenant_venc
  on public.gastos(tenant_id, fecha_vencimiento);

create index if not exists idx_gastos_tenant_estado
  on public.gastos(tenant_id, estado);
