import { supabase } from "../lib/supabaseClient";

const normalizeItem = (row) => ({
  id: row.id,
  salesOrderId: row.sales_order_id,
  codigo: row.producto_codigo,
  descripcion: row.producto_descripcion,
  metal: row.producto_metal,
  kilataje: row.producto_kilataje,
  linea: row.producto_linea,
  fotoUrl: row.producto_foto_url,
  piezas: Number(row.piezas || 0),
  gramosPorPieza: Number(row.gramos_por_pieza || 0),
  gramosTotal: Number(row.gramos_total || 0),
  laborMxn: Number(row.labor_mxn || 0),
  precioGramoMxn: Number(row.precio_gramo_mxn || 0),
  precioPiezaMxn: Number(row.precio_pieza_mxn || 0),
  subtotalMxn: Number(row.subtotal_mxn || 0),
  comentarios: row.comentarios || "",
  configuracion: row.configuracion || {},
  sortOrder: Number(row.sort_order || 0),
});

export const normalizeSalesOrder = (row) => ({
  id: row.id,
  tenantId: row.tenant_id,
  preorderId: row.preorder_id,
  folio: row.folio,
  status: row.status,
  clientId: row.client_id,
  confirmedBy: row.confirmed_by,
  confirmedAt: row.confirmed_at,
  clienteNombre: row.cliente_nombre,
  clienteEmpresa: row.cliente_empresa,
  clienteEmail: row.cliente_email,
  clienteTelefono: row.cliente_telefono,
  clienteRfc: row.cliente_rfc,
  moneda: row.moneda,
  tipoCambio: Number(row.tipo_cambio || 0),
  totalPiezas: Number(row.total_piezas || 0),
  totalGramos: Number(row.total_gramos || 0),
  totalMxn: Number(row.total_mxn || 0),
  anticipoMxn: Number(row.anticipo_mxn || 0),
  comprobanteUrl: row.comprobante_url || "",
  termsText: row.terms_text || "",
  termsAccepted: Boolean(row.terms_accepted),
  acceptedByName: row.accepted_by_name || "",
  acceptedByEmail: row.accepted_by_email || "",
  acceptedAt: row.accepted_at || "",
  notas: row.notas || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  items: (row.sales_order_items || []).map(normalizeItem),
});

export const fetchSalesOrders = async (tenantId) => {
  let query = supabase
    .from("sales_orders")
    .select("*, sales_order_items(*)")
    .order("confirmed_at", { ascending: false });
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeSalesOrder);
};

export const confirmPreorderAsOrder = async (preorderId, confirmation = {}) => {
  const { data, error } = await supabase.rpc("confirm_preorder_as_order", {
    p_preorder_id: preorderId,
    p_confirmation: confirmation,
  });
  if (error) throw error;
  return data;
};

export const updateSalesOrderStatus = async (id, status) => {
  const { error } = await supabase
    .from("sales_orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
};
