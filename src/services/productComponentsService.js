import { supabase } from "../lib/supabaseClient";
import { normalizeText } from "../utils/textNormalizer";

const DEFAULT_COMPONENTS = [
  { codigo: "CADENA", nombre: "Cadena", tipo: "tipo_pieza", peso: 0, unidad: "pza", orden: 10 },
  { codigo: "PULSO", nombre: "Pulso", tipo: "tipo_pieza", peso: 0, unidad: "pza", orden: 20 },
  { codigo: "ESCLAVA", nombre: "Esclava", tipo: "tipo_pieza", peso: 0, unidad: "pza", orden: 30 },
  { codigo: "MILITAR", nombre: "Militar", tipo: "tipo_pieza", peso: 0, unidad: "pza", orden: 40 },
  { codigo: "BROCHE-MILITAR", nombre: "Broche militar", tipo: "broche", peso: 0, unidad: "g", orden: 10 },
  { codigo: "PLACA-MILITAR", nombre: "Placa militar", tipo: "broche", peso: 0, unidad: "g", orden: 20 },
  { codigo: "BROCHE-CAJA", nombre: "Broche de caja", tipo: "broche", peso: 0, unidad: "g", orden: 30 },
  { codigo: "BROCHE-LISO", nombre: "Broche liso", tipo: "broche", peso: 0, unidad: "g", orden: 40 },
  { codigo: "16CM", nombre: "16 cm", tipo: "largo", peso: 0, unidad: "cm", orden: 16 },
  { codigo: "18CM", nombre: "18 cm", tipo: "largo", peso: 0, unidad: "cm", orden: 18 },
  { codigo: "20CM", nombre: "20 cm", tipo: "largo", peso: 0, unidad: "cm", orden: 20 },
  { codigo: "21CM", nombre: "21 cm", tipo: "largo", peso: 0, unidad: "cm", orden: 21 },
  { codigo: "22CM", nombre: "22 cm", tipo: "largo", peso: 0, unidad: "cm", orden: 22 },
  { codigo: "24CM", nombre: "24 cm", tipo: "largo", peso: 0, unidad: "cm", orden: 24 },
  { codigo: "LISO", nombre: "Liso", tipo: "terminado", peso: 0, unidad: "pza", orden: 10 },
  { codigo: "DIAMANTADO", nombre: "Diamantado", tipo: "terminado", peso: 0, unidad: "pza", orden: 20 },
  { codigo: "RODIO", nombre: "Rodio", tipo: "terminado", peso: 0, unidad: "pza", orden: 30 },
  { codigo: "PULIDO", nombre: "Pulido", tipo: "terminado", peso: 0, unidad: "pza", orden: 40 },
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
