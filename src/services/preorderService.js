import { supabase } from "../lib/supabaseClient";
import { getTenantId, isSuperAdmin, withTenant } from "./tenantUtils";

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
    .order("created_at", { ascending: false });
  query = withTenant(query, tenantId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const fetchPreorder = async (id) => {
  const { data, error } = await supabase
    .from("preorders")
    .select("*, preorder_items(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
};

export const savePreorder = async (preorder, items) => {
  const totals = calcTotals(items, preorder);
  const isExisting = isValidUuid(preorder.id);
  const isNew = !isExisting;

  // Limpiar campos vacíos que son UUID en Supabase
  const {
    preorder_items,
    id,
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
    updated_at: new Date().toISOString(),
  });

  let preorderId = isExisting ? preorder.id : null;

  if (isNew) {
    const { data, error } = await supabase
      .from("preorders")
      .insert(preorderData)
      .select("id")
      .single();
    if (error) throw error;
    preorderId = data.id;
  } else {
    const { error } = await supabase
      .from("preorders")
      .update(preorderData)
      .eq("id", preorderId);
    if (error) throw error;
    // Borrar items anteriores y reinsertarlos
    await supabase.from("preorder_items").delete().eq("preorder_id", preorderId);
  }

  if (items.length > 0) {
    const itemsData = items.map((item, idx) => {
      const {
        id,
        preorder_id,
        created_at,
        _gt_manual,
        _configurable_group,
        _configurable_title,
        _configurable_base_description,
        _configurable_base_foto_url,
        _configurable_base_weight,
        _configurable_selections,
        _configurable_variant_code,
        _configurable_variants,
        comentarios,
        costo_pieza_mxn,
        margen_pieza_pct,
        ...cleanItem
      } = item;
      if (comentarios) {
        cleanItem.producto_descripcion = [cleanItem.producto_descripcion, `Nota: ${comentarios}`].filter(Boolean).join("\n");
      }
      const cleanedItem = cleanItemNumbers({
        ...cleanItem,
        preorder_id: preorderId,
        sort_order: idx,
        updated_at: new Date().toISOString(),
      }, idx);
      cleanOptionalUuid(cleanedItem, "piece_price_list_id");
      cleanOptionalUuid(cleanedItem, "labor_list_id");
      cleanOptionalUuid(cleanedItem, "tenant_id");
      return cleanedItem;
    });
    const { error } = await supabase.from("preorder_items").insert(itemsData);
    if (error) throw error;
  }

  return { id: preorderId, folio: preorderData.folio };
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
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
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
    status: "pendiente",
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
