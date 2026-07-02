import { supabase } from "../lib/supabaseClient";
import { getTenantId, isSuperAdmin, withTenant } from "./tenantUtils";
import { sortPreordersByLastSaved } from "../utils/preorderSorting";

const buildFolio = () => {
  const d = new Date();
  const pad = (v) => String(v).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PRE-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${suffix}`;
};

const calcTotals = (items, preorder = {}) => ({
  total_piezas: items.reduce((s, i) => s + Number(i.piezas || 0), 0),
  total_gramos: items.reduce((s, i) => s + Number(i.gramos_total || 0), 0),
  total_mxn: items.reduce((s, i) => s + Number(i.subtotal_mxn || 0), 0),
});

const toDbNumber = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const number = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : fallback;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => typeof value === "string" && UUID_RE.test(value);

const cleanOptionalUuid = (record, field, emptyValue = undefined) => {
  if (!record[field] || !isValidUuid(record[field])) {
    if (emptyValue === undefined) delete record[field];
    else record[field] = emptyValue;
  }
};

const cleanPreorderNumbers = (preorderData) => ({
  ...preorderData,
  tipo_cambio: toDbNumber(preorderData.tipo_cambio, 0),
  total_piezas: toDbNumber(preorderData.total_piezas, 0),
  total_gramos: toDbNumber(preorderData.total_gramos, 0),
  total_mxn: toDbNumber(preorderData.total_mxn, 0),
});

const cleanItemNumbers = (item, idx) => ({
  ...item,
  piezas: toDbNumber(item.piezas, 0),
  gramos_por_pieza: toDbNumber(item.gramos_por_pieza, 0),
  gramos_total: toDbNumber(item.gramos_total, 0),
  labor_mxn: toDbNumber(item.labor_mxn, 0),
  precio_gramo_mxn: toDbNumber(item.precio_gramo_mxn, 0),
  precio_pieza_mxn: toDbNumber(item.precio_pieza_mxn, 0),
  subtotal_mxn: toDbNumber(item.subtotal_mxn, 0),
  sort_order: toDbNumber(item.sort_order, idx),
});

const publicComponentSelection = (selection) => selection ? {
  id: selection.id || null,
  codigo: selection.codigo || "",
  nombre: selection.nombre || "",
  label: selection.label || selection.nombre || "",
  size: selection.size || "",
  tipo: selection.tipo || "",
  peso: Number(selection.peso || 0),
  unidad: selection.unidad || "",
  fotoUrl: selection.fotoUrl || "",
  metadata: selection.metadata || {},
  product: selection.product ? {
    codigo: selection.product.codigo || "",
    descripcion: selection.product.descripcion || "",
    metal: selection.product.metal || "",
    kilataje: selection.product.kilataje || "",
    linea: selection.product.linea || "",
    fotoUrl: selection.product.fotoUrl || "",
    pesoPromedio: Number(selection.product.pesoPromedio || 0),
  } : null,
} : null;

const itemConfiguration = (item) => {
  if (!item?._configurable_group) return null;
  const selections = Object.fromEntries(
    Object.entries(item._configurable_selections || {})
      .map(([key, selection]) => [key, publicComponentSelection(selection)])
      .filter(([, selection]) => selection)
  );
  return {
    version: 1,
    group: true,
    type: item._configurable_type || "components",
    base_code: item._configurable_base_code || "",
    title: item._configurable_title || "",
    base_description: item._configurable_base_description || "",
    base_photo_url: item._configurable_base_foto_url || "",
    base_weight: Number(item._configurable_base_weight || 0),
    selections,
    variants: (item._configurable_variants || []).map((variant) => ({
      code: variant.code || "",
      label: variant.label || "",
      size: variant.size || "",
      product: variant.product ? {
        codigo: variant.product.codigo || "",
        descripcion: variant.product.descripcion || "",
        metal: variant.product.metal || "",
        kilataje: variant.product.kilataje || "",
        linea: variant.product.linea || "",
        fotoUrl: variant.product.fotoUrl || "",
        pesoPromedio: Number(variant.product.pesoPromedio || 0),
      } : null,
    })),
    variant_code: item._configurable_variant_code || "",
  };
};

const hydratePreorderItem = (item) => {
  const config = item?.configuracion;
  if (!config?.group) return item;
  return {
    ...item,
    _configurable_group: true,
    _configurable_type: config.type || "components",
    _configurable_base_code: config.base_code || "",
    _configurable_title: config.title || "",
    _configurable_base_description: config.base_description || "",
    _configurable_base_foto_url: config.base_photo_url || "",
    _configurable_base_weight: Number(config.base_weight || 0),
    _configurable_selections: config.selections || {},
    _configurable_variants: config.variants || [],
    _configurable_variant_code: config.variant_code || "",
  };
};

const hydratePreorder = (preorder) => {
  const items = (preorder?.preorder_items || []).map(hydratePreorderItem);
  return {
    ...preorder,
    preorder_items: items,
    _integrity_issue: items.length === 0 && Number(preorder?.total_piezas || 0) > 0
      ? "missing_items"
      : null,
  };
};

const buildItemPayload = (item, idx) => cleanItemNumbers({
  producto_codigo: item.producto_codigo,
  producto_descripcion: item.producto_descripcion || "",
  producto_metal: item.producto_metal || "",
  producto_kilataje: item.producto_kilataje || "",
  producto_linea: item.producto_linea || "",
  producto_foto_url: item.producto_foto_url || "",
  piezas: item.piezas,
  gramos_por_pieza: item.gramos_por_pieza,
  gramos_total: item.gramos_total,
  labor_mxn: item.labor_mxn,
  precio_gramo_mxn: item.precio_gramo_mxn,
  pricing_mode: item.pricing_mode || "gram",
  piece_price_list_id: isValidUuid(item.piece_price_list_id) ? item.piece_price_list_id : null,
  precio_pieza_mxn: item.precio_pieza_mxn,
  subtotal_mxn: item.subtotal_mxn,
  sort_order: idx,
  comentarios: item.comentarios || "",
  configuracion: itemConfiguration(item),
}, idx);

const normalizePreorderStatus = (status) => {
  const allowed = new Set(["pendiente", "revision", "confirmada", "cancelada"]);
  return allowed.has(status) ? status : "pendiente";
};

// ── ADMIN ─────────────────────────────────────────────────
export const fetchAllPreorders = async (profile) => {
  const tenantId = isSuperAdmin(profile) ? "" : getTenantId(profile);
  let query = supabase
    .from("preorders")
    .select("*, preorder_items(*)")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });
  query = withTenant(query, tenantId);
  const { data, error } = await query;
  if (error) throw error;
  if (!data?.length) return [];

  // Separate query for creator roles — inline FK join not available in this schema cache
  const creatorIds = [...new Set(data.map((p) => p.created_by).filter(Boolean))];
  if (creatorIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, role")
      .in("id", creatorIds);
    if (profiles?.length) {
      const roleMap = new Map(profiles.map((p) => [p.id, p.role]));
      return sortPreordersByLastSaved(data.map((po) => hydratePreorder({
        ...po,
        creator: po.created_by ? { role: roleMap.get(po.created_by) || "admin" } : null,
      })));
    }
  }
  return sortPreordersByLastSaved(data.map(hydratePreorder));
};

export const fetchPreorder = async (id) => {
  const { data, error } = await supabase
    .from("preorders")
    .select("*, preorder_items(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return hydratePreorder(data);
};

/**
 * Guarda una preorden. Acepta un objeto de opciones:
 *   expectedUpdatedAt  — timestamp (string ISO) de la versión que tenemos en memoria.
 *                        Si la DB ya tiene un updated_at distinto, lanzamos un error
 *                        de tipo "CONFLICT" para que el editor pueda informar al usuario.
 *   forceOverwrite     — si es true, omite el chequeo de versión y guarda de todas formas.
 */
export const savePreorder = async (preorder, items, { expectedUpdatedAt = null, forceOverwrite = false } = {}) => {
  const totals = calcTotals(items, preorder);
  const isExisting = isValidUuid(preorder.id);
  const newUpdatedAt = new Date().toISOString();

  // Limpiar campos vacíos que son UUID en Supabase
  const {
    preorder_items,
    id,
    creator,          // campo sintético — no existe como columna en DB
    aplicar_iva,
    mostrar_desglose,
    pf_mode,
    kitco_usd_oz,
    premio_pct,
    plata_fina_mxn,
    plataFinaMxn,
    total_subtotal_mxn,
    total_iva_mxn,
    ...clean
  } = { ...preorder };
  cleanOptionalUuid(clean, "client_id", null);
  cleanOptionalUuid(clean, "created_by", null);
  cleanOptionalUuid(clean, "labor_list_id");
  cleanOptionalUuid(clean, "piece_price_list_id");
  if (!clean.tenant_id && !clean.tenantId) delete clean.tenant_id;
  if (clean.tenantId) {
    clean.tenant_id = clean.tenantId;
    delete clean.tenantId;
  }
  cleanOptionalUuid(clean, "tenant_id");

  const preorderData = cleanPreorderNumbers({
    ...clean,
    status: normalizePreorderStatus(clean.status),
    folio: clean.folio || buildFolio(),
    ...totals,
    updated_at: newUpdatedAt,
  });

  const itemsData = items.map(buildItemPayload);
  const rpcPreorder = {
    ...preorderData,
    id: isExisting ? preorder.id : null,
  };

  const { data, error } = await supabase.rpc("save_preorder_transaction", {
    p_preorder: rpcPreorder,
    p_items: itemsData,
    p_expected_updated_at: expectedUpdatedAt || null,
    p_force: forceOverwrite,
  });

  if (error) {
    const errorMessage = String(error.message || "");
    if (errorMessage.startsWith("CONFLICT|")) {
      const [, dbUpdatedAt = "", folio = ""] = errorMessage.split("|");
      const conflictError = new Error(error.message);
      conflictError.isConflict = true;
      conflictError.dbUpdatedAt = dbUpdatedAt || null;
      conflictError.folio = folio || null;
      throw conflictError;
    }
    throw error;
  }

  return {
    id: data.id,
    folio: data.folio,
    updatedAt: data.updated_at || newUpdatedAt,
  };
};

export const updatePreorderStatus = async (id, status) => {
  const { error } = await supabase.from("preorders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
};

export const deletePreorder = async (id) => {
  const { error } = await supabase.from("preorders").delete().eq("id", id);
  if (error) throw error;
};

// ── CLIENTE ───────────────────────────────────────────────
export const fetchClientPreorders = async (clientId) => {
  const { data, error } = await supabase
    .from("preorders")
    .select("*, preorder_items(*)")
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return sortPreordersByLastSaved((data || []).map(hydratePreorder));
};

export const submitClientPreorder = async (profile, cartItems, customer) => {
  const items = cartItems.map((item, idx) => ({
    producto_codigo: item.product.codigo,
    producto_descripcion: item.product.descripcion,
    producto_metal: item.product.metal,
    producto_kilataje: item.product.kilataje,
    producto_linea: item.product.linea,
    producto_foto_url: item.product.fotoUrl,
    piezas: Number(item.quantity || 1),
    gramos_por_pieza: Number(item.product.pesoPromedio || 0),
    gramos_total: Number(item.product.pesoPromedio || 0) * Number(item.quantity || 1),
    labor_mxn: Number(item.product.quoteLaborPerGram || 0),
    precio_gramo_mxn: Number(item.product.quotePricePerGram || item.product.precioMinimo || 0),
    subtotal_mxn:
      Number(item.product.quotePricePerGram || item.product.precioMinimo || 0) *
      Number(item.product.pesoPromedio || 0) *
      Number(item.quantity || 1),
    sort_order: idx,
  }));

  const preorder = {
    folio: buildFolio(),
    status: "revision",
    client_id: profile.client_id,
    created_by: profile.id,
    cliente_nombre: customer.name,
    cliente_empresa: customer.company,
    cliente_email: customer.email,
    cliente_telefono: customer.phone,
    cliente_rfc: customer.rfc,
    tipo_cambio: Number(customer.tipoCambio || 0),
    moneda: customer.currency || "MXN",
    notas: customer.notes,
    tenant_id: profile.tenant_id || profile.tenantId || null,
  };

  return savePreorder(preorder, items);
};
