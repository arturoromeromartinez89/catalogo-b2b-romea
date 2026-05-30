import { supabase } from "../lib/supabaseClient";
import { getTenantId, withTenant } from "./tenantUtils";

const emptyMetalPrices = {
  kitco_usd_oz: 0,
  tipo_cambio: 17,
  premio_pct: 4,
  plata_fina_mxn: 0,
};

const normalizeCode = (value) => String(value || "").trim().toLowerCase();
export const TROY_OUNCE_GRAMS = 31.1035;

export const roundUp2 = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.ceil(number * 100) / 100;
};

export const inferLaborFromLineCode = (code) => {
  const match = String(code || "").match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : 0;
};

export const buildPriceListName = (currency = "MXN", name = "") => {
  const prefix = String(currency || "MXN").toUpperCase();
  const clean = String(name || "").trim().replace(/^(USD|MXN)\s*-\s*/i, "");
  return clean ? `${prefix} - ${clean}` : `${prefix} -`;
};

export const calculateFineSilver = ({ currency = "MXN", pfMode = "manual", manualValue = 0, kitcoUsdOz = 0, premiumPct = 0, exchangeRate = 1 }) => {
  if (pfMode === "manual") return roundUp2(manualValue);
  const baseUsd = Number(kitcoUsdOz || 0) / TROY_OUNCE_GRAMS;
  const fineUsd = baseUsd * (1 + Number(premiumPct || 0) / 100);
  return roundUp2(currency === "USD" ? fineUsd : fineUsd * Number(exchangeRate || 0));
};

export const calculatePriceListLine = ({ line, currency = "USD", exchangeRate = 1, fineSilver = 0, marginPct = 0 }) => {
  const laborMxn = roundUp2(line.labor_mxn ?? line.mo_base ?? inferLaborFromLineCode(line.codigo));
  const laborUsd = roundUp2(laborMxn / (Number(exchangeRate || 0) || 1));
  const silver = roundUp2(fineSilver);
  const costLabor = currency === "USD" ? laborUsd : laborMxn;
  const totalCost = roundUp2(costLabor + silver);
  const margin = Number(marginPct || 0);
  const integrated = roundUp2(margin >= 100 ? totalCost : totalCost / (1 - margin / 100));
  const finalLabor = roundUp2(integrated - silver);
  return {
    line_codigo: String(line.codigo || line.line_codigo || "").trim(),
    descripcion: line.descripcion || "",
    labor_mxn: laborMxn,
    labor_usd: laborUsd,
    silver_fine: silver,
    total_cost: totalCost,
    margin_pct: margin,
    integrated_price: integrated,
    final_labor: finalLabor,
  };
};

