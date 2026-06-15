import { supabase } from "../lib/supabaseClient";
import { resolveImageUrl } from "../utils/formatters";
import { getTenantId, withTenant } from "./tenantUtils";
import { normalizeText } from "../utils/textNormalizer";

const PAGE_SIZE = 500;
const UPSERT_BATCH_SIZE = 500;
const PUBLIC_PRODUCT_COLUMNS = [
  "id",
  "tenant_id",
  "created_at",
  "updated_at",
  "codigo",
  "modelo",
  "descripcion",
  "metal",
  "kilataje",
  "linea",
  "familia",
  "grupo",
  "proveedor",
  "genero",
  "acabado",
  "piedra",
  "medida",
  "estatus",
  "peso_promedio",
  "unidad_venta",
  "clave_venta",
  "precio_minimo",
  "moneda_precio_min",
  "foto_url",
  "foto_url_2",
  "foto_url_3",
  "visible_web",
  "orden_web",
  "tags_busqueda",
  "search_text",
].join(",");

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null);

const toDbNumber = (...values) => {
  const value = firstValue(...values, 0);
  if (value === "") return 0;
  const number = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(number) ? number : 0;
};

const toDbBoolean = (...values) => {
  const value = firstValue(...values, true);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return ["1", "si", "sí", "yes", "true", "activo", "active", "alta"].includes(normalizeText(value));
};

