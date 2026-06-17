import { supabase } from "../lib/supabaseClient";
import { DEFAULT_QUICK_FILTER_DEFINITIONS } from "../utils/filters";
import { normalizeText } from "../utils/textNormalizer";

const slugify = (s) =>
  normalizeText(String(s || "")).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

// Convierte una fila de catalog_quick_filters al formato que usa el frontend.
// terms (text[] plano) → grupos OR: cada término es su propio grupo, igual que
// las definiciones joyeras por defecto. match_type='without_stone' → custom.
const dbRowToDefinition = (row) => ({
  id: row.slug,
  labels: { es: row.label, en: row.label },
  terms: Array.isArray(row.terms) ? row.terms.map((t) => [t]) : [],
  custom: row.match_type === "without_stone" ? "withoutStone" : undefined,
});

/**
 * Botones rápidos del catálogo para un tenant. Estrictamente tenant-scoped por
 * RLS. Si la tabla no existe, falla, o el tenant no tiene filtros, devuelve la
 * lista joyera por defecto (fallback) para no romper el catálogo.
 */
export const fetchCatalogQuickFilters = async (tenantId) => {
  if (!tenantId) return DEFAULT_QUICK_FILTER_DEFINITIONS;
  try {
    const { data, error } = await supabase
      .from("catalog_quick_filters")
      .select("slug,label,terms,match_type,sort_order,active")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) return DEFAULT_QUICK_FILTER_DEFINITIONS;
    return data.map(dbRowToDefinition);
  } catch (e) {
    // Importante para observabilidad SaaS: el fallback no debe ocultar fallos
    // reales de Supabase/RLS. Un tenant sin filtros (0 filas) NO entra aquí.
    console.warn(`[quick-filters] usando fallback joyero por error al leer (tenant ${tenantId}):`, e?.message || e);
    return DEFAULT_QUICK_FILTER_DEFINITIONS;
  }
};

// ─── ADMIN (Fase 2) — gestión por tenant. La RLS exige admin del tenant. ──────

/** Todos los botones del tenant (activos e inactivos) para administrarlos. */
export const fetchTenantQuickFiltersAdmin = async (tenantId) => {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from("catalog_quick_filters")
    .select("id,slug,label,terms,match_type,active,sort_order")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
};

/** Crea o actualiza un botón rápido del tenant. */
export const saveQuickFilter = async (tenantId, f) => {
  const isWithoutStone = f.match_type === "without_stone";
  const row = {
    tenant_id:  tenantId,
    slug:       f.slug || slugify(f.label) || `btn-${Date.now()}`,
    label:      String(f.label || "").trim(),
    terms:      isWithoutStone ? [] : (Array.isArray(f.terms) ? f.terms : []),
    match_type: isWithoutStone ? "without_stone" : "terms",
    active:     f.active !== false,
    sort_order: Number(f.sort_order || 0),
    updated_at: new Date().toISOString(),
  };
  if (f.id) row.id = f.id;
  const { data, error } = await supabase
    .from("catalog_quick_filters")
    .upsert(row, { onConflict: f.id ? "id" : "tenant_id,slug" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

export const deleteQuickFilter = async (id) => {
  const { error } = await supabase.from("catalog_quick_filters").delete().eq("id", id);
  if (error) throw new Error(error.message);
};

/** Reordena: guarda el sort_order de cada fila según su posición en la lista. */
export const reorderQuickFilters = async (orderedIds = []) => {
  const results = await Promise.all(orderedIds.map((id, idx) =>
    supabase.from("catalog_quick_filters").update({ sort_order: idx, updated_at: new Date().toISOString() }).eq("id", id)
  ));
  const failed = results.find((r) => r.error);
  if (failed) throw new Error(failed.error.message);
};
