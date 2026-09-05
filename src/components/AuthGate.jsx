import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { isAuthLocked } from "../lib/authLock";
import { getSessionAndProfile } from "../services/supabaseCatalog";
import { getAppUrl } from "../utils/basePath";

const VANGUARDIA_LOGO_URL = "https://pyignizeoevafifzfnik.supabase.co/storage/v1/object/public/company-assets/logos/77d5d8e5-9a8b-4e90-a125-06d7d70cc2eb/logo.jpg";
const AUTH_TIMEOUT_MS = 20000;

const copy = {
  es: {
    timeout: "No fue posible conectarse. Intenta nuevamente.",
    missingProfile: "Tu cuenta requiere configuración. Contacta al administrador.",
    noConnect: "No fue posible conectarse. Intenta nuevamente.",
    noRefresh: "No fue posible actualizar tu sesión. Vuelve a iniciar sesión.",
    accountCreated: "Cuenta creada. Revisa tu correo si se requiere confirmación.",
    noSignin: "No se pudo iniciar sesión.",
    missingSupabase: "Servicio no disponible",
    envHelp: "La conexión del sistema no está configurada.",
    sqlHelp: "Contacta al administrador del sistema.",
    loading: "Cargando...",
    slowHelp: "La conexión está tardando más de lo normal.",
    missingUserProfile: "Falta perfil de usuario",
    repairHelp: "Contacta al administrador para activar tu perfil.",
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
    loginProductName: "Catálogo B2B",
    loginProductHelp: "Sistema comercial para catálogos, clientes, preórdenes y cotizaciones.",
    loginFeature1: "Gestión de catálogos y productos",
    loginFeature2: "Preórdenes y cotizaciones B2B",
    loginFeature3: "Clientes, precios y permisos",
    loginFeature4: "PDFs y ligas comerciales",
    appCopyright: "Catálogo B2B",
    // Recuperación de contraseña
    forgotPassword: "¿Olvidaste tu contraseña?",
    resetPassword: "Recuperar contraseña",
    resetHelp: "Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.",
    resetEmailRequired: "El correo es obligatorio para recuperar la contraseña.",
    resetSend: "Enviar enlace de recuperación",
    resetSent: "Listo. Revisa tu correo para restablecer tu contraseña.",
    resetError: "No se pudo enviar el correo de recuperación.",
    backToLogin: "Volver al inicio de sesión",
    sending: "Enviando...",
    // Nueva contraseña (flujo al volver desde el link de Supabase)
    newPasswordTitle: "Crear nueva contraseña",
    newPasswordHelp: "Escribe tu nueva contraseña para completar el restablecimiento.",
    newPassword: "Nueva contraseña",
    confirmPassword: "Confirmar contraseña",
    passwordMismatch: "Las contraseñas no coinciden.",
    passwordTooShort: "La contraseña debe tener al menos 6 caracteres.",
    savePassword: "Guardar nueva contraseña",
    passwordSaved: "Contraseña actualizada correctamente. Ya puedes iniciar sesión.",
    saving: "Guardando...",
    showPassword: "Mostrar contraseña",
    hidePassword: "Ocultar contraseña",
    invalidCredentials: "El correo o la contraseña son incorrectos.",
    emailNotConfirmed: "Confirma tu correo antes de iniciar sesión.",
    tooManyRequests: "Se realizaron demasiados intentos. Espera un momento y vuelve a intentar.",
  },
  en: {
    timeout: "We could not connect. Please try again.",
    missingProfile: "Your account requires configuration. Contact the administrator.",
    noConnect: "We could not connect. Please try again.",
    noRefresh: "We could not refresh your session. Please sign in again.",
    accountCreated: "Account created. Check your email if confirmation is required.",
    noSignin: "Could not sign in.",
    missingSupabase: "Service unavailable",
    envHelp: "The system connection is not configured.",
    sqlHelp: "Contact the system administrator.",
    loading: "Loading...",
    slowHelp: "The connection is taking longer than usual.",
    missingUserProfile: "User profile missing",
    repairHelp: "Contact the administrator to activate your profile.",
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
    // Password recovery
    forgotPassword: "Forgot your password?",
    resetPassword: "Reset password",
    resetHelp: "Enter your email and we will send you a link to reset your password.",
    resetEmailRequired: "Email is required to recover your password.",
    resetSend: "Send recovery link",
    resetSent: "Done. Check your email to reset your password.",
    resetError: "Could not send the recovery email.",
    backToLogin: "Back to sign in",
    sending: "Sending...",
    // New password (flow when returning from Supabase link)
    newPasswordTitle: "Create new password",
    newPasswordHelp: "Enter your new password to complete the reset.",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    passwordMismatch: "Passwords do not match.",
    passwordTooShort: "Password must be at least 6 characters.",
    savePassword: "Save new password",
    passwordSaved: "Password updated successfully. You can now sign in.",
    saving: "Saving...",
    showPassword: "Show password",
    hidePassword: "Hide password",
    invalidCredentials: "The email or password is incorrect.",
    emailNotConfirmed: "Confirm your email before signing in.",
    tooManyRequests: "Too many attempts were made. Wait a moment and try again.",
  },
};

