// Fuente única del lenguaje de estados y del cálculo de avance del Project Hub.
// Referencias: PRODUCT.md ("Global Status Language") y docs/NEXOR-PROJECT-OPERATING-MODEL.md.
// El portal del cliente y NEXOR Studio deben leer siempre desde aquí para no mostrar
// dos verdades distintas ni exponer claves internas al usuario.

// Los seis estados globales: azul, verde, naranja, rojo, negro y gris.
// El color nunca funciona solo: estas etiquetas acompañan siempre a la señal cromática.
export const VISUAL_STATUS_LABELS = {
  completed: "Terminado",
  in_progress: "En proceso",
  waiting: "En espera",
  overdue: "Atrasado",
  cancelled: "Cancelado",
  planned: "Por iniciar",
};

// Etiqueta legible de cada estado interno. Ninguna clave técnica debe llegar al usuario.
const RAW_STATUS_LABELS = {
  draft: "Borrador",
  planned: "Por iniciar",
  backlog: "Por iniciar",
  todo: "Por hacer",
  pending: "Pendiente",
  active: "Activo",
  in_progress: "En proceso",
  review: "En revisión",
  waiting: "En espera",
  blocked: "En espera",
  on_hold: "En espera",
  needs_changes: "Requiere cambios",
  rejected: "Requiere cambios",
  at_risk: "Atrasado",
  overdue: "Atrasado",
  done: "Terminada",
  completed: "Terminado",
  delivered: "Entregado",
  approved: "Aprobado",
  accepted: "Aceptado",
  resolved: "Resuelto",
  cancelled: "Cancelado",
  not_applicable: "No aplica",
  superseded: "Reemplazada",
};

const CLOSED_STATUSES = ["done", "completed", "delivered", "approved", "accepted", "cancelled"];

export const isPastDue = (date, status) => {
  if (!date || CLOSED_STATUSES.includes(status)) return false;
  return new Date(`${String(date).slice(0, 10)}T23:59:59`) < new Date();
};

// Traduce cualquier estado interno a uno de los seis estados globales.
export const toVisualStatus = (status, dueDate) => {
  if (status === "cancelled") return "cancelled";
  if (isPastDue(dueDate, status)) return "overdue";
  if (["done", "completed", "delivered", "approved", "accepted"].includes(status)) return "completed";
  if (["in_progress", "active", "review"].includes(status)) return "in_progress";
  if (["blocked", "waiting", "pending", "needs_changes", "rejected", "on_hold"].includes(status)) return "waiting";
  return "planned";
};

// Devuelve texto siempre comprensible. Cadena vacía cuando el registro no maneja estado,
// para que quien llama pueda ofrecer otro dato (por ejemplo el tipo de documento).
export const statusLabel = (status) => {
  if (!status) return "";
  return RAW_STATUS_LABELS[status] || VISUAL_STATUS_LABELS[toVisualStatus(status)];
};

// Un registro cancelado o no publicado nunca participa en el avance.
const countsForProgress = (item) => item.status !== "cancelled" && item.visible_to_client !== false;

// Peso del elemento: peso explícito del entregable, horas estimadas de la tarea o una unidad.
// Un registro sin estimación válida pesa una unidad; nunca desaparece del cálculo.
const itemWeight = (item) => {
  const value = Number(item.weight ?? item.estimatedHours ?? item.estimated_hours ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
};

export const weightedPercentage = (items, isComplete) => {
  const active = (items || []).filter(countsForProgress);
  const total = active.reduce((sum, item) => sum + itemWeight(item), 0);
  if (!total) return 0;
  const complete = active.reduce((sum, item) => sum + (isComplete(item) ? itemWeight(item) : 0), 0);
  return Math.round((complete / total) * 100);
};

// Avance confirmado: entregables aceptados por el cliente, ponderados por su peso.
export const confirmedProgress = (deliverables) => weightedPercentage(deliverables, (item) => item.status === "approved");

// Avance de trabajo: tareas terminadas, ponderadas por su estimación.
export const workProgress = (tasks) => weightedPercentage(tasks, (task) => task.status === "done");
