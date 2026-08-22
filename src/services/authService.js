import { withBasePath } from "../utils/basePath";

const clearSupabaseAuthStorage = () => {
  if (typeof window === "undefined") return;
  [window.localStorage, window.sessionStorage].forEach((storage) => {
    try {
      Object.keys(storage)
        .filter((key) => key.startsWith("sb-") || key.includes("supabase.auth"))
        .forEach((key) => storage.removeItem(key));
    } catch {
      // Ignore storage access errors and continue with redirect.
    }
  });
};

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const fastSignOut = async (supabase) => {
  if (supabase?.auth?.signOut) {
    const signOut = supabase.auth
      .signOut({ scope: "local" })
      .then(({ error }) => ({ error }))
      .catch((error) => ({ error }));

    await Promise.race([signOut, wait(1200).then(() => ({ timedOut: true }))]);
  }

  // El cierre local es la garantía final: aun sin red o sin Supabase configurado,
  // el usuario no debe quedar atrapado ni conservar credenciales en el navegador.
  clearSupabaseAuthStorage();

  window.setTimeout(() => {
    window.location.replace(withBasePath());
  }, 120);
};
