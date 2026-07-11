import { supabase } from "../lib/supabaseClient";

// ── Fechas (hora local de quien consulta, no UTC) ────────────────────────────
export const toDateKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(`${date}T00:00:00`);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const monthKey = (date = new Date()) => toDateKey(date).slice(0, 7);

// Semana ISO: '2026-W28'
export const isoWeekKey = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

// Lunes de la semana de `date` (local)
export const weekStart = (date = new Date()) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - (day - 1));
  return d;
};

export const addDays = (date, days) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
};

// ── Tareas ───────────────────────────────────────────────────────────────────
const TASK_COLUMNS = "id, tenant_id, title, task_date, category, client_id, objective_id, status, completed_at, assignee_id, position, notes, created_at, item_type, start_time";

export const AGENDA_CATEGORIES = ["comercial", "administrativo", "viaje"];
// Categorías que pueden llevar cliente (mismo criterio que el CHECK en BD)
export const CLIENT_CATEGORIES = ["comercial", "viaje"];

// Trae la semana visible + todo pendiente anterior (rollover por consulta).
export const fetchAgendaTasks = async (tenantId, { from, to } = {}) => {
  if (!tenantId || !supabase) return [];
  const { data, error } = await supabase
    .from("agenda_tasks")
    .select(TASK_COLUMNS)
    .eq("tenant_id", tenantId)
    .or(`and(task_date.gte.${from},task_date.lte.${to}),and(task_date.lt.${from},status.eq.pending)`)
    .order("start_time", { ascending: true, nullsFirst: false })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
};

export const createAgendaTask = async (tenantId, task, profileId = "") => {
  const category = AGENDA_CATEGORIES.includes(task.category) ? task.category : "administrativo";
  const isAppointment = task.item_type === "appointment";
  const row = {
    tenant_id: tenantId,
    title: String(task.title || "").trim(),
    task_date: task.task_date,
    category,
    item_type: isAppointment ? "appointment" : "task",
    start_time: isAppointment ? (task.start_time || null) : null,
    client_id: CLIENT_CATEGORIES.includes(category) ? (task.client_id || null) : null,
    objective_id: task.objective_id || null,
    notes: task.notes || null,
    assignee_id: task.assignee_id || profileId || null,
    created_by: profileId || null,
  };
  if (!row.title) throw new Error("La tarea necesita un título.");
  if (!row.task_date) throw new Error("La tarea necesita una fecha.");
  if (isAppointment && !row.start_time) throw new Error("La cita necesita una hora.");
  const { data, error } = await supabase
    .from("agenda_tasks")
    .insert(row)
    .select(TASK_COLUMNS)
    .single();
  if (error) throw error;
  return data;
};

export const setAgendaTaskStatus = async (taskId, status) => {
  const patch = {
    status,
    completed_at: status === "done" ? new Date().toISOString() : null,
  };
  const { data, error } = await supabase
    .from("agenda_tasks")
    .update(patch)
    .eq("id", taskId)
    .select(TASK_COLUMNS)
    .single();
  if (error) throw error;
  return data;
};

export const updateAgendaTask = async (taskId, patch) => {
  const { data, error } = await supabase
    .from("agenda_tasks")
    .update(patch)
    .eq("id", taskId)
    .select(TASK_COLUMNS)
    .single();
  if (error) throw error;
  return data;
};

export const deleteAgendaTask = async (taskId) => {
  const { error } = await supabase.from("agenda_tasks").delete().eq("id", taskId);
  if (error) throw error;
};

// ── Objetivos ────────────────────────────────────────────────────────────────
export const fetchAgendaObjectives = async (tenantId, periodKeys = []) => {
  if (!tenantId || !supabase) return [];
  let query = supabase
    .from("agenda_objectives")
    .select("id, tenant_id, period_type, period_key, title, position, created_at")
    .eq("tenant_id", tenantId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (periodKeys.length) query = query.in("period_key", periodKeys);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

export const createAgendaObjective = async (tenantId, objective, profileId = "") => {
  const row = {
    tenant_id: tenantId,
    period_type: objective.period_type === "week" ? "week" : "month",
    period_key: objective.period_key,
    title: String(objective.title || "").trim(),
    created_by: profileId || null,
  };
  if (!row.title) throw new Error("El objetivo necesita un título.");
  const { data, error } = await supabase
    .from("agenda_objectives")
    .insert(row)
    .select("id, tenant_id, period_type, period_key, title, position, created_at")
    .single();
  if (error) throw error;
  return data;
};

export const deleteAgendaObjective = async (objectiveId) => {
  const { error } = await supabase.from("agenda_objectives").delete().eq("id", objectiveId);
  if (error) throw error;
};

// ── Seguimiento por cliente (vista) ──────────────────────────────────────────
export const fetchClientFollowup = async (tenantId) => {
  if (!tenantId || !supabase) return [];
  const { data, error } = await supabase
    .from("client_followup_summary")
    .select("client_id, name, company, pendientes, completadas, ultima_actividad")
    .eq("tenant_id", tenantId)
    .order("pendientes", { ascending: false })
    .order("ultima_actividad", { ascending: true, nullsFirst: true });
  if (error) throw error;
  return data || [];
};
