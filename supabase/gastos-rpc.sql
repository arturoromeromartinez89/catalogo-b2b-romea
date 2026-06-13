-- ============================================================================
-- GASTOS 2.0 — RPCs transaccionales
-- Archivo: supabase/gastos-rpc.sql
--
-- PARA CODEX: convertir a migración versionada, revisar seguridad/atomicidad,
-- aplicar y probar en staging (incluye ataques entre tenants). NO producción
-- sin aprobación. Requiere antes: supabase/gastos-vencimientos.sql.
--
-- Diseño según handoff (4.4) y respuesta de Codex:
--   · tenant y rol SIEMPRE desde la sesión (auth.uid()); nunca del payload.
--   · exige usuario/tenant activos, rol admin y tenant_features.modulo_admin.
--   · centro de costo se valida contra public.centros_costo (singular, oficial).
--   · moneda solo MXN en este bloque (todos los importes son monto_mxn).
--   · pago bloquea la cuenta FOR UPDATE, impide sobrepago, actualiza cuenta +
--     pago + gasto + movimiento bancario en UNA sola transacción.
-- ============================================================================

-- Guard de autorización del módulo admin reutilizable. Devuelve el tenant del
-- usuario si: usuario activo + rol admin del tenant + tenant activo +
-- tenant_features.modulo_admin = true. Si no, lanza excepción.
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
  if not public.is_tenant_admin() then
    raise exception 'no autorizado: requiere rol administrativo' using errcode = '42501';
  end if;
  v_tenant := public.current_tenant_id();  -- ya exige perfil activo + tenant activo
  if v_tenant is null then
    raise exception 'no autorizado: sin tenant activo' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.tenant_features tf
    where tf.tenant_id = v_tenant and tf.modulo_admin is true
  ) then
    raise exception 'el modulo administrativo no esta habilitado para este tenant' using errcode = '42501';
  end if;
  return v_tenant;
end;
$$;

revoke all on function public.require_admin_module_tenant() from public;
grant execute on function public.require_admin_module_tenant() to authenticated;

