import ClientPortalShell from "../components/ClientPortalShell";
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
  return <ClientPortalShell
    tenantSlug={tenant.slug}
    companyName={tenant.name}
    clientLogoUrl={tenant.logoUrl}
    clientShortName={tenant.shortName}
    initialProjectName={tenant.projectName}
    onReturnToStudio={() => window.location.assign(`${import.meta.env.BASE_URL}demo/studio`)}
  />;
}
