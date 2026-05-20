import { supabase } from "../lib/supabaseClient";

const IMAGE_BUCKET = "company-assets";
const CONCURRENCY = 5;

const normalizeCode = (value) =>
  String(value || "")
    .replace(/\.[^.]+$/, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

const imageExtension = (fileName) => {
  const ext = String(fileName || "").split(".").pop()?.toLowerCase();
  return ext && ext !== fileName ? ext : "jpg";
};

const safeStorageName = (code) => normalizeCode(code).replace(/[^A-Z0-9._-]/g, "_");

const buildProductMap = (products = []) => {
  const map = new Map();
  products.forEach((product) => {
    const code = normalizeCode(product.codigo);
    if (code && product.id) map.set(code, product);
  });
  return map;
};

const uploadAndUpdateImage = async ({ file, product, tenantId }) => {
  const ext = imageExtension(file.name);
  const code = safeStorageName(product.codigo);
  const owner = tenantId || "global";
  const path = `products/${owner}/${code}.${ext}`;

  const upload = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type || `image/${ext}`,
      upsert: true,
    });

  if (upload.error) throw upload.error;

  const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  let query = supabase
    .from("products")
    .update({ foto_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", product.id);

  if (tenantId) query = query.eq("tenant_id", tenantId);

  const update = await query.select("id,codigo,foto_url").single();
  if (update.error) throw update.error;

  return { code: product.codigo, publicUrl };
};

export const importProductImagesByCode = async ({ files = [], products = [], tenantId = "", onProgress }) => {
  const productMap = buildProductMap(products);
  const imageFiles = Array.from(files).filter((file) => file.type?.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(file.name));
  const summary = {
    totalFiles: imageFiles.length,
    matched: 0,
    uploaded: 0,
    failed: 0,
    unmatched: [],
    errors: [],
  };

  const jobs = imageFiles.map((file) => {
    const fileCode = normalizeCode(file.name);
    const product = productMap.get(fileCode);
    if (!product) {
      summary.unmatched.push(file.name);
      return null;
    }
    summary.matched += 1;
    return { file, product };
  }).filter(Boolean);

  let cursor = 0;
  const totalJobs = jobs.length;

  const worker = async () => {
    while (cursor < totalJobs) {
      const job = jobs[cursor];
      cursor += 1;
      try {
        await uploadAndUpdateImage({ ...job, tenantId });
        summary.uploaded += 1;
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({ file: job.file.name, message: error.message });
      }
      onProgress?.({ ...summary, processed: summary.uploaded + summary.failed, totalJobs });
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, totalJobs) }, worker));
  return summary;
};
