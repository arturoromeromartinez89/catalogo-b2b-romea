-- Tablas para listas de precios de mano de obra por línea
-- Ejecutar en: Supabase Dashboard → SQL Editor

-- 1. Lista de labores (nombrada)
CREATE TABLE IF NOT EXISTS public.labor_lists (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  tenant_id  uuid        REFERENCES public.tenants(id) ON DELETE CASCADE,
  active     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Labores por línea dentro de cada lista
CREATE TABLE IF NOT EXISTS public.labor_list_lines (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  labor_list_id  uuid    NOT NULL REFERENCES public.labor_lists(id) ON DELETE CASCADE,
  line_codigo    text    NOT NULL,
  mo_base        numeric NOT NULL DEFAULT 0,
  UNIQUE(labor_list_id, line_codigo)
);

-- RLS
ALTER TABLE public.labor_lists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labor_list_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage labor lists"       ON public.labor_lists;
DROP POLICY IF EXISTS "admins manage labor list lines"  ON public.labor_list_lines;

CREATE POLICY "admins manage labor lists"
  ON public.labor_lists FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "admins manage labor list lines"
  ON public.labor_list_lines FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
