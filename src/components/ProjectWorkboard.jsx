import { useEffect, useMemo, useState } from "react";
import {
  addProjectTaskComment,
  createTaskAttachmentUrl,
  moveProjectTask,
  uploadProjectTaskAttachment,
} from "../services/projectHubService";

const DAY_WIDTH = 28;
const DAY_MS = 86400000;
const columns = [
  { id: "todo", label: "Por hacer", accepts: ["backlog", "todo"] },
  { id: "in_progress", label: "En curso", accepts: ["in_progress"] },
  { id: "review", label: "En revisión", accepts: ["review"] },
  { id: "blocked", label: "Bloqueadas", accepts: ["blocked"] },
  { id: "done", label: "Completadas", accepts: ["done"] },
];
const statusNames = { backlog: "Backlog", todo: "Por hacer", in_progress: "En curso", review: "En revisión", blocked: "Bloqueada", done: "Completada" };
const priorityNames = { low: "Baja", medium: "Media", high: "Alta", critical: "Crítica" };
const objectiveStatusNames = { planned: "Programado", active: "En curso", completed: "Completado", at_risk: "En riesgo" };

const parseDate = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`) : null;
const isoDate = (date) => date.toISOString().slice(0, 10);
const dateDiff = (start, end) => Math.round((end - start) / DAY_MS);
const formatShortDate = (value) => value ? new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(parseDate(value)) : "Sin fecha";
const formatLongDate = (value) => value ? new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "long", year: "numeric" }).format(parseDate(value)) : "Sin fecha";
const formatBytes = (value) => {
  const size = Number(value || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1048576) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1048576).toFixed(1)} MB`;
};

