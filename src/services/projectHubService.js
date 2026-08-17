import { supabase } from "../lib/supabaseClient";

const childTables = new Set([
  "project_phases",
  "project_updates",
  "project_deliverables",
  "project_documents",
  "project_approvals",
  "project_solutions",
  "project_solution_brief_versions",
  "project_acceptance_criteria",
  "project_time_entries",
  "project_development_activity",
  "project_objectives",
  "project_tasks",
]);

const throwIfError = ({ error }) => {
  if (error) throw error;
};

const sortProjectChildren = (project) => {
  if (!project) return null;
  return {
    ...project,
    project_phases: [...(project.project_phases || [])].sort((a, b) => a.sort_order - b.sort_order),
    project_updates: [...(project.project_updates || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    project_deliverables: [...(project.project_deliverables || [])].sort((a, b) => String(a.estimated_delivery_date || "9999").localeCompare(String(b.estimated_delivery_date || "9999"))),
    project_documents: [...(project.project_documents || [])].sort((a, b) => String(a.document_type).localeCompare(String(b.document_type))),
    project_approvals: [...(project.project_approvals || [])].sort((a, b) => String(a.due_date || "9999").localeCompare(String(b.due_date || "9999"))),
    project_solutions: [...(project.project_solutions || [])]
      .map((solution) => ({
        ...solution,
        project_solution_brief_versions: [...(solution.project_solution_brief_versions || [])].sort((a, b) => Number(b.version_number) - Number(a.version_number)),
      }))
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || String(a.start_date || "9999").localeCompare(String(b.start_date || "9999"))),
    project_solution_brief_versions: [...(project.project_solution_brief_versions || [])].sort((a, b) => Number(b.version_number) - Number(a.version_number)),
    project_acceptance_criteria: [...(project.project_acceptance_criteria || [])].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
    project_time_entries: [...(project.project_time_entries || [])].sort((a, b) => String(b.work_date).localeCompare(String(a.work_date))),
    project_development_activity: [...(project.project_development_activity || [])].sort((a, b) => String(b.activity_date).localeCompare(String(a.activity_date))),
    project_objectives: [...(project.project_objectives || [])].sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || String(a.period_start).localeCompare(String(b.period_start))),
    project_tasks: [...(project.project_tasks || [])]
      .map((task) => ({
        ...task,
        project_task_comments: [...(task.project_task_comments || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
        project_task_attachments: [...(task.project_task_attachments || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      }))
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || String(a.due_date || "9999").localeCompare(String(b.due_date || "9999"))),
  };
};

const projectSelection = `
  *,
  project_phases(*),
  project_updates(*),
  project_deliverables(*),
  project_documents(*),
  project_approvals(*),
  project_solutions(*, project_solution_brief_versions(*)),
  project_solution_brief_versions(*),
  project_acceptance_criteria(*),
  project_time_entries(*),
  project_development_activity(*),
  project_objectives(*),
  project_members(*),
  project_tasks(*, project_task_comments(*), project_task_attachments(*))
`;

export const fetchPublishedProject = async (tenantId) => {
  if (!tenantId) return null;
  const { data, error } = await supabase
    .from("projects")
    .select(projectSelection)
    .eq("tenant_id", tenantId)
    .eq("published", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return sortProjectChildren(data);
};

export const fetchProjectsForTenant = async (tenantId) => {
  if (!tenantId) return [];
  const { data, error } = await supabase
    .from("projects")
    .select(projectSelection)
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(sortProjectChildren);
};

const textList = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
};

export const saveProject = async (project, tenantId, userId = null) => {
  const payload = {
    tenant_id: tenantId,
    name: String(project.name || "").trim(),
    description: String(project.description || "").trim(),
    objective: String(project.objective || "").trim(),
    goal: String(project.goal || "").trim(),
    included_scope: textList(project.included_scope),
    excluded_scope: textList(project.excluded_scope),
    status: project.status || "draft",
    health: project.health || "green",
    // Legacy column retained for compatibility. Client progress is calculated from accepted deliverables.
    progress_percentage: 0,
    current_phase_name: String(project.current_phase_name || "").trim(),
    start_date: project.start_date || null,
    estimated_end_date: project.estimated_end_date || null,
    actual_end_date: project.actual_end_date || null,
    internal_owner_name: String(project.internal_owner_name || "Equipo NEXOR IA").trim(),
    published: Boolean(project.published),
  };
  if (project.id) payload.id = project.id;
  if (!project.id && userId) payload.created_by = userId;
  const { data, error } = await supabase.from("projects").upsert(payload).select("*").single();
  if (error) throw error;
  return data;
};

export const saveProjectChild = async (table, item, tenantId, projectId, userId = null) => {
  if (!childTables.has(table)) throw new Error("Tipo de registro no permitido.");
  const payload = { ...item, tenant_id: tenantId, project_id: projectId };
  delete payload.created_at;
  delete payload.updated_at;
  Object.keys(payload).forEach((key) => {
    if (key.startsWith("project_") && Array.isArray(payload[key])) delete payload[key];
  });
  Object.keys(payload).forEach((key) => {
    if ((key.endsWith("_date") || key.endsWith("_at")) && payload[key] === "") payload[key] = null;
  });
  if (payload.period_start === "") payload.period_start = null;
  if (payload.period_end === "") payload.period_end = null;
  if (payload.objective_id === "") payload.objective_id = null;
  if (payload.phase_id === "") payload.phase_id = null;
  if (payload.solution_id === "") payload.solution_id = null;
  if (payload.deliverable_id === "") payload.deliverable_id = null;
  if (payload.task_id === "") payload.task_id = null;
  if (payload.external_url === "") payload.external_url = null;
  if (payload.summary_pdf_url === "") payload.summary_pdf_url = null;
  if (!payload.id) delete payload.id;
  if (["project_updates", "project_documents"].includes(table) && !payload.id && userId) payload.created_by = userId;
  if (table === "project_approvals" && !payload.id && userId) payload.requested_by = userId;
  if (table === "project_tasks" && !payload.id && userId) payload.created_by = userId;
  if (["project_solution_brief_versions", "project_time_entries", "project_development_activity"].includes(table) && !payload.id && userId) payload.created_by = userId;
  const { data, error } = await supabase.from(table).upsert(payload).select("*").single();
  if (error) throw error;
  return data;
};

// Equipo interno del proyecto. Apunta a public.profiles: no existe un segundo sistema de usuarios.
export const saveProjectMember = async ({ tenantId, projectId, profileId, projectRole = "colaborador", id = null }) => {
  if (!profileId) throw new Error("Selecciona a la persona del equipo.");
  const payload = { tenant_id: tenantId, project_id: projectId, profile_id: profileId, project_role: projectRole, active: true };
  if (id) payload.id = id;
  const { data, error } = await supabase
    .from("project_members")
    .upsert(payload, { onConflict: "project_id,profile_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

export const removeProjectMember = async (memberId) => {
  const { error } = await supabase.from("project_members").delete().eq("id", memberId);
  if (error) throw error;
};

export const deleteProjectChild = async (table, id) => {
  if (!childTables.has(table)) throw new Error("Tipo de registro no permitido.");
  const result = await supabase.from(table).delete().eq("id", id);
  throwIfError(result);
};

export const respondToProjectApproval = async (approvalId, status, comment = "") => {
  const { data, error } = await supabase.rpc("respond_project_approval", {
    p_approval_id: approvalId,
    p_status: status,
    p_comment: comment,
  });
  if (error) throw error;
  return data;
};

export const moveProjectTask = async (taskId, status, sortOrder = 0) => {
  const { data, error } = await supabase.rpc("move_project_task", {
    p_task_id: taskId,
    p_status: status,
    p_sort_order: Number(sortOrder || 0),
  });
  if (error) throw error;
  return data;
};

const currentUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw new Error("Necesitas iniciar sesión para interactuar con esta tarea.");
  return data.user.id;
};

export const addProjectTaskComment = async ({ tenantId, projectId, taskId, body }) => {
  const createdBy = await currentUserId();
  const { data, error } = await supabase
    .from("project_task_comments")
    .insert({
      tenant_id: tenantId,
      project_id: projectId,
      task_id: taskId,
      body: String(body || "").trim(),
      created_by: createdBy,
      visible_to_client: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
};

const safeFileName = (name) => String(name || "archivo")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9._-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 140) || "archivo";

export const uploadProjectTaskAttachment = async ({ tenantId, projectId, taskId, file }) => {
  if (!file) throw new Error("Selecciona un archivo.");
  if (file.size > 26214400) throw new Error("El archivo no puede superar 25 MB.");
  const createdBy = await currentUserId();
  const storagePath = `${tenantId}/${projectId}/${taskId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { data: attachment, error: metadataError } = await supabase
    .from("project_task_attachments")
    .insert({
      tenant_id: tenantId,
      project_id: projectId,
      task_id: taskId,
      file_name: String(file.name || "archivo").slice(0, 240),
      storage_path: storagePath,
      mime_type: file.type || "application/octet-stream",
      file_size: file.size || 0,
      created_by: createdBy,
      visible_to_client: true,
    })
    .select("*")
    .single();
  if (metadataError) throw metadataError;

  const { error: uploadError } = await supabase.storage
    .from("project-hub-files")
    .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (uploadError) {
    await supabase.from("project_task_attachments").delete().eq("id", attachment.id);
    throw uploadError;
  }
  return attachment;
};

export const createTaskAttachmentUrl = async (storagePath) => {
  const { data, error } = await supabase.storage.from("project-hub-files").createSignedUrl(storagePath, 300);
  if (error) throw error;
  return data.signedUrl;
};

export const deleteProjectTaskAttachment = async (attachment) => {
  const { error: storageError } = await supabase.storage.from("project-hub-files").remove([attachment.storage_path]);
  if (storageError) throw storageError;
  const { error } = await supabase.from("project_task_attachments").delete().eq("id", attachment.id);
  if (error) throw error;
};
