-- Production-safe schema smoke test. It always rolls back its test rows.

begin;

do $$
declare
  v_tenant constant uuid := '3b5a512d-c7e8-4700-87a9-78cfd4d63d18';
  v_remision uuid;
  v_client uuid;
  v_advance uuid;
  v_sale_payment uuid;
begin
  select r.id, r.client_id
  into v_remision, v_client
  from public.remisiones r
  where r.tenant_id = v_tenant
  order by r.created_at desc
  limit 1;

  if v_remision is null then
    raise exception 'SMOKE TEST BLOCKED: Romea has no remision available';
  end if;

  insert into public.cobros (
    tenant_id, remision_id, client_id, fecha_cobro, tipo_abono,
    abono_labor_mxn, abono_plata_gramos, abono_usd, medio_pago,
    monto_recibido, moneda_recibida, tipo_cambio, monto_mxn_equivalente,
    ganancia_cambiaria_mxn, notas
  ) values (
    v_tenant, null, v_client, current_date, 'total_usd',
    0, 0, 1000, 'efectivo_mxn',
    1000, 'USD', 17, 17000,
    0, 'CODEX_ADVANCE_SCHEMA_SMOKE'
  ) returning id into v_advance;

  if not exists (
    select 1 from public.cobros c
    where c.id = v_advance
      and c.remision_id is null
      and c.abono_usd = 1000
  ) then
    raise exception 'FAILED: advance insert was not preserved correctly';
  end if;

  insert into public.cobros (
    tenant_id, remision_id, client_id, fecha_cobro, tipo_abono,
    abono_labor_mxn, abono_plata_gramos, abono_usd, medio_pago,
    monto_recibido, moneda_recibida, tipo_cambio, monto_mxn_equivalente,
    ganancia_cambiaria_mxn, notas
  ) values (
    v_tenant, v_remision, v_client, current_date, 'total_usd',
    0, 0, 1, 'transferencia_usd',
    1, 'USD', 17, 17,
    0, 'CODEX_SALE_PAYMENT_SCHEMA_SMOKE'
  ) returning id into v_sale_payment;

  if not exists (
    select 1 from public.cobros c
    where c.id = v_sale_payment
      and c.remision_id = v_remision
  ) then
    raise exception 'FAILED: sale-linked payment insert was not preserved correctly';
  end if;
end
$$;

rollback;
