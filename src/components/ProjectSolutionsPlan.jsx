import { useMemo, useState } from "react";

const DAY_WIDTH = 28;
const DAY_MS = 86400000;
const parseDate = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`) : null;
const isoDate = (date) => date.toISOString().slice(0, 10);
const dateDiff = (start, end) => Math.round((end - start) / DAY_MS);

const statusNames = {
  pending: "Por iniciar",
  planned: "Por iniciar",
  in_progress: "En curso",
  review: "En revisión",
  completed: "Completada",
  delivered: "Completada",
};

const columns = [
  { id: "pending", label: "Por iniciar", accepts: ["pending", "planned"] },
  { id: "in_progress", label: "En curso", accepts: ["in_progress"] },
  { id: "review", label: "En revisión", accepts: ["review"] },
  { id: "completed", label: "Completadas", accepts: ["completed", "delivered"] },
];

const planIcon = (name) => {
  const paths = {
    gantt: <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M7 4v4M14 10v4M10 16v4" /></>,
    board: <><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="10" rx="1" /><rect x="17" y="4" width="4" height="13" rx="1" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
};

export default function ProjectSolutionsPlan({ project, onOpenSolution }) {
  const [view, setView] = useState("gantt");
  const solutions = project.solutions || [];

  const timeline = useMemo(() => {
    const starts = solutions.map((solution) => parseDate(solution.startDate)).filter(Boolean);
    const ends = solutions.map((solution) => parseDate(solution.endDate)).filter(Boolean);
    const fallbackStart = parseDate(project.startDate) || new Date();
    const fallbackEnd = parseDate(project.endDate) || new Date(fallbackStart.getTime() + 42 * DAY_MS);
    const start = new Date(Math.min(...(starts.length ? starts : [fallbackStart]).map((date) => date.getTime())));
    const end = new Date(Math.max(...(ends.length ? ends : [fallbackEnd]).map((date) => date.getTime())));
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() + 1);
    const days = Math.max(1, dateDiff(start, end) + 1);
    return { start, end, days, width: days * DAY_WIDTH };
  }, [solutions, project.startDate, project.endDate]);

  return <section className="project-workboard project-solutions-plan">
    <header className="project-workboard__header">
      <div><h2>Plan maestro</h2><span>El cronograma muestra las soluciones completas que forman este proyecto.</span></div>
      <div className="project-workboard__view-toggle" role="group" aria-label="Vista del plan maestro">
        <button type="button" className={view === "gantt" ? "active" : ""} onClick={() => setView("gantt")}>{planIcon("gantt")}Cronograma</button>
        <button type="button" className={view === "board" ? "active" : ""} onClick={() => setView("board")}>{planIcon("board")}Tablero</button>
      </div>
    </header>

    <div className="project-solutions-plan__summary">
      <article><span>Soluciones</span><strong>{solutions.length}</strong><small>Alcance total del proyecto</small></article>
      <article><span>En curso</span><strong>{solutions.filter((item) => item.status === "in_progress").length}</strong><small>Trabajo activo</small></article>
      <article><span>Progreso general</span><strong>{project.progress}%</strong><small>Avance consolidado</small></article>
    </div>

    {view === "gantt" ? <MasterGantt solutions={solutions} timeline={timeline} onOpen={onOpenSolution} /> : <SolutionsBoard solutions={solutions} onOpen={onOpenSolution} />}
  </section>;
}

function MasterGantt({ solutions, timeline, onOpen }) {
  const days = Array.from({ length: timeline.days }, (_, index) => new Date(timeline.start.getTime() + index * DAY_MS));
  const today = parseDate(isoDate(new Date()));
  const todayIndex = dateDiff(timeline.start, today);

  return <div className="project-gantt-shell master-solutions-gantt">
    <div className="project-gantt" style={{ "--gantt-width": `${timeline.width}px` }}>
      <div className="project-gantt__corner"><span>Solución</span><small>{solutions.length} en el proyecto</small></div>
      <div className="project-gantt__dates" style={{ width: timeline.width }}>
        {days.map((date, index) => <div className={date.getDay() === 0 || date.getDay() === 6 ? "weekend" : ""} style={{ width: DAY_WIDTH }} key={isoDate(date)}><span>{index === 0 || date.getDate() === 1 ? new Intl.DateTimeFormat("es-MX", { month: "short" }).format(date) : ""}</span><strong>{date.getDate()}</strong></div>)}
      </div>
      {solutions.map((solution) => {
        const start = parseDate(solution.startDate) || timeline.start;
        const end = parseDate(solution.endDate) || start;
        const left = Math.max(0, dateDiff(timeline.start, start) * DAY_WIDTH);
        const width = Math.max(DAY_WIDTH, (dateDiff(start, end) + 1) * DAY_WIDTH);
        return <div className="project-gantt__row master-solutions-gantt__row" key={solution.id}>
          <button type="button" className="project-gantt__task" onClick={() => onOpen(solution.id)}><strong>{solution.name}</strong><small>{solution.stage || solution.phase || "Por iniciar"}</small></button>
          <div className="project-gantt__track" style={{ width: timeline.width }}>
            {days.map((date) => <i className={date.getDay() === 0 || date.getDay() === 6 ? "weekend" : ""} style={{ width: DAY_WIDTH }} key={isoDate(date)} />)}
            {todayIndex >= 0 && todayIndex < timeline.days ? <span className="project-gantt__today" style={{ left: todayIndex * DAY_WIDTH + DAY_WIDTH / 2 }}><b>Hoy</b></span> : null}
            <button type="button" className={`project-gantt__bar project-gantt__bar--${solution.status}`} style={{ left, width }} onClick={() => onOpen(solution.id)} title={`${solution.name}: ${solution.progress}%`}><i style={{ width: `${solution.progress}%` }} /><span>{solution.progress}%</span></button>
          </div>
        </div>;
      })}
      {!solutions.length ? <div className="project-workboard__empty">Aún no hay soluciones en este proyecto.</div> : null}
    </div>
  </div>;
}

function SolutionsBoard({ solutions, onOpen }) {
  return <div className="project-kanban master-solutions-board">
    {columns.map((column) => {
      const cards = solutions.filter((solution) => column.accepts.includes(solution.status));
      return <section className={`project-kanban__column project-kanban__column--${column.id}`} key={column.id}>
        <header><span>{column.label}</span><b>{cards.length}</b></header>
        <div className="project-kanban__cards">
          {cards.map((solution) => <article className="project-task-card master-solution-card" key={solution.id} onClick={() => onOpen(solution.id)}>
            <div className="project-task-card__top"><span>{solution.stage || "Solución"}</span><i>{statusNames[solution.status] || solution.status}</i></div>
            <h3>{solution.name}</h3><p>{solution.description}</p>
            <div className="project-task-card__progress"><i><b style={{ width: `${solution.progress}%` }} /></i><span>{solution.progress}%</span></div>
            <footer><span>{solution.phase || "Por iniciar"}</span><button type="button" aria-label={`Abrir ${solution.name}`}>{planIcon("arrow")}</button></footer>
          </article>)}
          {!cards.length ? <div className="project-kanban__dropzone">Sin soluciones</div> : null}
        </div>
      </section>;
    })}
  </div>;
}
