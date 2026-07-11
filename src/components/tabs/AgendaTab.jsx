import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { supabase } from "../../lib/supabaseClient";
import {
  addDays,
  createAgendaObjective,
  createAgendaTask,
  deleteAgendaObjective,
  deleteAgendaTask,
  fetchAgendaObjectives,
  fetchAgendaTasks,
  fetchClientFollowup,
  isoWeekKey,
  monthKey,
  setAgendaTaskStatus,
  toDateKey,
  weekStart,
} from "../../services/agendaService";

/**
 * AgendaTab — Agenda comercial del tenant (tablero Lun-Sáb).
 *
 * Diseño: banda de highlights compacta (KPIs + acciones) arriba, tablero
 * semanal como elemento dominante con columnas de altura estable y scroll
 * interno, y panel lateral con objetivos y seguimiento por cliente.
 *
 * Rollover sin cron: las tareas pendientes con fecha anterior a hoy se
 * muestran en la columna de hoy con un badge "arrastrada desde {fecha}".
 * La fecha original nunca se muta.
 *
 * Adjuntos: por ahora viven solo en memoria de la sesión (no persisten);
 * la UI lo indica. Persistencia via Storage queda para una fase posterior.
 */

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const Icon = ({ name, size = 14 }) => {
  const paths = {
    chevronLeft: <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
    chevronRight: <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
    paperclip: <path d="M21 12.5l-8.3 8.3a5.5 5.5 0 01-7.8-7.8l8.6-8.6a3.7 3.7 0 015.2 5.2l-8.6 8.6a1.8 1.8 0 01-2.6-2.6l7.9-7.9" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />,
    trash: <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m3 0l-.8 12a2 2 0 01-2 1.9H8.8a2 2 0 01-2-1.9L6 7m4 4v6m4-6v6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />,
    plus: <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />,
    grid: <path d="M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
    rows: <path d="M4 5h16v4H4zM4 11h16v4H4zM4 17h16v2H4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
    whatsapp: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" fill="currentColor" />,
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      {paths[name] || null}
    </svg>
  );
};

const formatShortDate = (dateKey, language = "es") => {
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString(language === "en" ? "en-US" : "es-MX", { day: "numeric", month: "short" });
};

const clientLabel = (clients, clientId) => {
  const client = clients.find((item) => item.id === clientId);
  return client ? (client.company || client.name) : "";
};

