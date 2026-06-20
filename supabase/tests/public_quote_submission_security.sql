do $$
declare
  v_tenant constant uuid := '96666666-0000-4000-8000-0000000000a1';
  v_link uuid;
  v_preorder uuid;
  v_blocked boolean;
  v_item public.preorder_items%rowtype;
begin
  delete from public.tenants where id = v_tenant;
  insert into public.tenants (id, name, slug, status)
  values (v_tenant, 'Quote Security Test', 'quote-security-test', 'active');

  insert into public.quote_links (tenant_id, token, products, expires_at)
  values (
    v_tenant,
    'quote-security-test-token',
    '[{"codigo":"SAFE","descripcion":"Approved","metal":"Silver","pesoPromedio":2,"precioMinimo":10}]'::jsonb,
    now() + interval '1 hour'
  ) returning id into v_link;

  set local role anon;

  v_blocked := false;
  begin
    perform public.submit_quote_link_preorder(
      'quote-security-test-token',
      '{"name":"Test","email":"test@example.com"}'::jsonb,
      '[{"codigo":"HACK","quantity":1,"precioMinimo":0}]'::jsonb
    );
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: accepted a product outside the quote'; end if;
  raise notice 'PASS: product outside the quote rejected';

  v_preorder := public.submit_quote_link_preorder(
    'quote-security-test-token',
    '{"name":"Test","email":"test@example.com"}'::jsonb,
    '[{"codigo":"SAFE","quantity":2,"descripcion":"FORGED","pesoPromedio":999,"precioMinimo":999}]'::jsonb
  );

  reset role;
  select * into v_item from public.preorder_items where preorder_id = v_preorder;
  if v_item.producto_descripcion <> 'Approved'
    or v_item.gramos_por_pieza <> 2
    or v_item.precio_gramo_mxn <> 10
    or v_item.piezas <> 2 then
    raise exception 'FAIL: browser-controlled product data was trusted';
  end if;
  raise notice 'PASS: server snapshot overrides forged product data';

  set local role anon;
  v_blocked := false;
  begin
    perform public.submit_quote_link_preorder(
      'quote-security-test-token',
      '{"name":"Test","email":"test@example.com"}'::jsonb,
      '[{"codigo":"SAFE","quantity":1}]'::jsonb
    );
  exception when others then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FAIL: quote submission throttle did not apply'; end if;
  raise notice 'PASS: repeated submission throttled';

  reset role;
  delete from public.preorder_items where preorder_id = v_preorder;
  delete from public.preorders where id = v_preorder;
  delete from public.quote_links where id = v_link;
  delete from public.tenants where id = v_tenant;
  raise notice 'ALL PASS: public quote submission hardened';
end $$;
