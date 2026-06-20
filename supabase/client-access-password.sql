-- DEPRECATED: no ejecutar.
--
-- Este archivo existia para crear clients.access_password y guardar
-- contrasenas visibles. Ese flujo fue retirado por seguridad.
--
-- El acceso de clientes ahora debe manejarse con invitaciones y correos de
-- recuperacion desde Supabase Auth. La migracion vigente que limpia el campo
-- legado es:
--
--   supabase/migrations/20260620160000_secure_client_access.sql

select 'deprecated: use Supabase Auth invitations/reset emails instead' as notice;
