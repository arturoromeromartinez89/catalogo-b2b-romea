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

const demoProjectsByTenant = {
  "demo-tenant-1": [{
    id: "demo-project-1", tenant_id: "demo-tenant-1", name: "Digitalización de operaciones", description: "Sistema adaptado a la operación de Estuches Chávez.", status: "active", health: "green", current_phase_name: "Diseño funcional", start_date: "2026-08-10", estimated_end_date: "2026-09-18", internal_owner_name: "Arturo Romero", published: true,
    project_solutions: [{ id: "demo-solution-1", name: "Inventario", description: "Control de existencias, entradas y salidas.", status: "in_progress", stage_name: "Operación", current_phase_name: "Diseño funcional", next_milestone: "Aprobación del flujo", sort_order: 10, visible_to_client: true }],
    project_deliverables: [{ id: "demo-deliverable-1", name: "Mapa operativo", status: "approved", weight: 1, visible_to_client: true }, { id: "demo-deliverable-2", name: "Prototipo de inventario", status: "in_progress", weight: 5, estimated_delivery_date: "2026-09-02", visible_to_client: true }],
    project_approvals: [{ id: "demo-approval-1", title: "Aprobar flujo de entradas y salidas", status: "pending", due_date: "2026-08-21", visible_to_client: true }],
    project_tasks: [{ id: "demo-task-1", title: "Diseñar recepción de mercancía", status: "in_progress", priority: "high", visible_to_client: true }],
    project_members: [{ id: "demo-member-1", profile_id: "demo-profile-1", project_role: "responsable" }, { id: "demo-member-2", profile_id: "demo-profile-2", project_role: "colaborador" }],
  }],
  "demo-tenant-2": [{
    id: "demo-project-2", tenant_id: "demo-tenant-2", name: "Sistema integral Vanguardia", description: "Sistema comercial y operativo adaptado a Vanguardia Joyera.", status: "active", health: "yellow", current_phase_name: "Catálogo comercial", start_date: "2026-06-15", estimated_end_date: "2026-10-30", internal_owner_name: "Daniel", published: true,
    project_solutions: [{ id: "demo-solution-2", name: "Catálogo B2B", status: "in_progress", sort_order: 10, visible_to_client: true }, { id: "demo-solution-3", name: "Compras", status: "planned", sort_order: 20, visible_to_client: true }],
    project_deliverables: [{ id: "demo-deliverable-3", name: "Catálogo navegable", status: "approved", weight: 2, visible_to_client: true }, { id: "demo-deliverable-4", name: "Toma de órdenes", status: "in_progress", weight: 3, estimated_delivery_date: "2026-09-12", visible_to_client: true }],
    project_approvals: [{ id: "demo-approval-2", title: "Definir política de precios por cliente", status: "pending", due_date: "2026-08-25", visible_to_client: true }],
    project_tasks: [], project_members: [{ id: "demo-member-3", profile_id: "demo-profile-1", project_role: "responsable" }],
  }],
  "demo-tenant-3": [{
    id: "demo-project-3", tenant_id: "demo-tenant-3", name: "Operación ROMEA", description: "Sistema interno de la joyería ROMEA.", status: "active", health: "green", current_phase_name: "Definición de alcance", start_date: "2026-08-01", estimated_end_date: "2026-11-15", internal_owner_name: "Arturo Romero", published: false,
    project_solutions: [{ id: "demo-solution-4", name: "Ventas", status: "planned", sort_order: 10, visible_to_client: true }],
    project_deliverables: [{ id: "demo-deliverable-5", name: "Documento de alcance", status: "pending", weight: 1, estimated_delivery_date: "2026-08-28", visible_to_client: true }],
    project_approvals: [], project_tasks: [], project_members: [{ id: "demo-member-4", profile_id: "demo-profile-1", project_role: "responsable" }],
  }],
  "demo-tenant-4": [],
};

const demoProfile = { id: "demo-profile-1", email: "arturo@ejemplo.nexor", role: "superadmin" };

export default function StudioDemoPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "[PRUEBAS] NEXOR Studio";
    return () => { document.title = previousTitle; };
  }, []);

  return <SuperAdminDashboard profile={demoProfile} demoData={{ tenants: demoTenants, profiles: demoProfiles, projectsByTenant: demoProjectsByTenant }} />;
}
