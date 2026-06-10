-- ============================================================
-- Migración: lista de labores asignada por cliente
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agrega columna labor_list_id a la tabla clients
--    NULL = sin lista de labores (el cliente ve precios base de la hoja de metal)
--    UUID de un labor_list = esa lista se pre-aplica en la preorden del cliente
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS labor_list_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.clients.labor_list_id IS
  'ID de la lista de labores asignada a este cliente.
   NULL = sin lista (el cliente ve precios base).
   UUID = esa labor_list se auto-aplica cuando el cliente abre su preorden.';

-- 2. Verificar que la columna quedó
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'clients'
   AND column_name  = 'labor_list_id';

-- ============================================================
-- CÓMO USAR DESDE EL ADMIN:
--   - Abre la pestaña Clientes
--   - Haz clic en "Editar" en la fila del cliente
--   - Selecciona una "Lista de labores" en el dropdown
--   - Guarda
--
-- Cuando el cliente abra su preorden, esa lista se aplica
-- automáticamente y los precios reflejan su tarifa de mano de obra.
-- Si no tiene lista asignada, la preorden muestra precios base.
-- ============================================================
