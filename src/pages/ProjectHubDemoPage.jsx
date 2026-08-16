import { useEffect } from "react";
import ProjectHub from "../components/ProjectHub";
import NexorBrand from "../components/branding/NexorBrand";

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
        <NexorBrand />
      </header>
      <ProjectHub tenantSlug={tenant.slug} companyName={tenant.name} theme="light" />
    </div>
  );
}
