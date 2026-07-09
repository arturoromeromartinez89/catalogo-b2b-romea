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
 * Rollover sin cron: las tareas pendientes con fecha anterior a hoy se
 * muestran en la columna de hoy con un badge "arrastrada desde {fecha}".
 * La fecha original nunca se muta.
 */

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const formatShortDate = (dateKey, language = "es") => {
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString(language === "en" ? "en-US" : "es-MX", { day: "numeric", month: "short" });
};

const clientLabel = (clients, clientId) => {
  const client = clients.find((item) => item.id === clientId);
  return client ? (client.company || client.name) : "";
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

  // Formulario de captura rápida
  const todayKey = toDateKey(new Date());
  const [form, setForm] = useState({
    title: "",
    task_date: todayKey,
    category: "comercial",
    client_id: "",
    objective_id: "",
  });

  // Formulario de objetivos
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
      fetchClientFollowup(tenantId).then(setFollowup).catch(() => {});
    } catch (error) {
      setStatus(`${t("agTaskError")}: ${error.message}`);
    }
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

  return (
    <section className="admin-workspace agenda-workspace">
      <div className="admin-soft-panel compact-panel agenda-header-panel">
        <div className="agenda-header-row">
          <div>
            <span className="tool-eyebrow">{t("agEyebrow")}</span>
            <h2>{t("agTitle")}</h2>
            <p className="muted">{t("agSubtitle")}</p>
          </div>
          <div className="agenda-header-actions">
            <button className="secondary-button compact-action" type="button" onClick={() => setWeekOffset((c) => c - 1)}>←</button>
            <button className="secondary-button compact-action" type="button" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
              {t("agThisWeek")}
            </button>
            <button className="secondary-button compact-action" type="button" onClick={() => setWeekOffset((c) => c + 1)}>→</button>
            <button className="primary-button compact-action" type="button" onClick={() => setReportOpen(true)}>
              {t("agReportButton")}
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
          <button className="primary-button compact-action" type="submit">{t("agAddTask")}</button>
        </form>

        {filterClientId ? (
          <p className="agenda-filter-notice">
            {t("agFilteredBy", clientLabel(clients, filterClientId))}
            <button type="button" className="secondary-button compact-action" onClick={() => setFilterClientId("")}>
              {t("agClearFilter")}
            </button>
          </p>
        ) : null}
        {status ? <p className="status info">{status}</p> : null}
      </div>

      <div className="agenda-board" aria-label={t("agTitle")}>
        {days.map((dayKey, index) => {
          const dayTasks = tasksForDay(dayKey);
          const isToday = dayKey === todayKey;
          return (
            <section className={`agenda-column${isToday ? " agenda-column--today" : ""}`} key={dayKey}>
              <header>
                <strong>{DAY_LABELS[index]}</strong>
                <span>{formatShortDate(dayKey, language)}</span>
                {isToday ? <em>{t("agToday")}</em> : null}
              </header>
              <div className="agenda-column-body">
                {dayTasks.map((task) => {
                  const overdue = task.status === "pending" && task.task_date < todayKey;
                  return (
                    <article className={`agenda-task agenda-task--${task.status}${overdue ? " agenda-task--overdue" : ""}`} key={task.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={task.status === "done"}
                          onChange={() => handleToggleTask(task)}
                        />
                        <span>{task.title}</span>
                      </label>
                      <div className="agenda-task-meta">
                        <span className={`agenda-chip agenda-chip--${task.category}`}>
                          {task.category === "comercial" ? t("agCatComercial") : t("agCatAdministrativo")}
                        </span>
                        {task.client_id ? (
                          <button type="button" className="agenda-client-link" onClick={() => setFilterClientId(task.client_id)}>
                            {clientLabel(clients, task.client_id)}
                          </button>
                        ) : null}
                        {overdue ? (
                          <span className="agenda-chip agenda-chip--overdue">
                            {t("agDraggedFrom", formatShortDate(task.task_date, language))}
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="agenda-task-delete"
                        onClick={() => handleDeleteTask(task)}
                        aria-label={t("agDeleteTask")}
                        title={t("agDeleteTask")}
                      >
                        ×
                      </button>
                    </article>
                  );
                })}
                {!dayTasks.length ? <p className="agenda-empty">{loading ? "…" : t("agEmptyDay")}</p> : null}
              </div>
            </section>
          );
        })}
      </div>

      {overdueOutsideWeek.length ? (
        <p className="agenda-overdue-notice">{t("agOverdueElsewhere", overdueOutsideWeek.length)}</p>
      ) : null}

      <div className="agenda-panels">
        <section className="admin-soft-panel compact-panel">
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
                        <span>{objective.title}</span>
                        {canManageObjectives ? (
                          <button
                            type="button"
                            className="agenda-task-delete"
                            onClick={() => deleteAgendaObjective(objective.id).then(load)}
                            aria-label={t("agDeleteObjective")}
                          >
                            ×
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
              <button className="secondary-button compact-action" type="submit">{t("agAddObjective")}</button>
            </form>
          ) : null}
        </section>

        <section className="admin-soft-panel compact-panel">
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
                <span className="agenda-followup-name">{row.company || row.name}</span>
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
                {t("agSendWhatsApp")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
