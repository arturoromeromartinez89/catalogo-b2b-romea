-- Every collection must enter a real, active account owned by the same tenant.
-- Money uses caja_banco_id; physical silver uses cuenta_plata_id.

create or replace function public.validate_cobro_destination_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.cuentas_caja_banco%rowtype;
begin
  if new.medio_pago = 'plata_fisica' then
    if new.cuenta_plata_id is null or new.caja_banco_id is not null then
      raise exception 'Selecciona una caja de plata real para registrar el cobro.';
    end if;

    select * into v_account
    from public.cuentas_caja_banco
    where id = new.cuenta_plata_id
      and tenant_id = new.tenant_id
      and activo = true;

    if not found then
      raise exception 'La caja de plata seleccionada no existe, esta inactiva o pertenece a otra empresa.';
    end if;

    if v_account.tipo <> 'plata' or v_account.moneda <> 'GRM' then
      raise exception 'La cuenta seleccionada no es una caja de plata en gramos.';
    end if;

    if coalesce(new.gramos_recibidos, 0) <= 0 then
      raise exception 'Los gramos recibidos deben ser mayores que cero.';
    end if;

    if new.moneda_recibida is not null then
      raise exception 'Un cobro en plata fisica no debe registrar moneda de dinero.';
    end if;
  else
    if new.caja_banco_id is null or new.cuenta_plata_id is not null then
      raise exception 'Selecciona una caja o cuenta real para registrar el cobro.';
    end if;

    if new.moneda_recibida is null or new.moneda_recibida not in ('MXN', 'USD') then
      raise exception 'Selecciona una moneda valida para el cobro.';
    end if;

    select * into v_account
    from public.cuentas_caja_banco
    where id = new.caja_banco_id
      and tenant_id = new.tenant_id
      and activo = true;

    if not found then
      raise exception 'La cuenta seleccionada no existe, esta inactiva o pertenece a otra empresa.';
    end if;

    if v_account.tipo = 'plata' or v_account.moneda <> new.moneda_recibida then
      raise exception 'La cuenta seleccionada no acepta cobros en %.', new.moneda_recibida;
    end if;

    if coalesce(new.monto_recibido, 0) <= 0 then
      raise exception 'El monto recibido debe ser mayor que cero.';
    end if;
  end if;

  return new;
end;
$$;
drop trigger if exists validate_cobro_destination_account on public.cobros;
create trigger validate_cobro_destination_account
before insert or update of tenant_id, medio_pago, monto_recibido,
  moneda_recibida, caja_banco_id, gramos_recibidos, cuenta_plata_id
on public.cobros
for each row execute function public.validate_cobro_destination_account();
comment on function public.validate_cobro_destination_account() is
  'Rejects collections without an active destination account from the same tenant and currency.';
revoke all on function public.validate_cobro_destination_account() from public;
notify pgrst, 'reload schema';
