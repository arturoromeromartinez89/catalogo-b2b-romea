-- ═══════════════════════════════════════════════════════════════════════════
-- Campos para separar Clientes y Prospectos en la tabla clients
-- Seguro de re-ejecutar: IF NOT EXISTS / WHERE type IS NULL
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Columnas de perfil ampliado ─────────────────────────────────────────────
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ciudad      TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS domicilio   TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS comentarios TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS badge_raw   TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS obtenido_en TEXT DEFAULT 'JCK';

-- ─── Columna type (nullable para poder hacer backfill correcto) ───────────────
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS type TEXT;

-- ─── Backfill: prospectos (email de sistema o datos de gafete de feria) ───────
UPDATE public.clients
SET type = 'prospecto'
WHERE type IS NULL AND (
  email LIKE '%@prospect.local'
  OR (badge_raw IS NOT NULL AND badge_raw <> '')
);

-- ─── Backfill: todo lo demás son clientes reales ──────────────────────────────
UPDATE public.clients
SET type = 'cliente'
WHERE type IS NULL;

-- ─── DEFAULT para registros nuevos ───────────────────────────────────────────
ALTER TABLE public.clients ALTER COLUMN type SET DEFAULT 'cliente';

-- ─── Índice para queries filtradas por tenant + tipo ─────────────────────────
CREATE INDEX IF NOT EXISTS clients_tenant_type_idx
  ON public.clients (tenant_id, type);
