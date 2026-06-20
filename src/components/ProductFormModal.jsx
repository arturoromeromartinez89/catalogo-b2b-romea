import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { normalizeText } from "../utils/textNormalizer";

const labels = {
  codigo: { es: ["Codigo", "Ej. AN-1001. Debe ser unico."], en: ["Code", "Ex. AN-1001. Must be unique."] },
  modelo: { es: ["Modelo", "Nombre comercial o modelo interno."], en: ["Model", "Commercial name or internal model."] },
  descripcion: { es: ["Descripcion", "Ej. Vitrina cristal chica o anillo caballero."], en: ["Description", "Ex. Small glass display case or men's ring."] },
  metal: { es: ["Material / metal", "Ej. Acrilico, madera, plata, oro, acero."], en: ["Material / metal", "Ex. Acrylic, wood, silver, gold, steel."] },
  kilataje: { es: ["Variante / kilataje", "Ej. Chico, grande, 925, 10K, 14K."], en: ["Variant / karat", "Ex. Small, large, 925, 10K, 14K."] },
  linea: { es: ["Linea / coleccion", "Ej. Mostrador, temporada, dama."], en: ["Line / collection", "Ex. Countertop, season, women."] },
  familia: { es: ["Categoria / familia", "Ej. Vitrinas, bases, anillos, aretes."], en: ["Category / family", "Ex. Display cases, bases, rings, earrings."] },
  grupo: { es: ["Subcategoria / grupo", "Ej. Muro, mostrador, liso, zirconia."], en: ["Subcategory / group", "Ex. Wall, countertop, plain, zirconia."] },
  genero: { es: ["Genero", "Ej. Mujer, Hombre, Infantil, Unisex."], en: ["Gender", "Ex. Women, Men, Kids, Unisex."] },
  acabado: { es: ["Acabado", "Ej. Liso, Diamantado, Rodio."], en: ["Finish", "Ex. Plain, Diamond cut, Rhodium."] },
  piedra: { es: ["Piedra", "Ej. Sin piedra, Zirconia, Perla."], en: ["Stone", "Ex. No stone, Zirconia, Pearl."] },
  medida: { es: ["Medida", "Ej. 7, Chico, Mediana."], en: ["Size", "Ex. 7, Small, Medium."] },
  pesoPromedio: { es: ["Peso promedio", "Captura gramos como numero. Ej. 3.25"], en: ["Average weight", "Enter grams as a number. Ex. 3.25"] },
  unidadVenta: { es: ["Unidad venta", "Ej. Pieza, Par, Juego."], en: ["Sales unit", "Ex. Piece, Pair, Set."] },
  claveVenta: { es: ["Clave venta", "Ej. PZA, PAR."], en: ["Sales key", "Ex. PZA, PAR."] },
  precioMinimo: { es: ["Precio minimo", "Numero sin simbolos. Ej. 1290"], en: ["Minimum price", "Number without symbols. Ex. 1290"] },
  manoObra: { es: ["Mano de obra", "Precio de mano de obra. Ej. 150"], en: ["Labor price", "Labor price. Ex. 150"] },
  monedaPrecioMin: { es: ["Moneda", "Ej. MXN o USD."], en: ["Currency", "Ex. MXN or USD."] },
  fotoUrl: { es: ["Foto URL", "Liga directa a la imagen del producto."], en: ["Photo URL", "Direct link to the product image."] },
  fotoUrl2: { es: ["Foto URL 2", "Imagen adicional opcional."], en: ["Photo URL 2", "Optional additional image."] },
  fotoUrl3: { es: ["Foto URL 3", "Imagen adicional opcional."], en: ["Photo URL 3", "Optional additional image."] },
  ordenWeb: { es: ["Orden web", "Numero para ordenar el catalogo."], en: ["Web order", "Number used to sort the catalog."] },
  tagsBusqueda: { es: ["Tags busqueda", "anillo caballero piedra negra plata 925."], en: ["Search tags", "ring men black stone silver 925."] },
};

const groups = [
  { title: { es: "1. Identificacion", en: "1. Identification" }, className: "product-form-grid two", fields: ["codigo", "descripcion"] },
  { title: { es: "2. Clasificacion", en: "2. Classification" }, className: "product-form-grid three", fields: ["metal", "kilataje", "linea", "familia", "grupo", "genero", "acabado", "piedra", "medida"] },
  { title: { es: "3. Dimensiones y precio", en: "3. Weight and pricing" }, className: "product-form-grid three", fields: ["pesoPromedio", "unidadVenta", "claveVenta", "precioMinimo", "manoObra", "monedaPrecioMin"] },
  { title: { es: "4. Imagenes, orden y busqueda", en: "4. Images, order and search" }, className: "product-form-grid two", fields: ["fotoUrl", "fotoUrl2", "fotoUrl3", "ordenWeb", "tagsBusqueda", "modelo"] },
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

  const duplicateCode = useMemo(() => {
    const code = normalizeText(form.codigo);
    const editableOriginal = mode === "edit" ? normalizeText(product?.codigo || "") : "";
    if (!code || code === editableOriginal) return false;
    return products.some((item) => normalizeText(item.codigo) === code);
  }, [form.codigo, mode, product?.codigo, products]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const validate = () => {
    const code = form.codigo.trim();
    if (!code) return t("requiredCode");
    if (!form.descripcion.trim()) return t("requiredDescription");
    if (duplicateCode) return t("duplicatedCode");
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

  const renderInput = (key) => {
    const [label, help] = labels[key]?.[language] || labels[key]?.es || [key, ""];
    return (
      <label key={key}>
        {label}
        <input value={form[key] ?? ""} onChange={(event) => update(key, event.target.value)} placeholder={help} />
        <small>{help}</small>
        {key === "codigo" && duplicateCode ? <small className="inline-error">Este codigo ya existe.</small> : null}
      </label>
    );
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="product-modal" role="dialog" aria-modal="true" aria-label={t("newProduct")}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{t("productFormEyebrow")}</p>
            <h2>{mode === "edit" ? t("editProduct") : mode === "duplicate" ? t("duplicateProduct") : t("newProduct")}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={t("closeForm")}>x</button>
        </div>
        <form className="product-form organized" onSubmit={handleSubmit}>
          <div className="product-form-status-row">
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
          </div>

          {groups.map((group) => (
            <section className="product-form-section" key={group.title.es}>
              <h3>{group.title[language] || group.title.es}</h3>
              <div className={group.className}>{group.fields.map(renderInput)}</div>
            </section>
          ))}

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
