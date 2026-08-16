import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { fetchPublishedProject, respondToProjectApproval } from "../services/projectHubService";
import ProjectWorkboard from "./ProjectWorkboard";

const icon = (name) => {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    planning: <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 4v4M15 10v4M11 16v4" /></>,
    solutions: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><path d="M17 14v6M14 17h6" /></>,
    sidebar: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M14 8l-3 4 3 4" /></>,
    roadmap: <><path d="M5 4v16" /><circle cx="5" cy="7" r="2" /><circle cx="5" cy="17" r="2" /><path d="M9 7h10M9 17h10" /></>,
    updates: <><path d="M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14l-4-3-4 3-4-3-4 3Z" /><path d="M8 7h8M8 11h5" /></>,
    deliverables: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
    documents: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    approvals: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    download: <><path d="M12 3v12M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

const demoProjects = {
  "estuches-chavez": {
    name: "Digitalización de operaciones",
    description: "Diseño e implementación del sistema adaptado a la operación de Estuches Chávez.",
    progress: 28,
    health: "green",
    phase: "Diseño funcional",
    startDate: "2026-08-10",
    endDate: "2026-09-18",
    owner: "Equipo NEXOR IA",
    solutions: [
      {
        id: "inventory",
        name: "Inventario",
        description: "Control de productos, existencias, entradas, salidas y trazabilidad en una sola operación.",
        status: "in_progress",
        progress: 28,
        phase: "Diseño funcional",
        nextMilestone: "Aprobación del flujo de entradas y salidas",
        targetDate: "18 sep 2026",
        scope: ["Productos", "Existencias", "Entradas y salidas", "Trazabilidad"],
      },
    ],
    phases: [
      { name: "Definición de alcance", status: "completed", progress: 100, date: "10 ago" },
      { name: "Diseño funcional", status: "in_progress", progress: 55, date: "21 ago" },
      { name: "Desarrollo", status: "pending", progress: 0, date: "04 sep" },
      { name: "Pruebas y ajustes", status: "pending", progress: 0, date: "14 sep" },
      { name: "Entrega inicial", status: "pending", progress: 0, date: "18 sep" },
    ],
    week: [
      { label: "Mapa de movimientos de inventario", status: "completed" },
      { label: "Diseño de entradas y salidas", status: "in_progress" },
      { label: "Validación de catálogo inicial", status: "pending" },
    ],
    updates: [
      { title: "Alcance inicial definido", text: "Se organizó la solución en productos, existencias y movimientos para mantener una operación sencilla.", date: "12 ago 2026", type: "milestone" },
      { title: "Diseño funcional en proceso", text: "Estamos preparando el flujo de entradas y salidas que se presentará para revisión.", date: "13 ago 2026", type: "progress" },
      { title: "Preparación del ambiente de pruebas", text: "El desarrollo se validará en un ambiente separado antes de habilitarse en la operación real.", date: "13 ago 2026", type: "information" },
    ],
    deliverables: [
      { name: "Definición funcional", status: "in_progress", date: "21 ago 2026", description: "Flujos, reglas y alcance aprobado de la solución." },
      { name: "Primera versión de Inventario", status: "pending", date: "04 sep 2026", description: "Productos, existencias, entradas, salidas e historial." },
      { name: "Pruebas con usuarios", status: "pending", date: "14 sep 2026", description: "Validación guiada y registro de ajustes finales." },
      { name: "Entrega inicial", status: "pending", date: "18 sep 2026", description: "Versión aprobada y habilitada para Estuches Chávez." },
    ],
    documents: [
      { name: "Resumen de alcance", type: "scope", date: "12 ago 2026", status: "available" },
      { name: "Propuesta de implementación", type: "proposal", date: "12 ago 2026", status: "available" },
      { name: "Contrato", type: "contract", date: "—", status: "pending" },
    ],
    approvals: [
      { title: "Confirmar catálogo inicial", description: "Definir qué lista de productos se utilizará para cargar las existencias iniciales.", dueDate: "21 ago 2026", status: "pending" },
    ],
    objectives: [
      { id: "obj-alcance", title: "Cerrar alcance funcional", description: "Acordar reglas, catálogo inicial y movimientos que debe cubrir el inventario.", periodLabel: "10–21 agosto", periodStart: "2026-08-10", periodEnd: "2026-08-21", status: "active", progress: 68 },
      { id: "obj-mvp", title: "Construir el inventario MVP", description: "Entregar productos, existencias, entradas, salidas e historial en ambiente de pruebas.", periodLabel: "24 agosto–4 septiembre", periodStart: "2026-08-24", periodEnd: "2026-09-04", status: "planned", progress: 18 },
      { id: "obj-validacion", title: "Validar y preparar entrega", description: "Probar con usuarios, resolver ajustes y dejar lista la primera liberación.", periodLabel: "7–18 septiembre", periodStart: "2026-09-07", periodEnd: "2026-09-18", status: "planned", progress: 0 },
    ],
    tasks: [
      { id: "task-1", objectiveId: "obj-alcance", title: "Mapear movimientos de inventario", description: "Documentar entradas, salidas, ajustes y responsables.", status: "done", priority: "high", startDate: "2026-08-10", dueDate: "2026-08-12", progress: 100, assignee: "NEXOR IA", sortOrder: 10, comments: [], attachments: [] },
      { id: "task-2", objectiveId: "obj-alcance", title: "Diseñar entradas y salidas", description: "Prototipo del flujo operativo para revisión del cliente.", status: "in_progress", priority: "high", startDate: "2026-08-13", dueDate: "2026-08-18", progress: 65, assignee: "Diseño NEXOR", sortOrder: 20, comments: [{ id: "comment-demo", body: "El flujo inicial ya contempla ajuste por merma y devolución.", author: "Equipo NEXOR IA", createdAt: "2026-08-15" }], attachments: [] },
      { id: "task-3", objectiveId: "obj-alcance", title: "Validar catálogo inicial", description: "Confirmar campos, familias y archivo de carga inicial.", status: "review", priority: "critical", startDate: "2026-08-17", dueDate: "2026-08-21", progress: 55, assignee: "Estuches Chávez", sortOrder: 30, comments: [], attachments: [] },
      { id: "task-4", objectiveId: "obj-mvp", title: "Construir catálogo de productos", description: "Alta, edición, búsqueda y clasificación de productos.", status: "todo", priority: "high", startDate: "2026-08-24", dueDate: "2026-08-28", progress: 0, assignee: "Desarrollo NEXOR", sortOrder: 40, comments: [], attachments: [] },
      { id: "task-5", objectiveId: "obj-mvp", title: "Programar existencias y movimientos", description: "Cálculo de stock e historial auditable por producto.", status: "backlog", priority: "critical", startDate: "2026-08-27", dueDate: "2026-09-02", progress: 0, assignee: "Desarrollo NEXOR", sortOrder: 50, comments: [], attachments: [] },
      { id: "task-6", objectiveId: "obj-mvp", title: "Preparar ambiente de pruebas", description: "Instancia separada para revisión sin afectar la operación.", status: "in_progress", priority: "medium", startDate: "2026-08-24", dueDate: "2026-08-26", progress: 35, assignee: "NEXOR IA", sortOrder: 60, comments: [], attachments: [] },
      { id: "task-7", objectiveId: "obj-validacion", title: "Cargar inventario inicial", description: "Importar y conciliar las existencias proporcionadas.", status: "todo", priority: "high", startDate: "2026-09-07", dueDate: "2026-09-09", progress: 0, assignee: "NEXOR IA", sortOrder: 70, comments: [], attachments: [] },
      { id: "task-8", objectiveId: "obj-validacion", title: "Ejecutar pruebas con usuarios", description: "Sesión guiada y registro de hallazgos por prioridad.", status: "todo", priority: "high", startDate: "2026-09-10", dueDate: "2026-09-14", progress: 0, assignee: "Equipo conjunto", sortOrder: 80, comments: [], attachments: [] },
      { id: "task-9", objectiveId: "obj-validacion", title: "Resolver ajustes de aceptación", description: "Corregir hallazgos críticos antes de liberar.", status: "backlog", priority: "medium", startDate: "2026-09-15", dueDate: "2026-09-17", progress: 0, assignee: "Desarrollo NEXOR", sortOrder: 90, comments: [], attachments: [] },
      { id: "task-10", objectiveId: "obj-validacion", title: "Autorizar entrega inicial", description: "Confirmar la versión aprobada y fecha de activación.", status: "backlog", priority: "critical", startDate: "2026-09-18", dueDate: "2026-09-18", progress: 0, assignee: "Estuches Chávez", sortOrder: 100, comments: [], attachments: [] },
    ],
  },
  "vanguardia-joyera": {
    name: "Evolución del sistema comercial",
    description: "Consolidación del catálogo B2B, preórdenes y operación comercial de Vanguardia Joyera y Rapana Jewelers.",
    progress: 68,
    health: "green",
    phase: "Validación operativa",
    startDate: "2026-06-02",
    endDate: "2026-09-05",
    owner: "Equipo NEXOR IA",
  },
  romea: {
    name: "NEXOR IA para operación ROMEA",
    description: "Implementación modular de catálogo, operación comercial y administración para la empresa joyera ROMEA.",
    progress: 44,
    health: "yellow",
    phase: "Desarrollo modular",
    startDate: "2026-07-15",
    endDate: "2026-10-02",
    owner: "Equipo NEXOR IA",
  },
};

const defaultPhases = [
  { name: "Discovery", status: "completed", progress: 100, date: "Completado" },
  { name: "Diseño", status: "completed", progress: 100, date: "Completado" },
  { name: "Desarrollo", status: "in_progress", progress: 48, date: "En curso" },
  { name: "Pruebas", status: "pending", progress: 0, date: "Siguiente" },
  { name: "Implementación", status: "pending", progress: 0, date: "Programado" },
];

const genericWeek = [
  { label: "Revisión de flujos prioritarios", status: "completed" },
  { label: "Configuración de soluciones", status: "in_progress" },
  { label: "Preparación de pruebas", status: "pending" },
];

const genericUpdates = [
  { title: "Avance de configuración", text: "Se actualizaron los flujos principales y la configuración del entorno de trabajo.", date: "13 ago 2026", type: "progress" },
  { title: "Siguiente revisión preparada", text: "El próximo bloque funcional quedará disponible para una revisión guiada.", date: "12 ago 2026", type: "information" },
  { title: "Hito de diseño completado", text: "La estructura visual y de navegación fue aprobada para continuar con el desarrollo.", date: "08 ago 2026", type: "milestone" },
];

const genericDeliverables = [
  { name: "Diseño funcional", status: "delivered", date: "08 ago 2026", description: "Estructura de navegación y flujos principales." },
  { name: "Soluciones prioritarias", status: "in_progress", date: "05 sep 2026", description: "Primera versión operativa de las soluciones acordadas." },
  { name: "Pruebas y entrega", status: "pending", date: "Por confirmar", description: "Validación de usuarios y liberación controlada." },
];

const genericSolutions = [
  {
    id: "primary-solution",
    name: "Solución principal",
    description: "La solución funcional que se está desarrollando para este proyecto.",
    status: "in_progress",
    progress: 48,
    phase: "Desarrollo",
    nextMilestone: "Primera versión demostrable",
    targetDate: "Por confirmar",
    scope: ["Configuración", "Flujo principal", "Pruebas", "Implementación"],
  },
];

const genericDocuments = [
  { name: "Resumen ejecutivo", type: "scope", date: "08 ago 2026", status: "available" },
  { name: "Propuesta de implementación", type: "proposal", date: "08 ago 2026", status: "available" },
  { name: "Contrato", type: "contract", date: "—", status: "pending" },
];

const genericObjectives = [
  { id: "generic-discovery", title: "Definir y aprobar alcance", description: "Alinear los flujos, reglas y prioridades de la primera entrega.", periodLabel: "Periodo 1", periodStart: "2026-08-10", periodEnd: "2026-08-21", status: "completed", progress: 100 },
  { id: "generic-build", title: "Construir soluciones prioritarias", description: "Desarrollar y demostrar el bloque funcional acordado.", periodLabel: "Periodo 2", periodStart: "2026-08-24", periodEnd: "2026-09-11", status: "active", progress: 48 },
  { id: "generic-release", title: "Validar y liberar", description: "Completar pruebas, ajustes y entrega controlada.", periodLabel: "Periodo 3", periodStart: "2026-09-14", periodEnd: "2026-10-02", status: "planned", progress: 0 },
];

const genericTasks = [
  { id: "generic-task-1", objectiveId: "generic-discovery", title: "Confirmar alcance funcional", description: "Revisar reglas y prioridades de implementación.", status: "done", priority: "high", startDate: "2026-08-10", dueDate: "2026-08-14", progress: 100, assignee: "Equipo conjunto", sortOrder: 10, comments: [], attachments: [] },
  { id: "generic-task-2", objectiveId: "generic-build", title: "Desarrollar flujo principal", description: "Construir el primer bloque funcional demostrable.", status: "in_progress", priority: "high", startDate: "2026-08-24", dueDate: "2026-09-04", progress: 62, assignee: "NEXOR IA", sortOrder: 20, comments: [], attachments: [] },
  { id: "generic-task-3", objectiveId: "generic-build", title: "Revisión interna de calidad", description: "Validar reglas, permisos y comportamiento de la solución.", status: "review", priority: "medium", startDate: "2026-09-03", dueDate: "2026-09-11", progress: 35, assignee: "NEXOR IA", sortOrder: 30, comments: [], attachments: [] },
  { id: "generic-task-4", objectiveId: "generic-release", title: "Pruebas con usuarios", description: "Ejecutar escenarios reales y registrar ajustes.", status: "todo", priority: "high", startDate: "2026-09-14", dueDate: "2026-09-23", progress: 0, assignee: "Equipo conjunto", sortOrder: 40, comments: [], attachments: [] },
  { id: "generic-task-5", objectiveId: "generic-release", title: "Preparar liberación", description: "Cerrar pendientes y autorizar la versión inicial.", status: "backlog", priority: "critical", startDate: "2026-09-24", dueDate: "2026-10-02", progress: 0, assignee: "NEXOR IA", sortOrder: 50, comments: [], attachments: [] },
];

const normalizeSlug = (value) => String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const daysUntil = (dateString) => {
  if (!dateString) return null;
  const end = new Date(`${dateString}T12:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.max(0, Math.ceil((end - today) / 86400000));
};

const statusLabel = (status, t) => ({
  completed: t("phCompleted"),
  in_progress: t("phInProgress"),
  pending: t("phPending"),
  delivered: t("phDelivered"),
  approved: t("phApproved"),
}[status] || status);

const formatPortalDate = (date) => date ? new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${String(date).slice(0, 10)}T12:00:00`)) : "—";

const projectFromDatabase = (record) => {
  if (!record) return null;
  const phases = record.project_phases || [];
  const activeIndex = Math.max(0, phases.findIndex((item) => item.status === "in_progress"));
  const weekStart = Math.max(0, activeIndex - 1);
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    progress: record.progress_percentage,
    health: record.health,
    phase: record.current_phase_name || phases.find((item) => item.status === "in_progress")?.name || "Por iniciar",
    startDate: record.start_date,
    endDate: record.estimated_end_date,
    owner: record.internal_owner_name,
    status: record.status,
    phases: phases.map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      progress: item.progress_percentage,
      date: formatPortalDate(item.estimated_end_date),
    })),
    week: phases.slice(weekStart, weekStart + 3).map((item) => ({ label: item.name, status: item.status })),
    updates: (record.project_updates || []).filter((item) => item.visible_to_client !== false).map((item) => ({
      id: item.id,
      title: item.title,
      text: item.description,
      date: formatPortalDate(item.created_at),
      type: item.update_type,
    })),
    deliverables: (record.project_deliverables || []).filter((item) => item.visible_to_client !== false).map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      date: formatPortalDate(item.estimated_delivery_date),
      description: item.description,
      externalUrl: item.external_url,
    })),
    documents: (record.project_documents || []).filter((item) => item.visible_to_client !== false).map((item) => ({
      id: item.id,
      name: item.name,
      type: item.document_type,
      date: formatPortalDate(item.created_at),
      status: item.external_url ? "available" : "pending",
      externalUrl: item.external_url,
    })),
    approvals: (record.project_approvals || []).filter((item) => item.visible_to_client !== false).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      dueDate: formatPortalDate(item.due_date),
      status: item.status,
      clientComment: item.client_comment,
    })),
    solutions: (record.project_solutions || []).filter((item) => item.visible_to_client !== false).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      status: item.status,
      progress: Number(item.progress_percentage || 0),
      phase: item.current_phase_name,
      nextMilestone: item.next_milestone,
      targetDate: formatPortalDate(item.estimated_end_date),
      scope: item.scope_items || [],
    })),
    objectives: (record.project_objectives || []).filter((item) => item.visible_to_client !== false).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      periodLabel: item.period_label,
      periodStart: item.period_start,
      periodEnd: item.period_end,
      status: item.status,
      progress: Number(item.progress_percentage || 0),
      sortOrder: Number(item.sort_order || 0),
    })),
    tasks: (record.project_tasks || []).filter((item) => item.visible_to_client !== false).map((item) => ({
      id: item.id,
      objectiveId: item.objective_id,
      phaseId: item.phase_id,
      title: item.title,
      description: item.description,
      status: item.status,
      priority: item.priority,
      startDate: item.start_date,
      dueDate: item.due_date,
      progress: Number(item.progress_percentage || 0),
      assignee: item.assignee_name,
      sortOrder: Number(item.sort_order || 0),
      comments: (item.project_task_comments || []).filter((comment) => comment.visible_to_client !== false).map((comment) => ({ id: comment.id, body: comment.body, createdAt: comment.created_at, author: "Equipo del proyecto" })),
      attachments: (item.project_task_attachments || []).filter((attachment) => attachment.visible_to_client !== false).map((attachment) => ({ id: attachment.id, fileName: attachment.file_name, storagePath: attachment.storage_path, mimeType: attachment.mime_type, fileSize: attachment.file_size, createdAt: attachment.created_at })),
    })),
  };
};

