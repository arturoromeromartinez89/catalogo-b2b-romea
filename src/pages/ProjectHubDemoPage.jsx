import { useEffect, useState } from "react";
import ProjectHub from "../components/ProjectHub";
import nexorLogoUrl from "../assets/nexor-ia_lockup_dark-on-transparent.svg";
import estuchesChavezLogoUrl from "../assets/logo-estuches-chavez.png";

const portalTenants = {
  "estuches-chavez": {
    slug: "estuches-chavez",
    name: "Estuches Chávez",
    logoUrl: estuchesChavezLogoUrl,
    projectName: "Digitalización de operaciones",
  },
  "vanguardia-joyera": {
    slug: "vanguardia-joyera",
    name: "Vanguardia Joyera",
    shortName: "VANGUARDIA JOYERA",
    projectName: "Evolución del sistema comercial",
  },
  romea: {
    slug: "romea",
    name: "ROMEA",
    shortName: "ROMEA",
    projectName: "Plataforma comercial B2B",
  },
};

const getRequestedTenant = () => {
  const requestedSlug = new URLSearchParams(window.location.search).get("cliente") || "";
  return portalTenants[requestedSlug] || portalTenants["estuches-chavez"];
};

export default function ProjectHubDemoPage() {
  const tenant = getRequestedTenant();
  const [portalContext, setPortalContext] = useState({ projectName: tenant.projectName, solutionName: "" });

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `[PRUEBAS] ${tenant.name} · NEXOR IA`;
    return () => { document.title = previousTitle; };
  }, [tenant.name]);

  const leaveClientView = () => {
    window.location.assign(`${import.meta.env.BASE_URL}demo/studio`);
  };

  return (
    <div className="project-hub-demo-shell project-hub-demo-shell--light">
      <header className="project-hub-demo-bar">
        <img className="project-hub-demo-logo" src={nexorLogoUrl} alt="NEXOR IA" />
        <div className="project-hub-demo-bar__portal-actions">
          <div className="nexor-workplace nexor-workplace--client" aria-label={`${tenant.name}, proyecto ${portalContext.projectName}`}>
            <div className="project-hub-client-logo" data-client-logo-slot="true">
              {tenant.logoUrl
                ? <img src={tenant.logoUrl} alt={tenant.name} />
                : <span className="project-hub-client-logo__name">{tenant.shortName || tenant.name}</span>}
            </div>
            <span className="nexor-workplace__divider" aria-hidden="true" />
            <strong><span>Proyecto:</span> {portalContext.projectName || "Por definir"}</strong>
          </div>
          <button className="project-hub-exit-client" type="button" onClick={leaveClientView} aria-label="Salir de vista cliente y volver a NEXOR Studio">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5" />
              <path d="m11 18-6-6 6-6" />
            </svg>
            <span>Salir de vista cliente</span>
          </button>
        </div>
      </header>
      <ProjectHub tenantSlug={tenant.slug} companyName={tenant.name} theme="light" onContextChange={setPortalContext} />
    </div>
  );
}
