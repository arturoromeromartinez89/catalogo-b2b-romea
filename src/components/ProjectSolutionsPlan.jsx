import { useMemo, useState } from "react";

const DAY_WIDTH = 22;
const DAY_MS = 86400000;
const parseDate = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`) : null;
const isoDate = (date) => date.toISOString().slice(0, 10);
const dateDiff = (start, end) => Math.round((end - start) / DAY_MS);

const statusNames = {
  planned: "Por iniciar",
  in_progress: "En proceso",
  waiting: "En espera",
  overdue: "Atrasado",
  completed: "Terminado",
  cancelled: "Cancelado",
};

const planIcon = (name) => {
  const paths = {
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <><path d="M5 12h14" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
};

const rangeForNextThreeMonths = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 3);
  const days = dateDiff(start, end) + 1;
  return { start, end, days, width: days * DAY_WIDTH };
};

export default function ProjectSolutionsPlan({ project, onOpenSolution, onOpenTask }) {
  const solutions = project.solutions || [];
  const timeline = useMemo(rangeForNextThreeMonths, []);
  const [expanded, setExpanded] = useState(() => new Set(solutions.slice(0, 1).map((solution) => solution.id)));

  const toggle = (solutionId) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(solutionId)) next.delete(solutionId);
    else next.add(solutionId);
    return next;
  });

  return <section className="project-workboard project-solutions-plan">
    <header className="project-workboard__header project-solutions-plan__header">
      <div><p>Próximos 3 meses</p><h2>Cronograma de soluciones</h2><span>Despliega una solución para ver sus actividades. Cada actividad abre su detalle.</span></div>
      <div className="project-status-legend" aria-label="Reglas de estado">
        {Object.entries(statusNames).map(([status, label]) => <span className={`project-status project-status--${status}`} key={status}>{label}</span>)}
      </div>
    </header>

    <div className="project-solutions-plan__summary">
      <article><span>Soluciones</span><strong>{solutions.length}</strong><small>Alcance publicado</small></article>
      <article><span>Actividades</span><strong>{project.tasks?.filter((task) => task.status !== "cancelled").length || 0}</strong><small>Trabajo verificable</small></article>
      <article><span>Terminadas</span><strong>{project.tasks?.filter((task) => task.status === "done").length || 0}</strong><small>No incluye canceladas</small></article>
    </div>

    <MasterGantt
      solutions={solutions}
      tasks={project.tasks || []}
      timeline={timeline}
      expanded={expanded}
      onToggle={toggle}
      onOpenSolution={onOpenSolution}
      onOpenTask={onOpenTask}
    />
  </section>;
}

function MasterGantt({ solutions, tasks, timeline, expanded, onToggle, onOpenSolution, onOpenTask }) {
  const days = Array.from({ length: timeline.days }, (_, index) => new Date(timeline.start.getTime() + index * DAY_MS));
  const months = days.reduce((groups, date, index) => {
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const current = groups.at(-1);
    if (current?.key === key) current.days += 1;
    else groups.push({ key, date, startIndex: index, days: 1 });
    return groups;
  }, []);

  const barPosition = (startValue, endValue) => {
    const rawStart = parseDate(startValue) || timeline.start;
    const rawEnd = parseDate(endValue) || rawStart;
    if (rawEnd < timeline.start || rawStart > timeline.end) return null;
    const start = rawStart < timeline.start ? timeline.start : rawStart;
    const end = rawEnd > timeline.end ? timeline.end : rawEnd;
    return {
      left: Math.max(0, dateDiff(timeline.start, start) * DAY_WIDTH),
      width: Math.max(DAY_WIDTH, (dateDiff(start, end) + 1) * DAY_WIDTH),
    };
  };

  const track = (key) => <div className="project-gantt__grid" aria-hidden="true">
    {days.map((date) => <i className={date.getDay() === 0 || date.getDay() === 6 ? "weekend" : ""} style={{ width: DAY_WIDTH }} key={`${key}-${isoDate(date)}`} />)}
  </div>;

  return <div className="project-gantt-shell master-solutions-gantt">
    <div className="project-gantt project-gantt--expandable" style={{ "--gantt-width": `${timeline.width}px` }}>
      <div className="project-gantt__corner"><span>Solución / actividad</span><small>Haz clic para abrir el detalle</small></div>
      <div className="project-gantt__dates project-gantt__dates--months" style={{ width: timeline.width }}>
        {months.map((month) => <div style={{ width: month.days * DAY_WIDTH }} key={month.key}><strong>{new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(month.date)}</strong><small>{month.days} días</small></div>)}
      </div>

      {solutions.map((solution) => {
        const solutionTasks = tasks.filter((task) => task.solutionId === solution.id && task.status !== "cancelled");
        const isExpanded = expanded.has(solution.id);
        const position = barPosition(solution.startDate, solution.endDate);
        const state = solution.visualStatus || "planned";
        return <div className="project-gantt__group" key={solution.id}>
          <div className="project-gantt__row master-solutions-gantt__row">
            <div className="project-gantt__task project-gantt__solution-label">
              <button type="button" className="project-gantt__expand" aria-expanded={isExpanded} aria-label={`${isExpanded ? "Contraer" : "Desplegar"} ${solution.name}`} onClick={() => onToggle(solution.id)}>{planIcon(isExpanded ? "minus" : "plus")}</button>
              <button type="button" className="project-gantt__task-link" onClick={() => onOpenSolution(solution.id)}><strong>{solution.name}</strong><small>{statusNames[state]} · {solutionTasks.length} actividades</small></button>
            </div>
            <div className="project-gantt__track" style={{ width: timeline.width }}>
              {track(`solution-${solution.id}`)}
              {position ? <button type="button" className={`project-gantt__bar project-gantt__bar--${state}`} style={position} onClick={() => onOpenSolution(solution.id)} title={`${solution.name}: ${solution.progress}%`}><i style={{ width: `${solution.progress}%` }} /><span>{solution.progress}%</span></button> : null}
            </div>
          </div>

          {isExpanded ? <div className="project-gantt__children">
            {solutionTasks.map((task) => {
              const taskPosition = barPosition(task.startDate, task.dueDate);
              const taskState = task.visualStatus || "planned";
              return <div className="project-gantt__row project-gantt__row--task" key={task.id}>
                <button type="button" className="project-gantt__task project-gantt__task--child" onClick={() => onOpenTask(solution.id, task.id)}><i /><span><strong>{task.title}</strong><small>{statusNames[taskState]} · {task.assignee || "Por asignar"}</small></span>{planIcon("arrow")}</button>
                <div className="project-gantt__track" style={{ width: timeline.width }}>
                  {track(`task-${task.id}`)}
                  {taskPosition ? <button type="button" className={`project-gantt__bar project-gantt__bar--${taskState}`} style={taskPosition} onClick={() => onOpenTask(solution.id, task.id)} title={`${task.title}: ${statusNames[taskState]}`}><span>{task.status === "done" ? "100%" : ""}</span></button> : null}
                </div>
              </div>;
            })}
            {!solutionTasks.length ? <div className="project-gantt__empty-child">Esta solución todavía no tiene actividades publicadas.</div> : null}
          </div> : null}
        </div>;
      })}
      {!solutions.length ? <div className="project-workboard__empty">Aún no hay soluciones publicadas en este proyecto.</div> : null}
    </div>
  </div>;
}