export const getSilverFinePrice = (metalPrices = emptyMetalPrices) => {
  const stored = Number(metalPrices.plata_fina_mxn || 0);
  if (stored > 0) return stored;

  const kitco = Number(metalPrices.kitco_usd_oz || 0);
  const exchange = Number(metalPrices.tipo_cambio || 0);
  const premium = Number(metalPrices.premio_pct || 0);
  if (!kitco || !exchange) return 0;

  return roundUp2((kitco / TROY_OUNCE_GRAMS) * (1 + premium / 100) * exchange);
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
    .upsert(row, { onConflict: tenantId ? "tenant_id,codigo" : "codigo" });
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

  const { error } = await supabase
    .from("product_lines")
    .upsert(rows, { onConflict: tenantId ? "tenant_id,codigo" : "codigo" });
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
  let query = supabase.from("labor_lists").select("*").eq("active", true).order("created_at", { ascending: false });
  if (tenantId) query = query.eq("tenant_id", tenantId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const fetchCompatibleLaborLists = async (profileOrTenantId = "", currency = "MXN") => {
  const lists = await fetchLaborLists(profileOrTenantId);
  return lists.filter((list) => (list.currency || "MXN") === currency && (list.status || "borrador") === "activa");
};

export const saveLaborList = async (list, profileOrTenantId = "") => {
  const tenantId = getTenantId(profileOrTenantId);
  const currency = String(list.currency || "MXN").toUpperCase();
  const row = {
    name: buildPriceListName(currency, list.name),
    currency,
    status: list.status || "borrador",
    pf_mode: list.pf_mode || "manual",
    kitco_usd_oz: Number(list.kitco_usd_oz || 0),
    oz_grams: Number(list.oz_grams || TROY_OUNCE_GRAMS),
    premio_pct: Number(list.premio_pct || 0),
    tipo_cambio: Number(list.tipo_cambio || 0),
    plata_fina_value: Number(list.plata_fina_value || 0),
    exchange_rate_date: list.exchange_rate_date || null,
    kitco_date: list.kitco_date || null,
    comments: list.comments || "",
    updated_at: new Date().toISOString(),
  };
  if (list.source_snapshot) row.source_snapshot = list.source_snapshot;
  if (row.status === "activa" && !list.activated_at) row.activated_at = new Date().toISOString();
  if (tenantId) row.tenant_id = tenantId;

  const writeList = async (payload) => {
    if (list.id) {
      return supabase.from("labor_lists").update(payload).eq("id", list.id).select("*").single();
    }
    return supabase.from("labor_lists").insert(payload).select("*").single();
  };

  let data;
  let error;
  try {
    ({ data, error } = await writeList(row));
  } catch (requestError) {
    if (!/Failed to fetch/i.test(requestError.message || "")) throw requestError;
    await new Promise((resolve) => setTimeout(resolve, 700));
    ({ data, error } = await writeList(row));
  }
  if (error && row.source_snapshot && /source_snapshot|schema cache|column/i.test(error.message || "")) {
    const { source_snapshot, ...fallbackRow } = row;
    ({ data, error } = await writeList(fallbackRow));
  }
  if (error) throw error;
  return data;
};

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
};

const upsertRowsWithRetry = async (rows) => {
  const { error } = await supabase
    .from("labor_list_lines")
    .upsert(rows, { onConflict: "labor_list_id,line_codigo" });
  if (error) throw error;
};

export const upsertLaborListLines = async (laborListId, lines = []) => {
  if (!lines.length) return;
  const rows = lines.map((line) => ({
    labor_list_id: laborListId,
    line_codigo: String(line.line_codigo || line.codigo || "").trim(),
    descripcion: line.descripcion || "",
    mo_base: Number(line.mo_base ?? line.labor_mxn ?? 0),
    labor_mxn: Number(line.labor_mxn ?? line.mo_base ?? 0),
    labor_usd: Number(line.labor_usd || 0),
    silver_fine: Number(line.silver_fine || 0),
    total_cost: Number(line.total_cost || 0),
    margin_pct: Number(line.margin_pct || 0),
    integrated_price: Number(line.integrated_price || 0),
    final_labor: Number(line.final_labor || 0),
  }));

  for (const rowsChunk of chunk(rows, 25)) {
    try {
      await upsertRowsWithRetry(rowsChunk);
    } catch (error) {
      if (!/Failed to fetch/i.test(error.message || "")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 700));
      await upsertRowsWithRetry(rowsChunk);
    }
  }
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

export const fetchLaborListLinesMap = async (laborListIds = []) => {
  if (!laborListIds.length) return new Map();
  const { data, error } = await supabase
    .from("labor_list_lines")
    .select("*")
    .in("labor_list_id", laborListIds);
  if (error) throw error;
  return (data || []).reduce((map, row) => {
    const listRows = map.get(row.labor_list_id) || [];
    listRows.push(row);
    map.set(row.labor_list_id, listRows);
    return map;
  }, new Map());
};

export const duplicateLaborList = async (list, profileOrTenantId = "") => {
  const sourceLines = await fetchLaborListLines(list.id);
  const copy = await saveLaborList({
    ...list,
    id: undefined,
    name: `${list.name || "Lista"} copia`,
    status: "borrador",
    activated_at: null,
  }, profileOrTenantId);
  await upsertLaborListLines(copy.id, sourceLines);
  return copy;
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
