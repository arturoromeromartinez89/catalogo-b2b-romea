import { useCompany } from "../contexts/CompanyContext";

export default function BrandLogo({ size = "md" }) {
  const company = useCompany();
  const name = company.brand_name || "Mi Catálogo";

  if (company.logo_url) {
    return (
      <img
        src={company.logo_url}
        alt={name}
        style={{
          maxHeight: size === "sm" ? 36 : 56,
          maxWidth: size === "sm" ? 120 : 200,
          objectFit: "contain",
        }}
      />
    );
  }

  return (
    <div className="brand-fallback">
      <strong>{name}</strong>
    </div>
  );
}
