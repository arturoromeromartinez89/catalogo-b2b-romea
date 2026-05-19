import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { getSessionAndProfile } from "../services/supabaseCatalog";

const copy = {
  es: {
    timeout: "Supabase tardó demasiado en responder. Revisa que el SQL haya corrido completo.",
    missingProfile: "Tu usuario existe, pero falta crear su perfil. Corre el SQL de reparación que te indiqué.",
    noConnect: "No se pudo conectar con Supabase.",
    noRefresh: "No se pudo actualizar la sesión.",
    accountCreated: "Cuenta creada. Revisa tu correo si Supabase pide confirmación.",
    noSignin: "No se pudo iniciar sesión.",
    missingSupabase: "Falta conectar Supabase",
    envHelp: "Crea un archivo .env usando .env.example y coloca:",
    sqlHelp: "Después corre el SQL de supabase/schema.sql en Supabase y reinicia npm run dev.",
    loading: "Cargando...",
    slowHelp: "Si se tarda más de 10 segundos, hay un problema con Supabase o con las tablas.",
    missingUserProfile: "Falta perfil de usuario",
    repairHelp: "Ejecuta en Supabase el SQL de reparación para crear tu perfil admin.",
    retry: "Reintentar",
    closeSession: "Cerrar sesión",
    createAccess: "Crear acceso",
    signIn: "Iniciar sesión",
    email: "Correo",
    password: "Contraseña",
    createAccount: "Crear cuenta",
    enter: "Entrar",
    haveAccount: "Ya tengo cuenta",
    createClientAccount: "Crear cuenta de cliente",
    welcome: "Bienvenido",
    loginHelp: "Ingresa tus credenciales para continuar",
    loginProductName: "Catalogo B2B",
    loginProductHelp: "Sistema comercial para catalogos, clientes, preordenes y cotizaciones.",
    loginFeature1: "Gestion de catalogos y productos",
    loginFeature2: "Preordenes y cotizaciones B2B",
    loginFeature3: "Clientes, precios y permisos",
    loginFeature4: "PDFs y ligas comerciales",
    appCopyright: "Catalogo B2B",
  },
  en: {
    timeout: "Supabase took too long to respond. Check that the SQL ran completely.",
    missingProfile: "Your user exists, but its profile is missing. Run the repair SQL I gave you.",
    noConnect: "Could not connect to Supabase.",
    noRefresh: "Could not refresh the session.",
    accountCreated: "Account created. Check your email if Supabase requires confirmation.",
    noSignin: "Could not sign in.",
    missingSupabase: "Supabase connection missing",
    envHelp: "Create a .env file using .env.example and add:",
    sqlHelp: "Then run supabase/schema.sql in Supabase and restart npm run dev.",
    loading: "Loading...",
    slowHelp: "If this takes more than 10 seconds, there may be a Supabase or table setup issue.",
    missingUserProfile: "User profile missing",
    repairHelp: "Run the repair SQL in Supabase to create your admin profile.",
    retry: "Retry",
    closeSession: "Sign out",
    createAccess: "Create access",
    signIn: "Sign in",
    email: "Email",
    password: "Password",
    createAccount: "Create account",
    enter: "Enter",
    haveAccount: "I already have an account",
    createClientAccount: "Create client account",
    welcome: "Welcome",
    loginHelp: "Enter your credentials to continue",
    loginProductName: "B2B Catalog",
    loginProductHelp: "Commercial system for catalogs, customers, preorders and quotes.",
    loginFeature1: "Catalog and product management",
    loginFeature2: "B2B preorders and quotes",
    loginFeature3: "Customers, pricing and permissions",
    loginFeature4: "PDFs and commercial links",
    appCopyright: "B2B Catalog",
  },
};

const withTimeout = (promise, ms = 9000, message = copy.es.timeout) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);

