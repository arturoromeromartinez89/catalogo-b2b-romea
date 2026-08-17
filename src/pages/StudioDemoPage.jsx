import { useEffect } from "react";
import SuperAdminDashboard from "../components/superadmin/SuperAdminDashboard";

// Vitrina de NEXOR Studio para revisión de diseño. Solo existe en staging y solo usa
// información inventada: ninguna consulta a la base, ninguna sesión, ningún dato real.

const demoTenants = [
  { id: "demo-tenant-1", name: "Estuches Chávez", slug: "estuches-chavez", status: "active", created_at: "2026-08-10T12:00:00Z" },
  { id: "demo-tenant-2", name: "Vanguardia Joyera", slug: "vanguardia-joyera", status: "active", created_at: "2026-06-02T12:00:00Z" },
  { id: "demo-tenant-3", name: "ROMEA", slug: "romea", status: "active", created_at: "2026-07-15T12:00:00Z" },
  { id: "demo-tenant-4", name: "Taller de muestra", slug: "taller-de-muestra", status: "paused", created_at: "2026-05-04T12:00:00Z" },
];

const demoProfiles = [
  { id: "demo-profile-1", email: "arturo@ejemplo.nexor", role: "superadmin", tenant_id: null, client_id: null, created_at: "2026-05-01T12:00:00Z" },
  { id: "demo-profile-2", email: "daniel@ejemplo.nexor", role: "admin", tenant_id: null, client_id: null, created_at: "2026-08-17T12:00:00Z" },
  { id: "demo-profile-3", email: "contacto@ejemplo.cliente", role: "tenant_admin", tenant_id: "demo-tenant-1", client_id: null, created_at: "2026-08-12T12:00:00Z" },
];

const demoMetrics = {
  "demo-tenant-1": { products: 0, clients: 2, preorders: 0 },
  "demo-tenant-2": { products: 1860, clients: 16, preorders: 21 },
  "demo-tenant-3": { products: 49, clients: 100, preorders: 28 },
  "demo-tenant-4": { products: 0, clients: 0, preorders: 0 },
};

const demoProfile = { id: "demo-profile-1", email: "arturo@ejemplo.nexor", role: "superadmin" };

export default function StudioDemoPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "[PRUEBAS] NEXOR Studio";
    return () => { document.title = previousTitle; };
  }, []);

  return <SuperAdminDashboard profile={demoProfile} demoData={{ tenants: demoTenants, profiles: demoProfiles, metrics: demoMetrics }} />;
}