const withTimeout = (promise, ms = AUTH_TIMEOUT_MS, message = copy.es.timeout) => new Promise((resolve, reject) => {
  const timer = window.setTimeout(() => reject(new Error(message)), ms);
  Promise.resolve(promise).then(
    (value) => {
      window.clearTimeout(timer);
      resolve(value);
    },
    (error) => {
      window.clearTimeout(timer);
      reject(error);
    },
  );
});

const getProfileForSession = async (session) => {
  if (!session) return { session: null, profile: null };
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
  return { session, profile: error ? null : profile };
};

const getAuthErrorMessage = (error, text, fallback) => {
  const rawMessage = String(error?.message || "").toLowerCase();
  if (rawMessage.includes("invalid login credentials")) return text.invalidCredentials;
  if (rawMessage.includes("email not confirmed")) return text.emailNotConfirmed;
  if (rawMessage.includes("rate limit") || rawMessage.includes("too many requests")) return text.tooManyRequests;
  return fallback;
};

const authIcon = (name) => {
  const paths = {
    email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
    password: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" /></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.6" /></>,
    eyeOff: <><path d="m3 3 18 18M10.6 6.2A10.5 10.5 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.2 2.9M6.3 6.3C3.9 8 2.5 12 2.5 12s3.5 6 9.5 6c1.5 0 2.9-.4 4.1-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

function AuthBrandPanel() {
  return (
    <aside className="login-brand-panel login-brand-panel--vanguardia">
      <div className="login-brand-content login-brand-content--vanguardia">
        <div className="login-vanguardia-logo-frame">
          <img className="login-vanguardia-logo" src={VANGUARDIA_LOGO_URL} alt="Vanguardia Joyera" />
        </div>
        <div className="login-vanguardia-product">
          <h1>Catálogo B2B</h1>
          <p>Vanguardia Joyera</p>
        </div>
      </div>
    </aside>
  );
}

function AuthFormHeader({ title, help }) {
  return (
    <div className="login-form-heading">
      <h2>{title}</h2>
      <p>{help}</p>
    </div>
  );
}

function AuthFooter() {
  return <small className="login-powered-by">Vanguardia Joyera</small>;
}

export default function AuthGate({ children }) {
  const { language, t } = useLanguage();
  const text = copy[language] || copy.es;
  // modos: "signin" | "reset" | "new-password"
  const [mode, setMode] = useState("signin");
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ email: "", password: "" });
  const [newPasswordForm, setNewPasswordForm] = useState({ password: "", confirm: "" });
  const [passwordVisibility, setPasswordVisibility] = useState({ signin: false, new: false, confirm: false });
  const [loading, setLoading] = useState(true);
  const [showSlowHint, setShowSlowHint] = useState(false);
  const [message, setMessage] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const signInInFlight = useRef(false);

  useEffect(() => {
    document.title = "Vanguardia Joyera · Catálogo B2B";
  }, []);

  useEffect(() => {
    if (!loading) { setShowSlowHint(false); return undefined; }
    const timer = window.setTimeout(() => setShowSlowHint(true), 5000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const refreshSession = async () => {
    setLoading(true);
    setMessage("");
    try {
      const next = await withTimeout(getSessionAndProfile(), AUTH_TIMEOUT_MS, text.timeout);
      setSession(next.session);
      setProfile(next.profile);
      if (next.session && !next.profile) {
        setMessage(text.missingProfile);
      }
    } catch (error) {
      setMessage(getAuthErrorMessage(error, text, text.noConnect));
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

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Ignorar eventos mientras el admin crea una cuenta de cliente
      if (isAuthLocked()) return;
      // Supabase emite PASSWORD_RECOVERY cuando el usuario vuelve desde el link de restablecimiento.
      // En ese momento tiene sesión temporal — mostramos el formulario de nueva contraseña.
      if (event === "PASSWORD_RECOVERY") {
        setMode("new-password");
        setLoading(false);
        return;
      }
      if (event === "SIGNED_IN" && signInInFlight.current) return;
      if (!nextSession) {
        setSession(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      window.setTimeout(async () => {
        try {
          const next = await withTimeout(getProfileForSession(nextSession), AUTH_TIMEOUT_MS, text.timeout);
          setSession(next.session);
          setProfile(next.profile);
          if (!next.profile) setMessage(text.missingProfile);
        } catch (error) {
          setMessage(getAuthErrorMessage(error, text, text.noRefresh));
        } finally {
          setLoading(false);
        }
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    signInInFlight.current = true;
    try {
      const action = supabase.auth.signInWithPassword({ email: form.email, password: form.password });
      const { data, error } = await withTimeout(action, AUTH_TIMEOUT_MS, text.timeout);
      if (error) throw error;
      const next = await withTimeout(getProfileForSession(data.session), AUTH_TIMEOUT_MS, text.timeout);
      setSession(next.session);
      setProfile(next.profile);
      if (next.session && !next.profile) setMessage(text.missingProfile);
    } catch (error) {
      setMessage(getAuthErrorMessage(error, text, text.noSignin));
    } finally {
      signInInFlight.current = false;
      setLoading(false);
    }
  };

  const goToMode = (nextMode) => {
    setMode(nextMode);
    setMessage("");
    setResetSent(false);
    setNewPasswordForm({ password: "", confirm: "" });
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    if (!form.email.trim()) {
      setMessage(text.resetEmailRequired);
      return;
    }
    setResetLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
        redirectTo: getAppUrl(),
      });
      if (error) throw error;
      setResetSent(true);
      setMessage(text.resetSent);
    } catch (error) {
      setMessage(getAuthErrorMessage(error, text, text.resetError));
    } finally {
      setResetLoading(false);
    }
  };

  const saveNewPassword = async (event) => {
    event.preventDefault();
    const { password, confirm } = newPasswordForm;
    if (password.length < 6) {
      setMessage(text.passwordTooShort);
      return;
    }
    if (password !== confirm) {
      setMessage(text.passwordMismatch);
      return;
    }
    setSavingPassword(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage(text.passwordSaved);
      // Cerrar sesión temporal y volver al login para que el usuario entre con la nueva contraseña
      await supabase.auth.signOut();
      goToMode("signin");
    } catch (error) {
      setMessage(getAuthErrorMessage(error, text, text.resetError));
    } finally {
      setSavingPassword(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <section className="setup-screen">
        <div className="setup-card">
          <p className="eyebrow">Catálogo B2B</p>
          <h1>{text.missingSupabase}</h1>
          <p>{text.envHelp}</p>
          <p>{text.sqlHelp}</p>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="setup-screen">
        <div className="loading-card">
          <span className="loading-spinner" aria-hidden="true" />
          <p className="loading-label">{text.loading}</p>
          {showSlowHint ? <p className="muted loading-hint">{text.slowHelp}</p> : null}
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

  // Pantalla de nueva contraseña — se activa cuando Supabase emite PASSWORD_RECOVERY
  if (mode === "new-password") {
    return (
      <section className="login-shell login-shell--vanguardia">
        <AuthBrandPanel />
        <main className="login-form-panel">
          <form className="login-form-card" onSubmit={saveNewPassword}>
            <AuthFormHeader title={text.newPasswordTitle} help={text.newPasswordHelp} />
            <label>
              {text.newPassword}
              <div className="login-input-wrap">
                <span>{authIcon("password")}</span>
                <input
                  type={passwordVisibility.new ? "text" : "password"}
                  value={newPasswordForm.password}
                  onChange={(event) => setNewPasswordForm({ ...newPasswordForm, password: event.target.value })}
                  required
                  minLength={6}
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  aria-label={passwordVisibility.new ? text.hidePassword : text.showPassword}
                  aria-pressed={passwordVisibility.new}
                  onClick={() => setPasswordVisibility((current) => ({ ...current, new: !current.new }))}
                >
                  {authIcon(passwordVisibility.new ? "eyeOff" : "eye")}
                </button>
              </div>
            </label>
            <label>
              {text.confirmPassword}
              <div className="login-input-wrap">
                <span>{authIcon("password")}</span>
                <input
                  type={passwordVisibility.confirm ? "text" : "password"}
                  value={newPasswordForm.confirm}
                  onChange={(event) => setNewPasswordForm({ ...newPasswordForm, confirm: event.target.value })}
                  required
                  minLength={6}
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  aria-label={passwordVisibility.confirm ? text.hidePassword : text.showPassword}
                  aria-pressed={passwordVisibility.confirm}
                  onClick={() => setPasswordVisibility((current) => ({ ...current, confirm: !current.confirm }))}
                >
                  {authIcon(passwordVisibility.confirm ? "eyeOff" : "eye")}
                </button>
              </div>
            </label>
            {message ? <p className="status info">{message}</p> : null}
            <button className="primary-button full login-submit" type="submit" disabled={savingPassword}>
              {savingPassword ? text.saving : text.savePassword}
            </button>
            <AuthFooter />
          </form>
        </main>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="login-shell login-shell--vanguardia">
        <AuthBrandPanel />

        <main className="login-form-panel">
          {mode === "reset" ? (
            <form className="login-form-card" onSubmit={resetPassword}>
              <AuthFormHeader title={text.resetPassword} help={text.resetHelp} />
              <label>
                {text.email}
                <div className="login-input-wrap">
                  <span>{authIcon("email")}</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    required
                    disabled={resetSent}
                  />
                </div>
              </label>
              {message ? <p className={`status ${resetSent ? "success" : "info"}`}>{message}</p> : null}
              {!resetSent ? (
                <button className="primary-button full login-submit" type="submit" disabled={resetLoading}>
                  {resetLoading ? text.sending : text.resetSend}
                </button>
              ) : null}
              <button className="link-button" type="button" onClick={() => goToMode("signin")}>
                {text.backToLogin}
              </button>
              <AuthFooter />
            </form>
          ) : (
            <form className="login-form-card" onSubmit={submit} aria-label="Iniciar sesión">
              <AuthFormHeader title={text.signIn} help={text.loginHelp} />
              <label>
                {text.email}
                <div className="login-input-wrap">
                  <span>{authIcon("email")}</span>
                  <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
                </div>
              </label>
              <label>
                {text.password}
                <div className="login-input-wrap">
                  <span>{authIcon("password")}</span>
                  <input type={passwordVisibility.signin ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
                  <button
                    className="login-password-toggle"
                    type="button"
                    aria-label={passwordVisibility.signin ? text.hidePassword : text.showPassword}
                    aria-pressed={passwordVisibility.signin}
                    onClick={() => setPasswordVisibility((current) => ({ ...current, signin: !current.signin }))}
                  >
                    {authIcon(passwordVisibility.signin ? "eyeOff" : "eye")}
                  </button>
                </div>
              </label>
              {message ? <p className="status info">{message}</p> : null}
              <button className="primary-button full login-submit" type="submit">
                {text.signIn}
              </button>
              <button className="link-button" type="button" onClick={() => goToMode("reset")}>
                {text.forgotPassword}
              </button>
              <AuthFooter />
            </form>
          )}
        </main>
      </section>
    );
  }

  // Cuenta de cliente suspendida por el admin
  if (profile?.role === "client" && profile?.active === false) {
    return (
      <section className="setup-screen">
        <div className="setup-card">
          <p className="eyebrow">Catálogo B2B</p>
          <h1>Cuenta suspendida</h1>
          <p>Tu acceso ha sido temporalmente desactivado. Contacta a tu proveedor para más información.</p>
          <button className="secondary-button" type="button" onClick={() => supabase.auth.signOut()}>
            Cerrar sesión
          </button>
        </div>
      </section>
    );
  }

  return children({ session, profile });
}
