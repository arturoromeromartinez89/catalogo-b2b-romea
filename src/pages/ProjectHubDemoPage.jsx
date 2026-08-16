import { useEffect, useState } from "react";
import ProjectHub from "../components/ProjectHub";
import NexorBrand from "../components/branding/NexorBrand";

const tenants = [
  { slug: "estuches-chavez", name: "Estuches Chávez" },
  { slug: "vanguardia-joyera", name: "Vanguardia Joyera" },
  { slug: "romea", name: "ROMEA" },
];

export default function ProjectHubDemoPage() {
  const [tenant, setTenant] = useState(tenants[0]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "[PRUEBAS] NEXOR IA · Centro de proyecto";
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div className="project-hub-demo-shell">
      <header className="project-hub-demo-bar">
        <NexorBrand compact subtitle="Centro de proyecto" />
        <div className="project-hub-demo-bar__context">
          <span><i />Nodo seguro</span>
          <label>
            Empresa
            <select value={tenant.slug} onChange={(event) => setTenant(tenants.find((item) => item.slug === event.target.value) || tenants[0])}>
              {tenants.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}
            </select>
          </label>
        </div>
      </header>
      <ProjectHub tenantSlug={tenant.slug} companyName={tenant.name} />
    </div>
  );
}