export const fetchAllProducts = async ({ visibleOnly = false, tenantId = "", columns = "*" } = {}) => {
  const rows = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("products")
      .select(columns)
      .order("codigo")
      .range(from, from + PAGE_SIZE - 1);

    if (visibleOnly) query = query.eq("visible_web", true);
    query = withTenant(query, tenantId);

    const result = await query;
    throwIfError(result);
    rows.push(...result.data);

    if (result.data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
};

export const dbProductToProduct = (row) => ({
  id: row.id,
  tenantId: row.tenant_id || "",
  createdAt: row.created_at || "",
  updatedAt: row.updated_at || "",
  codigo: row.codigo || "",
  modelo: row.modelo || "",
  descripcion: row.descripcion || "",
  metal: row.metal || "",
  kilataje: row.kilataje || "",
  linea: row.linea || "",
  familia: row.familia || "",
  grupo: row.grupo || "",
  proveedor: row.proveedor || row.provider || row.supplier || "",
  genero: row.genero || "",
  acabado: row.acabado || "",
  piedra: row.piedra || "",
  medida: row.medida || "",
  estatus: row.estatus || "",
  pesoPromedio: Number(row.peso_promedio || 0),
  unidadVenta: row.unidad_venta || "",
  claveVenta: row.clave_venta || "",
  precioMinimo: Number(row.precio_minimo || 0),
  manoObra: Number(row.mano_obra || 0),
  monedaPrecioMin: row.moneda_precio_min || "MXN",
  fotoUrl: resolveImageUrl(row.foto_url),
  fotoUrl2: resolveImageUrl(row.foto_url_2),
  fotoUrl3: resolveImageUrl(row.foto_url_3),
  visibleWeb: Boolean(row.visible_web),
  ordenWeb: Number(row.orden_web || 0),
  tagsBusqueda: row.tags_busqueda || "",
  searchText:
    row.search_text ||
    normalizeText(
      [
        row.codigo,
        row.modelo,
        row.descripcion,
        row.metal,
        row.kilataje,
        row.linea,
        row.familia,
        row.grupo,
        row.proveedor,
        row.genero,
        row.acabado,
        row.piedra,
        row.medida,
        row.tags_busqueda,
      ].join(" ")
    ),
});

const sanitizeProductForClient = (product) => {
  const {
    manoObra,
    mano_obra,
    quoteLaborPerGram,
    laborPrice,
    labor_price,
    ...safeProduct
  } = product;
  return safeProduct;
};

export const productToDb = (product, tenantId = "") => {
  const searchText =
    firstValue(product.searchText, product.search_text) ||
    normalizeText(
      [
        product.codigo,
        product.modelo,
        product.descripcion,
        product.metal,
        product.kilataje,
        product.linea,
        product.familia,
        product.grupo,
        firstValue(product.proveedor, product.provider, product.supplier),
        product.genero,
        product.acabado,
        product.piedra,
        product.medida,
        firstValue(product.tagsBusqueda, product.tags_busqueda),
      ].join(" ")
    );

  const row = {
    codigo: firstValue(product.codigo, ""),
    modelo: firstValue(product.modelo, ""),
    descripcion: firstValue(product.descripcion, ""),
    metal: firstValue(product.metal, ""),
    kilataje: firstValue(product.kilataje, ""),
    linea: firstValue(product.linea, ""),
    familia: firstValue(product.familia, ""),
    grupo: firstValue(product.grupo, ""),
    proveedor: firstValue(product.proveedor, product.provider, product.supplier, ""),
    genero: firstValue(product.genero, ""),
    acabado: firstValue(product.acabado, ""),
    piedra: firstValue(product.piedra, ""),
    medida: firstValue(product.medida, ""),
    estatus: firstValue(product.estatus, "Activo"),
    peso_promedio: toDbNumber(product.pesoPromedio, product.peso_promedio, product.average_weight),
    unidad_venta: firstValue(product.unidadVenta, product.unidad_venta, product.sales_unit, ""),
    clave_venta: firstValue(product.claveVenta, product.clave_venta, product.sales_key, ""),
    precio_minimo: toDbNumber(product.precioMinimo, product.precio_minimo, product.minimum_price),
    mano_obra: toDbNumber(product.manoObra, product.mano_obra, product.laborPrice, product.labor_price),
    moneda_precio_min: firstValue(product.monedaPrecioMin, product.moneda_precio_min, product.minimum_price_currency, "MXN"),
    foto_url: resolveImageUrl(firstValue(product.fotoUrl, product.foto_url, product.photo_url, "")),
    foto_url_2: resolveImageUrl(firstValue(product.fotoUrl2, product.foto_url_2, product.photo_url_2, "")),
    foto_url_3: resolveImageUrl(firstValue(product.fotoUrl3, product.foto_url_3, product.photo_url_3, "")),
    visible_web: toDbBoolean(product.visibleWeb, product.visible_web),
    orden_web: toDbNumber(product.ordenWeb, product.orden_web, product.web_order),
    tags_busqueda: firstValue(product.tagsBusqueda, product.tags_busqueda, product.search_tags, ""),
    search_text: searchText,
    updated_at: new Date().toISOString(),
  };

  const resolvedTenantId = tenantId || product.tenant_id || product.tenantId || "";
  if (resolvedTenantId) row.tenant_id = resolvedTenantId;
  return row;
};

const throwIfError = ({ error }) => {
  if (error) throw error;
};

const shouldKeepExistingImage = (value) => !String(value || "").trim();

const preserveExistingImages = async (rows, tenantId = "") => {
  const codes = rows
    .filter((row) => shouldKeepExistingImage(row.foto_url) || shouldKeepExistingImage(row.foto_url_2) || shouldKeepExistingImage(row.foto_url_3))
    .map((row) => row.codigo)
    .filter(Boolean);

  if (!codes.length) return rows;

  const existingByCode = new Map();
  for (let index = 0; index < codes.length; index += PAGE_SIZE) {
    const batchCodes = codes.slice(index, index + PAGE_SIZE);
    let query = supabase
      .from("products")
      .select("codigo,foto_url,foto_url_2,foto_url_3")
      .in("codigo", batchCodes);
    query = withTenant(query, tenantId);

    const result = await query;
    throwIfError(result);
    result.data.forEach((item) => existingByCode.set(item.codigo, item));
  }

  return rows.map((row) => {
    const existing = existingByCode.get(row.codigo);
    if (!existing) return row;
    return {
      ...row,
      foto_url: shouldKeepExistingImage(row.foto_url) ? existing.foto_url || "" : row.foto_url,
      foto_url_2: shouldKeepExistingImage(row.foto_url_2) ? existing.foto_url_2 || "" : row.foto_url_2,
      foto_url_3: shouldKeepExistingImage(row.foto_url_3) ? existing.foto_url_3 || "" : row.foto_url_3,
    };
  });
};

export const getSessionAndProfile = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return { session: null, profile: null };
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
  if (error) return { session, profile: null };
  return { session, profile };
};

