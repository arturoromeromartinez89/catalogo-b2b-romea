import { supabase } from "../lib/supabaseClient";
import { normalizeText } from "../utils/textNormalizer";

const PAGE_SIZE = 1000;

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

const fetchAllProducts = async ({ visibleOnly = false } = {}) => {
  const rows = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("products")
      .select("*")
      .order("codigo")
      .range(from, from + PAGE_SIZE - 1);

    if (visibleOnly) query = query.eq("visible_web", true);

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
  codigo: row.codigo || "",
  modelo: row.modelo || "",
  descripcion: row.descripcion || "",
  metal: row.metal || "",
  kilataje: row.kilataje || "",
  linea: row.linea || "",
  familia: row.familia || "",
  grupo: row.grupo || "",
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
  fotoUrl: row.foto_url || "",
  fotoUrl2: row.foto_url_2 || "",
  fotoUrl3: row.foto_url_3 || "",
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
        row.genero,
        row.acabado,
        row.piedra,
        row.medida,
        row.tags_busqueda,
      ].join(" ")
    ),
});

export const productToDb = (product) => {
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
        product.genero,
        product.acabado,
        product.piedra,
        product.medida,
        firstValue(product.tagsBusqueda, product.tags_busqueda),
      ].join(" ")
    );

  return {
    codigo: firstValue(product.codigo, ""),
    modelo: firstValue(product.modelo, ""),
    descripcion: firstValue(product.descripcion, ""),
    metal: firstValue(product.metal, ""),
    kilataje: firstValue(product.kilataje, ""),
    linea: firstValue(product.linea, ""),
    familia: firstValue(product.familia, ""),
    grupo: firstValue(product.grupo, ""),
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
    foto_url: firstValue(product.fotoUrl, product.foto_url, product.photo_url, ""),
    foto_url_2: firstValue(product.fotoUrl2, product.foto_url_2, product.photo_url_2, ""),
    foto_url_3: firstValue(product.fotoUrl3, product.foto_url_3, product.photo_url_3, ""),
    visible_web: toDbBoolean(product.visibleWeb, product.visible_web),
    orden_web: toDbNumber(product.ordenWeb, product.orden_web, product.web_order),
    tags_busqueda: firstValue(product.tagsBusqueda, product.tags_busqueda, product.search_tags, ""),
    search_text: searchText,
    updated_at: new Date().toISOString(),
  };
};

const throwIfError = ({ error }) => {
  if (error) throw error;
};

export const getSessionAndProfile = async () => {
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return { session: null, profile: null };
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
  if (error) return { session, profile: null };
  return { session, profile };
};

export const fetchAdminData = async () => {
  const allProducts = await fetchAllProducts();
  const [products, clients, catalogs, catalogProducts, priceLists, priceItems, clientCatalogs, clientPriceLists] =
    await Promise.all([
      { data: allProducts, error: null },
      supabase.from("clients").select("*").order("company"),
      supabase.from("catalogs").select("*").order("name"),
      supabase.from("catalog_products").select("*"),
      supabase.from("price_lists").select("*").order("name"),
      supabase.from("price_list_items").select("*").order("metal"),
      supabase.from("client_catalogs").select("*"),
      supabase.from("client_price_lists").select("*"),
    ]);

  [products, clients, catalogs, catalogProducts, priceLists, priceItems, clientCatalogs, clientPriceLists].forEach(throwIfError);

  return {
    products: products.data.map(dbProductToProduct),
    clients: clients.data,
    catalogs: catalogs.data,
    catalogProducts: catalogProducts.data,
    priceLists: priceLists.data,
    priceItems: priceItems.data,
    clientCatalogs: clientCatalogs.data,
    clientPriceLists: clientPriceLists.data,
  };
};

export const upsertProducts = async (products) => {
  const rows = products.map(productToDb);
  const result = await supabase.from("products").upsert(rows, { onConflict: "codigo" }).select("*");
  throwIfError(result);
  return result.data.map(dbProductToProduct);
};

export const deleteProduct = async (id) => {
  throwIfError(await supabase.from("products").delete().eq("id", id));
};

export const saveClient = async (client) => {
  const result = await supabase.from("clients").upsert(client).select("*").single();
  throwIfError(result);
  if (result.data?.email) {
    await supabase
      .from("profiles")
      .update({ client_id: result.data.id, role: "client" })
      .eq("email", result.data.email)
      .neq("role", "admin");
  }
  return result.data;
};

export const saveCatalog = async (catalog) => {
  const result = await supabase.from("catalogs").upsert(catalog).select("*").single();
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

export const savePriceList = async (priceList) => {
  const result = await supabase.from("price_lists").upsert(priceList).select("*").single();
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

export const fetchClientData = async (profile) => {
  const visibleProducts = await fetchAllProducts({ visibleOnly: true });
  const [products, priceLists] = await Promise.all([
    { data: visibleProducts, error: null },
    supabase.from("client_price_lists").select("price_list_id").eq("client_id", profile.client_id).eq("active", true),
  ]);
  throwIfError(products);
  throwIfError(priceLists);

  const priceListIds = priceLists.data.map((item) => item.price_list_id);
  const priceItems = priceListIds.length
    ? await supabase.from("price_list_items").select("*").in("price_list_id", priceListIds)
    : { data: [], error: null };
  throwIfError(priceItems);

  return {
    products: products.data.map(dbProductToProduct),
    priceItems: priceItems.data,
  };
};
