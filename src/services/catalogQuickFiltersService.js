import { supabase } from "../lib/supabaseClient";
import { DEFAULT_QUICK_FILTER_DEFINITIONS } from "../utils/filters";

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
  } catch {
    return DEFAULT_QUICK_FILTER_DEFINITIONS;
  }
};