const smallIcon = (name) => {
  const paths = {
    gantt: <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M7 4v4M14 10v4M10 16v4" /></>,
    kanban: <><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="10" rx="1" /><rect x="17" y="4" width="4" height="13" rx="1" /></>,
    paperclip: <path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 1 1-2.8-2.8l8.9-8.9" />,
    comment: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 20h14" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
};

export default function ProjectWorkboard({ project, tenantId = "", onReload, onNotice, mode = "project" }) {
  const isSolutionMode = mode === "solution";
  const [view, setView] = useState(isSolutionMode ? "kanban" : "gantt");
  const [objectiveId, setObjectiveId] = useState("all");
  const [tasks, setTasks] = useState(project.tasks || []);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [localComments, setLocalComments] = useState({});
  const [localAttachments, setLocalAttachments] = useState({});

  useEffect(() => { setTasks(project.tasks || []); }, [project.tasks]);
  const objectives = project.objectives || [];
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || null;
  const filteredTasks = objectiveId === "all" ? tasks : tasks.filter((task) => task.objectiveId === objectiveId);
  const visibleObjectives = objectiveId === "all" ? objectives : objectives.filter((item) => item.id === objectiveId);

  const timeline = useMemo(() => {
    const dated = filteredTasks.filter((task) => task.startDate && task.dueDate);
    const starts = [...dated.map((task) => parseDate(task.startDate)), ...visibleObjectives.map((item) => parseDate(item.periodStart))].filter(Boolean);
    const ends = [...dated.map((task) => parseDate(task.dueDate)), ...visibleObjectives.map((item) => parseDate(item.periodEnd))].filter(Boolean);
    const fallbackStart = parseDate(project.startDate) || new Date();
    const fallbackEnd = parseDate(project.endDate) || new Date(fallbackStart.getTime() + 28 * DAY_MS);
    const start = new Date(Math.min(...(starts.length ? starts : [fallbackStart]).map((date) => date.getTime())));
    const end = new Date(Math.max(...(ends.length ? ends : [fallbackEnd]).map((date) => date.getTime())));
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() + 1);
    const days = Math.max(1, dateDiff(start, end) + 1);
    return { start, end, days, width: days * DAY_WIDTH };
  }, [filteredTasks, visibleObjectives, project.startDate, project.endDate]);

  const selectedComments = selectedTask ? [...(selectedTask.comments || []), ...(localComments[selectedTask.id] || [])] : [];
  const selectedAttachments = selectedTask ? [...(selectedTask.attachments || []), ...(localAttachments[selectedTask.id] || [])] : [];

  const updateTaskStatus = async (taskId, status, sortOrder = 0) => {
    const before = tasks;
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, status, progress: status === "done" ? 100 : task.progress } : task));
    if (!tenantId) {
      onNotice?.("Movimiento de demostración aplicado. En el portal autenticado se guarda automáticamente.");
      return;
    }
    setSaving(true);
    try {
      await moveProjectTask(taskId, status, sortOrder);
      await onReload?.();
      onNotice?.("Actividad actualizada.");
    } catch (error) {
      setTasks(before);
      onNotice?.(error.message || "No se pudo mover la tarea.");
    } finally { setSaving(false); }
  };

  const dropTask = (column) => {
    if (!draggedTaskId) return;
    const count = tasks.filter((task) => column.accepts.includes(task.status)).length;
    updateTaskStatus(draggedTaskId, column.id, (count + 1) * 10);
    setDraggedTaskId("");
  };

  const submitComment = async () => {
    const body = comment.trim();
    if (!selectedTask || !body) return;
    setSaving(true);
    try {
      if (tenantId) {
        await addProjectTaskComment({ tenantId, projectId: project.id, taskId: selectedTask.id, body });
        await onReload?.();
      } else {
        setLocalComments((current) => ({ ...current, [selectedTask.id]: [...(current[selectedTask.id] || []), { id: `demo-${Date.now()}`, body, createdAt: new Date().toISOString(), author: "Tú" }] }));
      }
      setComment("");
      onNotice?.("Comentario agregado a la actividad.");
    } catch (error) { onNotice?.(error.message || "No se pudo guardar el comentario."); }
    finally { setSaving(false); }
  };

  const uploadAttachment = async (file) => {
    if (!selectedTask || !file) return;
    setSaving(true);
    try {
      if (tenantId) {
        await uploadProjectTaskAttachment({ tenantId, projectId: project.id, taskId: selectedTask.id, file });
        await onReload?.();
      } else {
        const demoAttachment = { id: `demo-file-${Date.now()}`, fileName: file.name, fileSize: file.size, mimeType: file.type, demo: true };
        setLocalAttachments((current) => ({ ...current, [selectedTask.id]: [...(current[selectedTask.id] || []), demoAttachment] }));
      }
      onNotice?.("Archivo adjuntado a la actividad.");
    } catch (error) { onNotice?.(error.message || "No se pudo adjuntar el archivo."); }
    finally { setSaving(false); }
  };

  const openAttachment = async (attachment) => {
    if (attachment.demo || !attachment.storagePath) { onNotice?.("Archivo de demostración agregado correctamente."); return; }
    try {
      const url = await createTaskAttachmentUrl(attachment.storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) { onNotice?.(error.message || "No se pudo abrir el archivo."); }
  };

  return (
    <section className="project-workboard">
      <header className="project-workboard__header">
        <div><h2>{isSolutionMode ? "Actividades" : "Plan de trabajo"}</h2><span>{isSolutionMode ? "Trabajo operativo de esta solución, organizado por objetivo y estado." : "Actividades concretas organizadas por objetivo y fecha."}</span></div>
        {!isSolutionMode ? <div className="project-workboard__view-toggle" role="group" aria-label="Vista del plan de trabajo">
          <button type="button" className={view === "gantt" ? "active" : ""} onClick={() => setView("gantt")}>{smallIcon("gantt")}Cronograma</button>
          <button type="button" className={view === "kanban" ? "active" : ""} onClick={() => setView("kanban")}>{smallIcon("kanban")}Tablero</button>
        </div> : <div className="project-workboard__mode-badge">Kanban de la solución</div>}
      </header>

      <div className="project-objectives" aria-label="Objetivos por periodo">
        <button type="button" className={`project-objective project-objective--all${objectiveId === "all" ? " active" : ""}`} onClick={() => setObjectiveId("all")}>
          <span>Vista completa</span><strong>{tasks.length} actividades</strong><small>{objectives.length} objetivos definidos</small>
        </button>
        {objectives.map((objective) => {
          const count = tasks.filter((task) => task.objectiveId === objective.id).length;
          return <button type="button" key={objective.id} className={`project-objective project-objective--${objective.status}${objectiveId === objective.id ? " active" : ""}`} onClick={() => setObjectiveId(objective.id)}>
            <span>{objective.periodLabel || `${formatShortDate(objective.periodStart)} – ${formatShortDate(objective.periodEnd)}`}</span>
            <strong>{objective.title}</strong>
            <p>{objective.description}</p>
            <div><i><b style={{ width: `${objective.progress}%` }} /></i><em>{objective.progress}%</em></div>
            <small>{objectiveStatusNames[objective.status] || objective.status} · {count} actividades</small>
          </button>;
        })}
      </div>

      {!isSolutionMode && view === "gantt" ? <GanttView tasks={filteredTasks} timeline={timeline} onOpen={setSelectedTaskId} /> : <KanbanView tasks={filteredTasks} onOpen={setSelectedTaskId} onDragStart={setDraggedTaskId} onDrop={dropTask} />}

      {selectedTask ? <TaskPanel
        task={selectedTask}
        objective={objectives.find((item) => item.id === selectedTask.objectiveId)}
        comments={selectedComments}
        attachments={selectedAttachments}
        comment={comment}
        setComment={setComment}
        saving={saving}
        onClose={() => { setSelectedTaskId(""); setComment(""); }}
        onStatus={(status) => updateTaskStatus(selectedTask.id, status, selectedTask.sortOrder)}
        onComment={submitComment}
        onUpload={uploadAttachment}
        onOpenAttachment={openAttachment}
      /> : null}
    </section>
  );
}

