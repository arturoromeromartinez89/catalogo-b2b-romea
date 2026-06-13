import { supabase } from "../lib/supabaseClient";

// ─── Servicio de Capital y Activos fijos ──────────────────────────────────────
// Tablas-documento aditivas (movimientos_capital, activos_fijos). La
// depreciación se calcula aquí (lineal) — no se persiste, se deriva.

const handle = (error, ctx) => { if (error) throw new Error(`${ctx}: ${error.message}`); };

// ── Movimientos de capital ──
export const fetchMovimientosCapital = async (tenantId) => {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from("movimientos_capital")
    .select("*, cuentas_caja_banco(nombre)")
    .eq("tenant_id", tenantId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  handle(error, "fetchMovimientosCapital");
  return (data || []).map((r) => ({
    id: r.id,
    fecha: r.fecha,
    tipo: r.tipo,
    montoMxn: Number(r.monto_mxn || 0),
    concepto: r.concepto || "",
    socio: r.socio || "",
    cuentaId: r.cuenta_id,
    cuentaNombre: r.cuentas_caja_banco?.nombre || "",
    metodo: r.metodo || "",
    notas: r.notas || "",
  }));
};

export const saveMovimientoCapital = async (mov, tenantId) => {
  const payload = {
    tenant_id: tenantId,
    fecha: mov.fecha,
    tipo: mov.tipo,
    monto_mxn: Number(mov.montoMxn || 0),
    concepto: mov.concepto,
    socio: mov.socio || "",
    cuenta_id: mov.cuentaId || null,
    metodo: mov.metodo || "transferencia",
    notas: mov.notas || "",
    updated_at: new Date().toISOString(),
  };
  if (mov.id) {
    const { error } = await supabase.from("movimientos_capital").update(payload).eq("id", mov.id);
    handle(error, "saveMovimientoCapital.update");
  } else {
    const { error } = await supabase.from("movimientos_capital").insert(payload);
    handle(error, "saveMovimientoCapital.insert");
  }
};

export const deleteMovimientoCapital = async (id) => {
  const { error } = await supabase.from("movimientos_capital").delete().eq("id", id);
  handle(error, "deleteMovimientoCapital");
};

// ── Activos fijos ──
export const fetchActivosFijos = async (tenantId) => {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from("activos_fijos")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("fecha_compra", { ascending: false });
  handle(error, "fetchActivosFijos");
  return (data || []).map(normalizeActivo);
};

const normalizeActivo = (r) => {
  const costo = Number(r.costo_mxn || 0);
  const residual = Number(r.valor_residual_mxn || 0);
  const vida = Math.max(1, Number(r.vida_util_meses || 60));
  const dep = depreciacion({ costo, residual, vida, fechaCompra: r.fecha_compra, estatus: r.estatus });
  return {
    id: r.id,
    nombre: r.nombre || "",
    categoria: r.categoria || "otro",
    fechaCompra: r.fecha_compra,
    costoMxn: costo,
    valorResidualMxn: residual,
    vidaUtilMeses: vida,
    proveedor: r.proveedor || "",
    notas: r.notas || "",
    estatus: r.estatus || "activo",
    ...dep,
  };
};

// Depreciación lineal: (costo - residual) / vida, prorrateada por meses transcurridos.
export const depreciacion = ({ costo, residual, vida, fechaCompra, estatus }) => {
  const depMensual = (costo - residual) / vida;
  const meses = mesesTranscurridos(fechaCompra);
  const mesesDep = Math.min(meses, vida);
  let acumulada = Math.max(0, depMensual * mesesDep);
  if (acumulada > costo - residual) acumulada = costo - residual;
  const valorLibros = Math.max(residual, costo - acumulada);
  return {
    depMensual: Math.round(depMensual * 100) / 100,
    depAcumulada: Math.round(acumulada * 100) / 100,
    valorLibros: Math.round(valorLibros * 100) / 100,
    mesesDepreciados: mesesDep,
    totalmenteDepreciado: estatus === "baja" || mesesDep >= vida,
  };
};

const mesesTranscurridos = (fecha) => {
  if (!fecha) return 0;
  const d = new Date(fecha);
  const hoy = new Date();
  return Math.max(0, (hoy.getFullYear() - d.getFullYear()) * 12 + (hoy.getMonth() - d.getMonth()));
};

export const saveActivoFijo = async (activo, tenantId) => {
  const payload = {
    tenant_id: tenantId,
    nombre: activo.nombre,
    categoria: activo.categoria || "maquinaria",
    fecha_compra: activo.fechaCompra,
    costo_mxn: Number(activo.costoMxn || 0),
    valor_residual_mxn: Number(activo.valorResidualMxn || 0),
    vida_util_meses: Math.max(1, Number(activo.vidaUtilMeses || 60)),
    proveedor: activo.proveedor || "",
    notas: activo.notas || "",
    estatus: activo.estatus || "activo",
    updated_at: new Date().toISOString(),
  };
  if (activo.id) {
    const { error } = await supabase.from("activos_fijos").update(payload).eq("id", activo.id);
    handle(error, "saveActivoFijo.update");
  } else {
    const { error } = await supabase.from("activos_fijos").insert(payload);
    handle(error, "saveActivoFijo.insert");
  }
};

export const deleteActivoFijo = async (id) => {
  const { error } = await supabase.from("activos_fijos").delete().eq("id", id);
  handle(error, "deleteActivoFijo");
};

// ── Resumen de capital (para Inicio y para la tarjeta de KPIs) ──
export const resumenCapital = (movimientos = [], activos = []) => {
  const aportado = movimientos.filter((m) => m.tipo === "aportacion").reduce((s, m) => s + m.montoMxn, 0);
  const retirado = movimientos.filter((m) => m.tipo === "retiro").reduce((s, m) => s + m.montoMxn, 0);
  const deudaSocios = aportado - retirado; // lo que el negocio te debe
  const activosVigentes = activos.filter((a) => a.estatus !== "baja");
  const valorActivosLibros = activosVigentes.reduce((s, a) => s + a.valorLibros, 0);
  const costoActivos = activosVigentes.reduce((s, a) => s + a.costoMxn, 0);
  const depAcumuladaTotal = activosVigentes.reduce((s, a) => s + a.depAcumulada, 0);
  return { aportado, retirado, deudaSocios, valorActivosLibros, costoActivos, depAcumuladaTotal };
};
