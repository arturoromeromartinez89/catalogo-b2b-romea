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
  const signOut = supabase.auth
    .signOut({ scope: "local" })
    .then(({ error }) => ({ error }))
    .catch((error) => ({ error }));

  const result = await Promise.race([signOut, wait(1200).then(() => ({ timedOut: true }))]);

  if (result?.error) throw result.error;
  if (result?.timedOut) clearSupabaseAuthStorage();

  window.setTimeout(() => {
    window.location.replace("/");
  }, 120);
};
