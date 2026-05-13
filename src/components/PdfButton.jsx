import { generatePreorderPdf } from "../utils/pdfGenerator";
import { useLanguage } from "../i18n/LanguageContext";

export default function PdfButton({ cartItems, customer }) {
  const { language, t } = useLanguage();
  const handleClick = async () => {
    if (!cartItems.length) {
      window.alert(t("addProductsBeforePdf"));
      return;
    }

    if (!customer.name && !customer.company) {
      const shouldContinue = window.confirm(t("customerWarning"));
      if (!shouldContinue) return;
    }

    await generatePreorderPdf({ cartItems, customer, language });
  };

  return (
    <button className="primary-button full" type="button" onClick={handleClick}>
      {t("generatePdf")}
    </button>
  );
}
