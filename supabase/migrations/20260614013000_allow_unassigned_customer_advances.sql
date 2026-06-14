-- Allow customer advances that are not yet assigned to a sale.
-- A NULL remision_id represents unapplied customer credit.

alter table public.cobros
  alter column remision_id drop not null;
comment on column public.cobros.remision_id is
  'Optional sale reference. NULL means an unapplied customer advance.';
notify pgrst, 'reload schema';
