-- Return the commercial folio and server totals only for the preorder created
-- in the same call. Anonymous users still receive no table read privileges.
create or replace function public.submit_estuches_guest_preorder_with_receipt(
  p_customer jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preorder_id uuid;
  v_receipt jsonb;
begin
  v_preorder_id := public.submit_estuches_guest_preorder(p_customer, p_items);

  select jsonb_build_object(
    'id', po.id,
    'folio', po.folio,
    'created_at', po.created_at,
    'moneda', po.moneda,
    'total_piezas', po.total_piezas,
    'total_mxn', po.total_mxn
  )
  into v_receipt
  from public.preorders po
  where po.id = v_preorder_id;

  if v_receipt is null then
    raise exception 'No fue posible recuperar el comprobante de la preorden.';
  end if;

  return v_receipt;
end;
$$;
revoke all on function public.submit_estuches_guest_preorder_with_receipt(jsonb, jsonb) from public;
grant execute on function public.submit_estuches_guest_preorder_with_receipt(jsonb, jsonb) to anon, authenticated;
notify pgrst, 'reload schema';
