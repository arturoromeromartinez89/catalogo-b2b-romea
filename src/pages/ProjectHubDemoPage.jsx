import { useEffect } from "react";
import ProjectHub from "../components/ProjectHub";
import nexorLogoUrl from "../assets/nexor-ia_lockup_dark-on-transparent.svg";

const tenant = { slug: "estuches-chavez", name: "Estuches Chávez" };

export default function ProjectHubDemoPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "[PRUEBAS] NEXOR IA · Centro de proyecto";
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div className="project-hub-demo-shell project-hub-demo-shell--light">
      <header className="project-hub-demo-bar">
        <img className="project-hub-demo-logo" src={nexorLogoUrl} alt="NEXOR IA" />
      </header>
      <ProjectHub tenantSlug={tenant.slug} companyName={tenant.name} theme="light" />
    </div>
  );
}
