import { useEffect, useState } from "react";
import ProjectHub from "../components/ProjectHub";
import nexorLogoUrl from "../assets/nexor-ia_lockup_dark-on-transparent.svg";
import estuchesChavezLogoUrl from "../assets/logo-estuches-chavez.png";

const tenant = {
  slug: "estuches-chavez",
  name: "Estuches Chávez",
  logoUrl: estuchesChavezLogoUrl,
};

export default function ProjectHubDemoPage() {
  const [portalContext, setPortalContext] = useState({ projectName: "Digitalización de operaciones", solutionName: "" });

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "[PRUEBAS] NEXOR IA · Centro de proyecto";
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div className="project-hub-demo-shell project-hub-demo-shell--light">
      <header className="project-hub-demo-bar">
        <img className="project-hub-demo-logo" src={nexorLogoUrl} alt="NEXOR IA" />
        <div className="project-hub-client-context">
          <div className="project-hub-client-logo" data-client-logo-slot="true">
            <img src={tenant.logoUrl} alt={tenant.name} />
          </div>
          <div className="nexor-top-location nexor-top-location--client" aria-label={`${tenant.name}, proyecto ${portalContext.projectName}`}>
            <small>{portalContext.solutionName ? `Solución · ${portalContext.solutionName}` : "Portal del cliente"}</small>
            <strong>{portalContext.projectName || "Proyecto"}</strong>
          </div>
        </div>
      </header>
      <ProjectHub tenantSlug={tenant.slug} companyName={tenant.name} theme="light" onContextChange={setPortalContext} />
    </div>
  );
}
