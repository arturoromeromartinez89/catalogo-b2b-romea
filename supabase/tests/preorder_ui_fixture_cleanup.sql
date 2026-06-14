do $$
begin
  delete from public.preorders
  where client_id = '40000000-0000-4000-8000-000000000003'
     or tenant_id = '40000000-0000-4000-8000-000000000001';
  delete from auth.users where id = '40000000-0000-4000-8000-000000000002';
  delete from public.clients
  where id = '40000000-0000-4000-8000-000000000003'
     or email = 'visual-client@example.com';
  delete from public.products
  where tenant_id = '40000000-0000-4000-8000-000000000001'
     or codigo in ('ROM-CHI-CHN-10MM', 'ROM-CHI-BRC-10MM');
  delete from public.company_settings where tenant_id = '40000000-0000-4000-8000-000000000001';
  delete from public.tenant_features where tenant_id = '40000000-0000-4000-8000-000000000001';
  delete from public.tenants where id = '40000000-0000-4000-8000-000000000001';
end;
$$;
