/**
 * adminModuleService.js
 * Módulo Administrativo ROMEA — capa de servicio para Supabase.
 * Tablas: remisiones, remision_items, cobros, gastos, pagos,
 *         categorias_gasto, cuentas_caja_banco, tenant_features
 */
import { supabase } from "../lib/supabaseClient";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const handleError = (error, context) => {
  console.error(`[adminModule] ${context}:`, error);
  throw new Error(error?.message || `Error en ${context}`);
};

// Genera folio incremental del tipo REM-2026-001
export const generateFolio = (prefix, existing = []) => {
  const year = new Date().getFullYear();
  const used = existing
    .map((f) => {
      const m = String(f || "").match(new RegExp(`^${prefix}-${year}-(\\d+)$`));
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter(Boolean);
  const next = used.length ? Math.max(...used) + 1 : 1;
  return `${prefix}-${year}-${String(next).padStart(3, "0")}`;
};

// ─── TENANT FEATURES ──────────────────────────────────────────────────────────

export const fetchTenantFeatures = async (tenantId) => {
  const { data, error } = await supabase
    .from("tenant_features")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) handleError(error, "fetchTenantFeatures");
  return data;
};

// ─── CATEGORÍAS DE GASTO ──────────────────────────────────────────────────────

export const fetchCategoriasGasto = async (tenantId) => {
  const { data, error } = await supabase
    .from("categorias_gasto")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("activo", true)
    .order("orden");
  if (error) handleError(error, "fetchCategoriasGasto");
  return data || [];
};

export const saveCategoria = async (categoria, tenantId) => {
  const payload = { ...categoria, tenant_id: tenantId };
  if (payload.id) {
    const { data, error } = await supabase
      .from("categorias_gasto")
      .update(payload)
      .eq("id", payload.id)
      .select()
      .single();
    if (error) handleError(error, "saveCategoria.update");
    return data;
  }
  const { data, error } = await supabase
    .from("categorias_gasto")
    .insert(payload)
    .select()
    .single();
  if (error) handleError(error, "saveCategoria.insert");
  return data;
};

// Categorías por defecto para ROMEA
export const DEFAULT_CATEGORIAS = [
  { nombre: "Renta",           orden: 1 },
  { nombre: "Internet",        orden: 2 },
  { nombre: "Sueldo fijo",     orden: 3 },
  { nombre: "Destajo",         orden: 4 },
  { nombre: "Vaciado",         orden: 5 },
  { nombre: "Insumos",         orden: 6 },
  { nombre: "Empaque y envío", orden: 7 },
  { nombre: "Contador",        orden: 8 },
  { nombre: "Compra de plata", orden: 9 },
  { nombre: "Otros",           orden: 10 },
];

export const seedCategoriasDefault = async (tenantId) => {
  const existing = await fetchCategoriasGasto(tenantId);
  if (existing.length > 0) return existing;
  const rows = DEFAULT_CATEGORIAS.map((c) => ({ ...c, tenant_id: tenantId }));
  const { data, error } = await supabase
    .from("categorias_gasto")
    .insert(rows)
    .select();
  if (error) handleError(error, "seedCategoriasDefault");
  return data || [];
};

// ─── CUENTAS CAJA / BANCO ─────────────────────────────────────────────────────

export const fetchCuentas = async (tenantId) => {
  const { data, error } = await supabase
    .from("cuentas_caja_banco")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("activo", true)
    .order("orden");
  if (error) handleError(error, "fetchCuentas");
  return data || [];
};

export const DEFAULT_CUENTAS = [
  { nombre: "Efectivo taller", tipo: "efectivo",   moneda: "MXN", saldo_inicial: 0, gramos_iniciales: 0, orden: 1 },
  { nombre: "Banco BBVA",      tipo: "banco",       moneda: "MXN", saldo_inicial: 0, gramos_iniciales: 0, orden: 2 },
  { nombre: "Mercado Pago",    tipo: "plataforma",  moneda: "MXN", saldo_inicial: 0, gramos_iniciales: 0, orden: 3 },
  { nombre: "Caja Plata .925", tipo: "plata",       moneda: "GRM", saldo_inicial: 0, gramos_iniciales: 0, orden: 4 },
];

export const seedCuentasDefault = async (tenantId) => {
  const existing = await fetchCuentas(tenantId);
  if (existing.length > 0) return existing;
  const rows = DEFAULT_CUENTAS.map((c) => ({ ...c, tenant_id: tenantId, saldo_actual: c.saldo_inicial || 0, gramos_actuales: c.gramos_iniciales || 0 }));
  const { data, error } = await supabase
    .from("cuentas_caja_banco")
    .insert(rows)
    .select();
  if (error) handleError(error, "seedCuentasDefault");
  return data || [];
};

// ─── REMISIONES ───────────────────────────────────────────────────────────────

const normalizeRemision = (row) => ({
  id:                    row.id,
  folio:                 row.folio,
  fecha:                 row.fecha,
  fechaEntrega:          row.fecha_entrega,
  clienteId:             row.client_id,
  clienteNombre:         row.cliente_nombre,
  clienteEmpresa:        row.cliente_empresa,
  moneda:                row.moneda,
  origen:                row.origen,
  preorderId:            row.preorder_id,
  totalGramos:           Number(row.total_gramos || 0),
  subtotal:              Number(row.subtotal || 0),
  descuento:             Number(row.descuento || 0),
  total:                 Number(row.total || 0),
  montoCobrado:          Number(row.monto_cobrado || 0),
  saldoDinero:           Number(row.saldo_dinero || 0),
  cargoPlatGramos:       Number(row.cargo_plata_gramos || 0),
  plataEntregadaGramos:  Number(row.plata_entregada_gramos || 0),
  saldoPlataGramos:      Number(row.saldo_plata_gramos || 0),
  estado:                row.estado,
  metodoEnvio:           row.metodo_envio,
  tracking:              row.tracking,
  notas:                 row.notas,
  kitcoEmision:          Number(row.kitco_emision || 0),
  tipoCambioEmision:     Number(row.tipo_cambio_emision || 0),
  createdAt:             row.created_at,
  updatedAt:             row.updated_at,
  items:                 (row.remision_items || []).map(normalizeRemisionItem),
  cobros:                (row.cobros || []).map(normalizeCobro),
});

const normalizeRemisionItem = (row) => ({
  id:                row.id,
  remisionId:        row.remision_id,
  productoCodigo:    row.producto_codigo,
  productoFotoUrl:   row.producto_foto_url,
  descripcion:       row.descripcion,
  configuracion:     row.configuracion || {},
  cantidad:          Number(row.cantidad || 1),
  gramosPorPieza:    Number(row.gramos_por_pieza || 0),
  gramosTotal:       Number(row.gramos_total || 0),
  laborMxnPorGramo:  Number(row.labor_mxn_por_gramo || 0),
  plataMxnPorGramo:  Number(row.plata_fina_mxn_por_gramo || 0),
  precioTotalPorGramo: Number(row.precio_total_mxn_por_gramo || 0),
  precioUsdPorGramo: Number(row.precio_usd_por_gramo || 0),
  subtotalUsd:       Number(row.subtotal_usd || 0),
  subtotalLaborMxn:  Number(row.subtotal_labor_mxn || 0),
  subtotalPlataGramos: Number(row.subtotal_plata_gramos || 0),
  sortOrder:         Number(row.sort_order || 0),
  notas:             row.notas,
});

export const fetchRemisiones = async (tenantId, { estado, moneda, clienteId, desde, hasta } = {}) => {
  let q = supabase
    .from("remisiones")
    .select(`*, remision_items(*), cobros(id, fecha_cobro, tipo_abono, abono_labor_mxn, abono_usd, medio_pago, monto_recibido, moneda_recibida)`)
    .eq("tenant_id", tenantId)
    .order("fecha", { ascending: false })
    .order("folio", { ascending: false });

  if (estado)    q = q.eq("estado", estado);
  if (moneda)    q = q.eq("moneda", moneda);
  if (clienteId) q = q.eq("client_id", clienteId);
  if (desde)     q = q.gte("fecha", desde);
  if (hasta)     q = q.lte("fecha", hasta);

  const { data, error } = await q;
  if (error) handleError(error, "fetchRemisiones");
  return (data || []).map(normalizeRemision);
};

export const fetchRemisionById = async (id) => {
  const { data, error } = await supabase
    .from("remisiones")
    .select(`*, remision_items(*), cobros(*)`)
    .eq("id", id)
    .single();
  if (error) handleError(error, "fetchRemisionById");
  return normalizeRemision(data);
};

export const createRemision = async (remision, items, tenantId) => {
  // Calcular totales
  const totalGramos = items.reduce((s, i) => s + Number(i.gramosTotal || 0), 0);
  const subtotal = items.reduce((s, i) => {
    if (remision.moneda === "USD") return s + Number(i.subtotalUsd || 0);
    return s + Number(i.subtotalLaborMxn || 0);
  }, 0);
  const total = subtotal - Number(remision.descuento || 0);
  const cargoPlatGramos = remision.moneda === "MXN" ? totalGramos : 0;

  const remisionPayload = {
    tenant_id:            tenantId,
    folio:                remision.folio,
    fecha:                remision.fecha,
    fecha_entrega:        remision.fechaEntrega || null,
    client_id:            remision.clienteId || null,
    cliente_nombre:       remision.clienteNombre || "",
    cliente_empresa:      remision.clienteEmpresa || "",
    cliente_email:        remision.clienteEmail || "",
    cliente_telefono:     remision.clienteTelefono || "",
    moneda:               remision.moneda || "USD",
    origen:               remision.origen || "manual",
    preorder_id:          remision.preorderId || null,
    total_gramos:         totalGramos,
    subtotal,
    descuento:            Number(remision.descuento || 0),
    total,
    monto_cobrado:        0,
    saldo_dinero:         total,
    cargo_plata_gramos:   cargoPlatGramos,
    plata_entregada_gramos: 0,
    saldo_plata_gramos:   cargoPlatGramos,
    kitco_emision:        remision.kitcoEmision || null,
    tipo_cambio_emision:  remision.tipoCambioEmision || null,
    estado:               remision.estado || "borrador",
    metodo_envio:         remision.metodoEnvio || "",
    notas:                remision.notas || "",
  };

  const { data: rem, error: remErr } = await supabase
    .from("remisiones")
    .insert(remisionPayload)
    .select()
    .single();
  if (remErr) handleError(remErr, "createRemision.insert");

  if (items.length > 0) {
    const itemsPayload = items.map((item, idx) => ({
      remision_id:                 rem.id,
      tenant_id:                   tenantId,
      producto_codigo:             item.productoCodigo || "",
      producto_foto_url:           item.productoFotoUrl || "",
      descripcion:                 item.descripcion,
      configuracion:               item.configuracion || {},
      cantidad:                    Number(item.cantidad || 1),
      gramos_por_pieza:            Number(item.gramosPorPieza || 0),
      gramos_total:                Number(item.gramosTotal || 0),
      labor_mxn_por_gramo:         Number(item.laborMxnPorGramo || 0),
      plata_fina_mxn_por_gramo:    Number(item.plataMxnPorGramo || 0),
      precio_total_mxn_por_gramo:  Number(item.precioTotalPorGramo || 0),
      precio_usd_por_gramo:        Number(item.precioUsdPorGramo || 0),
      subtotal_usd:                Number(item.subtotalUsd || 0),
      subtotal_labor_mxn:          Number(item.subtotalLaborMxn || 0),
      subtotal_plata_gramos:       Number(item.gramosTotal || 0),
      sort_order:                  idx,
      notas:                       item.notas || "",
    }));
    const { error: itemsErr } = await supabase.from("remision_items").insert(itemsPayload);
    if (itemsErr) handleError(itemsErr, "createRemision.items");
  }

  return fetchRemisionById(rem.id);
};

export const updateRemision = async (remisionId, remision, items, tenantId) => {
  const totalGramos = items.reduce((s, i) => s + Number(i.gramosTotal || 0), 0);
  const subtotal = items.reduce((s, i) => {
    if (remision.moneda === "USD") return s + Number(i.subtotalUsd || 0);
    return s + Number(i.subtotalLaborMxn || 0);
  }, 0);
  const total = subtotal - Number(remision.descuento || 0);
  const cargoPlatGramos = remision.moneda === "MXN"
    ? items.reduce((s, i) => s + Number(i.gramosTotal || 0), 0)
    : 0;

  const payload = {
    folio:                remision.folio,
    fecha:                remision.fecha,
    fecha_entrega:        remision.fechaEntrega || null,
    client_id:            remision.clienteId || remision.client_id || null,
    cliente_nombre:       remision.clienteNombre || "",
    cliente_empresa:      remision.clienteEmpresa || "",
    cliente_email:        remision.clienteEmail || "",
    cliente_telefono:     remision.clienteTelefono || "",
    moneda:               remision.moneda || "USD",
    preorder_id:          remision.preorderId || null,
    total_gramos:         totalGramos,
    subtotal,
    descuento:            Number(remision.descuento || 0),
    total,
    cargo_plata_gramos:   cargoPlatGramos,
    kitco_emision:        remision.kitcoEmision || null,
    tipo_cambio_emision:  remision.tipoCambioEmision || null,
    estado:               remision.estado || "borrador",
    notas:                remision.notas || "",
    updated_at:           new Date().toISOString(),
  };

  const { error: remErr } = await supabase.from("remisiones").update(payload).eq("id", remisionId);
  if (remErr) handleError(remErr, "updateRemision");

  // Reemplazar items
  await supabase.from("remision_items").delete().eq("remision_id", remisionId);
  if (items.length > 0) {
    const itemsPayload = items.map((item, idx) => ({
      remision_id:                 remisionId,
      tenant_id:                   tenantId,
      producto_codigo:             item.productoCodigo || "",
      producto_foto_url:           item.productoFotoUrl || "",
      descripcion:                 item.descripcion,
      configuracion:               item.configuracion || {},
      cantidad:                    Number(item.cantidad || 1),
      gramos_por_pieza:            Number(item.gramosPorPieza || 0),
      gramos_total:                Number(item.gramosTotal || 0),
      labor_mxn_por_gramo:         Number(item.laborMxnPorGramo || 0),
      plata_fina_mxn_por_gramo:    Number(item.plataMxnPorGramo || 0),
      precio_total_mxn_por_gramo:  Number(item.precioTotalPorGramo || 0),
      precio_usd_por_gramo:        Number(item.precioUsdPorGramo || 0),
      subtotal_usd:                Number(item.subtotalUsd || 0),
      subtotal_labor_mxn:          Number(item.subtotalLaborMxn || 0),
      subtotal_plata_gramos:       Number(item.gramosTotal || 0),
      sort_order:                  idx,
      notas:                       item.notas || "",
    }));
    const { error: itemsErr } = await supabase.from("remision_items").insert(itemsPayload);
    if (itemsErr) handleError(itemsErr, "updateRemision.items");
  }

  return fetchRemisionById(remisionId);
};

export const saveRemision = async (remision, items, tenantId) => {
  const isExisting = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(remision.id || ""));
  if (isExisting) return updateRemision(remision.id, remision, items, tenantId);
  return createRemision(remision, items, tenantId);
};

