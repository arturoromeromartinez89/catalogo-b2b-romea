export const preorderSavedAt = (preorder = {}) =>
  preorder.updated_at || preorder.updatedAt || preorder.created_at || preorder.createdAt || "";

export const sortPreordersByLastSaved = (preorders = []) =>
  [...preorders].sort((a, b) => {
    const bTime = new Date(preorderSavedAt(b) || 0).getTime() || 0;
    const aTime = new Date(preorderSavedAt(a) || 0).getTime() || 0;
    if (bTime !== aTime) return bTime - aTime;
    return String(b.folio || "").localeCompare(String(a.folio || ""));
  });
