import { useEffect, useMemo, useState } from "react";
import StorageImage from "../StorageImage";
import { buildPlaceholderUrl, formatWeight, imageUrlForSize, shortText } from "../../utils/formatters";
import { normalizeText } from "../../utils/textNormalizer";

const STATUS_OPTIONS = ["Sobre pedido", "En stock", "Baja"];
const PAGE_SIZE = 80;

const validationStorageKey = (tenantId) => `catalogo-b2b-validation-v1:${tenantId || "sin-tenant"}`;

const readValidationState = (tenantId) => {
  try {
    const raw = localStorage.getItem(validationStorageKey(tenantId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeValidationState = (tenantId, state) => {
  localStorage.setItem(validationStorageKey(tenantId), JSON.stringify(state || {}));
};

const normalizeStatusForValidation = (status) => {
  const value = normalizeText(status);
  if (["baja", "inactivo", "inactive", "discontinued"].includes(value)) return "Baja";
  if (["en stock", "stock", "activo", "alta", "vigente"].includes(value)) return "En stock";
  return "Sobre pedido";
};

const baseDraftForProduct = (product, saved = {}) => ({
  codigo: product.codigo,
  pesoPromedio: product.pesoPromedio || "",
  familia: product.familia || "",
  estatus: normalizeStatusForValidation(product.estatus),
  ubicacionFisica: saved.ubicacionFisica || "",
  pesoValidado: Boolean(saved.pesoValidado),
  fotoValidada: Boolean(saved.fotoValidada),
  familiaValidada: Boolean(saved.familiaValidada),
  ubicacionValidada: Boolean(saved.ubicacionValidada),
  updatedAt: saved.updatedAt || "",
});

export default function ValidationTab({ products = [], tenantId = "", onSaveProduct, notifyAction }) {
  const [query, setQuery] = useState("");
  const [validationByCode, setValidationByCode] = useState({});
  const [drafts, setDrafts] = useState({});
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [savingCode, setSavingCode] = useState("");

  useEffect(() => {
    const saved = readValidationState(tenantId);
    setValidationByCode(saved);
    setDrafts({});
    setLimit(PAGE_SIZE);
  }, [tenantId]);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [query]);

  const productByCode = useMemo(() => new Map(products.map((product) => [product.codigo, product])), [products]);

  const getDraft = (product) => drafts[product.codigo] || baseDraftForProduct(product, validationByCode[product.codigo]);

  const stats = useMemo(() => {
    const total = products.length;
    let withWeight = 0;
    let withPhoto = 0;
    let withFamily = 0;
    let complete = 0;

    for (const product of products) {
      const saved = validationByCode[product.codigo] || {};
      const hasWeight = Number(product.pesoPromedio || 0) > 0;
      const hasPhoto = Boolean(product.fotoUrl);
      const hasFamily = Boolean(String(product.familia || "").trim());
      if (hasWeight) withWeight += 1;
      if (hasPhoto) withPhoto += 1;
      if (hasFamily) withFamily += 1;
      if (saved.pesoValidado && saved.fotoValidada && saved.familiaValidada && saved.ubicacionValidada) complete += 1;
    }

    return {
      total,
      withWeight,
      withPhoto,
      withFamily,
      complete,
      percent: total ? Math.round((complete / total) * 100) : 0,
    };
  }, [products, validationByCode]);

  const filteredProducts = useMemo(() => {
    const term = normalizeText(query);
    if (!term) return products;
    return products.filter((product) =>
      normalizeText([product.codigo, product.descripcion, product.linea, product.familia, product.grupo, product.proveedor].join(" ")).includes(term)
    );
  }, [products, query]);

  const visibleProducts = filteredProducts.slice(0, limit);

  const updateDraft = (codigo, patch) => {
    const product = productByCode.get(codigo);
    if (!product) return;
    setDrafts((current) => ({
      ...current,
      [codigo]: {
        ...baseDraftForProduct(product, validationByCode[codigo]),
        ...current[codigo],
        ...patch,
      },
    }));
  };

  const saveValidation = async (codigo) => {
    const product = productByCode.get(codigo);
    if (!product || !onSaveProduct) return;
    const draft = getDraft(product);
    setSavingCode(codigo);
    try {
      await onSaveProduct({
        ...product,
        pesoPromedio: Number(draft.pesoPromedio || 0),
        familia: draft.familia || "",
        estatus: draft.estatus || "Sobre pedido",
      });
      const nextValidation = {
        ...validationByCode,
        [codigo]: {
          ubicacionFisica: draft.ubicacionFisica || "",
          pesoValidado: Boolean(draft.pesoValidado),
          fotoValidada: Boolean(draft.fotoValidada),
          familiaValidada: Boolean(draft.familiaValidada),
          ubicacionValidada: Boolean(draft.ubicacionValidada),
          updatedAt: new Date().toISOString(),
        },
      };
      setValidationByCode(nextValidation);
      writeValidationState(tenantId, nextValidation);
      setDrafts((current) => {
        const next = { ...current };
        delete next[codigo];
        return next;
      });
      notifyAction?.("success", "Validacion guardada", `SKU ${codigo} actualizado.`);
    } catch (error) {
      notifyAction?.("error", "No se pudo guardar", error.message);
    } finally {
      setSavingCode("");
    }
  };

  return (
    <section className="admin-workspace validation-workspace">
      <div className="validation-header admin-soft-panel">
        <div>
          <span className="tool-eyebrow">Validacion de informacion</span>
          <h2>Validacion de codigos</h2>
          <p className="muted">
            Revisa peso, foto, familia y ubicacion fisica por SKU. Esta version es provisional para operar en staging.
          </p>
        </div>
        <div className="validation-progress">
          <strong>{stats.percent}%</strong>
          <span>avance validado</span>
        </div>
      </div>

      <div className="validation-metrics">
        <div><span>Codigos</span><strong>{stats.total.toLocaleString()}</strong></div>
        <div><span>Con peso</span><strong>{stats.withWeight.toLocaleString()}</strong></div>
        <div><span>Con foto</span><strong>{stats.withPhoto.toLocaleString()}</strong></div>
        <div><span>Con familia</span><strong>{stats.withFamily.toLocaleString()}</strong></div>
        <div><span>Completos</span><strong>{stats.complete.toLocaleString()}</strong></div>
      </div>

      <div className="validation-toolbar admin-soft-panel">
        <label>
          Buscar SKU
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Codigo, descripcion, linea, familia o proveedor"
          />
        </label>
        <span>{filteredProducts.length.toLocaleString()} resultados</span>
      </div>

      <div className="validation-list">
        {visibleProducts.map((product) => {
          const draft = getDraft(product);
          const hasPhoto = Boolean(product.fotoUrl);
          return (
            <article className="validation-row admin-soft-panel" key={product.id || product.codigo}>
              <div className="validation-product">
                <div className="validation-thumb">
                  <StorageImage
                    src={product.fotoUrl}
                    width={220}
                    fallback={imageUrlForSize(product.fotoUrl, 220) || buildPlaceholderUrl("Sin foto")}
                    alt={product.descripcion}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div>
                  <strong>{product.codigo}</strong>
                  <p>{shortText(product.descripcion, 86)}</p>
                  <small>{[product.linea, product.grupo, product.proveedor].filter(Boolean).join(" / ") || "Sin clasificacion extra"}</small>
                </div>
              </div>

              <div className="validation-fields">
                <label>
                  Peso
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.pesoPromedio}
                    onChange={(event) => updateDraft(product.codigo, { pesoPromedio: event.target.value })}
                    placeholder={formatWeight(product.pesoPromedio)}
                  />
                </label>
                <label>
                  Familia
                  <input
                    value={draft.familia}
                    onChange={(event) => updateDraft(product.codigo, { familia: event.target.value })}
                    placeholder="Familia"
                  />
                </label>
                <label>
                  Ubicacion fisica
                  <input
                    value={draft.ubicacionFisica}
                    onChange={(event) => updateDraft(product.codigo, { ubicacionFisica: event.target.value })}
                    placeholder="Ej. Charola 12, vitrina A"
                  />
                </label>
                <label>
                  Estatus
                  <select value={draft.estatus} onChange={(event) => updateDraft(product.codigo, { estatus: event.target.value })}>
                    {STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </label>
              </div>

              <div className="validation-checks">
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={draft.pesoValidado}
                    onChange={(event) => updateDraft(product.codigo, { pesoValidado: event.target.checked })}
                  />
                  Peso validado
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={draft.fotoValidada}
                    disabled={!hasPhoto}
                    onChange={(event) => updateDraft(product.codigo, { fotoValidada: event.target.checked })}
                  />
                  Foto validada
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={draft.familiaValidada}
                    onChange={(event) => updateDraft(product.codigo, { familiaValidada: event.target.checked })}
                  />
                  Familia validada
                </label>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={draft.ubicacionValidada}
                    onChange={(event) => updateDraft(product.codigo, { ubicacionValidada: event.target.checked })}
                  />
                  Ubicacion validada
                </label>
              </div>

              <div className="validation-actions">
                <button
                  className="primary-button compact-action"
                  type="button"
                  onClick={() => saveValidation(product.codigo)}
                  disabled={savingCode === product.codigo}
                >
                  {savingCode === product.codigo ? "Guardando" : "Guardar"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {filteredProducts.length > visibleProducts.length ? (
        <div className="load-more-row">
          <button className="secondary-button compact-action" type="button" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
            Mostrar mas ({visibleProducts.length.toLocaleString()} de {filteredProducts.length.toLocaleString()})
          </button>
        </div>
      ) : null}
    </section>
  );
}
