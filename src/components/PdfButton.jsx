import { generatePdf } from "../utils/pdfGenerator";
import { useLanguage } from "../i18n/LanguageContext";
import { useCompany } from "../contexts/CompanyContext";

export default function PdfButton({ cartItems, customer, company: companyOverride = null }) {
  const { language, t } = useLanguage();
  const contextCompany = useCompany();
  const company = companyOverride || contextCompany;

  const handleClick = async () => {
    if (!cartItems.length) {
      window.alert(t("addProductsBeforePdf"));
      return;
    }
    if (!customer.name && !customer.company) {
      const ok = window.confirm(t("customerWarning"));
      if (!ok) return;
    }
    await generatePdf(cartItems, customer, language, company);
  };

  return (
    <button className="primary-button full" type="button" onClick={handleClick}>
      {t("generatePdf")}
    </button>
  );
}