export default function AuthGate({ children }) {
  const { language, t } = useLanguage();
  const text = copy[language] || copy.es;
  const [mode, setMode] = useState("signin");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const refreshSession = async () => {
    setLoading(true);
    setMessage("");
    try {
      const next = await withTimeout(getSessionAndProfile(), 9000, text.timeout);
      setSession(next.session);
      setProfile(next.profile);
      if (next.session && !next.profile) {
        setMessage(text.missingProfile);
      }
    } catch (error) {
      setMessage(error.message || text.noConnect);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    refreshSession();

    const { data } = supabase.auth.onAuthStateChange(async () => {
      try {
        const next = await withTimeout(getSessionAndProfile(), 9000, text.timeout);
        setSession(next.session);
        setProfile(next.profile);
      } catch (error) {
        setMessage(error.message || text.noRefresh);
      } finally {
        setLoading(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const action =
        mode === "signup"
          ? supabase.auth.signUp({ email: form.email, password: form.password })
          : supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      const { error } = await withTimeout(action, 9000, text.timeout);
      if (error) throw error;
      if (mode === "signup") setMessage(text.accountCreated);
      const next = await withTimeout(getSessionAndProfile(), 9000, text.timeout);
      setSession(next.session);
      setProfile(next.profile);
    } catch (error) {
      setMessage(error.message || text.noSignin);
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <section className="setup-screen">
        <div className="setup-card">
          <p className="eyebrow">Catálogo B2B</p>
          <h1>{text.missingSupabase}</h1>
          <p>{text.envHelp}</p>
          <pre>VITE_SUPABASE_URL=...{"\n"}VITE_SUPABASE_ANON_KEY=...</pre>
          <p>{text.sqlHelp}</p>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="setup-screen">
        <div className="setup-card">
          <p>{text.loading}</p>
          <p className="muted">{text.slowHelp}</p>
        </div>
      </section>
    );
  }

  if (session && !profile) {
    return (
      <section className="setup-screen">
        <div className="setup-card">
          <p className="eyebrow">Catálogo B2B</p>
          <h1>{text.missingUserProfile}</h1>
          {message ? <p className="status warning">{message}</p> : null}
          <p>{text.repairHelp}</p>
          <button className="primary-button" type="button" onClick={refreshSession}>{text.retry}</button>
          <button className="secondary-button" type="button" onClick={() => supabase.auth.signOut()}>{text.closeSession}</button>
        </div>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="login-shell">
        <aside className="login-brand-panel">
          <div className="login-brand-orb one" />
          <div className="login-brand-orb two" />
          <div className="login-brand-content">
            <div className="login-icon-box" aria-hidden="true">▥</div>
            <h1>{text.loginProductName}</h1>
            <p>{text.loginProductHelp}</p>
            <ul>
              <li>{text.loginFeature1}</li>
              <li>{text.loginFeature2}</li>
              <li>{text.loginFeature3}</li>
              <li>{text.loginFeature4}</li>
            </ul>
          </div>
        </aside>

        <main className="login-form-panel">
          <form className="login-form-card" onSubmit={submit}>
            <div>
              <h2>{mode === "signup" ? text.createAccess : text.welcome}</h2>
              <p>{text.loginHelp}</p>
            </div>
            <label>
              {text.email}
              <div className="login-input-wrap">
                <span aria-hidden="true">✉</span>
                <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
              </div>
            </label>
            <label>
              {text.password}
              <div className="login-input-wrap">
                <span aria-hidden="true">□</span>
                <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
              </div>
            </label>
            {message ? <p className="status info">{message}</p> : null}
            <button className="primary-button full login-submit" type="submit">
              {mode === "signup" ? text.createAccount : text.signIn}
            </button>
            <button className="link-button" type="button" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
              {mode === "signup" ? text.haveAccount : text.createClientAccount}
            </button>
            <small>{text.appCopyright} © 2026</small>
          </form>
        </main>
      </section>
    );
  }

  return children({ session, profile });
}
