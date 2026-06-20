import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const deploymentEnvironment = import.meta.env.VITE_DEPLOY_ENV || "production";
export const applicationVersion = import.meta.env.VITE_APP_VERSION || "development";

if (typeof document !== "undefined" && deploymentEnvironment !== "production") {
  document.documentElement.dataset.environment = deploymentEnvironment;
  if (!document.title.startsWith("[PRUEBAS]")) document.title = `[PRUEBAS] ${document.title}`;
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
