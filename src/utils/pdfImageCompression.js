const MM_PER_INCH = 25.4;

export const imageAlias = (value = "") => {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return `img_${Math.abs(hash)}`;
};

const loadImageElement = (source, timeoutMs = 4000) =>
  new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      finish(null);
    }, timeoutMs);

    img.crossOrigin = "anonymous";
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = source;
  });

const urlToObjectUrl = async (url) => {
  if (!url || String(url).startsWith("data:image/") || String(url).startsWith("blob:")) return "";
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return "";
    return URL.createObjectURL(await response.blob());
  } catch {
    return "";
  }
};

export const compressImageForPdf = async (url, {
  boxWmm = 32,
  boxHmm = 32,
  dpi = 150,
  quality = 0.58,
  timeoutMs = 4000,
  background = "#ffffff",
} = {}) => {
  if (!url) return null;

  let objectUrl = "";
  try {
    objectUrl = await urlToObjectUrl(url);
    const source = objectUrl || url;
    const img = await loadImageElement(source, timeoutMs);
    if (!img) return null;

    const naturalW = img.naturalWidth || img.width || 1;
    const naturalH = img.naturalHeight || img.height || 1;
    const maxW = Math.max(80, Math.ceil((Number(boxWmm) / MM_PER_INCH) * dpi));
    const maxH = Math.max(80, Math.ceil((Number(boxHmm) / MM_PER_INCH) * dpi));
    const ratio = Math.min(maxW / naturalW, maxH / naturalH, 1);
    const width = Math.max(1, Math.round(naturalW * ratio));
    const height = Math.max(1, Math.round(naturalH * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);

    return {
      dataUrl: canvas.toDataURL("image/jpeg", quality),
      width,
      height,
    };
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
};
