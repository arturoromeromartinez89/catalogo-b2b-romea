import { supabase } from "../lib/supabaseClient";
import { extractStoragePath } from "./storageImages";

const cleanNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

export const productToQuoteSnapshot = (product) => ({
  codigo: product.codigo || "",
  modelo: product.modelo || "",
  descripcion: product.descripcion || "",
  metal: product.metal || "",
  kilataje: product.kilataje || "",
  linea: product.linea || "",
  familia: product.familia || "",
  grupo: product.grupo || "",
  pesoPromedio: cleanNumber(product.pesoPromedio),
  precioMinimo: cleanNumber(product.quotePricePerGram || product.precioMinimo),
  monedaPrecioMin: product.monedaPrecioMin || "MXN",
  fotoUrl: product.fotoUrl || "",
  tagsBusqueda: product.tagsBusqueda || "",
});

export const buildQuoteUrl = (token) => `${window.location.origin}/cotizacion/${encodeURIComponent(token)}`;

export const createQuoteLink = async ({
  products,
  showPrice = true,
  showWeight = true,
  expiresInDays = 30,
  clientId = null,
  createdBy = null,
  tenantId = "",
}) => {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + Number(expiresInDays || 30) * 24 * 60 * 60 * 1000).toISOString();
  const row = {
    token,
    products: products.map(productToQuoteSnapshot),
    show_price: Boolean(showPrice),
    show_weight: Boolean(showWeight),
    expires_at: expiresAt,
    client_id: clientId || null,
    created_by: createdBy || null,
  };
  if (tenantId) row.tenant_id = tenantId;

  const { data, error } = await supabase
    .from("quote_links")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, url: buildQuoteUrl(token) };
};

export const fetchQuoteLinkByToken = async (token) => {
  const { data, error } = await supabase.rpc("get_quote_link_by_token", { p_token: token });
  if (error) throw error;
  const quote = Array.isArray(data) ? data[0] : data;
  if (!quote) throw new Error("La liga no existe o ya expiro.");
  return quote;
};

export const resolvePublicQuoteImages = async ({ token, products = [], company = {} }) => {
  const productRefs = products.map((product) => product.fotoUrl).filter((value) => extractStoragePath(value));
  const logoRef = extractStoragePath(company.logo_url) ? company.logo_url : "";
  const references = [...productRefs, logoRef].filter(Boolean);
  if (!references.length) return { products, company };

  const { data, error } = await supabase.functions.invoke("sign-public-images", {
    body: { token, references },
  });
  if (error) throw error;

  const signedByPath = new Map(
    (data?.signed || []).map((entry) => [entry.path, entry.signedUrl])
  );
  const resolve = (value) => signedByPath.get(extractStoragePath(value)) || value || "";

  return {
    products: products.map((product) => ({ ...product, fotoUrl: resolve(product.fotoUrl) })),
    company: { ...company, logo_url: resolve(company.logo_url) },
  };
};

export const submitQuoteLinkSelection = async ({ token, customer, items }) => {
  const payloadItems = items
    .filter((item) => Number(item.quantity || 0) > 0)
    .map((item) => ({
      ...productToQuoteSnapshot(item.product),
      quantity: cleanNumber(item.quantity),
    }));

  const { data, error } = await supabase.rpc("submit_quote_link_preorder", {
    p_token: token,
    p_customer: customer,
    p_items: payloadItems,
  });
  if (error) throw error;
  return data;
};
