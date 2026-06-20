-- Server-owned, tenant-scoped expense registration and payment transactions.
-- Requires 20260614010000_add_expense_due_fields.sql.

create or replace function public.require_admin_module_tenant()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  if auth.uid() is null or not public.is_tenant_admin() then
    raise exception 'no autorizado: requiere un administrador activo'
      using errcode = '42501';
  end if;

  v_tenant := public.current_tenant_id();
  if v_tenant is null then
    raise exception 'no autorizado: usuario o empresa suspendida'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.tenant_features tf
    where tf.tenant_id = v_tenant
      and tf.modulo_admin is true
  ) then
    raise exception 'el modulo administrativo no esta habilitado para esta empresa'
      using errcode = '42501';
  end if;

  return v_tenant;
end;
$$;
revoke all on function public.require_admin_module_tenant() from public, anon, authenticated;
create or replace function public._apply_expense_payment(
  p_tenant uuid,
  p_gasto_id uuid,
  p_fecha date,
  p_monto numeric,
  p_cuenta_id uuid,
  p_metodo text,
  p_referencia text,
  p_user uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gasto public.gastos%rowtype;
  v_cuenta public.cuentas_caja_banco%rowtype;
  v_nuevo_pagado numeric;
  v_nuevo_saldo numeric;
  v_nuevo_estado text;
  v_saldo_cuenta numeric;
begin
  if p_tenant is null or p_user is null then
    raise exception 'sesion invalida' using errcode = '42501';
  end if;
  if p_fecha is null then
    raise exception 'fecha de pago requerida';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'el monto del pago debe ser mayor que cero';
  end if;
  if p_cuenta_id is null then
    raise exception 'cuenta de pago requerida';
  end if;
  if coalesce(p_metodo, '') not in ('transferencia', 'efectivo', 'tarjeta', 'mercado_pago', 'otro') then
    raise exception 'metodo de pago invalido';
  end if;

  select *
  into v_gasto
  from public.gastos
  where id = p_gasto_id
    and tenant_id = p_tenant
  for update;

  if v_gasto.id is null then
    raise exception 'gasto no encontrado en esta empresa';
  end if;
  if v_gasto.estado = 'cancelado' then
    raise exception 'no se puede pagar un gasto cancelado';
  end if;

  select *
  into v_cuenta
  from public.cuentas_caja_banco
  where id = p_cuenta_id
    and tenant_id = p_tenant
  for update;

  if v_cuenta.id is null then
    raise exception 'cuenta no encontrada en esta empresa';
  end if;
  if v_cuenta.activo is not true then
    raise exception 'la cuenta no esta activa';
  end if;
  if v_cuenta.tipo = 'plata' or v_cuenta.moneda <> 'MXN' then
    raise exception 'el gasto requiere una cuenta monetaria en MXN';
  end if;
  if p_monto > coalesce(v_gasto.saldo_mxn, 0) + 0.005 then
    raise exception 'el pago excede el saldo pendiente';
  end if;

  v_nuevo_pagado := coalesce(v_gasto.monto_pagado_mxn, 0) + p_monto;
  v_nuevo_saldo := greatest(0, v_gasto.monto_mxn - v_nuevo_pagado);
  v_nuevo_estado := case
    when v_nuevo_saldo <= 0.005 then 'pagado'
    when v_nuevo_pagado > 0 then 'parcial'
    else 'pendiente'
  end;

  insert into public.pagos (
    tenant_id, gasto_id, fecha_pago, monto_mxn, caja_banco_id,
    metodo_pago, referencia, created_by
  ) values (
    p_tenant, p_gasto_id, p_fecha, p_monto, p_cuenta_id,
    p_metodo, nullif(left(coalesce(p_referencia, ''), 200), ''), p_user
  );

  update public.gastos
  set monto_pagado_mxn = v_nuevo_pagado,
      saldo_mxn = v_nuevo_saldo,
      estado = v_nuevo_estado,
      updated_at = now()
  where id = p_gasto_id
    and tenant_id = p_tenant;

  v_saldo_cuenta := coalesce(v_cuenta.saldo_actual, 0) - p_monto;

  update public.cuentas_caja_banco
  set saldo_actual = v_saldo_cuenta,
      updated_at = now()
  where id = p_cuenta_id
    and tenant_id = p_tenant;

  insert into public.movimientos_caja_banco (
    tenant_id, fecha, caja_banco_id, tipo, origen, monto, moneda,
    tipo_cambio, monto_mxn, saldo_resultante, referencia_id, descripcion
  ) values (
    p_tenant, p_fecha, p_cuenta_id, 'salida', 'pago_gasto', p_monto, 'MXN',
    1, p_monto, v_saldo_cuenta, p_gasto_id,
    left(coalesce(v_gasto.descripcion, 'Pago de gasto'), 200)
  );
end;
$$;
revoke all on function public._apply_expense_payment(uuid, uuid, date, numeric, uuid, text, text, uuid)
  from public, anon, authenticated;
create or replace function public.register_expense_transaction(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.require_admin_module_tenant();
  v_user uuid := auth.uid();
  v_gasto_id uuid := nullif(p_payload->>'gasto_id', '')::uuid;
  v_existing public.gastos%rowtype;
  v_descripcion text := btrim(coalesce(p_payload->>'descripcion', ''));
  v_monto numeric := round(coalesce((p_payload->>'monto_mxn')::numeric, 0), 2);
  v_fecha date := coalesce(nullif(p_payload->>'fecha', '')::date, current_date);
  v_categoria uuid := nullif(p_payload->>'categoria_id', '')::uuid;
  v_centro uuid := nullif(p_payload->>'centro_costo_id', '')::uuid;
  v_tipo text := coalesce(p_payload->>'tipo_gasto', 'variable');
  v_pay_mode text := coalesce(p_payload->>'payment_mode', 'pending');
  v_pay_monto numeric;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload invalido';
  end if;
  if v_descripcion = '' then
    raise exception 'descripcion requerida';
  end if;
  if v_monto <= 0 then
    raise exception 'el monto debe ser mayor que cero';
  end if;
  if coalesce(p_payload->>'moneda', 'MXN') <> 'MXN' then
    raise exception 'solo se admite MXN en este modulo';
  end if;
  if v_tipo not in ('fijo', 'variable') then
    raise exception 'tipo de gasto invalido';
  end if;
  if v_pay_mode not in ('pending', 'paid', 'partial') then
    raise exception 'modalidad de pago invalida';
  end if;

  if v_categoria is not null and not exists (
    select 1
    from public.categorias_gasto c
    where c.id = v_categoria
      and c.tenant_id = v_tenant
      and c.activo is true
  ) then
    raise exception 'categoria invalida para esta empresa';
  end if;

  if v_centro is not null and not exists (
    select 1
    from public.centros_costo cc
    where cc.id = v_centro
      and cc.tenant_id = v_tenant
      and cc.activo is true
  ) then
    raise exception 'centro de costo invalido para esta empresa';
  end if;

  if v_gasto_id is not null then
    if v_pay_mode <> 'pending' then
      raise exception 'los pagos de un gasto existente usan la operacion de pago';
    end if;

    select *
    into v_existing
    from public.gastos
    where id = v_gasto_id
      and tenant_id = v_tenant
    for update;

    if v_existing.id is null then
      raise exception 'gasto no encontrado en esta empresa';
    end if;
    if v_existing.estado = 'cancelado' then
      raise exception 'no se puede editar un gasto cancelado';
    end if;
    if v_monto + 0.005 < coalesce(v_existing.monto_pagado_mxn, 0) then
      raise exception 'el monto no puede ser menor que lo ya pagado';
    end if;

    update public.gastos
    set fecha = v_fecha,
        descripcion = left(v_descripcion, 500),
        categoria_id = v_categoria,
        centro_costo_id = v_centro,
        monto_mxn = v_monto,
        saldo_mxn = greatest(0, v_monto - coalesce(v_existing.monto_pagado_mxn, 0)),
        estado = case
          when v_monto - coalesce(v_existing.monto_pagado_mxn, 0) <= 0.005 then 'pagado'
          when coalesce(v_existing.monto_pagado_mxn, 0) > 0 then 'parcial'
          else 'pendiente'
        end,
        tipo_gasto = v_tipo,
        beneficiario = nullif(left(btrim(coalesce(p_payload->>'beneficiario', '')), 200), ''),
        notas = nullif(left(btrim(coalesce(p_payload->>'notas', '')), 1000), ''),
        fecha_vencimiento = nullif(p_payload->>'fecha_vencimiento', '')::date,
        numero_documento = nullif(left(btrim(coalesce(p_payload->>'numero_documento', '')), 200), ''),
        moneda = 'MXN',
        updated_at = now()
    where id = v_gasto_id
      and tenant_id = v_tenant;
  else
    insert into public.gastos (
      tenant_id, fecha, descripcion, categoria_id, centro_costo_id, monto_mxn,
      monto_pagado_mxn, saldo_mxn, estado, tipo_gasto, beneficiario, notas,
      fecha_vencimiento, numero_documento, moneda, created_by, updated_at
    ) values (
      v_tenant, v_fecha, left(v_descripcion, 500), v_categoria, v_centro, v_monto,
      0, v_monto, 'pendiente', v_tipo,
      nullif(left(btrim(coalesce(p_payload->>'beneficiario', '')), 200), ''),
      nullif(left(btrim(coalesce(p_payload->>'notas', '')), 1000), ''),
      nullif(p_payload->>'fecha_vencimiento', '')::date,
      nullif(left(btrim(coalesce(p_payload->>'numero_documento', '')), 200), ''),
      'MXN', v_user, now()
    ) returning id into v_gasto_id;

    if v_pay_mode in ('paid', 'partial') then
      v_pay_monto := case
        when v_pay_mode = 'paid' then v_monto
        else round(coalesce((p_payload->>'pago_monto')::numeric, 0), 2)
      end;

      perform public._apply_expense_payment(
        v_tenant,
        v_gasto_id,
        coalesce(nullif(p_payload->>'pago_fecha', '')::date, v_fecha),
        v_pay_monto,
        nullif(p_payload->>'pago_cuenta_id', '')::uuid,
        coalesce(p_payload->>'pago_metodo', 'transferencia'),
        nullif(p_payload->>'pago_referencia', ''),
        v_user
      );
    end if;
  end if;

  return (
    select to_jsonb(result_row)
    from (
      select g.*,
        (
          select coalesce(jsonb_agg(to_jsonb(p) order by p.fecha_pago, p.created_at), '[]'::jsonb)
          from public.pagos p
          where p.gasto_id = g.id
            and p.tenant_id = v_tenant
        ) as pagos
      from public.gastos g
      where g.id = v_gasto_id
        and g.tenant_id = v_tenant
    ) result_row
  );
end;
$$;
revoke all on function public.register_expense_transaction(jsonb) from public, anon;
grant execute on function public.register_expense_transaction(jsonb) to authenticated;
create or replace function public.register_expense_payment_transaction(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.require_admin_module_tenant();
  v_user uuid := auth.uid();
  v_gasto_id uuid := nullif(p_payload->>'gasto_id', '')::uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload invalido';
  end if;
  if v_gasto_id is null then
    raise exception 'gasto_id requerido';
  end if;

  perform public._apply_expense_payment(
    v_tenant,
    v_gasto_id,
    coalesce(nullif(p_payload->>'pago_fecha', '')::date, current_date),
    round(coalesce((p_payload->>'pago_monto')::numeric, 0), 2),
    nullif(p_payload->>'pago_cuenta_id', '')::uuid,
    coalesce(p_payload->>'pago_metodo', 'transferencia'),
    nullif(p_payload->>'pago_referencia', ''),
    v_user
  );

  return (
    select to_jsonb(result_row)
    from (
      select g.*,
        (
          select coalesce(jsonb_agg(to_jsonb(p) order by p.fecha_pago, p.created_at), '[]'::jsonb)
          from public.pagos p
          where p.gasto_id = g.id
            and p.tenant_id = v_tenant
        ) as pagos
      from public.gastos g
      where g.id = v_gasto_id
        and g.tenant_id = v_tenant
    ) result_row
  );
end;
$$;
revoke all on function public.register_expense_payment_transaction(jsonb) from public, anon;
grant execute on function public.register_expense_payment_transaction(jsonb) to authenticated;
