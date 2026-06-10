export const savePdfWithSize = (doc, fileName) => {
  const blob = doc.output("blob");
  const sizeMb = blob.size / (1024 * 1024);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return sizeMb;
};
