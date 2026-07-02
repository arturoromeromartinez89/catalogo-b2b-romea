import { useCompany } from "../contexts/CompanyContext";

export default function BrandLogo({ size = "md", company: companyOverride = null }) {
  const contextCompany = useCompany();
  const company = companyOverride || contextCompany || {};
  const alt = company.brand_name || company.legal_name || "Logo de empresa";
  const logoSize = {
    sm: { maxHeight: 36, maxWidth: 120 },
    md: { maxHeight: 82, maxWidth: 190 },
    lg: { maxHeight: 98, maxWidth: 170, width: 150 },
  }[size] || { maxHeight: 82, maxWidth: 190 };

  if (company.logo_url) {
    return (
      <img
        src={company.logo_url}
        alt={alt}
        style={{
          maxHeight: logoSize.maxHeight,
          maxWidth: logoSize.maxWidth,
          objectFit: "contain",
          width: logoSize.width ? `${logoSize.width}px` : "auto",
        }}
      />
    );
  }

  return <div className={`brand-logo-placeholder ${size}`} aria-label="Logo no cargado" />;
}
