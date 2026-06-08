import { supabase } from "../lib/supabaseClient";
import { normalizeText } from "../utils/textNormalizer";

// ---------------------------------------------------------------------------
// Componentes base de fallback (se usan si product_components no existe en DB)
//
// metadata controla las reglas de compatibilidad entre componentes:
//
//   tipo_pieza.metadata.excluye_placa_militar  → no muestra broches tipo placa militar
//   tipo_pieza.metadata.fuerza_placa_militar   → auto-selecciona placa militar como broche
//   tipo_pieza.metadata.requiere_diseño_placa  → muestra selector de diseño de placa
//   broche.metadata.es_placa_militar           → este broche es una placa militar
// ---------------------------------------------------------------------------
const DEFAULT_COMPONENTS = [
  // ── Tipos de pieza ───────────────────────────────────────────────────────
  {
    codigo: "CADENA", nombre: "Cadena", tipo: "tipo_pieza", peso: 0, unidad: "pza", orden: 10,
    metadata: { excluye_placa_militar: true },
  },
  {
    codigo: "PULSO", nombre: "Pulso", tipo: "tipo_pieza", peso: 0, unidad: "pza", orden: 20,
    metadata: { excluye_placa_militar: true },
  },
  {
    codigo: "ESCLAVA-MEDIO", nombre: "Esclava placa en medio", tipo: "tipo_pieza", peso: 0, unidad: "pza", orden: 30,
    metadata: { excluye_placa_militar: true, requiere_diseño_placa: true },
  },
  {
    codigo: "ESCLAVA-MILITAR", nombre: "Esclava placa militar", tipo: "tipo_pieza", peso: 0, unidad: "pza", orden: 40,
    metadata: { fuerza_placa_militar: true, requiere_diseño_placa: true },
  },

  // ── Broches ──────────────────────────────────────────────────────────────
  {
    codigo: "BROCHE-CAJA", nombre: "Broche de caja", tipo: "broche", peso: 0.25, unidad: "g", orden: 10,
    metadata: { es_placa_militar: false },
  },
  {
    codigo: "BROCHE-ESPECIAL", nombre: "Broche de caja especial", tipo: "broche", peso: 0.30, unidad: "g", orden: 20,
    metadata: { es_placa_militar: false },
  },
  {
    codigo: "PLACA-MILITAR", nombre: "Placa Militar", tipo: "broche", peso: 2.0, unidad: "g", orden: 30,
    metadata: { es_placa_militar: true },
  },

  // ── Diseño de placa (aplica a esclava placa en medio y esclava militar) ──
  { codigo: "PLACA-LISA",    nombre: "Lisa",       tipo: "diseño_placa", peso: 0, unidad: "pza", orden: 10, metadata: {} },
  { codigo: "PLACA-GRECA",   nombre: "Con greca",  tipo: "diseño_placa", peso: 0, unidad: "pza", orden: 20, metadata: {} },
  { codigo: "PLACA-OVALADA", nombre: "Ovalada",    tipo: "diseño_placa", peso: 0, unidad: "pza", orden: 30, metadata: {} },
  { codigo: "PLACA-BISEL",   nombre: "Con bisel",  tipo: "diseño_placa", peso: 0, unidad: "pza", orden: 40, metadata: {} },

  // ── Largos ───────────────────────────────────────────────────────────────
  { codigo: "16CM", nombre: "16 cm", tipo: "largo", peso: 0, unidad: "cm", orden: 16 },
  { codigo: "18CM", nombre: "18 cm", tipo: "largo", peso: 0, unidad: "cm", orden: 18 },
  { codigo: "20CM", nombre: "20 cm", tipo: "largo", peso: 0, unidad: "cm", orden: 20 },
  { codigo: "21CM", nombre: "21 cm", tipo: "largo", peso: 0, unidad: "cm", orden: 21 },
  { codigo: "22CM", nombre: "22 cm", tipo: "largo", peso: 0, unidad: "cm", orden: 22 },
  { codigo: "24CM", nombre: "24 cm", tipo: "largo", peso: 0, unidad: "cm", orden: 24 },

  // ── Terminados ───────────────────────────────────────────────────────────
  { codigo: "LISO",       nombre: "Liso",        tipo: "terminado", peso: 0, unidad: "pza", orden: 10 },
  { codigo: "DIAMANTADO", nombre: "Diamantado",  tipo: "terminado", peso: 0, unidad: "pza", orden: 20 },
  { codigo: "RODIO",      nombre: "Rodio",       tipo: "terminado", peso: 0, unidad: "pza", orden: 30 },
  { codigo: "PULIDO",     nombre: "Pulido",      tipo: "terminado", peso: 0, unidad: "pza", orden: 40 },
];

const normalizeComponent = (row) => ({
  id: row.id || row.codigo,
  codigo: String(row.codigo || "").trim(),
  nombre: String(row.nombre || "").trim(),
  tipo: String(row.tipo || "otro").trim(),
  descripcion: row.descripcion || "",
  peso: Number(row.peso || 0),
  unidad: row.unidad || "g",
  fotoUrl: row.foto_url || row.fotoUrl || "",
  visibleWeb: row.visible_web !== false,
  estatus: row.estatus || "activo",
  orden: Number(row.orden || 0),
  tagsBusqueda: row.tags_busqueda || row.tagsBusqueda || "",
  metadata: row.metadata || {},
  searchText: normalizeText([row.codigo, row.nombre, row.tipo, row.descripcion, row.tags_busqueda].join(" ")),
});

export const getDefaultProductComponents = () => DEFAULT_COMPONENTS.map(normalizeComponent);

export const fetchProductComponents = async (tenantId = "") => {
  if (!tenantId) return getDefaultProductComponents();

  const { data, error } = await supabase
    .from("product_components")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("visible_web", true)
    .order("tipo")
    .order("orden");

  if (error) {
    if (/product_components|schema cache|does not exist/i.test(error.message || "")) {
      return getDefaultProductComponents();
    }
    throw error;
  }

  const rows = (data || [])
    .map(normalizeComponent)
    .filter((component) => component.codigo && component.nombre && component.estatus !== "inactivo");

  return rows.length ? rows : getDefaultProductComponents();
};

export const groupProductComponents = (components = []) =>
  components.reduce((groups, component) => {
    const key = component.tipo || "otro";
    if (!groups[key]) groups[key] = [];
    groups[key].push(component);
    groups[key].sort((a, b) => {
      if (a.orden !== b.orden) return a.orden - b.orden;
      return String(a.nombre).localeCompare(String(b.nombre));
    });
    return groups;
  }, {});
