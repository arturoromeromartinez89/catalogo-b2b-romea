const normalizeHost = (host = "") =>
  String(host).toLowerCase().replace(/^www\./, "").split(":")[0];

const PUBLIC_PORTAL_BRANDS = [
  {
    key: "estuches-chavez",
    hosts: [
      "estucheschavez.com.mx",
    ],
    pathPrefix: "/catalogo",
    name: "Estuches Chavez",
    title: "Portal B2B Estuches Chavez",
    tagline: "Catalogo privado para clientes, preordenes y seguimiento comercial.",
    logoUrl: "https://www.estucheschavez.com.mx/imagenes/logo-estuches.png",
    copyright: "Estuches Chavez",
    features: [
      "Catalogo B2B de estuches y exhibidores",
      "Preordenes para clientes autorizados",
      "Productos, precios y disponibilidad en un solo lugar",
      "Seguimiento comercial directo con Estuches Chavez",
    ],
  },
];

export const resolvePublicPortalBrand = ({ hostname = "", pathname = "" } = {}) => {
  const normalizedHost = normalizeHost(hostname);
  const normalizedPath = pathname || "/";
  return PUBLIC_PORTAL_BRANDS.find((brand) =>
    brand.hosts.some((host) => normalizeHost(host) === normalizedHost)
    && (!brand.pathPrefix || normalizedPath.startsWith(brand.pathPrefix))
  ) || null;
};
