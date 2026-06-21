import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_INTERFACE_SETTINGS,
  INTERFACE_THEMES,
  PRODUCT_CARD_BUTTONS,
  PRODUCT_CARD_FIELDS,
  normalizeInterfaceSettings,
  saveInterfaceSettings,
} from "../services/interfaceSettingsService";
import { formatCurrency, formatWeight } from "../utils/formatters";

const previewProduct = {
  codigo: "DEMO-BAS-001",
  descripcion: "Base escalonada de demostracion",
  metal: "Acero",
  kilataje: "",
  pesoPromedio: 1,
  precioMinimo: 420,
  monedaPrecioMin: "MXN",
  manoObra: 0,
  linea: "Exhibicion",
  familia: "Bases",
  grupo: "Base",
};

const fieldValue = (product, key) => {
  if (key === "codigo") return product.codigo;
  if (key === "descripcion") return product.descripcion;
  if (key === "metal") return product.metal;
  if (key === "kilataje") return product.kilataje;
  if (key === "peso") return formatWeight(product.pesoPromedio);
  if (key === "precio") return formatCurrency(product.precioMinimo, product.monedaPrecioMin);
  if (key === "mano_obra") return `MO ${formatCurrency(product.manoObra || 0, product.monedaPrecioMin)}`;
  if (key === "linea") return product.linea;
  if (key === "familia") return product.familia;
  if (key === "grupo") return product.grupo;
  return "";
};

