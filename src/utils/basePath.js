const basePath = import.meta.env.BASE_URL || "/";

export const withBasePath = (path = "") => {
  const relativePath = String(path).replace(/^\/+/, "");
  return `${basePath}${relativePath}`;
};

export const getAppPathname = (pathname = window.location.pathname) => {
  const baseWithoutSlash = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  if (!baseWithoutSlash) return pathname || "/";
  if (pathname === baseWithoutSlash) return "/";
  if (pathname.startsWith(`${baseWithoutSlash}/`)) {
    return pathname.slice(baseWithoutSlash.length) || "/";
  }
  return pathname || "/";
};

export const getAppUrl = (path = "") => new URL(withBasePath(path), window.location.origin).toString();
