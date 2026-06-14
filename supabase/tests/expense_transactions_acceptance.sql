-- Gastos 2.0 acceptance test. All fixtures and mutations roll back.

begin;

-- Management API queries may carry an operator JWT. Fixture setup must run as
-- a trusted migration operation, not as that application user.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
alter table public.profiles disable trigger protect_profile_privileged_fields;

insert into public.tenants (id, name, slug, status)
values
  ('41000000-0000-4000-8000-000000000001', 'Expense Tenant A', 'expense-a', 'active'),
  ('42000000-0000-4000-8000-000000000002', 'Expense Tenant B', 'expense-b', 'active');

insert into auth.users (id, email)
values
  ('4a000000-0000-4000-8000-000000000001', 'expense-admin-a@example.test'),
  ('4b000000-0000-4000-8000-000000000002', 'expense-admin-b@example.test'),
  ('4c000000-0000-4000-8000-000000000003', 'expense-client-a@example.test');

insert into public.profiles (id, email, role, tenant_id, active)
values
  ('4a000000-0000-4000-8000-000000000001', 'expense-admin-a@example.test', 'tenant_admin', '41000000-0000-4000-8000-000000000001', true),
  ('4b000000-0000-4000-8000-000000000002', 'expense-admin-b@example.test', 'tenant_admin', '42000000-0000-4000-8000-000000000002', true),
  ('4c000000-0000-4000-8000-000000000003', 'expense-client-a@example.test', 'client', '41000000-0000-4000-8000-000000000001', true)
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role,
  tenant_id = excluded.tenant_id,
  active = excluded.active;

insert into public.tenant_features (tenant_id, modulo_admin)
values
  ('41000000-0000-4000-8000-000000000001', true),
  ('42000000-0000-4000-8000-000000000002', false)
on conflict (tenant_id) do update set modulo_admin = excluded.modulo_admin;

