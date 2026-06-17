-- ============================================================================
-- FASE 1 — Botones rápidos del catálogo configurables por tenant
-- catalog_quick_filters: cada empresa define sus propios botones rápidos.
--
-- RLS modelada en la tabla `products` (sección 4 de fix_rls_tenant_isolation.sql):
--   lectura  → cualquier usuario del tenant (tenant_id = current_tenant_id())
--   escritura→ is_superadmin() OR (is_tenant_admin() AND tenant_id = current_tenant_id())
-- Se evita using(true) y el is_admin() global, igual que las políticas recientes.
-- ============================================================================

create table if not exists public.catalog_quick_filters (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  slug        text not null,
  label       text not null,
  terms       text[] not null default '{}',
  match_type  text not null default 'terms',
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, slug),
  check (match_type in ('terms', 'without_stone'))
);

create index if not exists idx_catalog_quick_filters_tenant
  on public.catalog_quick_filters (tenant_id, active, sort_order);

alter table public.catalog_quick_filters enable row level security;

-- Lectura: cualquier usuario autenticado SOLO ve los filtros de SU tenant.
drop policy if exists "tenant reads quick filters" on public.catalog_quick_filters;
create policy "tenant reads quick filters" on public.catalog_quick_filters
for select using (
  tenant_id = public.current_tenant_id()
);

-- Escritura (insert/update/delete): solo admin del tenant (o superadmin).
drop policy if exists "admins manage quick filters" on public.catalog_quick_filters;
create policy "admins manage quick filters" on public.catalog_quick_filters
for all using (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
) with check (
  public.is_superadmin()
  or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
);

-- ── Datos iniciales: filtros joyeros actuales para TODOS los tenants ─────────
-- Idempotente: ON CONFLICT (tenant_id, slug) DO NOTHING. No pisa cambios.
insert into public.catalog_quick_filters (tenant_id, slug, label, terms, match_type, sort_order)
select t.id, f.slug, f.label, f.terms, f.match_type, f.sort_order
from public.tenants t
cross join (values
  ('anillos',      'Anillos',      array['anillo','anillos','ring','rings'],                                   'terms',         0),
  ('aretes',       'Aretes',       array['arete','aretes','arracada','arracadas','earring','earrings'],         'terms',         1),
  ('dijes',        'Dijes',        array['dije','dijes','pendant','pendants'],                                  'terms',         2),
  ('gargantillas', 'Gargantillas', array['gargantilla','gargantillas','necklace','necklaces'],                 'terms',         3),
  ('pulseras',     'Pulseras',     array['pulsera','pulseras','bracelet','bracelets'],                          'terms',         4),
  ('mujer',        'Mujer',        array['mujer','dama','femenino','woman','women','female'],                   'terms',         5),
  ('hombre',       'Hombre',       array['hombre','caballero','masculino','man','men','male'],                  'terms',         6),
  ('infantil',     'Infantil',     array['infantil','niña','nina','niño','nino','kids','children'],             'terms',         7),
  ('sin-piedra',   'Sin piedra',   array[]::text[],                                                             'without_stone', 8),
  ('con-piedra',   'Con piedra',   array['piedra','stone','zirconia','perla','pearl','cristal','crystal','gema','gem','onix','diamante','diamond'], 'terms', 9),
  ('liso',         'Liso',         array['liso','lisa','plain','smooth'],                                       'terms',        10),
  ('diamantado',   'Diamantado',   array['diamantado','diamantada','diamond cut'],                              'terms',        11),
  ('rodio',        'Rodio',        array['rodio','rodiado','rodiada','rhodium','rhodium plated'],                'terms',        12),
  ('plata',        'Plata',        array['plata','silver','.925','925'],                                        'terms',        13),
  ('oro',          'Oro',          array['oro','gold','10k','14k','18k'],                                       'terms',        14)
) as f(slug, label, terms, match_type, sort_order)
on conflict (tenant_id, slug) do nothing;

notify pgrst, 'reload schema';
