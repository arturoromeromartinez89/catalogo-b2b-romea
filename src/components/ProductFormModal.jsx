import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

const fields = [
  ["codigo", { es: ["Código", "Ej. AN-1001. Debe ser único."], en: ["Code", "Ex. AN-1001. Must be unique."] }],
  ["modelo", { es: ["Modelo", "Nombre comercial o modelo interno."], en: ["Model", "Commercial name or internal model."] }],
  ["descripcion", { es: ["Descripción", "Ej. Anillo de caballero con piedra negra."], en: ["Description", "Ex. Men's ring with black stone."] }],
  ["metal", { es: ["Metal", "Ej. Plata, Oro, Acero."], en: ["Metal", "Ex. Silver, Gold, Steel."] }],
  ["kilataje", { es: ["Kilataje", "Ej. 925, 10K, 14K, 18K."], en: ["Karat", "Ex. 925, 10K, 14K, 18K."] }],
  ["linea", { es: ["Línea", "Ej. Dama, Caballero, Infantil."], en: ["Line", "Ex. Women, Men, Kids."] }],
  ["familia", { es: ["Familia", "Ej. Anillos, Aretes, Dijes."], en: ["Family", "Ex. Rings, Earrings, Pendants."] }],
  ["grupo", { es: ["Grupo", "Ej. Liso, Diamantado, Zirconia."], en: ["Group", "Ex. Plain, Diamond cut, Zirconia."] }],
  ["genero", { es: ["Género", "Ej. Mujer, Hombre, Infantil, Unisex."], en: ["Gender", "Ex. Women, Men, Kids, Unisex."] }],
  ["acabado", { es: ["Acabado", "Ej. Liso, Diamantado, Rodio."], en: ["Finish", "Ex. Plain, Diamond cut, Rhodium."] }],
  ["piedra", { es: ["Piedra", "Ej. Sin piedra, Zirconia, Perla."], en: ["Stone", "Ex. No stone, Zirconia, Pearl."] }],
  ["medida", { es: ["Medida", "Ej. 7, Chico, Mediana."], en: ["Size", "Ex. 7, Small, Medium."] }],
  ["pesoPromedio", { es: ["Peso promedio", "Captura gramos como número. Ej. 3.25"], en: ["Average weight", "Enter grams as a number. Ex. 3.25"] }],
  ["unidadVenta", { es: ["Unidad venta", "Ej. Pieza, Par, Juego."], en: ["Sales unit", "Ex. Piece, Pair, Set."] }],
  ["claveVenta", { es: ["Clave venta", "Ej. PZA, PAR."], en: ["Sales key", "Ex. PZA, PAR."] }],
  ["precioMinimo", { es: ["Precio mínimo", "Número sin símbolos. Ej. 1290"], en: ["Minimum price", "Number without symbols. Ex. 1290"] }],
  ["manoObra", { es: ["Mano de obra", "Precio de mano de obra. Ej. 150"], en: ["Labor price", "Labor price. Ex. 150"] }],
  ["monedaPrecioMin", { es: ["Moneda", "Ej. MXN o USD."], en: ["Currency", "Ex. MXN or USD."] }],
  ["fotoUrl", { es: ["Foto URL", "Liga directa a la imagen del producto."], en: ["Photo URL", "Direct link to the product image."] }],
  ["fotoUrl2", { es: ["Foto URL 2", "Imagen adicional opcional."], en: ["Photo URL 2", "Optional additional image."] }],
  ["fotoUrl3", { es: ["Foto URL 3", "Imagen adicional opcional."], en: ["Photo URL 3", "Optional additional image."] }],
  ["ordenWeb", { es: ["Orden web", "Número para ordenar el catálogo."], en: ["Web order", "Number used to sort the catalog."] }],
  ["tagsBusqueda", { es: ["Tags búsqueda", "anillo caballero piedra negra plata 925."], en: ["Search tags", "ring men black stone silver 925."] }],
];

const emptyProduct = {
  codigo: "",
  modelo: "",
  descripcion: "",
  metal: "",
  kilataje: "",
  linea: "",
  familia: "",
  grupo: "",
  genero: "",
  acabado: "",
  piedra: "",
  medida: "",
  estatus: "Activo",
  pesoPromedio: 0,
  unidadVenta: "Pieza",
  claveVenta: "PZA",
  precioMinimo: 0,
  manoObra: 0,
  monedaPrecioMin: "MXN",
  fotoUrl: "",
  fotoUrl2: "",
  fotoUrl3: "",
  visibleWeb: true,
  ordenWeb: 0,
  tagsBusqueda: "",
};

export default function ProductFormModal({ product, mode, products, onSave, onDelete, onClose }) {
  const { t, language } = useLanguage();
  const [form, setForm] = useState(emptyProduct);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    if (!product) {
      setForm(emptyProduct);
      return;
    }
    setForm({
      ...emptyProduct,
      ...product,
      codigo: mode === "duplicate" ? `${product.codigo}-COPIA` : product.codigo,
      descripcion: product.descripcion || "",
    });
  }, [product, mode]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const validate = () => {
    const code = form.codigo.trim();
    if (!code) return t("requiredCode");
    if (!form.descripcion.trim()) return t("requiredDescription");
    const editableOriginal = mode === "edit" ? product?.codigo : "";
    const duplicate = products.some((item) => item.codigo === code && item.codigo !== editableOriginal);
    if (duplicate) return t("duplicatedCode");
    if (Number.isNaN(Number(form.pesoPromedio))) return t("numericWeight");
    if (Number.isNaN(Number(form.precioMinimo))) return t("numericPrice");
    if (Number.isNaN(Number(form.manoObra))) return t("numericPrice");
    return "";
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    onSave({
      ...form,
      codigo: form.codigo.trim(),
      descripcion: form.descripcion.trim(),
      pesoPromedio: Number(form.pesoPromedio || 0),
      precioMinimo: Number(form.precioMinimo || 0),
      manoObra: Number(form.manoObra || 0),
      ordenWeb: Number(form.ordenWeb || 0),
      visibleWeb: Boolean(form.visibleWeb),
    });
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="product-modal" role="dialog" aria-modal="true" aria-label={t("newProduct")}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{t("productFormEyebrow")}</p>
            <h2>{mode === "edit" ? t("editProduct") : mode === "duplicate" ? t("duplicateProduct") : t("newProduct")}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t("closeForm")}>×</button>
        </div>
        <form className="product-form" onSubmit={handleSubmit}>
          <label className="check-row">
            <input type="checkbox" checked={form.visibleWeb} onChange={(event) => update("visibleWeb", event.target.checked)} />
            {t("visibleCatalog")}
          </label>
          <label>
            {t("status")}
            <select value={form.estatus} onChange={(event) => update("estatus", event.target.value)}>
              <option>{t("active")}</option>
              <option>{t("lowStatus")}</option>
            </select>
          </label>
          {fields.map(([key, labels]) => {
            const [label, help] = labels[language] || labels.es;
            return (
              <label key={key}>
                {label}
                <input value={form[key] ?? ""} onChange={(event) => update(key, event.target.value)} placeholder={help} />
                <small>{help}</small>
              </label>
            );
          })}
          {error ? <p className="status error wide">{error}</p> : null}
          <div className="modal-actions">
            {mode === "edit" && product ? (
              <button className="danger-button" type="button" onClick={() => onDelete(product.codigo)}>{t("deleteProduct")}</button>
            ) : null}
            <button className="secondary-button" type="button" onClick={onClose}>{t("cancel")}</button>
            <button className="primary-button" type="submit">{t("saveProduct")}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