export const fetchAdminData = async (profile) => {
  const tenantId = getTenantId(profile);
  const allProducts = await fetchAllProducts({ tenantId });
  const clientsQuery      = withTenant(supabase.from("clients").select("*").order("company"), tenantId);
  const catalogsQuery     = withTenant(supabase.from("catalogs").select("*").order("name"), tenantId);
  const priceListsQuery   = withTenant(supabase.from("price_lists").select("*").order("name"), tenantId);
  const laborListsQuery   = withTenant(
    supabase.from("labor_lists").select("id, name, currency, status").order("name"),
    tenantId
  );
  const [products, clients, catalogs, catalogProducts, priceLists, priceItems, clientCatalogs, clientPriceLists, laborLists] =
    await Promise.all([
      { data: allProducts, error: null },
      clientsQuery,
      catalogsQuery,
      supabase.from("catalog_products").select("*"),
      priceListsQuery,
      supabase.from("price_list_items").select("*").order("metal"),
      supabase.from("client_catalogs").select("*"),
      supabase.from("client_price_lists").select("*"),
      laborListsQuery,
    ]);

  [products, clients, catalogs, catalogProducts, priceLists, priceItems, clientCatalogs, clientPriceLists].forEach(throwIfError);
  // laborLists: errores no-fatales (la tabla puede no existir en tenants legacy)
  if (laborLists.error) console.warn("labor_lists fetch:", laborLists.error.message);

  return {
    products: products.data.map(dbProductToProduct),
    clients: clients.data,
    catalogs: catalogs.data,
    catalogProducts: catalogProducts.data,
    priceLists: priceLists.data,
    priceItems: priceItems.data,
    clientCatalogs: clientCatalogs.data,
    clientPriceLists: clientPriceLists.data,
    laborLists: laborLists.data || [],
  };
};

export const upsertProducts = async (products, tenantId = "") => {
  const rows = await preserveExistingImages(products.map((product) => productToDb(product, tenantId)), tenantId);
  if (!rows.length) return [];
  const savedRows = [];

  for (let index = 0; index < rows.length; index += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + UPSERT_BATCH_SIZE);
    let result = await supabase
      .from("products")
      .upsert(batch, { onConflict: tenantId ? "tenant_id,codigo" : "codigo" })
      .select("*");

    if (result.error && String(result.error.message || "").toLowerCase().includes("proveedor")) {
      const fallbackRows = batch.map(({ proveedor, ...row }) => row);
      result = await supabase
        .from("products")
        .upsert(fallbackRows, { onConflict: tenantId ? "tenant_id,codigo" : "codigo" })
        .select("*");
    }

    throwIfError(result);
    savedRows.push(...(result.data || []));
  }

  return savedRows.map(dbProductToProduct);
};

export const deleteProduct = async (id, tenantId = "") => {
  let query = supabase.from("products").delete().eq("id", id);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  throwIfError(await query);
};

export const deleteTenantProducts = async (tenantId = "") => {
  if (!tenantId) throw new Error("No hay empresa activa para borrar productos.");
  const result = await supabase
    .from("products")
    .delete({ count: "exact" })
    .eq("tenant_id", tenantId);
  throwIfError(result);
  return result.count || 0;
};

export const saveClient = async (client, tenantId = "") => {
  const row = { ...client };
  row.email = String(row.email || "").trim();
  if (!row.email) {
    const seed = String(row.badge_raw || row.phone || row.name || row.company || Date.now())
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || `prospect-${Date.now()}`;
    row.email = `${seed}@prospect.local`;
  }
  if (tenantId) row.tenant_id = tenantId;
  let result = await supabase
    .from("clients")
    .upsert(row, { onConflict: row.id ? "id" : "email" })
    .select("*")
    .single();
  if (
    result.error &&
    ["type", "ciudad", "domicilio", "comentarios", "badge_raw", "obtenido_en"].some((field) => String(result.error.message || "").toLowerCase().includes(field))
  ) {
    const { type, ciudad, domicilio, comentarios, badge_raw, obtenido_en, ...fallbackRow } = row;
    result = await supabase
      .from("clients")
      .upsert(fallbackRow, { onConflict: fallbackRow.id ? "id" : "email" })
      .select("*")
      .single();
    // La columna type no existe aún en la BD — la restauramos en memoria para que
    // isProspectRecord clasifique correctamente sin requerir un reload de página.
    if (!result.error && result.data && type !== undefined) {
      result = { ...result, data: { ...result.data, type } };
    }
  }
  throwIfError(result);
  if (result.data?.email) {
    const profileUpdate = { client_id: result.data.id, role: "client" };
    if (tenantId) profileUpdate.tenant_id = tenantId;
    await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("email", result.data.email)
      .neq("role", "admin")
      .neq("role", "tenant_admin")
      .neq("role", "superadmin");
  }
  return result.data;
};

