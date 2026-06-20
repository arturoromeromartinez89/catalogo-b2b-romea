-- Run once in Supabase SQL Editor after reviewing the public contact details.
do $$
declare
  v_tenant_id uuid;
begin
  select id into v_tenant_id
  from public.tenants
  where slug in ('estuches-chavez', 'e')
     or lower(name) in ('estuches chavez', 'estuchez chavez')
  order by case when slug = 'estuches-chavez' then 0 else 1 end
  limit 1;

  if v_tenant_id is null then
    insert into public.tenants (name, slug, status)
    values ('Estuches Chavez', 'estuches-chavez', 'active')
    returning id into v_tenant_id;
  else
    update public.tenants
    set name = 'Estuches Chavez', slug = 'estuches-chavez', status = 'active', updated_at = now()
    where id = v_tenant_id;
  end if;

  if exists (select 1 from public.company_settings where tenant_id = v_tenant_id) then
    update public.company_settings
    set brand_name = 'Estuches Chavez',
        legal_name = 'Estuches Chavez',
        phone = '+52 33 3618 3746',
        email = 'estucheschavezventas@gmail.com',
        city = 'Guadalajara',
        state = 'Jalisco',
        country = 'Mexico',
        logo_url = coalesce(nullif(logo_url, ''), 'https://www.estucheschavez.com.mx/imagenes/logo-estuches.png'),
        updated_at = now()
    where tenant_id = v_tenant_id;
  else
    insert into public.company_settings (
      tenant_id, brand_name, legal_name, phone, email, city, state, country, logo_url
    ) values (
      v_tenant_id, 'Estuches Chavez', 'Estuches Chavez', '+52 33 3618 3746',
      'estucheschavezventas@gmail.com', 'Guadalajara', 'Jalisco', 'Mexico',
      'https://www.estucheschavez.com.mx/imagenes/logo-estuches.png'
    );
  end if;

  delete from public.catalog_quick_filters where tenant_id = v_tenant_id;
  insert into public.catalog_quick_filters (
    tenant_id, slug, label, terms, match_type, active, sort_order
  ) values
    (v_tenant_id, 'bustos', 'Bustos', array['busto', 'bustos'], 'terms', true, 0),
    (v_tenant_id, 'aretes', 'Aretes', array['arete', 'aretes'], 'terms', true, 1),
    (v_tenant_id, 'charolas', 'Charolas', array['charola', 'charolas', 'bandeja', 'bandejas'], 'terms', true, 2),
    (v_tenant_id, 'bases', 'Bases', array['base', 'bases', 'escalonada', 'escalonadas'], 'terms', true, 3),
    (v_tenant_id, 'vitrinas', 'Vitrinas', array['vitrina', 'vitrinas', 'escaparate'], 'terms', true, 4);

  raise notice 'Estuches Chavez listo. tenant_id=%', v_tenant_id;
end $$;
