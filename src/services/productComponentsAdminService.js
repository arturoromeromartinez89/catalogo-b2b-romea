import { supabase } from "../lib/supabaseClient";

// ─── Tipos disponibles ────────────────────────────────────────────────────────
// Tejido = SKU base (tabla productos), NO es componente físico con peso.
// Tipo de pieza = selector lógico del configurador, NO tiene entrada aquí.
// Solo se gestionan componentes físicos con peso propio.
export const COMPONENT_TYPES = [
  { key: "broche",       label: "Broches",            icon: "◉" },
  { key: "diseño_placa", label: "Diseños de placa",   icon: "▣" },
  { key: "largo",        label: "Largos",             icon: "↔" },
  { key: "terminado",    label: "Terminados",         icon: "◎" },
  { key: "piedra",       label: "Piedras",            icon: "◆" },
  { key: "accesorio",    label: "Accesorios",         icon: "◇" },
  { key: "otro",         label: "Otros",              icon: "○" },
];

export const COMPONENT_TYPE_KEYS = COMPONENT_TYPES.map((t) => t.key);

export const UNIDADES = ["g", "mm", "cm", "pza"];

// ─── Normalizar fila de DB → objeto JS ───────────────────────────────────────
export const normalizeAdminComponent = (row) => ({
  id:           row.id,
  tenantId:     row.tenant_id,
  codigo:       String(row.codigo || "").trim(),
  nombre:       String(row.nombre || "").trim(),
  tipo:         row.tipo || "otro",
  descripcion:  row.descripcion || "",
  peso:         Number(row.peso || 0),
  unidad:       row.unidad || "g",
  fotoUrl:      row.foto_url || "",
  visibleWeb:   row.visible_web !== false,
  estatus:      row.estatus || "activo",
  orden:        Number(row.orden || 0),
  tagsBusqueda: row.tags_busqueda || "",
  metadata:     row.metadata || {},
  createdAt:    row.created_at,
  updatedAt:    row.updated_at,
});

// ─── Fetch todos los componentes del tenant ───────────────────────────────────
export const fetchAllComponents = async (tenantId) => {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from("product_components")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("tipo")
    .order("orden")
    .order("nombre");
  if (error) throw error;
  return (data || []).map(normalizeAdminComponent);
};

// ─── Crear componente ─────────────────────────────────────────────────────────
export const createComponent = async (fields, tenantId) => {
  if (!tenantId) throw new Error("tenant_id requerido");
  const { data, error } = await supabase
    .from("product_components")
    .insert([{
      tenant_id:     tenantId,
      codigo:        String(fields.codigo || "").trim().toUpperCase(),
      nombre:        String(fields.nombre || "").trim(),
      tipo:          fields.tipo || "otro",
      descripcion:   fields.descripcion || "",
      peso:          Number(fields.peso || 0),
      unidad:        fields.unidad || "g",
      foto_url:      fields.fotoUrl || "",
      visible_web:   fields.visibleWeb !== false,
      estatus:       fields.estatus || "activo",
      orden:         Number(fields.orden || 0),
      tags_busqueda: fields.tagsBusqueda || "",
      metadata:      fields.metadata || {},
    }])
    .select()
    .single();
  if (error) throw error;
  return normalizeAdminComponent(data);
};

// ─── Actualizar componente ────────────────────────────────────────────────────
export const updateComponent = async (id, fields) => {
  const { data, error } = await supabase
    .from("product_components")
    .update({
      codigo:        String(fields.codigo || "").trim().toUpperCase(),
      nombre:        String(fields.nombre || "").trim(),
      tipo:          fields.tipo || "otro",
      descripcion:   fields.descripcion || "",
      peso:          Number(fields.peso || 0),
      unidad:        fields.unidad || "g",
      foto_url:      fields.fotoUrl || "",
      visible_web:   fields.visibleWeb !== false,
      estatus:       fields.estatus || "activo",
      orden:         Number(fields.orden || 0),
      tags_busqueda: fields.tagsBusqueda || "",
      metadata:      fields.metadata || {},
      updated_at:    new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return normalizeAdminComponent(data);
};

// ─── Eliminar componente ──────────────────────────────────────────────────────
export const deleteComponent = async (id) => {
  const { error } = await supabase
    .from("product_components")
    .delete()
    .eq("id", id);
  if (error) throw error;
};

// ─── Toggle estatus activo/inactivo ──────────────────────────────────────────
export const toggleComponentStatus = async (id, currentStatus) => {
  const next = currentStatus === "activo" ? "inactivo" : "activo";
  const { data, error } = await supabase
    .from("product_components")
    .update({ estatus: next, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return normalizeAdminComponent(data);
};

// ─── Subir foto a Supabase Storage ───────────────────────────────────────────
export const uploadComponentPhoto = async (file, tenantId, componentCodigo) => {
  if (!file || !tenantId) throw new Error("Archivo y tenant requeridos");
  const ext = file.name.split(".").pop().toLowerCase();
  const path = `${tenantId}/components/${componentCodigo}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("company-assets")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("company-assets").getPublicUrl(path);
  return data.publicUrl;
};

// ─── Importar desde Excel ─────────────────────────────────────────────────────
// Columnas esperadas: codigo, nombre, tipo, descripcion, peso, unidad, orden, tags_busqueda
export const parseComponentsExcel = async (file) => {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El archivo no tiene hojas.");
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
  if (!rows.length) throw new Error("El archivo no tiene filas.");

  return rows.map((row) => {
    const get = (...keys) => {
      for (const k of keys) {
        const val = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()] ?? "";
        if (String(val).trim()) return String(val).trim();
      }
      return "";
    };
    return {
      codigo:       get("codigo", "code", "sku").toUpperCase(),
      nombre:       get("nombre", "name"),
      tipo:         get("tipo", "type"),
      descripcion:  get("descripcion", "description", "desc"),
      peso:         Number(String(get("peso", "weight", "g")).replace(",", ".")) || 0,
      unidad:       get("unidad", "unit") || "g",
      orden:        Number(get("orden", "order")) || 0,
      tagsBusqueda: get("tags", "tags_busqueda", "busqueda"),
      visibleWeb:   get("visible_web", "visible") !== "false",
      estatus:      get("estatus", "status") || "activo",
      metadata:     {},
    };
  }).filter((row) => row.codigo && row.nombre && COMPONENT_TYPE_KEYS.includes(row.tipo));
};

export const bulkCreateComponents = async (rows, tenantId) => {
  if (!tenantId || !rows.length) return { created: 0, errors: [] };
  const inserts = rows.map((row) => ({
    tenant_id:     tenantId,
    codigo:        row.codigo,
    nombre:        row.nombre,
    tipo:          row.tipo,
    descripcion:   row.descripcion || "",
    peso:          row.peso || 0,
    unidad:        row.unidad || "g",
    foto_url:      "",
    visible_web:   row.visibleWeb !== false,
    estatus:       row.estatus || "activo",
    orden:         row.orden || 0,
    tags_busqueda: row.tagsBusqueda || "",
    metadata:      row.metadata || {},
  }));
  const { data, error } = await supabase
    .from("product_components")
    .upsert(inserts, { onConflict: "tenant_id,codigo", ignoreDuplicates: false })
    .select();
  if (error) throw error;
  return { created: (data || []).length, errors: [] };
};
