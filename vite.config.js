import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const PRODUCTION_SUPABASE_REF = "pyignizeoevafifzfnik";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const deployEnvironment = process.env.VITE_DEPLOY_ENV
    || env.VITE_DEPLOY_ENV
    || (mode === "staging" ? "staging" : "production");
  const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  const projectRef = supabaseUrl.match(/^https:\/\/([a-z]+)\.supabase\.co\/?$/)?.[1] || "";

  if (deployEnvironment !== "production" && projectRef === PRODUCTION_SUPABASE_REF) {
    throw new Error("BLOQUEADO: una compilacion de pruebas no puede usar Supabase de produccion.");
  }
  if (deployEnvironment === "production" && projectRef && projectRef !== PRODUCTION_SUPABASE_REF) {
    throw new Error("BLOQUEADO: una compilacion de produccion no puede usar Supabase de pruebas.");
  }

  return {
    plugins: [react()],
  };
});
