export const PURCHASE_STAGES = [
  { id: "proposal", label: "Por aprobar", shortLabel: "Aprobación" },
  { id: "registration", label: "Registro ERP", shortLabel: "Registro" },
  { id: "media", label: "Foto y CEDIS", shortLabel: "Foto" },
  { id: "ready", label: "Listos para publicar", shortLabel: "Listos" },
];

export const CODE_MODES = [
  {
    id: "supplier_equivalent",
    label: "Equivalencia con proveedor",
    help: "El proveedor entrega su número de parte y Vanguardia agrega el prefijo. Ejemplo: DRP257 → RJDRP257.",
  },
  {
    id: "internal_sequence",
    label: "Consecutivo de Vanguardia",
    help: "Compras consulta el consecutivo del proveedor y crea el SKU interno. Ejemplo: JR254.",
  },
  {
    id: "supplier_catalog",
    label: "Catálogo del proveedor",
    help: "Se conserva el número de parte de un catálogo formal, como el de Chrysos.",
  },
];

export const emptyPurchaseIntake = {
  supplierName: "RAJOI",
  supplierPrefix: "RJ",
  supplierPartNumber: "",
  internalSku: "",
  codeMode: "supplier_equivalent",
  description: "",
  metal: "Plata",
  karat: "925",
  supplierCostMxn: "",
  lineCode: "",
  family: "",
  groupName: "",
  weightGrams: "",
  proposalSource: "other",
  proposedByName: "",
  notes: "",
};

const normalizeCodePart = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, "");

export const normalizeLineCode = (value) => {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return raw.toUpperCase();
  return raw.padStart(3, "0");
};

export const suggestLineFromCost = (value) => {
  const cost = Number(value);
  if (!Number.isInteger(cost) || cost < 0 || cost > 999) return "";
  return String(cost).padStart(3, "0");
};

export const suggestInternalSku = ({ codeMode, supplierPrefix, supplierPartNumber, internalSku }) => {
  const current = normalizeCodePart(internalSku);
  if (current) return current;
  const prefix = normalizeCodePart(supplierPrefix);
  const supplierCode = normalizeCodePart(supplierPartNumber);
  if (codeMode === "supplier_equivalent" && prefix && supplierCode) return `${prefix}${supplierCode}`;
  if (codeMode === "internal_sequence" && prefix && supplierCode) return `${prefix}${supplierCode}`;
  if (codeMode === "supplier_catalog" && supplierCode) return supplierCode;
  return "";
};

export const getPurchaseStage = (item) => {
  if (item.status === "published") return "published";
  if (item.status === "rejected") return "rejected";
  if (!item.approvedAt) return "proposal";
  if (!item.erpRegisteredAt) return "registration";
  if (!item.photoUrl || !String(item.cedisLocation || "").trim()) return "media";
  return "ready";
};

export const getPublishRequirements = (item) => [
  { id: "approval", label: "Aprobación de Compras", complete: Boolean(item.approvedAt) },
  { id: "sku", label: "SKU interno", complete: Boolean(String(item.internalSku || "").trim()) },
  { id: "description", label: "Descripción", complete: Boolean(String(item.description || "").trim()) },
  { id: "line", label: "Línea", complete: Boolean(String(item.lineCode || "").trim()) },
  { id: "weight", label: "Peso", complete: Number(item.weightGrams) > 0 },
  { id: "erp", label: "Registro en ERP", complete: Boolean(item.erpRegisteredAt) },
  { id: "photo", label: "Fotografía profesional", complete: Boolean(item.photoUrl) },
  { id: "location", label: "Ubicación CEDIS", complete: Boolean(String(item.cedisLocation || "").trim()) },
];

export const getMissingPublishRequirements = (item) =>
  getPublishRequirements(item).filter((requirement) => !requirement.complete);

export const canPublishPurchase = (item) => getMissingPublishRequirements(item).length === 0;

export const purchaseItemSearchText = (item) => [
  item.internalSku,
  item.supplierPartNumber,
  item.description,
  item.supplierName,
  item.lineCode,
  item.family,
  item.groupName,
].join(" ").toLocaleLowerCase("es");

export const mapPurchaseIntakeFromDb = (row) => ({
  id: row.id,
  tenantId: row.tenant_id,
  productId: row.product_id,
  supplierName: row.supplier_name || "",
  supplierPrefix: row.supplier_prefix || "",
  supplierPartNumber: row.supplier_part_number || "",
  internalSku: row.internal_sku || "",
  codeMode: row.code_mode || "internal_sequence",
  description: row.description || "",
  metal: row.metal || "",
  karat: row.karat || "",
  supplierCostMxn: row.supplier_cost_mxn ?? "",
  lineCode: row.line_code || "",
  family: row.family || "",
  groupName: row.group_name || "",
  weightGrams: row.weight_grams ?? "",
  proposalSource: row.proposal_source || "other",
  proposedByName: row.proposed_by_name || "",
  notes: row.notes || "",
  status: row.status || "proposal",
  approvedAt: row.approved_at || "",
  approvedBy: row.approved_by || "",
  erpRegisteredAt: row.erp_registered_at || "",
  photoUrl: row.photo_url || "",
  photoStoragePath: row.photo_storage_path || "",
  photoCompletedAt: row.photo_completed_at || "",
  cedisLocation: row.cedis_location || "",
  cedisLocationAt: row.cedis_location_at || "",
  publishedAt: row.published_at || "",
  createdAt: row.created_at || "",
  updatedAt: row.updated_at || "",
});

export const mapPurchaseIntakeToDb = (item, tenantId) => ({
  tenant_id: tenantId,
  supplier_name: String(item.supplierName || "").trim(),
  supplier_prefix: normalizeCodePart(item.supplierPrefix),
  supplier_part_number: normalizeCodePart(item.supplierPartNumber),
  internal_sku: suggestInternalSku(item),
  code_mode: item.codeMode || "internal_sequence",
  description: String(item.description || "").trim().toUpperCase(),
  metal: String(item.metal || "").trim(),
  karat: String(item.karat || "").trim(),
  supplier_cost_mxn: item.supplierCostMxn === "" ? null : Number(item.supplierCostMxn),
  line_code: normalizeLineCode(item.lineCode),
  family: String(item.family || "").trim().toUpperCase(),
  group_name: String(item.groupName || "").trim().toUpperCase(),
  weight_grams: item.weightGrams === "" ? null : Number(item.weightGrams),
  proposal_source: item.proposalSource || "other",
  proposed_by_name: String(item.proposedByName || "").trim(),
  notes: String(item.notes || "").trim(),
});