function GanttView({ tasks, timeline, onOpen }) {
  const days = Array.from({ length: timeline.days }, (_, index) => new Date(timeline.start.getTime() + index * DAY_MS));
  const today = parseDate(isoDate(new Date()));
  const todayIndex = dateDiff(timeline.start, today);
  return <div className="project-gantt-shell">
    <div className="project-gantt" style={{ "--gantt-width": `${timeline.width}px` }}>
      <div className="project-gantt__corner"><span>Actividad</span><small>{tasks.length} visibles</small></div>
      <div className="project-gantt__dates" style={{ width: timeline.width }}>
        {days.map((date, index) => <div className={date.getDay() === 0 || date.getDay() === 6 ? "weekend" : ""} style={{ width: DAY_WIDTH }} key={isoDate(date)}><span>{index === 0 || date.getDate() === 1 ? new Intl.DateTimeFormat("es-MX", { month: "short" }).format(date) : ""}</span><strong>{date.getDate()}</strong></div>)}
      </div>
      {tasks.map((task) => {
        const start = parseDate(task.startDate) || timeline.start;
        const end = parseDate(task.dueDate) || start;
        const left = Math.max(0, dateDiff(timeline.start, start) * DAY_WIDTH);
        const width = Math.max(DAY_WIDTH, (dateDiff(start, end) + 1) * DAY_WIDTH);
        return <div className="project-gantt__row" key={task.id}>
          <button type="button" className="project-gantt__task" onClick={() => onOpen(task.id)}><span className={`project-priority project-priority--${task.priority}`} /> <strong>{task.title}</strong><small>{task.assignee || "Sin responsable"}</small></button>
          <div className="project-gantt__track" style={{ width: timeline.width }}>
            {days.map((date) => <i className={date.getDay() === 0 || date.getDay() === 6 ? "weekend" : ""} style={{ width: DAY_WIDTH }} key={isoDate(date)} />)}
            {todayIndex >= 0 && todayIndex < timeline.days ? <span className="project-gantt__today" style={{ left: todayIndex * DAY_WIDTH + DAY_WIDTH / 2 }}><b>Hoy</b></span> : null}
            <button type="button" className={`project-gantt__bar project-gantt__bar--${task.status}`} style={{ left, width }} onClick={() => onOpen(task.id)} title={`${task.title}: ${task.progress}%`}><i style={{ width: `${task.progress}%` }} /><span>{task.progress}%</span></button>
          </div>
        </div>;
      })}
      {!tasks.length ? <div className="project-workboard__empty">No hay actividades para este objetivo.</div> : null}
    </div>
  </div>;
}

