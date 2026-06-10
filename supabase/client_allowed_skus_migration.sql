-- ============================================================
-- Migración: catálogo personalizado por cliente (allowed_skus)
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agrega columna allowed_skus a la tabla clients
--    NULL = sin restricción (el cliente ve todos los productos)
--    ARRAY de códigos = el cliente solo ve esos productos

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS allowed_skus TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.clients.allowed_skus IS
  'NULL = sin restricción. Array de códigos = catálogo personalizado.';

-- 2. Índice GIN para búsquedas eficientes en el array
CREATE INDEX IF NOT EXISTS clients_allowed_skus_gin
  ON public.clients USING GIN (allowed_skus);

-- 3. Verificar que updated_at existe (debe existir en todos los tenants)
--    Si falla, agrégalo manualmente:
--    ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================================
-- CÓMO USAR DESDE EL ADMIN:
--   - Abre la pestaña Clientes
--   - Haz clic en "Catálogo" en la fila del cliente
--   - Agrega o quita productos del catálogo personalizado
--   - Guarda
--
-- El cliente solo verá los productos en su allowed_skus.
-- Si allowed_skus es NULL o [], ve todo el catálogo.
-- ============================================================
