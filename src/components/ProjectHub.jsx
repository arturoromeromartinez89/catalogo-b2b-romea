import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { fetchPublishedProject, respondToProjectApproval } from "../services/projectHubService";

const icon = (name) => {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
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
    name: "Módulo de inventario",
    description: "Control centralizado de existencias, entradas, salidas y trazabilidad de productos.",
    progress: 28,
    health: "green",
    phase: "Diseño funcional",
    startDate: "2026-08-10",
    endDate: "2026-09-18",
    owner: "Equipo NEXOR IA",
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
      { title: "Alcance inicial definido", text: "Se organizó el módulo en productos, existencias y movimientos para mantener una operación sencilla.", date: "12 ago 2026", type: "milestone" },
      { title: "Diseño funcional en proceso", text: "Estamos preparando el flujo de entradas y salidas que se presentará para revisión.", date: "13 ago 2026", type: "progress" },
      { title: "Preparación del ambiente de pruebas", text: "El desarrollo se validará en un ambiente separado antes de habilitarse en la operación real.", date: "13 ago 2026", type: "information" },
    ],
    deliverables: [
      { name: "Definición funcional", status: "in_progress", date: "21 ago 2026", description: "Flujos, reglas y alcance aprobado del módulo." },
      { name: "Módulo de inventario MVP", status: "pending", date: "04 sep 2026", description: "Productos, existencias, entradas, salidas e historial." },
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
  { label: "Configuración de módulos", status: "in_progress" },
  { label: "Preparación de pruebas", status: "pending" },
];

const genericUpdates = [
  { title: "Avance de configuración", text: "Se actualizaron los flujos principales y la configuración del entorno de trabajo.", date: "13 ago 2026", type: "progress" },
  { title: "Siguiente revisión preparada", text: "El próximo bloque funcional quedará disponible para una revisión guiada.", date: "12 ago 2026", type: "information" },
  { title: "Hito de diseño completado", text: "La estructura visual y de navegación fue aprobada para continuar con el desarrollo.", date: "08 ago 2026", type: "milestone" },
];

const genericDeliverables = [
  { name: "Diseño funcional", status: "delivered", date: "08 ago 2026", description: "Estructura de navegación y flujos principales." },
  { name: "Módulos prioritarios", status: "in_progress", date: "05 sep 2026", description: "Primera versión operativa de los módulos acordados." },
  { name: "Pruebas y entrega", status: "pending", date: "Por confirmar", description: "Validación de usuarios y liberación controlada." },
];

const genericDocuments = [
  { name: "Resumen ejecutivo", type: "scope", date: "08 ago 2026", status: "available" },
  { name: "Propuesta de implementación", type: "proposal", date: "08 ago 2026", status: "available" },
  { name: "Contrato", type: "contract", date: "—", status: "pending" },
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
  };
};

export default function ProjectHub({ tenantId = "", tenantSlug = "", companyName = "", theme = "light" }) {
  const { t } = useLanguage();
  const portalTheme = theme === "dark" ? "dark" : "light";
  const [section, setSection] = useState("overview");
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

  const nav = ["overview", "roadmap", "updates", "deliverables", "documents", "approvals"];
  const remaining = daysUntil(project.endDate);
  const pendingApprovals = project.approvals.filter((item) => item.status === "pending").length;
  const healthLabel = project.health === "green" ? t("phOnTrack") : project.health === "yellow" ? t("phAttention") : t("phAtRisk");

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
    <section className={`project-hub project-hub--${portalTheme}`} aria-label={t("projectHub")}>
      {!tenantId ? <div className="project-hub__preview" role="status">
        <span>{t("phPreviewLabel")}</span>
        <p>{t("phPreviewMessage")}</p>
      </div> : null}

      <header className="project-hub__header">
        <div className="project-hub__heading">
          <p className="project-hub__eyebrow">{t("projectHub")} · {companyName || t("phYourCompany")}</p>
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

      <nav className="project-hub__nav" aria-label={t("phSections")}>
        {nav.map((item) => (
          <button key={item} type="button" className={section === item ? "active" : ""} onClick={() => setSection(item)}>
            {icon(item)}
            {t(`phNav${item.charAt(0).toUpperCase()}${item.slice(1)}`)}
            {item === "approvals" && pendingApprovals ? <span>{pendingApprovals}</span> : null}
          </button>
        ))}
      </nav>

      {previewNotice ? <div className="project-hub__toast" role="status">{previewNotice}</div> : null}

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
    </section>
  );
}
