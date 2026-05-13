import { supabase } from "../lib/supabaseClient";

// ── LÍNEAS ────────────────────────────────────────────────
export const fetchLines = async () => {
  const { data, error } = await supabase
    .from("product_lines")
    .select("*")
    .eq("activa", true)
    .order("codigo");
  if (error) throw error;
  return data;
};

export const saveLine = async (line) => {
  const { error } = await supabase
    .from("product_lines")
    .upsert({ ...line, updated_at: new Date().toISOString() }, { onConflict: "codigo" });
  if (error) throw error;
};

// ── PRECIOS DE METAL ──────────────────────────────────────
export const fetchMetalPrices = async () => {
  const { data, error } = await supabase
    .from("metal_prices")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  if (error) return { kitco_usd_oz: 0, tipo_cambio: 17, premio_pct: 4, plata_fina_mxn: 0 };
  return data;
};

export const saveMetalPrices = async ({ kitco_usd_oz, tipo_cambio, premio_pct }, userEmail) => {
  // Borrar registros anteriores y crear uno nuevo
  await supabase.from("metal_prices").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const { error } = await supabase.from("metal_prices").insert({
    kitco_usd_oz: Number(kitco_usd_oz),
    tipo_cambio: Number(tipo_cambio),
    premio_pct: Number(premio_pct),
    updated_at: new Date().toISOString(),
    updated_by: userEmail || "admin",
  });
  if (error) throw error;
};

// ── MÁRGENES POR CLIENTE ──────────────────────────────────
export const fetchClientMargins = async (clientId) => {
  const { data, error } = await supabase
    .from("client_line_margins")
    .select("*")
    .eq("client_id", clientId);
  if (error) throw error;
  return data;
};

export const saveClientMargin = async (clientId, lineCodigo, margenPct) => {
  const { error } = await supabase
    .from("client_line_margins")
    .upsert(
      { client_id: clientId, line_codigo: lineCodigo, margen_pct: Number(margenPct) },
      { onConflict: "client_id,line_codigo" }
    );
  if (error) throw error;
};

// ── CÁLCULO DE PRECIO ─────────────────────────────────────
export const calcPrecioGramo = ({ mo_base, plata_fina_mxn, margen_pct, tipo_cambio_output = 1 }) => {
  const plata = Number(plata_fina_mxn || 0);
  const mo = Number(mo_base || 0);
  const margen = Number(margen_pct || 0) / 100;
  const costo = mo + plata;
  const integrado = margen > 0 && margen < 1 ? costo / (1 - margen) : costo;
  const mo_visible = integrado - plata;
  return {
    plata_fina: plata / tipo_cambio_output,
    mo_visible: mo_visible / tipo_cambio_output,
    integrado: integrado / tipo_cambio_output,
    costo,
  };
};

// ── PRECIO LÍNEA DEL SKU ──────────────────────────────────
export const getPrecioLineaForSku = (linea, lines, metalPrices, margins, clientId) => {
  const line = lines.find((l) => l.codigo === linea);
  if (!line) return null;
  const margin = margins.find((m) => m.client_id === clientId && m.line_codigo === linea);
  return calcPrecioGramo({
    mo_base: line.mo_base,
    plata_fina_mxn: metalPrices.plata_fina_mxn,
    margen_pct: margin?.margen_pct || 0,
  });
};