export const deleteClient = async (clientId) => {
  // Desvincula el perfil asociado (si lo hay) y borra el cliente/prospecto.
  // Si el cliente tiene ventas/preórdenes, la BD bloqueará el borrado por FK
  // y el mensaje se mostrará al usuario.
  await supabase.from("profiles").update({ client_id: null }).eq("client_id", clientId);
  const result = await supabase.from("clients").delete().eq("id", clientId);
  throwIfError(result);
};

export const saveCatalog = async (catalog, tenantId = "") => {
  const row = { ...catalog };
  if (tenantId) row.tenant_id = tenantId;
  const result = await supabase.from("catalogs").upsert(row).select("*").single();
  throwIfError(result);
  return result.data;
};

export const setCatalogProduct = async (catalogId, productId, active) => {
  if (active) {
    throwIfError(await supabase.from("catalog_products").upsert({ catalog_id: catalogId, product_id: productId }));
  } else {
    throwIfError(await supabase.from("catalog_products").delete().eq("catalog_id", catalogId).eq("product_id", productId));
  }
};

export const savePriceList = async (priceList, tenantId = "") => {
  const row = { ...priceList };
  if (tenantId) row.tenant_id = tenantId;
  const result = await supabase.from("price_lists").upsert(row).select("*").single();
  throwIfError(result);
  return result.data;
};

export const savePriceItem = async (item) => {
  const result = await supabase.from("price_list_items").upsert(item).select("*").single();
  throwIfError(result);
  return result.data;
};

export const setClientCatalog = async (clientId, catalogId, active) => {
  throwIfError(await supabase.from("client_catalogs").upsert({ client_id: clientId, catalog_id: catalogId, active }));
};

export const setClientPriceList = async (clientId, priceListId, active) => {
  throwIfError(await supabase.from("client_price_lists").upsert({ client_id: clientId, price_list_id: priceListId, active }));
};

/**
 * Actualiza la lista de SKUs permitidos para un cliente.
 * skus = [] o null → sin restricción (ve todo el catálogo).
 * skus = ["SKU1", "SKU2"] → solo ve esos productos.
 */
export const updateClientAllowedSkus = async (clientId, skus) => {
  const allowed = Array.isArray(skus) && skus.length > 0 ? skus : null;
  const { error } = await supabase
    .from("clients")
    .update({ allowed_skus: allowed })
    .eq("id", clientId);
  if (error) throw new Error(error.message);
};

/**
 * Asigna (o quita) la lista de labores de un cliente.
 * laborListId = "" o null → sin lista asignada (precios base).
 * laborListId = UUID → esa lista se auto-aplica en la preorden del cliente.
 */
/** Guarda (copia visible) la contraseña que el admin definió para el cliente. */
export const updateClientAccessPassword = async (clientId, password) => {
  const { error } = await supabase
    .from("clients")
    .update({ access_password: password })
    .eq("id", clientId);
  if (error) throw new Error(error.message);
};

/**
 * Cambia la contraseña de login del cliente (vía Edge Function con service_role)
 * y guarda la copia visible. Requiere desplegar la función set-client-password.
 */
export const setClientPassword = async (clientId, newPassword) => {
  const { data, error } = await supabase.functions.invoke("set-client-password", {
    body: { clientId, newPassword },
  });
  if (error) {
    // El cuerpo de error de la función trae el detalle
    let detail = error.message || "No se pudo cambiar la contraseña.";
    try { const ctx = await error.context?.json?.(); if (ctx?.error) detail = ctx.error; } catch { /* noop */ }
    throw new Error(detail);
  }
  if (data?.error) throw new Error(data.error);
  return data;
};

