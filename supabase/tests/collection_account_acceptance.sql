-- Acceptance test for mandatory collection destination accounts.
-- Runs entirely inside a transaction and leaves no financial records.

begin;

do $$
declare
  v_tenant constant uuid := '4c5a0000-0000-4000-8000-000000000001';
  v_client uuid;
  v_mxn_account uuid;
  v_usd_account uuid;
  v_silver_account uuid;
  v_other_tenant constant uuid := '4c5a0000-0000-4000-8000-000000000002';
  v_other_account uuid;
  v_collection uuid;
begin
  insert into public.tenants (id, name, slug)
  values (v_tenant, 'CODEX COLLECTION TEST', 'codex-collection-account-test');

  insert into public.clients (tenant_id, name, email)
  values (v_tenant, 'CODEX TEST CLIENT', 'codex-collection-account-test@example.com')
  returning id into v_client;

  insert into public.cuentas_caja_banco (tenant_id, nombre, tipo, moneda, orden)
  values (v_tenant, 'CODEX MXN TEST ACCOUNT', 'efectivo', 'MXN', 1)
  returning id into v_mxn_account;

  insert into public.cuentas_caja_banco (tenant_id, nombre, tipo, moneda, orden)
  values (v_tenant, 'CODEX USD TEST ACCOUNT', 'banco', 'USD', 2)
  returning id into v_usd_account;

  insert into public.cuentas_caja_banco (tenant_id, nombre, tipo, moneda, orden)
  values (v_tenant, 'CODEX SILVER TEST ACCOUNT', 'plata', 'GRM', 3)
  returning id into v_silver_account;

  insert into public.tenants (id, name, slug)
  values (v_other_tenant, 'CODEX OTHER TENANT TEST', 'codex-other-tenant-account-test');

  insert into public.cuentas_caja_banco (tenant_id, nombre, tipo, moneda, orden)
  values (v_other_tenant, 'CODEX OTHER TENANT ACCOUNT', 'efectivo', 'MXN', 999)
  returning id into v_other_account;

  begin
    insert into public.cobros (
      tenant_id, client_id, fecha_cobro, tipo_abono, abono_labor_mxn,
      medio_pago, monto_recibido, moneda_recibida, monto_mxn_equivalente
    ) values (
      v_tenant, v_client, current_date, 'labor_mxn', 100,
      'efectivo_mxn', 100, 'MXN', 100
    );
    raise exception 'FAILED: a collection without an account was accepted';
  exception
    when others then
      if sqlerrm = 'FAILED: a collection without an account was accepted' then raise; end if;
      if position('Selecciona una caja o cuenta real' in sqlerrm) = 0 then
        raise exception 'FAILED: unexpected missing-account error: %', sqlerrm;
      end if;
  end;

  begin
    insert into public.cobros (
      tenant_id, client_id, fecha_cobro, tipo_abono, abono_labor_mxn,
      medio_pago, monto_recibido, moneda_recibida, monto_mxn_equivalente,
      caja_banco_id
    ) values (
      v_tenant, v_client, current_date, 'labor_mxn', 100,
      'efectivo_mxn', 100, 'MXN', 100, v_other_account
    );
    raise exception 'FAILED: an account from another tenant was accepted';
  exception
    when others then
      if sqlerrm = 'FAILED: an account from another tenant was accepted' then raise; end if;
      if position('no existe, esta inactiva o pertenece a otra empresa' in sqlerrm) = 0 then
        raise exception 'FAILED: unexpected cross-tenant error: %', sqlerrm;
      end if;
  end;

  begin
    insert into public.cobros (
      tenant_id, client_id, fecha_cobro, tipo_abono, abono_plata_gramos,
      medio_pago, gramos_recibidos, cuenta_plata_id
    ) values (
      v_tenant, v_client, current_date, 'plata_gramos', 10,
      'plata_fisica', 10, v_mxn_account
    );
    raise exception 'FAILED: a money account was accepted as a silver account';
  exception
    when others then
      if sqlerrm = 'FAILED: a money account was accepted as a silver account' then raise; end if;
      if position('no es una caja de plata' in sqlerrm) = 0 then
        raise exception 'FAILED: unexpected incompatible-account error: %', sqlerrm;
      end if;
  end;

  update public.cuentas_caja_banco set activo = false where id = v_mxn_account;
  begin
    insert into public.cobros (
      tenant_id, client_id, fecha_cobro, tipo_abono, abono_labor_mxn,
      medio_pago, monto_recibido, moneda_recibida, monto_mxn_equivalente,
      caja_banco_id
    ) values (
      v_tenant, v_client, current_date, 'labor_mxn', 100,
      'efectivo_mxn', 100, 'MXN', 100, v_mxn_account
    );
    raise exception 'FAILED: an inactive account was accepted';
  exception
    when others then
      if sqlerrm = 'FAILED: an inactive account was accepted' then raise; end if;
      if position('no existe, esta inactiva o pertenece a otra empresa' in sqlerrm) = 0 then
        raise exception 'FAILED: unexpected inactive-account error: %', sqlerrm;
      end if;
  end;
  update public.cuentas_caja_banco set activo = true where id = v_mxn_account;

  insert into public.cobros (
    tenant_id, client_id, fecha_cobro, tipo_abono, abono_labor_mxn,
    medio_pago, monto_recibido, moneda_recibida, monto_mxn_equivalente,
    caja_banco_id, notas
  ) values (
    v_tenant, v_client, current_date, 'labor_mxn', 100,
    'efectivo_mxn', 100, 'MXN', 100,
    v_mxn_account, 'CODEX_VALID_MXN_ACCOUNT_TEST'
  ) returning id into v_collection;

  if not exists (
    select 1 from public.cobros
    where id = v_collection and caja_banco_id = v_mxn_account and cuenta_plata_id is null
  ) then
    raise exception 'FAILED: valid MXN collection did not retain its account';
  end if;

  insert into public.cobros (
    tenant_id, client_id, fecha_cobro, tipo_abono, abono_usd,
    medio_pago, monto_recibido, moneda_recibida, tipo_cambio,
    monto_mxn_equivalente, caja_banco_id, notas
  ) values (
    v_tenant, v_client, current_date, 'total_usd', 100,
    'transferencia_usd', 100, 'USD', 17,
    1700, v_usd_account, 'CODEX_VALID_USD_ACCOUNT_TEST'
  ) returning id into v_collection;

  if not exists (
    select 1 from public.cobros
    where id = v_collection and caja_banco_id = v_usd_account
      and moneda_recibida = 'USD'
  ) then
    raise exception 'FAILED: valid USD collection did not retain its account';
  end if;

  insert into public.cobros (
    tenant_id, client_id, fecha_cobro, tipo_abono, abono_plata_gramos,
    medio_pago, monto_recibido, moneda_recibida, gramos_recibidos,
    cuenta_plata_id, notas
  ) values (
    v_tenant, v_client, current_date, 'plata_gramos', 10,
    'plata_fisica', null, null, 10,
    v_silver_account, 'CODEX_VALID_SILVER_ACCOUNT_TEST'
  ) returning id into v_collection;

  if not exists (
    select 1 from public.cobros
    where id = v_collection and cuenta_plata_id = v_silver_account
      and caja_banco_id is null and moneda_recibida is null
  ) then
    raise exception 'FAILED: valid silver collection did not retain its account';
  end if;
end
$$;

rollback;