const move = (items, index, direction) => {
  const next = [...items];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

export default function InterfaceCustomizationPanel({
  tenantId = "",
  settings = DEFAULT_INTERFACE_SETTINGS,
  onSaved,
}) {
  const [draft, setDraft] = useState(() => normalizeInterfaceSettings(settings));
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(normalizeInterfaceSettings(settings));
    setStatus("");
  }, [settings]);

  const enabledFields = draft.admin_product_card_config.fields;
  const enabledButtons = draft.admin_product_card_config.buttons;
  const selectedTheme = useMemo(
    () => INTERFACE_THEMES.find((theme) => theme.key === draft.theme_key) || INTERFACE_THEMES[0],
    [draft.theme_key]
  );

  const setTheme = (themeKey) => {
    setDraft((current) => ({ ...current, theme_key: themeKey, hasCustomSettings: true }));
  };

  const toggleField = (fieldKey) => {
    setDraft((current) => {
      const fields = current.admin_product_card_config.fields;
      const nextFields = fields.includes(fieldKey)
        ? fields.filter((key) => key !== fieldKey)
        : [...fields, fieldKey];
      return {
        ...current,
        hasCustomSettings: true,
        admin_product_card_config: {
          ...current.admin_product_card_config,
          fields: nextFields.length ? nextFields : ["codigo"],
        },
      };
    });
  };

  const toggleButton = (buttonKey) => {
    setDraft((current) => {
      const buttons = current.admin_product_card_config.buttons;
      const nextButtons = buttons.includes(buttonKey)
        ? buttons.filter((key) => key !== buttonKey)
        : [...buttons, buttonKey];
      return {
        ...current,
        hasCustomSettings: true,
        admin_product_card_config: {
          ...current.admin_product_card_config,
          buttons: nextButtons,
        },
      };
    });
  };

  const moveField = (index, direction) => {
    setDraft((current) => ({
      ...current,
      hasCustomSettings: true,
      admin_product_card_config: {
        ...current.admin_product_card_config,
        fields: move(current.admin_product_card_config.fields, index, direction),
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus("");
    try {
      const saved = await saveInterfaceSettings(tenantId, draft);
      onSaved?.(saved);
      setStatus("Personalizacion guardada correctamente.");
    } catch (error) {
      setStatus(`Error al guardar personalizacion: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="company-config-card interface-customization-card">
      <header>
        <span aria-hidden="true">□</span>
        <div>
          <h3>Personalizacion</h3>
          <p>Configura el tema y la informacion visible en las tarjetas del catalogo administrador.</p>
        </div>
      </header>

      <div className="interface-customization-grid">
        <div className="interface-customization-controls">
          <section className="interface-setting-block">
            <h4>Tema</h4>
            <div className="theme-choice-grid">
              {INTERFACE_THEMES.map((theme) => (
                <button
                  className={`theme-choice theme-choice--${theme.key}${draft.theme_key === theme.key ? " active" : ""}`}
                  key={theme.key}
                  type="button"
                  onClick={() => setTheme(theme.key)}
                >
                  <span className="theme-choice__swatch" aria-hidden="true" />
                  <strong>{theme.label}</strong>
                  <small>{theme.description}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="interface-setting-block">
            <h4>Campos de tarjeta</h4>
            <div className="field-order-list">
              {enabledFields.map((fieldKey, index) => {
                const field = PRODUCT_CARD_FIELDS.find((item) => item.key === fieldKey);
                if (!field) return null;
                return (
                  <div className="field-order-item" key={fieldKey}>
                    <label>
                      <input type="checkbox" checked onChange={() => toggleField(fieldKey)} />
                      {field.label}
                    </label>
                    <div className="field-order-actions">
                      <button type="button" onClick={() => moveField(index, -1)} disabled={index === 0}>Subir</button>
                      <button type="button" onClick={() => moveField(index, 1)} disabled={index === enabledFields.length - 1}>Bajar</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="field-toggle-grid">
              {PRODUCT_CARD_FIELDS.filter((field) => !enabledFields.includes(field.key)).map((field) => (
                <label key={field.key}>
                  <input type="checkbox" checked={false} onChange={() => toggleField(field.key)} />
                  {field.label}
                </label>
              ))}
            </div>
          </section>

          <section className="interface-setting-block">
            <h4>Botones visibles</h4>
            <div className="field-toggle-grid">
              {PRODUCT_CARD_BUTTONS.map((button) => (
                <label key={button.key}>
                  <input
                    type="checkbox"
                    checked={enabledButtons.includes(button.key)}
                    onChange={() => toggleButton(button.key)}
                  />
                  {button.label}
                </label>
              ))}
            </div>
          </section>
        </div>

        <aside className={`interface-preview admin-theme-${selectedTheme.key}`} aria-label="Vista previa de tarjeta">
          <p className="tool-eyebrow">Vista previa</p>
          <article className="admin-product-card enabled no-photo custom-product-card">
            <div className="admin-product-info custom-product-info">
              {enabledFields.map((fieldKey, index) => {
                const field = PRODUCT_CARD_FIELDS.find((item) => item.key === fieldKey);
                const value = fieldValue(previewProduct, fieldKey);
                if (!field || !value) return null;
                if (index === 0) return <strong key={fieldKey}>{value}</strong>;
                if (index === 1) return <h3 key={fieldKey}>{value}</h3>;
                return (
                  <p className="custom-product-field" key={fieldKey}>
                    <span>{field.label}</span>
                    <strong>{value}</strong>
                  </p>
                );
              })}
            </div>
            <div className="admin-product-actions product-action-layout">
              <div className="product-action-admin">
                {enabledButtons.includes("ver_detalle") ? <button className="secondary-button compact-action" type="button">Ver detalle</button> : null}
                {enabledButtons.includes("editar_producto") ? <button className="secondary-button compact-action" type="button">Editar producto</button> : null}
              </div>
              <div className="product-action-client">
                {enabledButtons.includes("preorden") ? <button className="action-button preorder" type="button">+ pre-orden</button> : null}
                {enabledButtons.includes("catalogo") ? <button className="action-button catalog" type="button">+ catalogo</button> : null}
              </div>
            </div>
          </article>
        </aside>
      </div>

      {status ? <p className="status info">{status}</p> : null}

      <div className="company-save-row">
        <button className="primary-button compact-action" type="button" onClick={handleSave} disabled={saving || !tenantId}>
          {saving ? "Guardando..." : "Guardar personalizacion"}
        </button>
      </div>
    </section>
  );
}
