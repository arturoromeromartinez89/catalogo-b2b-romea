import { supabase } from "../lib/supabaseClient";
import { getTenantId, isSuperAdmin, withTenant } from "./tenantUtils";

const buildFolio = () => {
  const d = new Date();
  const pad = (v) => String(v).padStart(2, "0");
  return `PRE-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};

const calcTotals = (items) => ({
  total_piezas: items.reduce((s, i) => s + Number(i.piezas || 0), 0),
  total_gramos: items.reduce((s, i) => s + Number(i.gramos_total || 0), 0),
  total_mxn: items.reduce((s, i) => s + Number(i.subtotal_mxn || 0), 0),
});

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
  const totals = calcTotals(items);
  const isNew = !preorder.id;

  // Limpiar campos vacíos que son UUID en Supabase
  const { preorder_items, id, ...clean } = { ...preorder };
  if (!clean.client_id) clean.client_id = null;
  if (!clean.created_by) clean.created_by = null;
  if (!clean.tenant_id && !clean.tenantId) delete clean.tenant_id;
  if (clean.tenantId) {
    clean.tenant_id = clean.tenantId;
    delete clean.tenantId;
  }

  const preorderData = {
    ...clean,
    folio: clean.folio || buildFolio(),
    ...totals,
    updated_at: new Date().toISOString(),
  };

  let preorderId = preorder.id;

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
    const itemsData = items.map((item, idx) => ({
      ...item,
      preorder_id: preorderId,
      sort_order: idx,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("preorder_items").insert(itemsData);
    if (error) throw error;
  }

  return preorderId;
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
