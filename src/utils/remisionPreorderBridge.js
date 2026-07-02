/**
 * remisionPreorderBridge.js
 * ---------------------------------------------------------------------------
 * Puente entre el formato de Remisión y el del PreorderEditor.
 *
 * La Remisión reutiliza EXACTAMENTE el mismo componente que la Preorden
 * (PreorderEditor en documentType="remision"). Para lograrlo sin duplicar
 * código, estas funciones traducen entre los dos formatos:
 *
 *   - remisionToPreorderInitial(): remisión (o borrador) → estado inicial del editor
 *   - makeRemisionSaveDocument():  guarda el estado del editor como remisión
 *
 * Regla de negocio: una remisión solo lleva productos REGISTRADOS (con SKU).
 * Al importar desde preorden se cargan los valores de cálculo de PF y quedan
 * editables (porque el item del editor usa labor_mxn + precio_gramo_mxn).
 */
import { saveRemision } from "../services/adminModuleService";

// Estados de la remisión — 3 estatus (sin "Entregada"). El "tone" define el
// color tenue cuando el estatus está activo (los inactivos van en gris).
// Orden visual de izquierda a derecha: Activa, Borrador, Cancelada.
export const REMISION_STATUS = {
  activa:    { label: "Activa",    tone: "green" },
  borrador:  { label: "Borrador",  tone: "blue" },
  cancelada: { label: "Cancelada", tone: "red" },
};

export const REMISION_LABELS = {
  eyebrowNew:      "Nueva remisión",
  sheetTitle:      "Remisión",
  notesPlaceholder: "Instrucciones de envío, observaciones...",
};

const today = () => new Date().toISOString().split("T")[0];

// ── Configurables: preservar componentes (tejido/broche/placa) entre preorden
//    y remisión, igual que preorderService (itemConfiguration / hydrate). Sin
//    esto, la remisión guardada perdía las imágenes de componentes en el PDF.
const publicComp = (s) => (s ? {
  codigo: s.codigo || "", nombre: s.nombre || "", label: s.label || s.nombre || "", size: s.size || "", peso: Number(s.peso || 0),
  unidad: s.unidad || "", fotoUrl: s.fotoUrl || s.foto_url || "", metadata: s.metadata || {},
  product: s.product ? {
    codigo: s.product.codigo || "",
    descripcion: s.product.descripcion || "",
    metal: s.product.metal || "",
    kilataje: s.product.kilataje || "",
    linea: s.product.linea || "",
    fotoUrl: s.product.fotoUrl || "",
    pesoPromedio: Number(s.product.pesoPromedio || 0),
  } : null,
} : null);

const buildConfiguracion = (item) => {
  if (!item?._configurable_group) return item?.configuracion || null;
  const selections = Object.fromEntries(
    Object.entries(item._configurable_selections || {})
      .map(([k, s]) => [k, publicComp(s)])
      .filter(([, s]) => s)
  );
  return {
    version: 1, group: true,
    type: item._configurable_type || "components",
    base_code: item._configurable_base_code || "",
    title: item._configurable_title || "",
    base_description: item._configurable_base_description || "",
    base_photo_url: item._configurable_base_foto_url || "",
    base_weight: Number(item._configurable_base_weight || 0),
    selections,
    variants: (item._configurable_variants || []).map((v) => ({
      code: v.code || "",
      label: v.label || "",
      size: v.size || "",
      product: v.product ? {
        codigo: v.product.codigo || "",
        descripcion: v.product.descripcion || "",
        metal: v.product.metal || "",
        kilataje: v.product.kilataje || "",
        linea: v.product.linea || "",
        fotoUrl: v.product.fotoUrl || "",
        pesoPromedio: Number(v.product.pesoPromedio || 0),
      } : null,
    })),
    variant_code: item._configurable_variant_code || "",
  };
};

