import { supabase } from "../lib/supabaseClient";
import { getTenantId, withTenant } from "./tenantUtils";

const emptyMetalPrices = {
  kitco_usd_oz: 0,
  tipo_cambio: 17,
  premio_pct: 4,
  plata_fina_mxn: 0,
};

const normalizeCode = (value) => String(value || "").trim().toLowerCase();

export const getSilverFinePrice = (metalPrices = emptyMetalPrices) => {
  const stored = Number(metalPrices.plata_fina_mxn || 0);
  if (stored > 0) return stored;

  const kitco = Number(metalPrices.kitco_usd_oz || 0);
  const exchange = Number(metalPrices.tipo_cambio || 0);
  const premium = Number(metalPrices.premio_pct || 0);
  if (!kitco || !exchange) return 0;

  return (kitco / 31.1035) * (1 + premium / 100) * exchange;
};

export const fetchLines = async (profileOrTenantId = "") => {
  const tenantId = getTenantId(profileOrTenantId);
  const { data, error } = await withTenant(
    supabase
    .from("product_lines")
    .select("*")
    .eq("activa", true)
      .order("codigo"),
    tenantId
  );
  if (error) throw error;
  return data || [];
};

export const saveLine = async (line, profileOrTenantId = "") => {
  const tenantId = getTenantId(profileOrTenantId);
  const row = {
    ...line,
    codigo: String(line.codigo || "").trim(),
    mo_base: Number(line.mo_base || 0),
    activa: line.activa ?? true,
    updated_at: new Date().toISOString(),
  };
  if (tenantId) row.tenant_id = tenantId;
  const { error } = await supabase
    .from("product_lines")
    .upsert(row, { onConflict: "codigo" });
  if (error) throw error;
};

export const syncProductLinesFromProducts = async (products = [], profileOrTenantId = "") => {
  const tenantId = getTenantId(profileOrTenantId);
  const lineMap = new Map();

  products.forEach((product) => {
    const codigo = String(product.linea || "").trim();
    if (!codigo) return;
    const key = normalizeCode(codigo);
    const current = lineMap.get(key);
    const manoObra = Number(product.manoObra || product.mano_obra || 0);
    if (!current) {
      lineMap.set(key, {
        codigo,
        descripcion: product.familia || product.descripcion || codigo,
        mo_base: manoObra,
        activa: true,
        updated_at: new Date().toISOString(),
      });
      return;
    }
    if (!current.mo_base && manoObra) current.mo_base = manoObra;
  });

  const rows = [...lineMap.values()];
  if (!rows.length) return [];
  if (tenantId) rows.forEach((row) => { row.tenant_id = tenantId; });

  const { error } = await supabase.from("product_lines").upsert(rows, { onConflict: "codigo" });
  if (error) throw error;
  return fetchLines(tenantId);
};

export const fetchMetalPrices = async (profileOrTenantId = "") => {
  const tenantId = getTenantId(profileOrTenantId);
  let query = supabase
    .from("metal_prices")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1);
  query = withTenant(query, tenantId);
  const { data, error } = await query.maybeSingle();
  if (error || !data) return emptyMetalPrices;
  return { ...emptyMetalPrices, ...data };
};

export const saveMetalPrices = async ({ kitco_usd_oz, tipo_cambio, premio_pct }, userEmail, profileOrTenantId = "") => {
  const tenantId = getTenantId(profileOrTenantId);
  const finePrice = getSilverFinePrice({ kitco_usd_oz, tipo_cambio, premio_pct });

  const row = {
    kitco_usd_oz: Number(kitco_usd_oz || 0),
    tipo_cambio: Number(tipo_cambio || 0),
    premio_pct: Number(premio_pct || 0),
    plata_fina_mxn: finePrice,
    updated_at: new Date().toISOString(),
    updated_by: userEmail || "admin",
  };
  if (tenantId) row.tenant_id = tenantId;
  const { error } = await supabase.from("metal_prices").insert(row);
  if (error) throw error;
};

export const fetchClientMargins = async (clientId) => {
  if (!clientId) return [];
  const { data, error } = await supabase
    .from("client_line_margins")
    .select("*")
    .eq("client_id", clientId);
  if (error) throw error;
  return data || [];
};

export const saveClientMargin = async (clientId, lineCodigo, margenPct) => {
  const { error } = await supabase
    .from("client_line_margins")
    .upsert(
      { client_id: clientId, line_codigo: lineCodigo, margen_pct: Number(margenPct || 0) },
      { onConflict: "client_id,line_codigo" }
    );
  if (error) throw error;
};

// ─── Listas de labor ────────────────────────────────────────────────────────

export const fetchLaborLists = async (profileOrTenantId = "") => {
  const tenantId = getTenantId(profileOrTenantId);
  let query = supabase.from("labor_lists").select("*").eq("active", true).order("created_at");
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const saveLaborList = async ({ id, name }, profileOrTenantId = "") => {
  const tenantId = getTenantId(profileOrTenantId);
  const row = { name: String(name || "").trim(), updated_at: new Date().toISOString() };
  if (tenantId) row.tenant_id = tenantId;
  if (id) {
    const { data, error } = await supabase.from("labor_lists").update(row).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from("labor_lists").insert(row).select("*").single();
  if (error) throw error;
  return data;
};

export const deleteLaborList = async (id) => {
  const { error } = await supabase.from("labor_lists").update({ active: false }).eq("id", id);
  if (error) throw error;
};

export const fetchLaborListLines = async (laborListId) => {
  const { data, error } = await supabase
    .from("labor_list_lines")
    .select("*")
    .eq("labor_list_id", laborListId);
  if (error) throw error;
  return data || [];
};

export const upsertLaborListLines = async (laborListId, lines = []) => {
  if (!lines.length) return;
  const rows = lines.map((line) => ({
    labor_list_id: laborListId,
    line_codigo: String(line.line_codigo || line.codigo || "").trim(),
    mo_base: Number(line.mo_base || 0),
  }));
  const { error } = await supabase
    .from("labor_list_lines")
    .upsert(rows, { onConflict: "labor_list_id,line_codigo" });
  if (error) throw error;
};

// ─── Precios por gramo ───────────────────────────────────────────────────────

export const calcPrecioGramo = ({ mo_base, plata_fina_mxn, tipo_cambio_output = 1 }) => {
  const plata = Number(plata_fina_mxn || 0);
  const mo = Number(mo_base || 0);
  const integrado = mo + plata;
  const divisor = Number(tipo_cambio_output || 1) || 1;

  return {
    plata_fina: plata / divisor,
    mo_visible: mo / divisor,
    integrado: integrado / divisor,
    costo: integrado,
  };
};

export const calculateProductQuotePrice = (product, { lines = [], metalPrices = {} } = {}) => {
  const line = lines.find((item) => normalizeCode(item.codigo) === normalizeCode(product.linea));
  const plataFina = getSilverFinePrice(metalPrices);

  if (!line || !plataFina) {
    return {
      pricePerGram: 0,
      laborPerGram: 0,
      silverFinePerGram: plataFina,
      status: !line ? "missing-line" : "missing-metal-price",
    };
  }

  const price = calcPrecioGramo({
    mo_base: line.mo_base,
    plata_fina_mxn: plataFina,
  });

  return {
    pricePerGram: price.integrado,
    laborPerGram: price.mo_visible,
    silverFinePerGram: price.plata_fina,
    status: "configured",
  };
};