insert into public.categorias_gasto (id, tenant_id, nombre, activo, orden)
values
  ('4a100000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'Category A', true, 1),
  ('4b100000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000002', 'Category B', true, 1);

insert into public.centros_costo (id, tenant_id, nombre, activo, orden)
values
  ('4a200000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'Center A', true, 1),
  ('4b200000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000002', 'Center B', true, 1);

insert into public.cuentas_caja_banco (
  id, tenant_id, nombre, tipo, moneda, saldo_inicial, saldo_actual,
  gramos_iniciales, gramos_actuales, activo, orden
) values
  ('4a300000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'Bank A', 'banco', 'MXN', 1000, 1000, 0, 0, true, 1),
  ('4b300000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000002', 'Bank B', 'banco', 'MXN', 500, 500, 0, 0, true, 1);

alter table public.profiles enable trigger protect_profile_privileged_fields;

create or replace function public.test_reject_expense_movement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.descripcion = 'FORCE_ROLLBACK' then
    raise exception 'forced movement failure';
  end if;
  return new;
end;
$$;

create trigger test_reject_expense_movement
before insert on public.movimientos_caja_banco
for each row execute function public.test_reject_expense_movement();

select set_config('request.jwt.claim.sub', '4a000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"4a000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  result jsonb;
  expense_id uuid;
  account_balance numeric;
  blocked boolean;
  before_payments integer;
  before_movements integer;
begin
  if has_function_privilege('authenticated', 'public.require_admin_module_tenant()', 'execute') then
    raise exception 'FAILED: internal authorization helper is executable directly';
  end if;
  if has_function_privilege('anon', 'public.register_expense_transaction(jsonb)', 'execute') then
    raise exception 'FAILED: anonymous role can execute expense registration';
  end if;

  result := public.register_expense_transaction(jsonb_build_object(
    'descripcion', 'Pending expense',
    'monto_mxn', 120,
    'fecha', current_date,
    'fecha_vencimiento', current_date + 7,
    'numero_documento', 'DOC-1',
    'categoria_id', '4a100000-0000-4000-8000-000000000001',
    'centro_costo_id', '4a200000-0000-4000-8000-000000000001',
    'payment_mode', 'pending',
    'moneda', 'MXN'
  ));
  expense_id := (result->>'id')::uuid;
  perform set_config('test.pending_expense_id', expense_id::text, true);
  if result->>'estado' <> 'pendiente' or (result->>'saldo_mxn')::numeric <> 120 then
    raise exception 'FAILED: pending expense totals are wrong';
  end if;

  result := public.register_expense_transaction(jsonb_build_object(
    'descripcion', 'Paid expense',
    'monto_mxn', 100,
    'fecha', current_date,
    'payment_mode', 'paid',
    'pago_cuenta_id', '4a300000-0000-4000-8000-000000000001',
    'pago_metodo', 'transferencia',
    'moneda', 'MXN'
  ));
  if result->>'estado' <> 'pagado' or jsonb_array_length(result->'pagos') <> 1 then
    raise exception 'FAILED: paid expense was not completed atomically';
  end if;
  select saldo_actual into account_balance
  from public.cuentas_caja_banco
  where id = '4a300000-0000-4000-8000-000000000001';
  if account_balance <> 900 then raise exception 'FAILED: paid expense account balance is %', account_balance; end if;

  result := public.register_expense_transaction(jsonb_build_object(
    'descripcion', 'Partial expense',
    'monto_mxn', 200,
    'fecha', current_date,
    'payment_mode', 'partial',
    'pago_monto', 50,
    'pago_cuenta_id', '4a300000-0000-4000-8000-000000000001',
    'pago_metodo', 'efectivo',
    'moneda', 'MXN'
  ));
  expense_id := (result->>'id')::uuid;
  perform set_config('test.partial_expense_id', expense_id::text, true);
  if result->>'estado' <> 'parcial' or (result->>'saldo_mxn')::numeric <> 150 then
    raise exception 'FAILED: partial expense totals are wrong';
  end if;

  result := public.register_expense_payment_transaction(jsonb_build_object(
    'gasto_id', expense_id,
    'pago_monto', 100,
    'pago_cuenta_id', '4a300000-0000-4000-8000-000000000001',
    'pago_metodo', 'transferencia'
  ));
  if result->>'estado' <> 'parcial' or (result->>'saldo_mxn')::numeric <> 50 then
    raise exception 'FAILED: second partial payment totals are wrong';
  end if;

  blocked := false;
  begin
    perform public.register_expense_payment_transaction(jsonb_build_object(
      'gasto_id', expense_id,
      'pago_monto', 51,
      'pago_cuenta_id', '4a300000-0000-4000-8000-000000000001',
      'pago_metodo', 'transferencia'
    ));
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAILED: overpayment was accepted'; end if;

  blocked := false;
  begin
    perform public.register_expense_transaction(jsonb_build_object(
      'descripcion', 'Cross category', 'monto_mxn', 10,
      'categoria_id', '4b100000-0000-4000-8000-000000000002',
      'payment_mode', 'pending'
    ));
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAILED: cross-tenant category was accepted'; end if;

  blocked := false;
  begin
    perform public.register_expense_transaction(jsonb_build_object(
      'descripcion', 'Cross center', 'monto_mxn', 10,
      'centro_costo_id', '4b200000-0000-4000-8000-000000000002',
      'payment_mode', 'pending'
    ));
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAILED: cross-tenant center was accepted'; end if;

  blocked := false;
  begin
    perform public.register_expense_transaction(jsonb_build_object(
      'descripcion', 'Cross account', 'monto_mxn', 10,
      'payment_mode', 'paid',
      'pago_cuenta_id', '4b300000-0000-4000-8000-000000000002',
      'pago_metodo', 'transferencia'
    ));
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAILED: cross-tenant account was accepted'; end if;

  select count(*) into before_payments from public.pagos
  where tenant_id = '41000000-0000-4000-8000-000000000001';
  select count(*) into before_movements from public.movimientos_caja_banco
  where tenant_id = '41000000-0000-4000-8000-000000000001';
  select saldo_actual into account_balance from public.cuentas_caja_banco
  where id = '4a300000-0000-4000-8000-000000000001';

  blocked := false;
  begin
    perform public.register_expense_transaction(jsonb_build_object(
      'descripcion', 'FORCE_ROLLBACK', 'monto_mxn', 25,
      'payment_mode', 'paid',
      'pago_cuenta_id', '4a300000-0000-4000-8000-000000000001',
      'pago_metodo', 'transferencia'
    ));
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAILED: forced movement failure did not abort'; end if;
  if exists (select 1 from public.gastos where descripcion = 'FORCE_ROLLBACK') then
    raise exception 'FAILED: expense remained after rollback';
  end if;
  if (select count(*) from public.pagos where tenant_id = '41000000-0000-4000-8000-000000000001') <> before_payments then
    raise exception 'FAILED: payment remained after rollback';
  end if;
  if (select count(*) from public.movimientos_caja_banco where tenant_id = '41000000-0000-4000-8000-000000000001') <> before_movements then
    raise exception 'FAILED: movement remained after rollback';
  end if;
  if (select saldo_actual from public.cuentas_caja_banco where id = '4a300000-0000-4000-8000-000000000001') <> account_balance then
    raise exception 'FAILED: account balance changed after rollback';
  end if;

  result := public.register_expense_transaction(jsonb_build_object(
    'gasto_id', current_setting('test.pending_expense_id'),
    'descripcion', 'Pending expense edited',
    'monto_mxn', 140,
    'fecha', current_date,
    'payment_mode', 'pending',
    'moneda', 'MXN'
  ));
  if result->>'descripcion' <> 'Pending expense edited' or (result->>'saldo_mxn')::numeric <> 140 then
    raise exception 'FAILED: expense edit did not update the existing row';
  end if;
  if (select count(*) from public.gastos where id = current_setting('test.pending_expense_id')::uuid) <> 1 then
    raise exception 'FAILED: expense edit created a duplicate';
  end if;
end
$$;

-- Tenant A cannot pay an expense owned by tenant B.
reset role;
insert into public.gastos (
  id, tenant_id, fecha, descripcion, monto_mxn, monto_pagado_mxn,
  saldo_mxn, estado, tipo_gasto, moneda
) values (
  '4b400000-0000-4000-8000-000000000002',
  '42000000-0000-4000-8000-000000000002',
  current_date, 'Tenant B expense', 50, 0, 50, 'pendiente', 'variable', 'MXN'
);
set local role authenticated;

do $$
declare blocked boolean := false;
begin
  begin
    perform public.register_expense_payment_transaction(jsonb_build_object(
      'gasto_id', '4b400000-0000-4000-8000-000000000002',
      'pago_monto', 10,
      'pago_cuenta_id', '4a300000-0000-4000-8000-000000000001',
      'pago_metodo', 'transferencia'
    ));
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAILED: cross-tenant expense payment was accepted'; end if;
end
$$;

-- A client cannot invoke administrative expense operations.
reset role;
select set_config('request.jwt.claim.sub', '4c000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"4c000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
set local role authenticated;

do $$
declare blocked boolean := false;
begin
  begin
    perform public.register_expense_transaction('{"descripcion":"Client attack","monto_mxn":1}'::jsonb);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAILED: client registered an expense'; end if;
end
$$;

-- A tenant without the feature flag cannot use the RPC.
reset role;
select set_config('request.jwt.claim.sub', '4b000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"4b000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
declare blocked boolean := false;
begin
  begin
    perform public.register_expense_transaction('{"descripcion":"Disabled module","monto_mxn":1}'::jsonb);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAILED: disabled tenant used Gastos 2.0'; end if;
end
$$;

-- Suspended administrators and tenants fail closed.
reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
update public.profiles set active = false
where id = '4a000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub', '4a000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"4a000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare blocked boolean := false;
begin
  begin
    perform public.register_expense_transaction('{"descripcion":"Suspended user","monto_mxn":1}'::jsonb);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAILED: suspended admin registered an expense'; end if;
end
$$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}', true);
update public.profiles set active = true
where id = '4a000000-0000-4000-8000-000000000001';
update public.tenants set status = 'suspended'
where id = '41000000-0000-4000-8000-000000000001';
set local role authenticated;

do $$
declare blocked boolean := false;
begin
  begin
    perform public.register_expense_transaction('{"descripcion":"Suspended tenant","monto_mxn":1}'::jsonb);
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'FAILED: suspended tenant registered an expense'; end if;
end
$$;

rollback;
