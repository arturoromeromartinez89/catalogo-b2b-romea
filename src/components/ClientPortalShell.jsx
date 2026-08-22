import { useEffect, useState } from "react";
import ProjectHub from "./ProjectHub";
import nexorLogoUrl from "../assets/nexor-ia_lockup_dark-on-transparent.svg";
import { supabase } from "../lib/supabaseClient";
import { fastSignOut } from "../services/authService";

const headerIcon = (name) => {
  const paths = {
    studio: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M9 10h12" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
};

export default function ClientPortalShell({
  tenantId = "",
  tenantSlug = "",
  companyName = "Cliente",
  clientLogoUrl = "",
  clientShortName = "",
  initialProjectName = "Proyecto",
  onReturnToStudio = null,
}) {
  const [portalContext, setPortalContext] = useState({ projectName: initialProjectName, solutionName: "" });
  const [signingOut, setSigningOut] = useState(false);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${companyName} · NEXOR IA`;
    return () => { document.title = previousTitle; };
  }, [companyName]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSessionError("");
    setSigningOut(true);
    try {
      await fastSignOut(supabase);
    } catch (error) {
      setSessionError(error.message || "No se pudo cerrar la sesión. Intenta de nuevo.");
      setSigningOut(false);
    }
  };

  return (
    <div className="project-hub-demo-shell project-hub-demo-shell--light">
      <header className="project-hub-demo-bar">
        <img className="project-hub-demo-logo" src={nexorLogoUrl} alt="NEXOR IA" />
        <div className="project-hub-demo-bar__portal-actions">
          <div className="nexor-workplace nexor-workplace--client" aria-label={`${companyName}, proyecto ${portalContext.projectName}`}>
            <div className="project-hub-client-logo" data-client-logo-slot="true">
              {clientLogoUrl
                ? <img src={clientLogoUrl} alt={companyName} />
                : <span className="project-hub-client-logo__name">{clientShortName || companyName}</span>}
            </div>
            <span className="nexor-workplace__divider" aria-hidden="true" />
            <strong><span>Proyecto:</span> {portalContext.projectName || "Por definir"}</strong>
          </div>
          <div className="nexor-header-actions" role="group" aria-label="Navegación de cuenta">
            {onReturnToStudio ? (
              <button className="nexor-header-action nexor-header-action--primary" type="button" onClick={onReturnToStudio}>
                {headerIcon("studio")}
                <span>Studio</span>
              </button>
            ) : null}
            <button className="nexor-header-action nexor-header-action--logout" type="button" onClick={handleSignOut} disabled={signingOut}>
              {headerIcon("logout")}
              <span>{signingOut ? "Saliendo..." : "Salir"}</span>
            </button>
          </div>
        </div>
      </header>

      {sessionError ? <div className="nexor-session-error" role="alert"><span>{sessionError}</span><button type="button" onClick={() => setSessionError("")}>Cerrar</button></div> : null}
      <ProjectHub tenantId={tenantId} tenantSlug={tenantSlug} companyName={companyName} theme="light" onContextChange={setPortalContext} />

      {signingOut ? (
        <div className="signout-overlay nexor-studio-signout" role="status" aria-live="assertive">
          <div className="signout-card">
            <span className="loading-spinner" aria-hidden="true" />
            <strong>Cerrando sesión</strong>
            <p>Protegiendo tu acceso antes de salir.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