const formatFileSize = (size = 0) => {
  if (!size) return "0 KB";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export default function AgendaTab({ tenantId = "", profile = {}, clients = [] }) {
  const { t, language } = useLanguage();
  const canManageObjectives = ["superadmin", "tenant_admin", "admin"].includes(profile?.role);

  const [weekOffset, setWeekOffset] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [followup, setFollowup] = useState([]);
  const [filterClientId, setFilterClientId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [taskAttachments, setTaskAttachments] = useState({});
  const [viewMode, setViewMode] = useState("compact");

  const todayKey = toDateKey(new Date());
  const [form, setForm] = useState({
    title: "",
    task_date: todayKey,
    category: "comercial",
    client_id: "",
    objective_id: "",
  });
  const [objectiveForm, setObjectiveForm] = useState({ period_type: "month", title: "" });

  const monday = useMemo(() => addDays(weekStart(new Date()), weekOffset * 7), [weekOffset]);
  const days = useMemo(
    () => Array.from({ length: 6 }, (_, index) => toDateKey(addDays(monday, index))),
    [monday]
  );
  const fromKey = days[0];
  const toKey = days[days.length - 1];
  const currentMonthKey = monthKey(new Date());
  const currentWeekKey = isoWeekKey(new Date());

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [taskRows, objectiveRows, followupRows] = await Promise.all([
        fetchAgendaTasks(tenantId, { from: fromKey, to: toKey }),
        fetchAgendaObjectives(tenantId, [currentMonthKey, currentWeekKey]),
        fetchClientFollowup(tenantId).catch(() => []),
      ]);
      setTasks(taskRows);
      setObjectives(objectiveRows);
      setFollowup(followupRows);
    } catch (error) {
      setStatus(`Error al cargar la agenda: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId, fromKey, toKey]);

  const visibleTasks = useMemo(
    () => (filterClientId ? tasks.filter((task) => task.client_id === filterClientId) : tasks),
    [tasks, filterClientId]
  );

  // Rollover por consulta: pendientes vencidas caen en la columna de hoy
  // (solo cuando hoy está dentro de la semana visible).
  const tasksForDay = (dayKey) => visibleTasks.filter((task) => {
    const overdue = task.status === "pending" && task.task_date < todayKey;
    if (dayKey === todayKey) return task.task_date === dayKey || overdue;
    if (overdue) return false;
    return task.task_date === dayKey;
  });

  const overdueOutsideWeek = useMemo(
    () => (days.includes(todayKey) ? [] : visibleTasks.filter(
      (task) => task.status === "pending" && task.task_date < fromKey
    )),
    [visibleTasks, days, todayKey, fromKey]
  );

  // KPIs de la banda superior. Presupuestos: visuales, fuente pendiente.
  const kpis = useMemo(() => {
    const pendingToday = tasks.filter(
      (task) => task.status === "pending" && task.task_date <= todayKey
    ).length;
    const doneWeek = tasks.filter(
      (task) => task.status === "done" && task.task_date >= fromKey && task.task_date <= toKey
    ).length;
    return { pendingToday, doneWeek };
  }, [tasks, todayKey, fromKey, toKey]);

  const handleAddTask = async (event) => {
    event.preventDefault();
    setStatus("");
    try {
      await createAgendaTask(tenantId, form, profile?.id);
      setForm((current) => ({ ...current, title: "", client_id: "", objective_id: "" }));
      await load();
      setStatus(t("agTaskCreated"));
    } catch (error) {
      setStatus(`${t("agTaskError")}: ${error.message}`);
    }
  };

  const handleToggleTask = async (task) => {
    const next = task.status === "done" ? "pending" : "done";
    try {
      const updated = await setAgendaTaskStatus(task.id, next);
      setTasks((current) => current.map((item) => (item.id === task.id ? updated : item)));
      fetchClientFollowup(tenantId).then(setFollowup).catch(() => {});
    } catch (error) {
      setStatus(`${t("agTaskError")}: ${error.message}`);
    }
  };

  const handleDeleteTask = async (task) => {
    try {
      await deleteAgendaTask(task.id);
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setTaskAttachments((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
      fetchClientFollowup(tenantId).then(setFollowup).catch(() => {});
    } catch (error) {
      setStatus(`${t("agTaskError")}: ${error.message}`);
    }
  };

  const handleTaskFiles = (taskId, fileList) => {
    const files = Array.from(fileList || []).map((file) => ({
      id: `${Date.now()}-${file.name}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      size: file.size,
    }));
    if (!files.length) return;
    setTaskAttachments((current) => ({
      ...current,
      [taskId]: [...(current[taskId] || []), ...files],
    }));
  };

  const handleRemoveAttachment = (taskId, attachmentId) => {
    setTaskAttachments((current) => ({
      ...current,
      [taskId]: (current[taskId] || []).filter((file) => file.id !== attachmentId),
    }));
  };

  const handleAddObjective = async (event) => {
    event.preventDefault();
    setStatus("");
    try {
      await createAgendaObjective(tenantId, {
        ...objectiveForm,
        period_key: objectiveForm.period_type === "week" ? currentWeekKey : currentMonthKey,
      }, profile?.id);
      setObjectiveForm((current) => ({ ...current, title: "" }));
      await load();
    } catch (error) {
      setStatus(`${t("agObjectiveError")}: ${error.message}`);
    }
  };

  const objectiveProgress = (objectiveId) => {
    const linked = tasks.filter((task) => task.objective_id === objectiveId && task.status !== "cancelled");
    if (!linked.length) return null;
    const done = linked.filter((task) => task.status === "done").length;
    return { done, total: linked.length, pct: Math.round((done / linked.length) * 100) };
  };

  // ── Reporte WhatsApp ──
  const [reportScope, setReportScope] = useState("today");
  const [reportPhone, setReportPhone] = useState("");
  const [reportText, setReportText] = useState("");

  const buildReport = async () => {
    let scopeTasks = [];
    let label = "";
    if (reportScope === "today") {
      scopeTasks = tasks.filter((task) =>
        task.task_date === todayKey || (task.status === "pending" && task.task_date < todayKey));
      label = `${t("agReportToday")} ${formatShortDate(todayKey, language)}`;
    } else if (reportScope === "week") {
      scopeTasks = tasks;
      label = `${t("agReportWeek")} ${formatShortDate(fromKey, language)} – ${formatShortDate(toKey, language)}`;
    } else {
      const start = `${currentMonthKey}-01`;
      const end = toDateKey(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
      scopeTasks = await fetchAgendaTasks(tenantId, { from: start, to: end });
      label = `${t("agReportMonth")} ${currentMonthKey}`;
    }
    const pending = scopeTasks.filter((task) => task.status === "pending");
    const done = scopeTasks.filter((task) => task.status === "done");
    const line = (task) => {
      const client = task.client_id ? ` — ${clientLabel(clients, task.client_id)}` : "";
      return `• ${task.title}${client}`;
    };
    const parts = [
      `*${t("agReportTitle")}* (${label})`,
      "",
      `*${t("agReportPending")} (${pending.length})*`,
      ...(pending.length ? pending.map(line) : [`• ${t("agReportNone")}`]),
      "",
      `*${t("agReportDone")} (${done.length})*`,
      ...(done.length ? done.map(line) : [`• ${t("agReportNone")}`]),
    ];
    setReportText(parts.join("\n"));
  };

  useEffect(() => {
    if (reportOpen) buildReport();
  }, [reportOpen, reportScope]);

  const sendReport = () => {
    const digits = String(reportPhone || "").replace(/\D/g, "");
    const normalized = digits.length === 10 ? `52${digits}` : digits;
    const base = normalized.length >= 8 ? `https://wa.me/${normalized}` : "https://wa.me/";
    window.open(`${base}?text=${encodeURIComponent(reportText)}`, "_blank", "noreferrer");
  };

  // ── Importación única desde el HTML v4 (solo admin) ──
  const handleImportJson = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setStatus(t("agImportWorking"));
    try {
      const raw = JSON.parse(await file.text());
      const sourceTasks = raw.tasks || raw.tareas || [];
      const sourceObjectives = raw.objectives || raw.objetivos || [];
      const normalize = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

      let created = 0;
      for (const item of sourceObjectives) {
        const title = item.title || item.titulo || item.texto;
        if (!title) continue;
        await createAgendaObjective(tenantId, {
          period_type: (item.period_type || item.tipo) === "week" ? "week" : "month",
          period_key: item.period_key || item.periodo || currentMonthKey,
          title,
        }, profile?.id).catch(() => {});
      }

      for (const item of sourceTasks) {
        const title = item.title || item.titulo || item.texto;
        if (!title) continue;
        const rawClient = item.client || item.cliente || "";
        let clientId = null;
        let category = (item.category || item.categoria) === "administrativo" ? "administrativo" : "comercial";
        if (category === "comercial" && rawClient) {
          const match = clients.find((client) =>
            normalize(client.name) === normalize(rawClient) || normalize(client.company) === normalize(rawClient));
          if (match) clientId = match.id;
          else if (canManageObjectives) {
            const { data: newClient } = await supabase
              .from("clients")
              .insert({ tenant_id: tenantId, name: rawClient, type: "cliente", active: true })
              .select("id")
              .single();
            clientId = newClient?.id || null;
          }
        }
        if (!clientId && category === "comercial" && rawClient) category = "administrativo";
        await createAgendaTask(tenantId, {
          title: rawClient && !clientId ? `${title} (${rawClient})` : title,
          task_date: item.task_date || item.fecha || todayKey,
          category,
          client_id: clientId,
        }, profile?.id).catch(() => {});
        created += 1;
      }
      await load();
      setStatus(t("agImportDone", created));
    } catch (error) {
      setStatus(`${t("agImportError")}: ${error.message}`);
    }
  };

  const followupTop = followup.slice(0, 8);

  const renderTask = (task) => {
    const overdue = task.status === "pending" && task.task_date < todayKey;
    const attachments = taskAttachments[task.id] || [];
    const client = task.client_id ? clientLabel(clients, task.client_id) : "";
    return (
      <article
        className={`agenda-task agenda-task--${task.status} agenda-task--${task.category}${overdue ? " agenda-task--overdue" : ""}`}
        key={task.id}
      >
        <div className="agenda-task-top">
          <label className="agenda-task-check">
            <input
              type="checkbox"
              checked={task.status === "done"}
              onChange={() => handleToggleTask(task)}
              aria-label={t("agMarkDone")}
            />
            <span className="agenda-task-title" title={task.title}>{task.title}</span>
          </label>
          <div className="agenda-task-actions">
            <label className="agenda-icon-button" title={t("agAttachFile")}>
              <Icon name="paperclip" />
              <input
                type="file"
                multiple
                onChange={(event) => {
                  handleTaskFiles(task.id, event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className="agenda-icon-button agenda-icon-button--danger"
              onClick={() => handleDeleteTask(task)}
              aria-label={t("agDeleteTask")}
              title={t("agDeleteTask")}
            >
              <Icon name="trash" />
            </button>
          </div>
        </div>

        <div className="agenda-task-meta">
          {client ? (
            <button
              type="button"
              className="agenda-client-link"
              title={client}
              onClick={() => setFilterClientId(task.client_id)}
            >
              {client}
            </button>
          ) : (
            <span className="agenda-task-cat">
              {task.category === "comercial" ? t("agCatComercial") : t("agCatAdministrativo")}
            </span>
          )}
          {attachments.length ? (
            <span className="agenda-chip agenda-chip--files" title={t("agAttachmentVisualOnly")}>
              <Icon name="paperclip" size={10} />
              {attachments.length}
            </span>
          ) : null}
          {overdue ? (
            <span className="agenda-chip agenda-chip--overdue" title={t("agDraggedFrom", formatShortDate(task.task_date, language))}>
              ↩ {formatShortDate(task.task_date, language)}
            </span>
          ) : null}
        </div>

        {viewMode === "detail" ? (
          <div className="agenda-task-detail">
            {task.notes ? <p className="agenda-task-notes">{task.notes}</p> : null}
            {attachments.length ? (
              <div className="agenda-attachment-list">
                {attachments.map((file) => (
                  <span className="agenda-attachment-chip" key={file.id} title={`${file.name} · ${formatFileSize(file.size)} · ${t("agAttachmentVisualOnly")}`}>
                    <Icon name="paperclip" size={10} />
                    <span>{file.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(task.id, file.id)}
                      aria-label={t("agRemoveAttachment")}
                      title={t("agRemoveAttachment")}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <section className="admin-workspace agenda-workspace">
      {/* ── Banda de highlights: título + KPIs + acciones + captura rápida ── */}
      <div className="admin-soft-panel compact-panel agenda-topbar">
        <div className="agenda-topbar-row">
          <div className="agenda-topbar-title">
            <span className="tool-eyebrow">{t("agEyebrow")}</span>
            <h2>{t("agTitle")}</h2>
          </div>

          <div className="agenda-kpis" aria-label={t("agBudgetTitle")}>
            <div className="agenda-kpi agenda-kpi--pending">
              <small>{t("agKpiPendingToday")}</small>
              <strong>{loading ? "—" : kpis.pendingToday}</strong>
            </div>
            <div className="agenda-kpi">
              <small>{t("agKpiDoneWeek")}</small>
              <strong>{loading ? "—" : kpis.doneWeek}</strong>
            </div>
            <div className="agenda-kpi agenda-kpi--budget" title={t("agBudgetSourcePending")}>
              <small>{t("agMonthlyBudget")}</small>
              <strong>$0 <span>/ $0</span></strong>
            </div>
            <div className="agenda-kpi agenda-kpi--budget" title={t("agBudgetSourcePending")}>
              <small>{t("agAnnualBudget")}</small>
              <strong>$0 <span>/ $0</span></strong>
            </div>
          </div>

          <div className="agenda-header-actions">
            <div className="agenda-week-nav" role="group" aria-label={t("agThisWeek")}>
              <button className="agenda-icon-button" type="button" onClick={() => setWeekOffset((c) => c - 1)} aria-label="←">
                <Icon name="chevronLeft" />
              </button>
              <button className="agenda-week-current" type="button" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
                {t("agThisWeek")}
              </button>
              <button className="agenda-icon-button" type="button" onClick={() => setWeekOffset((c) => c + 1)} aria-label="→">
                <Icon name="chevronRight" />
              </button>
            </div>
            <div className="agenda-view-toggle" role="group" aria-label={t("agViewMode")}>
              <button
                type="button"
                className={viewMode === "compact" ? "active" : ""}
                aria-pressed={viewMode === "compact"}
                onClick={() => setViewMode("compact")}
                title={t("agViewCompact")}
              >
                <Icon name="rows" /> {t("agViewCompact")}
              </button>
              <button
                type="button"
                className={viewMode === "detail" ? "active" : ""}
                aria-pressed={viewMode === "detail"}
                onClick={() => setViewMode("detail")}
                title={t("agViewDetail")}
              >
                <Icon name="grid" /> {t("agViewDetail")}
              </button>
            </div>
            <button className="primary-button compact-action agenda-report-button" type="button" onClick={() => setReportOpen(true)}>
              <Icon name="whatsapp" /> {t("agReportButton")}
            </button>
          </div>
        </div>

        <form className="agenda-quick-add" onSubmit={handleAddTask}>
          <input
            placeholder={t("agTaskPlaceholder")}
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          />
          <input
            type="date"
            value={form.task_date}
            onChange={(event) => setForm((current) => ({ ...current, task_date: event.target.value }))}
          />
          <select
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value, client_id: "" }))}
          >
            <option value="comercial">{t("agCatComercial")}</option>
            <option value="administrativo">{t("agCatAdministrativo")}</option>
          </select>
          {form.category === "comercial" ? (
            <select
              value={form.client_id}
              onChange={(event) => setForm((current) => ({ ...current, client_id: event.target.value }))}
            >
              <option value="">{t("agNoClient")}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.company || client.name}</option>
              ))}
            </select>
          ) : null}
          {objectives.length ? (
            <select
              value={form.objective_id}
              onChange={(event) => setForm((current) => ({ ...current, objective_id: event.target.value }))}
            >
              <option value="">{t("agNoObjective")}</option>
              {objectives.map((objective) => (
                <option key={objective.id} value={objective.id}>{objective.title}</option>
              ))}
            </select>
          ) : null}
          <button className="primary-button compact-action" type="submit">
            <Icon name="plus" /> {t("agAddTask")}
          </button>
        </form>

        <div className="agenda-topbar-notes">
          <small className="agenda-session-note">
            <Icon name="paperclip" size={10} /> {t("agAttachmentVisualOnly")}
          </small>
          {filterClientId ? (
            <span className="agenda-filter-notice">
              {t("agFilteredBy", clientLabel(clients, filterClientId))}
              <button type="button" onClick={() => setFilterClientId("")}>{t("agClearFilter")}</button>
            </span>
          ) : null}
          {status ? <span className="agenda-status-note">{status}</span> : null}
        </div>
      </div>

      {/* ── Tablero + panel lateral ── */}
      <div className="agenda-main">
        <div className="agenda-board-wrap">
          <div className={`agenda-board agenda-board--${viewMode}`} aria-label={t("agTitle")}>
            {days.map((dayKey, index) => {
              const dayTasks = tasksForDay(dayKey);
              const isToday = dayKey === todayKey;
              return (
                <section className={`agenda-column${isToday ? " agenda-column--today" : ""}`} key={dayKey}>
                  <header>
                    <strong>{DAY_LABELS[index]}</strong>
                    <span>{formatShortDate(dayKey, language)}</span>
                    {isToday ? <em>{t("agToday")}</em> : null}
                    <small className="agenda-day-count">{dayTasks.length}</small>
                  </header>
                  <div className="agenda-column-body">
                    {dayTasks.map(renderTask)}
                    {!dayTasks.length ? <p className="agenda-empty">{loading ? "…" : t("agEmptyDay")}</p> : null}
                  </div>
                </section>
              );
            })}
          </div>
          {overdueOutsideWeek.length ? (
            <p className="agenda-overdue-notice">{t("agOverdueElsewhere", overdueOutsideWeek.length)}</p>
          ) : null}
        </div>

        <aside className="agenda-side">
          <section className="admin-soft-panel compact-panel agenda-side-panel">
            <h3>{t("agObjectives")}</h3>
            {["month", "week"].map((periodType) => {
              const key = periodType === "month" ? currentMonthKey : currentWeekKey;
              const list = objectives.filter((objective) => objective.period_type === periodType);
              return (
                <div className="agenda-objective-group" key={periodType}>
                  <h4>{periodType === "month" ? t("agMonthObjectives", key) : t("agWeekObjectives", key)}</h4>
                  {list.map((objective) => {
                    const progress = objectiveProgress(objective.id);
                    return (
                      <div className="agenda-objective" key={objective.id}>
                        <div className="agenda-objective-row">
                          <span title={objective.title}>{objective.title}</span>
                          {canManageObjectives ? (
                            <button
                              type="button"
                              className="agenda-icon-button agenda-icon-button--danger"
                              onClick={() => deleteAgendaObjective(objective.id).then(load)}
                              aria-label={t("agDeleteObjective")}
                              title={t("agDeleteObjective")}
                            >
                              <Icon name="trash" size={12} />
                            </button>
                          ) : null}
                        </div>
                        {progress ? (
                          <div className="agenda-progress">
                            <div className="agenda-progress-bar" style={{ width: `${progress.pct}%` }} />
                            <small>{progress.done}/{progress.total}</small>
                          </div>
                        ) : (
                          <small className="muted">{t("agNoLinkedTasks")}</small>
                        )}
                      </div>
                    );
                  })}
                  {!list.length ? <p className="agenda-empty">{t("agNoObjectives")}</p> : null}
                </div>
              );
            })}
            {canManageObjectives ? (
              <form className="agenda-objective-form" onSubmit={handleAddObjective}>
                <select
                  value={objectiveForm.period_type}
                  onChange={(event) => setObjectiveForm((current) => ({ ...current, period_type: event.target.value }))}
                >
                  <option value="month">{t("agPeriodMonth")}</option>
                  <option value="week">{t("agPeriodWeek")}</option>
                </select>
                <input
                  placeholder={t("agObjectivePlaceholder")}
                  value={objectiveForm.title}
                  onChange={(event) => setObjectiveForm((current) => ({ ...current, title: event.target.value }))}
                />
                <button className="secondary-button compact-action" type="submit" title={t("agAddObjective")}>
                  <Icon name="plus" size={12} />
                </button>
              </form>
            ) : null}
          </section>

          <section className="admin-soft-panel compact-panel agenda-side-panel">
            <h3>{t("agFollowup")}</h3>
            <p className="muted">{t("agFollowupHint")}</p>
            <div className="agenda-followup-list">
              {followupTop.map((row) => (
                <button
                  type="button"
                  key={row.client_id}
                  className={`agenda-followup-row${filterClientId === row.client_id ? " active" : ""}`}
                  onClick={() => setFilterClientId((current) => (current === row.client_id ? "" : row.client_id))}
                >
                  <span className="agenda-followup-name" title={row.company || row.name}>{row.company || row.name}</span>
                  <span className="agenda-followup-stats">
                    {row.pendientes > 0 ? (
                      <strong className="is-pending">{t("agPendingCount", row.pendientes)}</strong>
                    ) : (
                      <span className="muted">{t("agNoPending")}</span>
                    )}
                    {row.ultima_actividad ? (
                      <small>{t("agLastActivity", formatShortDate(toDateKey(new Date(row.ultima_actividad)), language))}</small>
                    ) : (
                      <small className="is-abandoned">{t("agNeverContacted")}</small>
                    )}
                  </span>
                </button>
              ))}
              {!followupTop.length ? <p className="agenda-empty">{t("agNoFollowup")}</p> : null}
            </div>
            {canManageObjectives ? (
              <label className="agenda-import">
                {t("agImportButton")}
                <input type="file" accept="application/json" onChange={handleImportJson} />
              </label>
            ) : null}
          </section>
        </aside>
      </div>

      {reportOpen ? (
        <div className="agenda-modal-overlay" role="dialog" aria-modal="true">
          <div className="agenda-modal agenda-report-modal">
            <h3>{t("agReportTitle")}</h3>
            <div className="agenda-report-controls">
              <select value={reportScope} onChange={(event) => setReportScope(event.target.value)}>
                <option value="today">{t("agScopeToday")}</option>
                <option value="week">{t("agScopeWeek")}</option>
                <option value="month">{t("agScopeMonth")}</option>
              </select>
              <input
                placeholder={t("agReportPhone")}
                value={reportPhone}
                onChange={(event) => setReportPhone(event.target.value)}
              />
            </div>
            <textarea
              rows={12}
              value={reportText}
              onChange={(event) => setReportText(event.target.value)}
            />
            <div className="agenda-report-actions">
              <button className="secondary-button compact-action" type="button" onClick={() => setReportOpen(false)}>
                {t("agClose")}
              </button>
              <button className="primary-button compact-action" type="button" onClick={sendReport}>
                <Icon name="whatsapp" /> {t("agSendWhatsApp")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
