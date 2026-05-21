-- Agregar columna proveedor a la tabla products
-- Ejecutar en: Supabase Dashboard → SQL Editor

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS proveedor text;