export const updateRemisionEstado = async (id, estado) => {
  const { error } = await supabase
    .from("remisiones")
    .update({ estado, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) handleError(error, "updateRemisionEstado");
};

export const cancelarRemision = async (id) => updateRemisionEstado(id, "cancelada");

// ─── COBROS ───────────────────────────────────────────────────────────────────

const normalizeCobro = (row) => ({
  id:                    row.id,
  remisionId:            row.remision_id,
  clienteId:             row.client_id,
  fechaCobro:            row.fecha_cobro,
  tipoAbono:             row.tipo_abono,
  abonoLaborMxn:         Number(row.abono_labor_mxn || 0),
  abonoPlataGramos:      Number(row.abono_plata_gramos || 0),
  abonoUsd:              Number(row.abono_usd || 0),
  medioPago:             row.medio_pago,
  montoRecibido:         Number(row.monto_recibido || 0),
  monedaRecibida:        row.moneda_recibida,
  tipoCambio:            Number(row.tipo_cambio || 0),
  montoMxnEquivalente:   Number(row.monto_mxn_equivalente || 0),
  gramosRecibidos:       Number(row.gramos_recibidos || 0),
  kitcoDia:              Number(row.kitco_dia || 0),
  valorMxnPlata:         Number(row.valor_mxn_plata_recibida || 0),
  gananciaCambiariaMxn:  Number(row.ganancia_cambiaria_mxn || 0),
  referenciaBancaria:    row.referencia_bancaria,
  cajaBancoId:           row.caja_banco_id,
  cuentaPlataId:         row.cuenta_plata_id,
  notas:                 row.notas,
  createdAt:             row.created_at,
});

export const registrarCobro = async (cobro, tenantId) => {
  if (!cobro.cuentaId) {
    throw new Error("Selecciona una caja o cuenta real antes de registrar el cobro.");
  }

  const esPlataFisica = cobro.medioPago === "plata_fisica";

  // 1. Insertar cobro. remision_id null = anticipo (cliente adelanta dinero sin
  //    venta asociada → genera saldo a favor de ese cliente).
  const payload = {
    tenant_id:              tenantId,
    remision_id:            cobro.remisionId || null,
    client_id:              cobro.clienteId || null,
    fecha_cobro:            cobro.fechaCobro,
    tipo_abono:             cobro.tipoAbono,
    abono_labor_mxn:        Number(cobro.abonoLaborMxn || 0),
    abono_plata_gramos:     Number(cobro.abonoPlataGramos || 0),
    abono_usd:              Number(cobro.abonoUsd || 0),
    medio_pago:             cobro.medioPago,
    monto_recibido:         esPlataFisica ? null : Number(cobro.montoRecibido || 0),
    moneda_recibida:        esPlataFisica ? null : (cobro.monedaRecibida || "MXN"),
    tipo_cambio:            Number(cobro.tipoCambio || 0) || null,
    monto_mxn_equivalente:  Number(cobro.montoMxnEquivalente || 0),
    gramos_recibidos:       Number(cobro.gramosRecibidos || 0) || null,
    kitco_dia:              Number(cobro.kitcoDia || 0) || null,
    valor_mxn_plata_recibida: Number(cobro.valorMxnPlata || 0) || null,
    ganancia_cambiaria_mxn: Number(cobro.gananciaCambiariaMxn || 0),
    referencia_bancaria:    cobro.referenciaBancaria || null,
    caja_banco_id:          esPlataFisica ? null : cobro.cuentaId,
    cuenta_plata_id:        esPlataFisica ? cobro.cuentaId : null,
    notas:                  cobro.notas || null,
  };

  const { data: newCobro, error: cobroErr } = await supabase
    .from("cobros")
    .insert(payload)
    .select()
    .single();
  if (cobroErr) handleError(cobroErr, "registrarCobro.insert");

  // 2. Si está asociado a una remisión, actualizar sus saldos (SIN cambiar
  //    estado — es delivery-based). Un anticipo no toca ninguna remisión.
  if (cobro.remisionId) {
    const remision = await fetchRemisionById(cobro.remisionId);
    const nuevoMontoCobrado = remision.montoCobrado + Number(cobro.abonoUsd || cobro.abonoLaborMxn || 0);
    const nuevoSaldo = Math.max(0, remision.total - nuevoMontoCobrado);
    const nuevoSaldoPlata = Math.max(0, remision.saldoPlataGramos - Number(cobro.abonoPlataGramos || 0));

    await supabase
      .from("remisiones")
      .update({
        monto_cobrado:          nuevoMontoCobrado,
        saldo_dinero:           nuevoSaldo,
        plata_entregada_gramos: remision.plataEntregadaGramos + Number(cobro.abonoPlataGramos || 0),
        saldo_plata_gramos:     nuevoSaldoPlata,
        updated_at:             new Date().toISOString(),
      })
      .eq("id", cobro.remisionId);
  }

  return newCobro;
};


export const fetchCobros = async (tenantId, { remisionId, desde, hasta } = {}) => {
  let q = supabase
    .from("cobros")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("fecha_cobro", { ascending: false });

  if (remisionId) q = q.eq("remision_id", remisionId);
  if (desde)      q = q.gte("fecha_cobro", desde);
  if (hasta)      q = q.lte("fecha_cobro", hasta);

  const { data, error } = await q;
  if (error) handleError(error, "fetchCobros");
  return (data || []).map(normalizeCobro);
};

// ─── GASTOS ───────────────────────────────────────────────────────────────────

const normalizeGasto = (row) => ({
  id:              row.id,
  fecha:           row.fecha,
  descripcion:     row.descripcion,
  categoriaId:     row.categoria_id,
  categoriaNombre: row.categorias_gasto?.nombre || "",
  centroCostoId:   row.centro_costo_id,
  montoMxn:        Number(row.monto_mxn || 0),
  montoPagadoMxn:  Number(row.monto_pagado_mxn || 0),
  saldoMxn:        Number(row.saldo_mxn || 0),
  estado:          row.estado,
  tipoGasto:       row.tipo_gasto,
  beneficiario:    row.beneficiario,
  comprobanteUrl:  row.comprobante_url,
  notas:           row.notas,
  createdAt:       row.created_at,
});

export const fetchGastos = async (tenantId, { estado, categoriaId, desde, hasta, tipoGasto } = {}) => {
  let q = supabase
    .from("gastos")
    .select("*, categorias_gasto(nombre)")
    .eq("tenant_id", tenantId)
    .order("fecha", { ascending: false });

  if (estado)      q = q.eq("estado", estado);
  if (categoriaId) q = q.eq("categoria_id", categoriaId);
  if (tipoGasto)   q = q.eq("tipo_gasto", tipoGasto);
  if (desde)       q = q.gte("fecha", desde);
  if (hasta)       q = q.lte("fecha", hasta);

  const { data, error } = await q;
  if (error) handleError(error, "fetchGastos");
  return (data || []).map(normalizeGasto);
};

export const saveGasto = async (gasto, tenantId) => {
  const payload = {
    tenant_id:       tenantId,
    fecha:           gasto.fecha,
    descripcion:     gasto.descripcion,
    categoria_id:    gasto.categoriaId || null,
    monto_mxn:       Number(gasto.montoMxn || 0),
    monto_pagado_mxn: Number(gasto.montoPagadoMxn || 0),
    saldo_mxn:       Number(gasto.montoMxn || 0) - Number(gasto.montoPagadoMxn || 0),
    estado:          gasto.montoPagadoMxn >= gasto.montoMxn ? "pagado" : gasto.montoPagadoMxn > 0 ? "parcial" : "pendiente",
    tipo_gasto:      gasto.tipoGasto || "variable",
    beneficiario:    gasto.beneficiario || "",
    comprobante_url: gasto.comprobanteUrl || "",
    notas:           gasto.notas || "",
    updated_at:      new Date().toISOString(),
  };

  if (gasto.id) {
    const { data, error } = await supabase.from("gastos").update(payload).eq("id", gasto.id).select("*, categorias_gasto(nombre)").single();
    if (error) handleError(error, "saveGasto.update");
    return normalizeGasto(data);
  }
  const { data, error } = await supabase.from("gastos").insert(payload).select("*, categorias_gasto(nombre)").single();
  if (error) handleError(error, "saveGasto.insert");
  return normalizeGasto(data);
};

export const pagarGasto = async (gastoId, montoPago, cuentaId, tenantId, metodo = "transferencia") => {
  const { data: gasto, error: gErr } = await supabase.from("gastos").select("*").eq("id", gastoId).single();
  if (gErr) handleError(gErr, "pagarGasto.fetch");

  const nuevoMontoPagado = Number(gasto.monto_pagado_mxn || 0) + Number(montoPago);
  const nuevoSaldo = Math.max(0, Number(gasto.monto_mxn) - nuevoMontoPagado);
  const nuevoEstado = nuevoSaldo <= 0.01 ? "pagado" : nuevoMontoPagado > 0 ? "parcial" : "pendiente";

  const { error: uErr } = await supabase.from("gastos").update({
    monto_pagado_mxn: nuevoMontoPagado,
    saldo_mxn: nuevoSaldo,
    estado: nuevoEstado,
    updated_at: new Date().toISOString(),
  }).eq("id", gastoId);
  if (uErr) handleError(uErr, "pagarGasto.update");

  // Registrar pago
  const { error: pErr } = await supabase.from("pagos").insert({
    tenant_id:   tenantId,
    gasto_id:    gastoId,
    fecha_pago:  new Date().toISOString().split("T")[0],
    monto_mxn:   Number(montoPago),
    caja_banco_id: cuentaId,
    metodo_pago: metodo,
  });
  if (pErr) handleError(pErr, "pagarGasto.pago");
};

export const deleteGasto = async (id) => {
  const { error } = await supabase.from("gastos").delete().eq("id", id);
  if (error) handleError(error, "deleteGasto");
};

// ─── BALANCE / RESUMEN ────────────────────────────────────────────────────────

export const fetchBalanceData = async (tenantId, { desde, hasta } = {}) => {
  const hoy = new Date().toISOString().split("T")[0];
  const inicioMes = hoy.slice(0, 8) + "01";
  const d = desde || inicioMes;
  const h = hasta || hoy;

  const [remisionesRes, cobrosRes, gastosRes] = await Promise.all([
    supabase.from("remisiones").select("moneda, total, monto_cobrado, saldo_dinero, saldo_plata_gramos, estado, fecha")
      .eq("tenant_id", tenantId).neq("estado", "cancelada"),
    supabase.from("cobros").select("tipo_abono, abono_labor_mxn, abono_usd, monto_mxn_equivalente, ganancia_cambiaria_mxn, fecha_cobro")
      .eq("tenant_id", tenantId).gte("fecha_cobro", d).lte("fecha_cobro", h),
    supabase.from("gastos").select("monto_mxn, monto_pagado_mxn, saldo_mxn, estado, tipo_gasto, fecha, categoria_id, categorias_gasto(nombre)")
      .eq("tenant_id", tenantId).gte("fecha", d).lte("fecha", h),
  ]);

  if (remisionesRes.error) handleError(remisionesRes.error, "balance.remisiones");
  if (cobrosRes.error)     handleError(cobrosRes.error, "balance.cobros");
  if (gastosRes.error)     handleError(gastosRes.error, "balance.gastos");

  const remisiones = remisionesRes.data || [];
  const cobros     = cobrosRes.data || [];
  const gastos     = gastosRes.data || [];

  // CxC
  const cxcUsd = remisiones.filter((r) => r.moneda === "USD" && r.saldo_dinero > 0)
    .reduce((s, r) => s + Number(r.saldo_dinero), 0);
  const cxcMxn = remisiones.filter((r) => r.moneda === "MXN" && r.saldo_dinero > 0)
    .reduce((s, r) => s + Number(r.saldo_dinero), 0);
  const cxcPlataGramos = remisiones.filter((r) => r.saldo_plata_gramos > 0)
    .reduce((s, r) => s + Number(r.saldo_plata_gramos), 0);

  // Ventas del periodo
  const ventasUsd = remisiones.filter((r) => r.moneda === "USD" && r.fecha >= d && r.fecha <= h)
    .reduce((s, r) => s + Number(r.total), 0);
  const ventasMxn = remisiones.filter((r) => r.moneda === "MXN" && r.fecha >= d && r.fecha <= h)
    .reduce((s, r) => s + Number(r.total), 0);

  // Cobros del periodo
  const cobradoUsd = cobros.filter((c) => c.tipo_abono === "total_usd")
    .reduce((s, c) => s + Number(c.abono_usd || 0), 0);
  const cobradoMxn = cobros.filter((c) => c.tipo_abono === "labor_mxn")
    .reduce((s, c) => s + Number(c.abono_labor_mxn || 0), 0);
  const gananciaCambiaria = cobros.reduce((s, c) => s + Number(c.ganancia_cambiaria_mxn || 0), 0);

  // Gastos del periodo
  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto_mxn || 0), 0);
  const gastosFijos = gastos.filter((g) => g.tipo_gasto === "fijo").reduce((s, g) => s + Number(g.monto_mxn || 0), 0);
  const gastosVariables = gastos.filter((g) => g.tipo_gasto === "variable").reduce((s, g) => s + Number(g.monto_mxn || 0), 0);
  const gastosPendientes = gastos.filter((g) => g.estado !== "pagado").reduce((s, g) => s + Number(g.saldo_mxn || 0), 0);

  // Por categoría
  const gastosPorCategoria = {};
  gastos.forEach((g) => {
    const cat = g.categorias_gasto?.nombre || "Sin categoría";
    gastosPorCategoria[cat] = (gastosPorCategoria[cat] || 0) + Number(g.monto_mxn || 0);
  });

  // Remisiones por estado
  const remisionesPorEstado = {};
  remisiones.forEach((r) => {
    remisionesPorEstado[r.estado] = (remisionesPorEstado[r.estado] || 0) + 1;
  });

  return {
    periodo: { desde: d, hasta: h },
    cxc: { usd: cxcUsd, mxn: cxcMxn, plataGramos: cxcPlataGramos },
    ventas: { usd: ventasUsd, mxn: ventasMxn },
    cobrado: { usd: cobradoUsd, mxn: cobradoMxn },
    gananciaCambiaria,
    gastos: { total: totalGastos, fijos: gastosFijos, variables: gastosVariables, pendientes: gastosPendientes, porCategoria: gastosPorCategoria },
    remisionesPorEstado,
  };
};
