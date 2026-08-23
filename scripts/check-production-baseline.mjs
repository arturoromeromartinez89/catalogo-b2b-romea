import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifestUrl = new URL("../supabase/baselines/production-manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

assert.equal(
  manifest.sha256,
  "d247b08b9876d626e9a55e0c106dbbd9a2033d70d2b27c2d267444b98b418c50",
  "La huella de la baseline cambio sin actualizar su evidencia privada",
);
assert.equal(manifest.functional_tables, 42, "Conteo inesperado de tablas");
assert.equal(manifest.rls_policies, 90, "Conteo inesperado de politicas");
assert.equal(manifest.public_functions, 17, "Conteo inesperado de funciones");
assert.equal(manifest.contains_data, false, "La baseline declarada no debe contener datos");
assert.equal(manifest.repository_copy, false, "El dump privado no debe versionarse");

console.log("PASS: manifiesto de baseline privada verificado (42 tablas, 90 politicas, 17 funciones)." );