const hydrateConfigurable = (config) => {
  if (!config?.group) return {};
  return {
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

// item de remisión (camelCase normalizado) → item del editor (formato preorden)
// `tc` (tipo de cambio) permite reconstruir el precio en MXN de remisiones
// antiguas en USD que solo guardaron precio_usd_por_gramo.
const remisionItemToEditorItem = (it, idx, tc = 0) => {
  const tcNum = Number(tc || 0);
  const labor = Number(it.laborMxnPorGramo || 0);
  const pf = Number(it.plataMxnPorGramo || 0);
  let precioGramo = Number(it.precioTotalPorGramo || 0) || labor + pf;
  if (!precioGramo && Number(it.precioUsdPorGramo || 0) > 0 && tcNum > 0) {
    precioGramo = Number(it.precioUsdPorGramo) * tcNum; // deriva MXN desde USD histórico
  }
  // Si no hay desglose labor/PF pero sí precio integrado, todo va a labor (PF=0).
  const laborFinal = labor > 0 ? labor : Math.max(0, precioGramo - pf);
  const gramosTotal = Number(it.gramosTotal || 0);
  return {
    producto_codigo:      it.productoCodigo || "",
    producto_descripcion: it.descripcion || "",
    producto_foto_url:    it.productoFotoUrl || "",
    producto_linea:       it.productoLinea || "",
    piezas:               Number(it.cantidad || 1),
    gramos_por_pieza:     Number(it.gramosPorPieza || 0),
    gramos_total:         gramosTotal,
    labor_mxn:            laborFinal,
    precio_gramo_mxn:     precioGramo,
    subtotal_mxn:         gramosTotal * precioGramo,
    comentarios:          it.notas || "",
    configuracion:        it.configuracion || {},
    pricing_mode:         "gram",
    sort_order:           it.sortOrder ?? idx,
    // Reconstruye _configurable_selections (con fotoUrl de cada componente) para
    // que el editor y el PDF muestren tejido/broche/placa igual que la preorden.
    ...hydrateConfigurable(it.configuracion),
  };
};

/**
 * Convierte una remisión (normalizada por fetchRemisiones) o un borrador
 * (creado por AdminDashboard al "Crear remisión" desde una preorden, que ya
 * trae preorder_items crudos) al objeto `preorder` que espera PreorderEditor.
 */
export const remisionToPreorderInitial = (rem) => {
  if (!rem) return null;
  // Borrador desde preorden: ya trae preorder_items en formato preorden.
  // Remisión existente: trae .items en formato remisión (camelCase).
  const tc = rem.tipoCambioEmision ?? rem.tipo_cambio ?? 0;
  const items = Array.isArray(rem.preorder_items) && rem.preorder_items.length
    ? rem.preorder_items.map((it, idx) => ({ pricing_mode: "gram", ...it, sort_order: it.sort_order ?? idx }))
    : (rem.items || []).map((it, idx) => remisionItemToEditorItem(it, idx, tc));

  // Tolerante a camelCase (remisión normalizada / borrador de AdminDashboard)
  // y a snake_case (payload que el propio editor devuelve en onClose).
  return {
    id:               rem.id,
    folio:            rem.folio || "",
    status:           rem.estado || rem.status || "borrador",
    client_id:        rem.clienteId || rem.client_id || "",
    cliente_nombre:   rem.clienteNombre || rem.cliente_nombre || "",
    cliente_empresa:  rem.clienteEmpresa || rem.cliente_empresa || "",
    cliente_email:    rem.clienteEmail || rem.cliente_email || "",
    cliente_telefono: rem.clienteTelefono || rem.cliente_telefono || "",
    cliente_rfc:      rem.clienteRfc || rem.cliente_rfc || "",
    moneda:           rem.moneda || "USD",
    tipo_cambio:      (rem.tipoCambioEmision ?? rem.tipo_cambio) ? String(rem.tipoCambioEmision ?? rem.tipo_cambio) : "",
    kitco_usd_oz:     (rem.kitcoEmision ?? rem.kitco_usd_oz) ? String(rem.kitcoEmision ?? rem.kitco_usd_oz) : "",
    notas:            rem.notas || "",
    fecha:            rem.fecha || "",
    fecha_entrega:    rem.fechaEntrega || rem.fecha_entrega || "",
    preorder_id:      rem.preorderId || rem.preorder_id || null,
    created_at:       rem.createdAt || rem.created_at || null,
    updated_at:       rem.updatedAt || rem.updated_at || null,
    pricing_mode:     "gram",
    preorder_items:   items,
  };
};

// Estado del editor (po + items) → argumentos de saveRemision()
export const preorderStateToRemisionArgs = (po, items) => {
  const moneda = po.moneda || "USD";
  const tc = Number(po.tipo_cambio || 0);
  const usd = moneda === "USD" && tc > 0;

  const remision = {
    id:                po.id,
    folio:             po.folio,
    estado:            po.status || "borrador",
    fecha:             po.fecha || today(),
    fechaEntrega:      po.fecha_entrega || "",
    clienteId:         po.client_id || "",
    clienteNombre:     po.cliente_nombre || "",
    clienteEmpresa:    po.cliente_empresa || "",
    clienteEmail:      po.cliente_email || "",
    clienteTelefono:   po.cliente_telefono || "",
    clienteRfc:        po.cliente_rfc || "",
    moneda,
    tipoCambioEmision: po.tipo_cambio || "",
    kitcoEmision:      po.kitco_usd_oz || "",
    descuento:         0,
    notas:             po.notas || "",
    preorderId:        po.preorder_id || null,
    origen:            po.preorder_id ? "preorden" : "manual",
  };

  const remItems = items.map((item) => {
    const labor = Number(item.labor_mxn || 0);
    const precioGramoMxn = Number(item.precio_gramo_mxn || 0);
    const pf = Math.max(0, precioGramoMxn - labor);
    const subtotalMxn = Number(item.subtotal_mxn || 0);
    return {
      productoCodigo:     item.producto_codigo || "",
      productoFotoUrl:    item.producto_foto_url || "",
      descripcion:        item.producto_descripcion || item.descripcion || "",
      configuracion:      buildConfiguracion(item) || {},
      cantidad:           Number(item.piezas || 1),
      gramosPorPieza:     Number(item.gramos_por_pieza || 0),
      gramosTotal:        Number(item.gramos_total || 0),
      laborMxnPorGramo:   labor,
      plataMxnPorGramo:   pf,
      precioTotalPorGramo: precioGramoMxn,
      precioUsdPorGramo:  usd ? precioGramoMxn / tc : 0,
      subtotalUsd:        usd ? subtotalMxn / tc : 0,
      subtotalLaborMxn:   subtotalMxn,
      notas:              item.comentarios || "",
    };
  });

  return { remision, items: remItems };
};

/**
 * Devuelve la función `saveDocument` que usa PreorderEditor en modo remisión.
 * Firma: async (po, items) => { id, folio, updatedAt }
 */
export const makeRemisionSaveDocument = (tenantId) => async (po, items) => {
  const { remision, items: remItems } = preorderStateToRemisionArgs(po, items);
  const saved = await saveRemision(remision, remItems, tenantId);
  return {
    id:        saved?.id,
    folio:     saved?.folio,
    updatedAt: saved?.updatedAt || new Date().toISOString(),
  };
};
