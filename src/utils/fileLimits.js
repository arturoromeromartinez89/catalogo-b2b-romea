export const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024;
export const MAX_SPREADSHEET_ROWS = 10000;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_BATCH = 1000;

export const validateSpreadsheetFile = (file) => {
  if (!file) throw new Error("Selecciona un archivo Excel.");
  if (file.size > MAX_SPREADSHEET_BYTES) {
    throw new Error("El archivo excede el limite de 10 MB.");
  }
  if (!/\.(xlsx|xls)$/i.test(file.name || "")) {
    throw new Error("Solo se permiten archivos .xlsx o .xls.");
  }
};

export const validateImageFile = (file) => {
  if (!file) throw new Error("Selecciona una imagen.");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("La imagen excede el limite de 8 MB.");
  const validExtension = /\.(jpe?g|png|webp)$/i.test(file.name || "");
  const validType = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
  if (!validExtension || (file.type && !validType)) {
    throw new Error("Solo se permiten imagenes JPG, PNG o WebP.");
  }
};

export const validateSpreadsheetRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("El archivo no contiene filas.");
  if (rows.length > MAX_SPREADSHEET_ROWS) {
    throw new Error(`El archivo excede el limite de ${MAX_SPREADSHEET_ROWS.toLocaleString()} filas.`);
  }
};
