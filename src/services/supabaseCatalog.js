import { supabase } from "../lib/supabaseClient";
import { normalizeText } from "../utils/textNormalizer";

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

export const productToDb = (product) => ({
  codigo: product.codigo,
  modelo: product.modelo,
  descripcion: product.descripcion,
  metal: product.metal,
  kilataje: product.kilataje,
  linea: product.linea,
  familia: product.familia,
  grupo: product.grupo,
  genero: product.genero,
  acabado: product.acabado,
  piedra: product.piedra,
  medida: product.medida,
  estatus: product.estatus || "Activo",
  peso_promedio: Number(product.pesoPromedio || 0),
  unidad_venta: product.unidadVenta,
  clave_venta: product.claveVenta,
  precio_minimo: Number(product.precioMinimo || 0),
  mano_obra: Number(product.manoObra || product.laborPrice || 0),
  moneda_precio_min: product.monedaPrecioMin || "MXN",
  foto_url: product.fotoUrl,
  foto_url_2: product.fotoUrl2,
  foto_url_3: product.fotoUrl3,
  visible_web: Boolean(product.visibleWeb),
  orden_web: Number(product.ordenWeb || 0),
  tags_busqueda: product.tagsBusqueda,
  search_text: product.searchText,
  updated_at: new Date().toISOString(),
});

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
  const [products, clients, catalogs, catalogProducts, priceLists, priceItems, clientCatalogs, clientPriceLists] =
    await Promise.all([
      supabase.from("products").select("*").order("codigo"),
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
  const [products, priceLists] = await Promise.all([
    supabase.from("products").select("*").eq("visible_web", true).order("codigo"),
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
