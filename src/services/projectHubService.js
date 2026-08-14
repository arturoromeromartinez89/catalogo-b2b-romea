import { supabase } from "../lib/supabaseClient";

const childTables = new Set([
  "project_phases",
  "project_updates",
  "project_deliverables",
  "project_documents",
  "project_approvals",
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
  };
};

const projectSelection = `
  *,
  project_phases(*),
  project_updates(*),
  project_deliverables(*),
  project_documents(*),
  project_approvals(*)
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

export const saveProject = async (project, tenantId, userId = null) => {
  const payload = {
    tenant_id: tenantId,
    name: String(project.name || "").trim(),
    description: String(project.description || "").trim(),
    status: project.status || "draft",
    health: project.health || "green",
    progress_percentage: Math.max(0, Math.min(100, Number(project.progress_percentage || 0))),
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
    if ((key.endsWith("_date") || key.endsWith("_at")) && payload[key] === "") payload[key] = null;
  });
  if (payload.external_url === "") payload.external_url = null;
  if (!payload.id) delete payload.id;
  if (["project_updates", "project_documents"].includes(table) && !payload.id && userId) payload.created_by = userId;
  if (table === "project_approvals" && !payload.id && userId) payload.requested_by = userId;
  const { data, error } = await supabase.from(table).upsert(payload).select("*").single();
  if (error) throw error;
  return data;
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
