import { useState } from "react";
import ProjectHub from "../components/ProjectHub";

const tenants = [
  { slug: "estuches-chavez", name: "Estuches Chávez" },
  { slug: "vanguardia-joyera", name: "Vanguardia Joyera" },
  { slug: "romea", name: "ROMEA" },
];

export default function ProjectHubDemoPage() {
  const [tenant, setTenant] = useState(tenants[0]);

  return (
    <div className="project-hub-demo-shell">
      <header className="project-hub-demo-bar">
        <div>
          <strong>NEXOR IA</strong>
          <span>Presentación del Client Portal</span>
        </div>
        <label>
          Empresa
          <select value={tenant.slug} onChange={(event) => setTenant(tenants.find((item) => item.slug === event.target.value) || tenants[0])}>
            {tenants.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}
          </select>
        </label>
      </header>
      <ProjectHub tenantSlug={tenant.slug} companyName={tenant.name} />
    </div>
  );
}
