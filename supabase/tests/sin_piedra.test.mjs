// Test ejecutable de la lógica de quick filters (corre el código REAL de
// src/utils/filters.js). Verifica que 'Sin piedra' (without_stone) da el mismo
// resultado venga de la lista por defecto o de una definición estilo-BD, y que
// un filtro DB-driven de otro giro (vitrinas) realmente filtra.
//
// Correr:  npx esbuild supabase/tests/sin_piedra.test.mjs --bundle --platform=node --format=esm --outfile=.sp_bundle.mjs && node .sp_bundle.mjs
import { applyFilters, DEFAULT_QUICK_FILTER_DEFINITIONS } from "../../src/utils/filters.js";

const P = (codigo, searchText) => ({ codigo, searchText, visibleWeb: true, estatus: "" });

const incluir = [
  P("A1", "anillo sin piedra"),   // dice "sin piedra"
  P("A2", "cadena liso"),         // dice "liso"
  P("A3", "pulsera rodio"),       // sin ninguna palabra de piedra
];
const excluir = [
  P("B1", "anillo con piedra"), P("B2", "ring with stone"), P("B3", "arete zirconia"),
  P("B4", "collar perla"), P("B5", "pearl pendant"), P("B6", "dije cristal"),
  P("B7", "crystal ring"), P("B8", "gema preciosa"), P("B9", "gem set"),
  P("B10", "anillo onix"), P("B11", "diamante engaste"), P("B12", "diamond ring"),
];
const all = [...incluir, ...excluir];

// Definición estilo-BD para 'sin piedra' (lo que produce el servicio cuando
// match_type='without_stone'): terms vacío + custom='withoutStone'.
const dbDefs = [{ id: "sin-piedra", labels: { es: "Sin piedra", en: "No stone" }, terms: [], custom: "withoutStone" }];

let ok = true;
const log = (m) => console.log(m);

const resDefault = applyFilters(all, "", {}, ["sin-piedra"], [], DEFAULT_QUICK_FILTER_DEFINITIONS).map((p) => p.codigo).sort();
const resDb = applyFilters(all, "", {}, ["sin-piedra"], [], dbDefs).map((p) => p.codigo).sort();

if (JSON.stringify(resDefault) !== JSON.stringify(resDb)) { ok = false; log(`FAIL: DB-driven (${resDb}) != DEFAULT (${resDefault})`); }
else log(`PASS: without_stone DB-driven == lógica anterior -> [${resDb.join(", ")}]`);

const incl = new Set(resDb);
const faltan = incluir.filter((p) => !incl.has(p.codigo)).map((p) => p.codigo);
const colados = excluir.filter((p) => incl.has(p.codigo)).map((p) => p.codigo);
if (faltan.length) { ok = false; log(`FAIL: debían incluirse y no están: ${faltan}`); }
if (colados.length) { ok = false; log(`FAIL: debían excluirse y se colaron: ${colados}`); }
if (!faltan.length && !colados.length) log("PASS: incluye sin-piedra/liso/sin-palabra y excluye piedra·stone·zirconia·perla·pearl·cristal·crystal·gema·gem·onix·diamante·diamond");

// Filtro DB-driven de otro tenant (exhibidores) realmente filtra por términos
const expoDefs = [{ id: "vitrinas", labels: { es: "Vitrinas" }, terms: [["vitrina"]] }];
const expo = [P("V1", "vitrina de cristal"), P("V2", "base de madera"), P("V3", "gancho metalico"), P("V4", "vitrina grande")];
const resExpo = applyFilters(expo, "", {}, ["vitrinas"], [], expoDefs).map((p) => p.codigo).sort();
if (JSON.stringify(resExpo) === JSON.stringify(["V1", "V4"])) log(`PASS: filtro DB-driven 'vitrinas' filtra correctamente -> [${resExpo.join(", ")}]`);
else { ok = false; log(`FAIL: vitrinas dio [${resExpo}] (esperado V1,V4)`); }

log(ok ? "== TODOS LOS PASS ==" : "== HUBO FALLOS ==");
process.exit(ok ? 0 : 1);