function KanbanView({ tasks, onOpen, onDragStart, onDrop }) {
  return <div className="project-kanban">
    {columns.map((column) => {
      const cards = tasks.filter((task) => column.accepts.includes(task.status));
      return <section className={`project-kanban__column project-kanban__column--${column.id}`} key={column.id} onDragOver={(event) => event.preventDefault()} onDrop={() => onDrop(column)}>
        <header><span>{column.label}</span><b>{cards.length}</b></header>
        <div className="project-kanban__cards">
          {cards.map((task) => <article className={`project-task-card project-task-card--${task.priority}`} key={task.id} draggable onDragStart={() => onDragStart(task.id)} onDragEnd={() => onDragStart("")} onClick={() => onOpen(task.id)}>
            <div className="project-task-card__top"><span>{priorityNames[task.priority] || task.priority}</span><i>⋮⋮</i></div>
            <h3>{task.title}</h3><p>{task.description}</p>
            <div className="project-task-card__progress"><i><b style={{ width: `${task.progress}%` }} /></i><span>{task.progress}%</span></div>
            <footer><span>{smallIcon("calendar")}{formatShortDate(task.dueDate)}</span><div><span>{smallIcon("comment")}{task.comments?.length || 0}</span><span>{smallIcon("paperclip")}{task.attachments?.length || 0}</span></div></footer>
          </article>)}
          {!cards.length ? <div className="project-kanban__dropzone">Arrastra una tarjeta aquí</div> : null}
        </div>
      </section>;
    })}
  </div>;
}

function TaskPanel({ task, objective, comments, attachments, comment, setComment, saving, onClose, onStatus, onComment, onUpload, onOpenAttachment }) {
  return <div className="project-task-panel-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="project-task-panel" role="dialog" aria-modal="true" aria-label={`Detalle de ${task.title}`}>
      <header><div><span>{objective?.periodLabel || "Actividad del proyecto"}</span><h2>{task.title}</h2></div><button type="button" aria-label="Cerrar actividad" onClick={onClose}>{smallIcon("close")}</button></header>
      <p className="project-task-panel__description">{task.description || "Sin descripción adicional."}</p>
      <div className="project-task-panel__meta">
        <label>Estado<select value={task.status} disabled={saving} onChange={(event) => onStatus(event.target.value)}><option value="backlog">Backlog</option>{columns.map((column) => <option value={column.id} key={column.id}>{column.label}</option>)}</select></label>
        <div><span>Responsable</span><strong>{task.assignee || "Por asignar"}</strong></div>
        <div><span>Periodo</span><strong>{formatLongDate(task.startDate)} – {formatLongDate(task.dueDate)}</strong></div>
        <div><span>Prioridad</span><strong className={`project-task-panel__priority project-task-panel__priority--${task.priority}`}>{priorityNames[task.priority]}</strong></div>
      </div>
      <section className="project-task-panel__section"><header><div><span>Avance</span><strong>{task.progress}%</strong></div></header><div className="project-progress"><i style={{ width: `${task.progress}%` }} /></div></section>
      <section className="project-task-panel__section">
        <header><div><span>Archivos</span><strong>{attachments.length}</strong></div><label className="project-task-panel__upload">{smallIcon("upload")}Adjuntar<input type="file" disabled={saving} accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.xls,.xlsx,.doc,.docx,.ppt,.pptx" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = ""; }} /></label></header>
        <div className="project-task-files">{attachments.map((attachment) => <button type="button" key={attachment.id} onClick={() => onOpenAttachment(attachment)}>{smallIcon("paperclip")}<span><strong>{attachment.fileName}</strong><small>{formatBytes(attachment.fileSize)}</small></span></button>)}{!attachments.length ? <p>Adjunta propuestas, capturas, hojas de cálculo o evidencia de esta actividad.</p> : null}</div>
      </section>
      <section className="project-task-panel__section project-task-panel__comments">
        <header><div><span>Conversación</span><strong>{comments.length}</strong></div></header>
        <div className="project-task-comments">{comments.map((item) => <article key={item.id}><div><strong>{item.author || "Equipo del proyecto"}</strong><small>{item.createdAt ? formatLongDate(item.createdAt) : ""}</small></div><p>{item.body}</p></article>)}{!comments.length ? <p>Aún no hay comentarios en esta actividad.</p> : null}</div>
        <div className="project-task-comment-form"><textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={4000} placeholder="Escribe una actualización, duda o decisión..." /><button className="primary-button" type="button" disabled={saving || !comment.trim()} onClick={onComment}>{saving ? "Guardando..." : "Comentar"}</button></div>
      </section>
    </aside>
  </div>;
}
