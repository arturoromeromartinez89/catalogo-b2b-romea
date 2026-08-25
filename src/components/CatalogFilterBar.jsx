/**
 * CatalogFilterBar.jsx
 * Barra de filtros compacta — una sola fila de 52 px.
 *
 * Layout:
 *   [ 1,234·456 ] [ 🔍 Buscar… chip × ] [ ⚙ Filtros ▾ ] [ Anillos ][ Aretes ]→ [ ✕ ] [ ▴ ]
 *
 * FilterPanel aparece como popover flotante al pulsar "Filtros".
 * QuickFilters son pills en scroll horizontal — nunca hacen flex-wrap.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import AdvancedSearch from "./AdvancedSearch";
import FilterPanel from "./FilterPanel";
import { useLanguage } from "../i18n/LanguageContext";
import { DEFAULT_QUICK_FILTER_DEFINITIONS } from "../utils/filters";
import { getCatalogTerminology } from "../utils/catalogTerminology";

// ─── Icono filtro ──────────────────────────────────────────────────────────────
const IconFilter = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <line x1="11" y1="18" x2="13" y2="18" />
  </svg>
);

// ─── Icono X ──────────────────────────────────────────────────────────────────
const IconX = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ─── Componente principal ──────────────────────────────────────────────────────
export default function CatalogFilterBar({
  // Métricas
  totalCount       = 0,
  filteredCount    = 0,
  loadingProducts  = false,
  // AdvancedSearch
  productQuery     = "",
  searchChips      = [],
  excludeQuery     = "",
  excludeChips     = [],
  products         = [],
  onQueryChange,
  onAddChip,
  onRemoveChip,
  onExcludeQueryChange,
  onAddExcludeChip,
  onRemoveExcludeChip,
  // FilterPanel (selects + rangos)
  filters          = {},
  filterOptions    = {},
  onFiltersChange,
  // QuickFilters (pills) — definiciones por tenant (fallback joyero)
  quickFilters     = [],
  onQuickFilterToggle,
  quickFilterDefinitions = DEFAULT_QUICK_FILTER_DEFINITIONS,
  // Acciones
  onClear,
  // Colapsar / expandir
  collapsed        = false,
  onToggleCollapse,
}) {
  const { language } = useLanguage();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const popoverRef = useRef(null);
  const terminology = useMemo(() => getCatalogTerminology(products, language), [products, language]);
  const canExclude =
    typeof onExcludeQueryChange === "function" &&
    typeof onAddExcludeChip === "function" &&
    typeof onRemoveExcludeChip === "function";

  // Cierra el popover al hacer click fuera
  useEffect(() => {
    if (!filtersOpen) return;
    const close = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setFiltersOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [filtersOpen]);

  // Cuenta filtros activos (selects + rangos + quick filters)
  const activeSelectCount = Object.values(filters).filter(Boolean).length;
  const activeCount = activeSelectCount + quickFilters.length + (canExclude ? excludeChips.length : 0);
  const hasAnyFilter =
    activeCount > 0 ||
    searchChips.length > 0 ||
    productQuery.length > 0 ||
    (canExclude && excludeQuery.length > 0);

  const pillLabel = (f) => f.labels?.[language] || f.label || f.id;

  return (
    <div className={`cfb${collapsed ? " cfb--collapsed" : ""}`} role="toolbar" aria-label="Filtros del catálogo">

      {/* ── Métricas ─────────────────────────────────── */}
      <div className="cfb-metrics">
        <span className="cfb-metric">
          {loadingProducts ? "…" : totalCount.toLocaleString("es-MX")}
        </span>
        <span className="cfb-sep" aria-hidden="true">·</span>
        <span className={`cfb-metric${filteredCount < totalCount ? " cfb-metric--filtered" : ""}`}>
          {filteredCount.toLocaleString("es-MX")}
        </span>
        <span className="cfb-metrics-label">productos</span>
      </div>

      {/* ── Controles (ocultos en collapsed) ─────────── */}
      {!collapsed && (
        <>
          {/* Búsqueda */}
          <div className="cfb-search">
            <AdvancedSearch
              value={productQuery}
              chips={searchChips}
              products={products}
              onChange={onQueryChange}
              onAddChip={(chip) => { onAddChip(chip); onQueryChange(""); }}
              onRemoveChip={onRemoveChip}
            />
          </div>

          {/* Botón Filtros → popover */}
          <div className="cfb-filter-wrap" ref={popoverRef}>
            <button
              type="button"
              className={`cfb-filter-btn${activeSelectCount > 0 ? " cfb-filter-btn--active" : ""}`}
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-haspopup="dialog"
            >
              <IconFilter />
              <span>Filtros</span>
              {activeSelectCount > 0 && (
                <span className="cfb-badge">{activeSelectCount}</span>
              )}
              <span className="cfb-chevron" aria-hidden="true">{filtersOpen ? "▲" : "▼"}</span>
            </button>

            {filtersOpen && (
              <div className="cfb-filter-popover" role="dialog" aria-label="Panel de filtros">
                <FilterPanel
                  filters={filters}
                  options={filterOptions}
                  onChange={onFiltersChange}
                  terminology={terminology}
                />
              </div>
            )}
          </div>

          {/* Pills de filtros rápidos — scroll horizontal, sin wrap */}
          <div className="cfb-pills" role="group" aria-label="Filtros rápidos">
            {quickFilterDefinitions.map((f) => {
              const active = quickFilters.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`cfb-pill${active ? " cfb-pill--active" : ""}`}
                  onClick={() => onQuickFilterToggle(f.id)}
                  aria-pressed={active}
                >
                  {pillLabel(f)}
                </button>
              );
            })}
          </div>

          {canExclude ? (
            <div className="cfb-exclude" aria-label="Descartar productos">
              <AdvancedSearch
                value={excludeQuery}
                chips={excludeChips}
                products={products}
                onChange={onExcludeQueryChange}
                onAddChip={(chip) => { onAddExcludeChip(chip); onExcludeQueryChange(""); }}
                onRemoveChip={onRemoveExcludeChip}
                placeholder="Descartar..."
              />
            </div>
          ) : null}

          {/* Botón limpiar — solo visible cuando hay algo activo */}
          {hasAnyFilter && (
            <button
              type="button"
              className="cfb-clear"
              onClick={onClear}
              title="Limpiar todos los filtros"
            >
              <IconX />
              <span>Limpiar</span>
            </button>
          )}
        </>
      )}

      {/* ── Toggle colapsar — siempre visible ──────── */}
      <button
        type="button"
        className="cfb-toggle"
        onClick={onToggleCollapse}
        title={collapsed ? "Mostrar filtros" : "Ocultar filtros"}
        aria-label={collapsed ? "Mostrar filtros" : "Ocultar filtros"}
      >
        {collapsed ? (
          <>
            <span>Filtros</span>
            {activeCount > 0 && <span className="cfb-badge">{activeCount}</span>}
            <span aria-hidden="true">▾</span>
          </>
        ) : (
          <span aria-hidden="true">▴</span>
        )}
      </button>

    </div>
  );
}