-- ── Aplicar un pago a un gasto, dentro de una transacción ya abierta ────────
-- Helper interno: NO es RPC pública. Actualiza cuenta + pago + gasto + movimiento.
create or replace function public._apply_expense_payment(
  p_tenant     uuid,
  p_gasto_id   uuid,
  p_fecha      date,
  p_monto      numeric,
  p_cuenta_id  uuid,
  p_metodo     text,
  p_referencia text,
  p_user       uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gasto   public.gastos%rowtype;
  v_cuenta  public.cuentas_caja_banco%rowtype;
  v_nuevo_pagado numeric;
  v_nuevo_saldo  numeric;
  v_nuevo_estado text;
  v_saldo_cuenta numeric;
begin
  if p_monto is null or p_monto <= 0 then
    raise exception 'el monto del pago debe ser mayor que cero';
  end if;

  -- Bloquear el gasto y la cuenta para evitar condiciones de carrera.
  select * into v_gasto from public.gastos
    where id = p_gasto_id and tenant_id = p_tenant for update;
  if v_gasto.id is null then
    raise exception 'gasto no encontrado en este tenant';
  end if;
  if v_gasto.estado = 'cancelado' then
    raise exception 'no se puede pagar un gasto cancelado';
  end if;

  select * into v_cuenta from public.cuentas_caja_banco
    where id = p_cuenta_id and tenant_id = p_tenant for update;
  if v_cuenta.id is null then
    raise exception 'cuenta no encontrada en este tenant';
  end if;
  if v_cuenta.activo is not true then
    raise exception 'la cuenta no esta activa';
  end if;
  if v_cuenta.tipo = 'plata' then
    raise exception 'los gastos se pagan desde cuentas de dinero, no de plata';
  end if;

  -- Impedir sobrepago.
  if p_monto > v_gasto.saldo_mxn + 0.005 then
    raise exception 'el pago (%.2f) excede el saldo del gasto (%.2f)', p_monto, v_gasto.saldo_mxn;
  end if;

  v_nuevo_pagado := coalesce(v_gasto.monto_pagado_mxn, 0) + p_monto;
  v_nuevo_saldo  := greatest(0, v_gasto.monto_mxn - v_nuevo_pagado);
  v_nuevo_estado := case when v_nuevo_saldo <= 0.005 then 'pagado'
                         when v_nuevo_pagado > 0 then 'parcial'
                         else 'pendiente' end;

  insert into public.pagos (tenant_id, gasto_id, fecha_pago, monto_mxn, caja_banco_id, metodo_pago, referencia, created_by)
  values (p_tenant, p_gasto_id, p_fecha, p_monto, p_cuenta_id, coalesce(p_metodo, 'transferencia'), p_referencia, p_user);

  update public.gastos
    set monto_pagado_mxn = v_nuevo_pagado,
        saldo_mxn = v_nuevo_saldo,
        estado = v_nuevo_estado,
        updated_at = now()
    where id = p_gasto_id;

  v_saldo_cuenta := coalesce(v_cuenta.saldo_actual, 0) - p_monto;
  update public.cuentas_caja_banco
    set saldo_actual = v_saldo_cuenta, updated_at = now()
    where id = p_cuenta_id;

  insert into public.movimientos_caja_banco
    (tenant_id, fecha, caja_banco_id, tipo, origen, monto, moneda, tipo_cambio, monto_mxn, saldo_resultante, referencia_id, descripcion)
  values
    (p_tenant, p_fecha, p_cuenta_id, 'salida', 'pago_gasto', p_monto, 'MXN', 1, p_monto, v_saldo_cuenta, p_gasto_id,
     left(coalesce(v_gasto.descripcion, 'Pago de gasto'), 200));
end;
$$;

revoke all on function public._apply_expense_payment(uuid, uuid, date, numeric, uuid, text, text, uuid) from public;

-- ── RPC: registrar gasto (con pago opcional en el mismo flujo) ──────────────
create or replace function public.register_expense_transaction(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.require_admin_module_tenant();
  v_user   uuid := auth.uid();
  v_gasto_id uuid;
  v_monto    numeric := round(coalesce((p_payload->>'monto_mxn')::numeric, 0), 2);
  v_fecha    date    := coalesce((p_payload->>'fecha')::date, current_date);
  v_categoria uuid   := nullif(p_payload->>'categoria_id', '')::uuid;
  v_centro   uuid    := nullif(p_payload->>'centro_costo_id', '')::uuid;
  v_pay_mode text    := coalesce(p_payload->>'payment_mode', 'pending');
  v_pay_monto numeric;
begin
  if v_monto <= 0 then
    raise exception 'el monto debe ser mayor que cero';
  end if;
  if coalesce(p_payload->>'moneda', 'MXN') <> 'MXN' then
    raise exception 'solo se admite MXN en este modulo';
  end if;
  -- Validar pertenencia al tenant de categoria y centro (centros_costo singular).
  if v_categoria is not null and not exists (
    select 1 from public.categorias_gasto c where c.id = v_categoria and c.tenant_id = v_tenant
  ) then
    raise exception 'categoria invalida para este tenant';
  end if;
  if v_centro is not null and not exists (
    select 1 from public.centros_costo cc where cc.id = v_centro and cc.tenant_id = v_tenant
  ) then
    raise exception 'centro de costo invalido para este tenant';
  end if;

  insert into public.gastos (
    tenant_id, fecha, descripcion, categoria_id, centro_costo_id, monto_mxn,
    monto_pagado_mxn, saldo_mxn, estado, tipo_gasto, beneficiario, notas,
    fecha_vencimiento, numero_documento, moneda, created_by, updated_at
  ) values (
    v_tenant, v_fecha, left(coalesce(p_payload->>'descripcion', ''), 500), v_categoria, v_centro, v_monto,
    0, v_monto, 'pendiente', coalesce(p_payload->>'tipo_gasto', 'variable'),
    left(coalesce(p_payload->>'beneficiario', ''), 200), left(coalesce(p_payload->>'notas', ''), 1000),
    nullif(p_payload->>'fecha_vencimiento', '')::date, nullif(p_payload->>'numero_documento', ''), 'MXN', v_user, now()
  ) returning id into v_gasto_id;

  -- Pago en el mismo flujo (pagado total o parcial).
  if v_pay_mode in ('paid', 'partial') then
    v_pay_monto := case when v_pay_mode = 'paid' then v_monto
                        else round(coalesce((p_payload->>'pago_monto')::numeric, 0), 2) end;
    perform public._apply_expense_payment(
      v_tenant, v_gasto_id, coalesce((p_payload->>'pago_fecha')::date, v_fecha),
      v_pay_monto, nullif(p_payload->>'pago_cuenta_id', '')::uuid,
      coalesce(p_payload->>'pago_metodo', 'transferencia'),
      nullif(p_payload->>'pago_referencia', ''), v_user
    );
  end if;

  return (
    select to_jsonb(g) from (
      select gg.*, (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.pagos p where p.gasto_id = gg.id) as pagos
      from public.gastos gg where gg.id = v_gasto_id
    ) g
  );
end;
$$;

revoke all on function public.register_expense_transaction(jsonb) from public;
grant execute on function public.register_expense_transaction(jsonb) to authenticated;

-- ── RPC: registrar un pago/abono a un gasto existente ───────────────────────
create or replace function public.register_expense_payment_transaction(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := public.require_admin_module_tenant();
  v_user   uuid := auth.uid();
  v_gasto_id uuid := nullif(p_payload->>'gasto_id', '')::uuid;
begin
  if v_gasto_id is null then
    raise exception 'gasto_id requerido';
  end if;
  perform public._apply_expense_payment(
    v_tenant, v_gasto_id, coalesce((p_payload->>'pago_fecha')::date, current_date),
    round(coalesce((p_payload->>'pago_monto')::numeric, 0), 2),
    nullif(p_payload->>'pago_cuenta_id', '')::uuid,
    coalesce(p_payload->>'pago_metodo', 'transferencia'),
    nullif(p_payload->>'pago_referencia', ''), v_user
  );
  return (
    select to_jsonb(g) from (
      select gg.*, (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from public.pagos p where p.gasto_id = gg.id) as pagos
      from public.gastos gg where gg.id = v_gasto_id
    ) g
  );
end;
$$;

revoke all on function public.register_expense_payment_transaction(jsonb) from public;
grant execute on function public.register_expense_payment_transaction(jsonb) to authenticated;
