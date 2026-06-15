-- ============================================================================
-- Guardar la contraseña que el admin define para el cliente (para mostrarla
-- y poder cambiarla desde el panel de Actividad).
-- Archivo: supabase/client-access-password.sql  → correr una vez en producción.
--
-- NOTA DE SEGURIDAD: esto guarda la contraseña en texto en la base, para que
-- el admin pueda verla/cambiarla. Es cómodo para tu flujo (compartes accesos
-- por WhatsApp) pero menos seguro que el hash de auth. La columna solo es
-- legible por admins (y por el propio cliente, que es su propia contraseña).
-- ============================================================================

alter table public.clients add column if not exists access_password text;

notify pgrst, 'reload schema';
