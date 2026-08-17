-- The storefront is piece-priced. Patch the function that was deployed earlier
-- today without changing any existing preorder data.
do $$
declare
  v_sql text;
begin
  select pg_get_functiondef(
    'public.submit_estuches_guest_preorder(jsonb,jsonb)'::regprocedure
  ) into v_sql;

  v_sql := replace(
    v_sql,
    'total_gramos, total_mxn, tenant_id, updated_at',
    'total_gramos, total_mxn, pricing_mode, tenant_id, updated_at'
  );
  v_sql := replace(
    v_sql,
    '0, 0, 0, v_tenant_id, now()',
    '0, 0, 0, ''piece'', v_tenant_id, now()'
  );
  v_sql := replace(
    v_sql,
    'subtotal_mxn, sort_order, updated_at',
    'pricing_mode, precio_pieza_mxn, subtotal_mxn, sort_order, updated_at'
  );
  v_sql := replace(
    v_sql,
    'v_subtotal, v_index, now()',
    '''piece'', greatest(coalesce(v_product.precio_minimo, 0), 0), v_subtotal, v_index, now()'
  );

  execute v_sql;
end;
$$;
notify pgrst, 'reload schema';
