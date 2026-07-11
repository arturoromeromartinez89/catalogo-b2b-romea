import ProductCard from "./ProductCard";
import { useLanguage } from "../i18n/LanguageContext";

export default function ProductGrid({ products, onAdd, onOpenDetail, showPrice = true }) {
  const { t } = useLanguage();

  if (!products.length) {
    return (
      <div className="empty-state">
        <h2>{t("noProducts")}</h2>
        <p>{t("noProductsHelp")}</p>
      </div>
    );
  }

  return (
    <section className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.codigo} product={product} onAdd={onAdd} onOpenDetail={onOpenDetail} showPrice={showPrice} />
      ))}
    </section>
  );
}