export default function ProjectHub({ tenantId = "", tenantSlug = "", companyName = "", theme = "light" }) {
  const { t } = useLanguage();
  const portalTheme = theme === "dark" ? "dark" : "light";
  const [section, setSection] = useState("planning");
  const [selectedSolutionId, setSelectedSolutionId] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [previewNotice, setPreviewNotice] = useState("");
  const [databaseProject, setDatabaseProject] = useState(null);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [loadError, setLoadError] = useState("");
  const [approvalComments, setApprovalComments] = useState({});
  const [respondingApprovalId, setRespondingApprovalId] = useState("");

  const loadProject = async () => {
    if (!tenantId) return;
    setLoading(true);
    setLoadError("");
    try {
      setDatabaseProject(await fetchPublishedProject(tenantId));
    } catch (error) {
      setLoadError(error.message || t("phLoadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProject(); }, [tenantId]);

  const demoProject = useMemo(() => {
    const slug = normalizeSlug(tenantSlug || companyName);
    const matchedKey = Object.keys(demoProjects).find((key) => slug.includes(key)) || "romea";
    const base = demoProjects[matchedKey];
    return {
      ...base,
      phases: base.phases || defaultPhases,
      week: base.week || genericWeek,
      updates: base.updates || genericUpdates,
      deliverables: base.deliverables || genericDeliverables,
      documents: base.documents || genericDocuments,
      approvals: base.approvals || [],
      solutions: base.solutions || genericSolutions,
      objectives: base.objectives || genericObjectives,
      tasks: base.tasks || genericTasks,
    };
  }, [tenantSlug, companyName]);

  const project = tenantId ? projectFromDatabase(databaseProject) : demoProject;

  if (loading) {
    return <section className={`project-hub project-hub--${portalTheme}`}><div className="project-hub-state"><span className="loading-spinner" /><strong>{t("phLoading")}</strong></div></section>;
  }

  if (loadError) {
    return <section className={`project-hub project-hub--${portalTheme}`}><div className="project-hub-state project-hub-state--error"><strong>{t("phLoadError")}</strong><p>{loadError}</p><button className="secondary-button" type="button" onClick={loadProject}>{t("phRetry")}</button></div></section>;
  }

  if (!project) {
    return <section className={`project-hub project-hub--${portalTheme}`}><div className="project-hub-state"><div className="project-empty project-empty--page"><i>{icon("roadmap")}</i><strong>{t("phNoPublishedProject")}</strong><p>{t("phNoPublishedProjectHelp")}</p></div></div></section>;
  }

  const nav = ["planning", "solutions", "deliverables", "documents", "approvals"];
  const remaining = daysUntil(project.endDate);
  const pendingApprovals = project.approvals.filter((item) => item.status === "pending").length;
  const healthLabel = project.health === "green" ? t("phOnTrack") : project.health === "yellow" ? t("phAttention") : t("phAtRisk");
  const selectedSolution = project.solutions?.find((item) => item.id === selectedSolutionId) || project.solutions?.[0] || null;

  const showPreviewNotice = (message) => {
    setPreviewNotice(message);
    window.setTimeout(() => setPreviewNotice(""), 3200);
  };

  const respondApproval = async (approval, status) => {
    if (!approval.id || !tenantId || respondingApprovalId) {
      showPreviewNotice(t("phResponseDemo"));
      return;
    }
    setRespondingApprovalId(approval.id);
    try {
      await respondToProjectApproval(approval.id, status, approvalComments[approval.id] || "");
      showPreviewNotice(status === "approved" ? t("phApprovalSaved") : t("phRejectionSaved"));
      await loadProject();
    } catch (error) {
      showPreviewNotice(error.message || t("phResponseError"));
    } finally {
      setRespondingApprovalId("");
    }
  };

  return (
    <section className={`project-hub project-hub--${portalTheme}${sidebarCollapsed ? " project-hub--sidebar-collapsed" : ""}`} aria-label={t("projectHub")}>
      <aside className="project-hub__sidebar">
        <div className="project-hub__sidebar-head">
          <div><strong>Proyecto</strong></div>
          <button type="button" aria-label={sidebarCollapsed ? "Abrir navegación" : "Contraer navegación"} title={sidebarCollapsed ? "Abrir navegación" : "Contraer navegación"} onClick={() => setSidebarCollapsed((current) => !current)}>{icon("sidebar")}</button>
        </div>
        <nav className="project-hub__nav" aria-label={t("phSections")}>
          {nav.map((item) => (
            <button key={item} type="button" aria-label={t(`phNav${item.charAt(0).toUpperCase()}${item.slice(1)}`)} title={sidebarCollapsed ? t(`phNav${item.charAt(0).toUpperCase()}${item.slice(1)}`) : undefined} className={section === item ? "active" : ""} onClick={() => setSection(item)}>
              {icon(item)}
              <span className="project-hub__nav-label">{t(`phNav${item.charAt(0).toUpperCase()}${item.slice(1)}`)}</span>
              {item === "approvals" && pendingApprovals ? <span className="project-hub__nav-count">{pendingApprovals}</span> : null}
            </button>
          ))}
        </nav>
        <footer><i /><span>Portal seguro</span></footer>
      </aside>
      <main className="project-hub__workspace">
      {!tenantId ? <div className="project-hub__preview" role="status">
        <span>{t("phPreviewLabel")}</span>
        <p>{t("phPreviewMessage")}</p>
      </div> : null}

      <header className="project-hub__header">
        <div className="project-hub__heading">
          <p className="project-hub__eyebrow">Proyecto · {companyName || t("phYourCompany")}</p>
          <div className="project-hub__title-row">
            <h1>{project.name}</h1>
            <span className="project-hub__active-badge">{t("phActive")}</span>
          </div>
          <p>{project.description}</p>
        </div>
        <button className="secondary-button project-hub__contract" type="button" onClick={() => {
          const contract = project.documents.find((item) => item.type === "contract" && item.externalUrl);
          if (contract) window.open(contract.externalUrl, "_blank", "noopener,noreferrer");
          else showPreviewNotice(t("phContractUnavailable"));
        }}>
          {icon("documents")}
          {t("phViewContract")}
        </button>
      </header>

      {previewNotice ? <div className="project-hub__toast" role="status">{previewNotice}</div> : null}

      {section === "planning" ? <ProjectWorkboard project={project} tenantId={tenantId} onReload={loadProject} onNotice={showPreviewNotice} /> : null}

      {section === "solutions" ? (
        <section className="project-section-page project-solutions-page">
          <header><h2>Soluciones</h2><span>Las partes del sistema que estamos construyendo para este proyecto.</span></header>
          {project.solutions?.length ? <div className="project-solutions">
            <div className="project-solutions__list" aria-label="Soluciones del proyecto">
              {project.solutions.map((solution) => (
                <button key={solution.id} type="button" className={selectedSolution?.id === solution.id ? "active" : ""} onClick={() => setSelectedSolutionId(solution.id)}>
                  <span className="project-solutions__glyph">{icon("solutions")}</span>
                  <span><strong>{solution.name}</strong><small>{solution.phase || "Por iniciar"}</small></span>
                  <b>{solution.progress}%</b>
                  {icon("arrow")}
                </button>
              ))}
            </div>
            {selectedSolution ? <article className="project-solution-detail">
              <div className="project-solution-detail__top">
                <span className={`project-status project-status--${selectedSolution.status}`}>{statusLabel(selectedSolution.status, t)}</span>
                <strong>{selectedSolution.progress}%</strong>
              </div>
              <h3>{selectedSolution.name}</h3>
              <p>{selectedSolution.description}</p>
              <div className="project-progress" aria-label={`Avance de ${selectedSolution.name}: ${selectedSolution.progress}%`}><i style={{ width: `${selectedSolution.progress}%` }} /></div>
              <dl>
                <div><dt>Ahora</dt><dd>{selectedSolution.phase || "Por iniciar"}</dd></div>
                <div><dt>Siguiente hito</dt><dd>{selectedSolution.nextMilestone || "Por definir"}</dd></div>
                <div><dt>Fecha objetivo</dt><dd>{selectedSolution.targetDate || "Por confirmar"}</dd></div>
              </dl>
              {selectedSolution.scope?.length ? <div className="project-solution-detail__scope"><span>Incluye</span><div>{selectedSolution.scope.map((item) => <i key={item}>{item}</i>)}</div></div> : null}
            </article> : null}
          </div> : <div className="project-empty project-empty--page"><i>{icon("solutions")}</i><strong>Aún no hay soluciones publicadas</strong><p>Cuando una solución sea definida aparecerá aquí.</p></div>}
        </section>
      ) : null}

      {section === "overview" ? (
        <div className="project-hub__overview">
          <div className="project-hub__metrics">
            <article className="project-hub__metric project-hub__metric--progress">
              <span>{t("phOverallProgress")}</span>
              <strong>{project.progress}%</strong>
              <div className="project-progress" aria-label={t("phProgressAria", project.progress)}><i style={{ width: `${project.progress}%` }} /></div>
              <small>{t("phUpdatedToday")}</small>
            </article>
            <article className="project-hub__metric">
              <span>{t("phCurrentPhase")}</span>
              <strong className="project-hub__metric-text">{project.phase}</strong>
              <small>{t("phWorkInProgress")}</small>
            </article>
            <article className="project-hub__metric">
              <span>{t("phRemainingDays")}</span>
              <strong>{remaining ?? "—"}</strong>
              <small>{t("phEstimatedDelivery")} · {project.endDate}</small>
            </article>
            <article className={`project-hub__metric${pendingApprovals ? " project-hub__metric--attention" : ""}`}>
              <span>{t("phClientPending")}</span>
              <strong>{pendingApprovals}</strong>
              <small>{pendingApprovals ? t("phNeedsReview") : t("phNothingPending")}</small>
            </article>
          </div>

          <section className={`project-health project-health--${project.health}`}>
            <div className="project-health__status"><i /><span>{t("phProjectHealth")}</span><strong>{healthLabel}</strong></div>
            <div className="project-health__dates">
              <span>{icon("calendar")}{t("phStarted")} <strong>{project.startDate}</strong></span>
              <span>{t("phOwner")} <strong>{project.owner}</strong></span>
            </div>
          </section>

          <div className="project-hub__main-grid">
            <article className="project-panel project-roadmap-preview">
              <header><div><span>{t("phRoadmap")}</span><h2>{t("phProjectStages")}</h2></div><button type="button" onClick={() => setSection("roadmap")}>{t("phViewDetail")}{icon("arrow")}</button></header>
              <div className="project-roadmap-preview__track">
                {project.phases.map((phase, index) => (
                  <div className={`project-roadmap-preview__step project-roadmap-preview__step--${phase.status}`} key={phase.name}>
                    <div className="project-roadmap-preview__marker">{phase.status === "completed" ? icon("check") : index + 1}</div>
                    <strong>{phase.name}</strong>
                    <span>{statusLabel(phase.status, t)}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="project-panel project-week">
              <header><div><span>{t("phThisWeek")}</span><h2>{t("phCurrentWork")}</h2></div></header>
              <ul>
                {project.week.map((item) => <li key={item.label} className={`project-week__item project-week__item--${item.status}`}><i>{item.status === "completed" ? icon("check") : ""}</i><span>{item.label}</span><small>{statusLabel(item.status, t)}</small></li>)}
              </ul>
            </article>
          </div>

          <div className="project-hub__lower-grid">
            <article className="project-panel project-updates-preview">
              <header><div><span>{t("phLatestUpdates")}</span><h2>{t("phWhatHasChanged")}</h2></div><button type="button" onClick={() => setSection("updates")}>{t("phSeeAll")}{icon("arrow")}</button></header>
              <div className="project-update-list">
                {project.updates.slice(0, 3).map((update) => <div className={`project-update project-update--${update.type}`} key={update.title}><i /><div><strong>{update.title}</strong><p>{update.text}</p><small>{update.date}</small></div></div>)}
              </div>
            </article>

            <article className={`project-panel project-needs${pendingApprovals ? " project-needs--pending" : ""}`}>
              <header><div><span>{t("phWeNeedFromYou")}</span><h2>{pendingApprovals ? t("phPendingReview") : t("phAllClear")}</h2></div></header>
              {pendingApprovals ? project.approvals.filter((item) => item.status === "pending").slice(0, 2).map((approval) => (
                <div className="project-approval-preview" key={approval.title}><strong>{approval.title}</strong><p>{approval.description}</p><small>{t("phDueDate")} · {approval.dueDate}</small><button className="primary-button" type="button" onClick={() => setSection("approvals")}>{t("phReviewRequest")}</button></div>
              )) : <div className="project-empty"><i>{icon("check")}</i><strong>{t("phNothingNeeded")}</strong><p>{t("phNothingNeededHelp")}</p></div>}
            </article>
          </div>
        </div>
      ) : null}

      {section === "roadmap" ? (
        <section className="project-section-page">
          <header><p>{t("phRoadmap")}</p><h2>{t("phProjectStages")}</h2><span>{t("phRoadmapHelp")}</span></header>
          <div className="project-roadmap-full">
            {project.phases.map((phase, index) => (
              <article key={phase.name} className={`project-phase-card project-phase-card--${phase.status}`}>
                <div className="project-phase-card__number">{phase.status === "completed" ? icon("check") : index + 1}</div>
                <div><span>{t("phPhase", index + 1)}</span><h3>{phase.name}</h3><p>{statusLabel(phase.status, t)} · {phase.date}</p></div>
                <div className="project-phase-card__progress"><span>{phase.progress}%</span><div className="project-progress"><i style={{ width: `${phase.progress}%` }} /></div></div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {section === "updates" ? (
        <section className="project-section-page">
          <header><p>{t("phUpdates")}</p><h2>{t("phProgressHistory")}</h2><span>{t("phUpdatesHelp")}</span></header>
          <div className="project-timeline">
            {project.updates.map((update) => <article className={`project-timeline__item project-timeline__item--${update.type}`} key={update.title}><i /><div><small>{update.date}</small><h3>{update.title}</h3><p>{update.text}</p></div></article>)}
          </div>
        </section>
      ) : null}

      {section === "deliverables" ? (
        <section className="project-section-page">
          <header><p>{t("phDeliverables")}</p><h2>{t("phMainDeliverables")}</h2><span>{t("phDeliverablesHelp")}</span></header>
          <div className="project-deliverable-grid">
            {project.deliverables.map((item) => <article className="project-deliverable" key={item.name}><div className={`project-deliverable__icon project-deliverable__icon--${item.status}`}>{icon(item.status === "delivered" || item.status === "approved" ? "check" : "deliverables")}</div><div><span className={`project-status project-status--${item.status}`}>{statusLabel(item.status, t)}</span><h3>{item.name}</h3><p>{item.description}</p><small>{t("phEstimatedDate")} · {item.date}</small></div></article>)}
          </div>
        </section>
      ) : null}

      {section === "documents" ? (
        <section className="project-section-page">
          <header><p>{t("phDocuments")}</p><h2>{t("phProjectDocuments")}</h2><span>{t("phDocumentsHelp")}</span></header>
          <div className="project-document-list">
            {project.documents.map((document) => <article className="project-document" key={document.name}><div className="project-document__icon">{icon("documents")}</div><div><span>{t(`phDocument${document.type.charAt(0).toUpperCase()}${document.type.slice(1)}`)}</span><h3>{document.name}</h3><small>{document.status === "available" ? document.date : t("phNotAvailableYet")}</small></div><button className="secondary-button" type="button" disabled={document.status !== "available"} onClick={() => document.externalUrl ? window.open(document.externalUrl, "_blank", "noopener,noreferrer") : showPreviewNotice(t("phDemoDocument"))}>{icon("download")}{document.status === "available" ? t("phOpen") : t("phPending")}</button></article>)}
          </div>
        </section>
      ) : null}

      {section === "approvals" ? (
        <section className="project-section-page">
          <header><p>{t("phApprovals")}</p><h2>{t("phYourPendingItems")}</h2><span>{t("phApprovalsHelp")}</span></header>
          {project.approvals.length ? <div className="project-approval-list">{project.approvals.map((approval) => <article className="project-approval" key={approval.title}><div><span className={`project-status project-status--${approval.status}`}>{statusLabel(approval.status, t)}</span><h3>{approval.title}</h3><p>{approval.description}</p><small>{t("phDueDate")} · {approval.dueDate}</small>{approval.clientComment ? <p className="project-approval__comment">{approval.clientComment}</p> : null}</div>{approval.status === "pending" ? <div className="project-approval__response"><textarea value={approvalComments[approval.id] || ""} onChange={(event) => setApprovalComments((current) => ({ ...current, [approval.id]: event.target.value }))} placeholder={t("phCommentPlaceholder")} maxLength={2000} /><div className="project-approval__actions"><button className="secondary-button" type="button" disabled={respondingApprovalId === approval.id} onClick={() => respondApproval(approval, "rejected")}>{t("phReject")}</button><button className="primary-button" type="button" disabled={respondingApprovalId === approval.id} onClick={() => respondApproval(approval, "approved")}>{respondingApprovalId === approval.id ? t("phSaving") : t("phApprove")}</button></div></div> : null}</article>)}</div> : <div className="project-empty project-empty--page"><i>{icon("check")}</i><strong>{t("phNothingPending")}</strong><p>{t("phNothingNeededHelp")}</p></div>}
        </section>
      ) : null}
      </main>
    </section>
  );
}
