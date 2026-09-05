import { supabase } from "../lib/supabaseClient";
import { mapPurchaseIntakeFromDb, mapPurchaseIntakeToDb } from "../utils/purchasingWorkflow";
import { requireTenantId } from "./tenantUtils";

const IMAGE_BUCKET = "company-assets";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

const throwIfError = ({ error }) => {
  if (error) throw error;
};

const safeSegment = (value) => String(value || "item").trim().toUpperCase().replace(/[^A-Z0-9._-]/g, "_");

export const fetchPurchaseIntakes = async (tenantId) => {
  const resolvedTenantId = requireTenantId(tenantId, "consultar Compras");
  const result = await supabase
    .from("purchase_product_intakes")
    .select("*")
    .eq("tenant_id", resolvedTenantId)
    .order("created_at", { ascending: false });
  throwIfError(result);
  return (result.data || []).map(mapPurchaseIntakeFromDb);
};

export const savePurchaseIntake = async (item, tenantId) => {
  const resolvedTenantId = requireTenantId(tenantId, "guardar el producto nuevo");
  const payload = mapPurchaseIntakeToDb(item, resolvedTenantId);
  const query = item.id
    ? supabase.from("purchase_product_intakes").update(payload).eq("id", item.id).eq("tenant_id", resolvedTenantId)
    : supabase.from("purchase_product_intakes").insert(payload);
  const result = await query.select("*").single();
  throwIfError(result);
  return mapPurchaseIntakeFromDb(result.data);
};

const runAction = async (name, intakeId) => {
  const result = await supabase.rpc(name, { p_intake_id: intakeId });
  throwIfError(result);
  return result.data ? mapPurchaseIntakeFromDb(result.data) : null;
};

export const approvePurchaseIntake = (intakeId) => runAction("approve_purchase_intake", intakeId);
export const confirmPurchaseErpRegistration = (intakeId) => runAction("confirm_purchase_erp_registration", intakeId);
export const publishPurchaseIntake = (intakeId) => runAction("publish_purchase_intake", intakeId);

export const completePurchaseMedia = async ({ intakeId, location, photoUrl = "", photoStoragePath = "" }) => {
  const result = await supabase.rpc("complete_purchase_media", {
    p_intake_id: intakeId,
    p_cedis_location: String(location || "").trim(),
    p_photo_url: photoUrl || null,
    p_photo_storage_path: photoStoragePath || null,
  });
  throwIfError(result);
  return mapPurchaseIntakeFromDb(result.data);
};

export const uploadPurchasePhoto = async ({ intake, file, tenantId }) => {
  const resolvedTenantId = requireTenantId(tenantId, "subir la fotografía");
  if (!file?.type?.startsWith("image/")) throw new Error("Selecciona una imagen JPG, PNG o WebP.");
  if (file.size > 10 * 1024 * 1024) throw new Error("La fotografía no puede pesar más de 10 MB.");

  const extension = String(file.name || "photo.jpg").split(".").pop()?.toLowerCase() || "jpg";
  const sku = safeSegment(intake.internalSku || intake.supplierPartNumber || intake.id);
  const path = `${resolvedTenantId}/purchasing/${intake.id}/${sku}.${extension}`;
  const upload = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: true,
  });
  throwIfError(upload);

  const signed = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  throwIfError(signed);
  return { photoUrl: signed.data.signedUrl, photoStoragePath: path };
};