export const updateClientLaborList = async (clientId, laborListId) => {
  const value = laborListId || null;
  const { error } = await supabase
    .from("clients")
    .update({ labor_list_id: value })
    .eq("id", clientId);
  if (error) throw new Error(error.message);
};

/**
 * Verifica cuáles emails de cliente tienen una cuenta activa (profile con role='client').
 * Retorna un Map<email_lowercase, true>.  Solo incluye emails con cuenta.
 * Multi-tenant safe: los emails de clientes son únicos globalmente.
 */
export const fetchClientAccessStatuses = async (emails = []) => {
  const result = new Map();
  // Normalizar a minúsculas: los perfiles de auth se guardan en minúsculas,
  // pero el correo del cliente puede tener mayúsculas (David-londo...). Sin
  // esto, el IN no hace match y la cuenta existente no se detecta.
  const clean = (emails || [])
    .map((e) => String(e || "").trim().toLowerCase())
    .filter((e) => e && !e.endsWith("@prospect.local"));
  if (!clean.length) return result;
  const BATCH = 200;
  for (let i = 0; i < clean.length; i += BATCH) {
    const { data } = await supabase
      .from("profiles")
      .select("email")
      .in("email", clean.slice(i, i + BATCH))
      .eq("role", "client");
    (data || []).forEach((p) => result.set(String(p.email).toLowerCase(), true));
  }
  return result;
};

/**
 * Obtiene estadísticas de preórdenes agrupadas por client_id.
 * Retorna un Map<clientId, { total: number, active: number, lastDate: string|null }>.
 * Se filtra por tenantId para garantizar aislamiento entre empresas.
 */
export const fetchClientPreorderStats = async (clientIds = [], tenantId = "") => {
  const result = new Map();
  if (!clientIds.length) return result;
  let query = supabase
    .from("preorders")
    .select("client_id, status, created_at")
    .in("client_id", clientIds)
    .order("created_at", { ascending: false });
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data } = await query;
  if (!data) return result;
  for (const row of data) {
    if (!row.client_id) continue;
    const entry = result.get(row.client_id) || { total: 0, active: 0, lastDate: null };
    entry.total += 1;
    if (row.status === "pendiente" || row.status === "revision") entry.active += 1;
    if (!entry.lastDate) entry.lastDate = row.created_at;
    result.set(row.client_id, entry);
  }
  return result;
};

export const fetchClientProfileStatus = async (email) => {
  if (!email || String(email).endsWith("@prospect.local")) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, active")
    .eq("email", String(email).toLowerCase())
    .eq("role", "client")
    .maybeSingle();
  return data; // null si no existe, { id, active } si existe
};

export const setClientProfileActive = async (email, active) => {
  const { error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("email", String(email).toLowerCase())
    .eq("role", "client");
  if (error) throw new Error(error.message);
};

export const fetchClientData = async (profile) => {
  const tenantId = getTenantId(profile);

  // Obtener el registro del cliente primero para saber sus allowed_skus
  const clientResult = profile?.client_id
    ? await withTenant(supabase.from("clients").select("*").eq("id", profile.client_id), tenantId).maybeSingle()
    : { data: null, error: null };
  throwIfError(clientResult);
  const clientRecord = clientResult.data;
  const allowedSkus = clientRecord?.allowed_skus;

  let productList;
  if (allowedSkus?.length > 0) {
    // Cliente con catálogo restringido — traer solo sus productos asignados directamente.
    // No se filtra por visible_web: el cliente solo ve lo que el admin le asignó.
    // PUBLIC_PRODUCT_COLUMNS ya es un string "col1,col2,..." — no aplicar .join
    let q = supabase
      .from("products")
      .select(PUBLIC_PRODUCT_COLUMNS)
      .in("codigo", allowedSkus);
    if (tenantId) q = q.eq("tenant_id", tenantId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    productList = data || [];
  } else {
    // Sin restricción de SKUs — ver todos los productos marcados visible_web
    productList = await fetchAllProducts({ visibleOnly: true, tenantId, columns: PUBLIC_PRODUCT_COLUMNS });
  }

  return {
    products: productList.map(dbProductToProduct).map(sanitizeProductForClient),
    priceItems: [],
    client: clientRecord,
  };
};
