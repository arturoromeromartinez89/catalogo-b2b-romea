import { useCompany } from "../contexts/CompanyContext";

export default function BrandLogo({ size = "md", company: companyOverride = null }) {
  const contextCompany = useCompany();
  const company = companyOverride || contextCompany || {};
  const alt = company.brand_name || company.legal_name || "Logo de empresa";

  if (company.logo_url) {
    return (
      <img
        src={company.logo_url}
        alt={alt}
        style={{
          maxHeight: size === "sm" ? 36 : 82,
          maxWidth: size === "sm" ? 120 : 190,
          objectFit: "contain",
        }}
      />
    );
  }

  return <div className={`brand-logo-placeholder ${size}`} aria-label="Logo no cargado" />;
}
