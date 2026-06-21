import { supabase } from "../lib/supabaseClient";

export const INTERFACE_THEMES = [
  { key: "premium", label: "Premium", description: "Sobrio, oscuro y corporativo." },
  { key: "verde", label: "Verde", description: "Fresco, operativo y amable." },
  { key: "azul", label: "Azul", description: "Limpio, confiable y comercial." },
  { key: "neutro", label: "Neutro", description: "Discreto, claro y universal." },
];

export const PRODUCT_CARD_FIELDS = [
  { key: "codigo", label: "Codigo" },
  { key: "descripcion", label: "Descripcion" },
  { key: "metal", label: "Metal" },
  { key: "kilataje", label: "Kilataje" },
  { key: "peso", label: "Peso" },
  { key: "precio", label: "Precio" },
  { key: "mano_obra", label: "Mano de obra" },
  { key: "linea", label: "Linea" },
  { key: "familia", label: "Familia" },
  { key: "grupo", label: "Grupo" },
];

export const PRODUCT_CARD_BUTTONS = [
  { key: "ver_detalle", label: "Ver detalle" },
  { key: "editar_producto", label: "Editar producto" },
  { key: "preorden", label: "Pre-orden" },
  { key: "catalogo", label: "Catalogo" },
];

const validThemes = new Set(INTERFACE_THEMES.map((theme) => theme.key));
const validFields = new Set(PRODUCT_CARD_FIELDS.map((field) => field.key));
const validButtons = new Set(PRODUCT_CARD_BUTTONS.map((button) => button.key));

export const DEFAULT_ADMIN_PRODUCT_CARD_CONFIG = {
  fields: ["codigo", "descripcion", "metal", "kilataje", "peso", "precio", "mano_obra"],
  buttons: ["ver_detalle", "editar_producto", "preorden", "catalogo"],
};

export const DEFAULT_INTERFACE_SETTINGS = {
  theme_key: "premium",
  admin_product_card_config: DEFAULT_ADMIN_PRODUCT_CARD_CONFIG,
  hasCustomSettings: false,
};

const uniqueValid = (items, validSet, fallback) => {
  const seen = new Set();
  const next = (Array.isArray(items) ? items : [])
    .filter((item) => validSet.has(item) && !seen.has(item) && seen.add(item));
  return next.length ? next : fallback;
};

export const normalizeInterfaceSettings = (settings = null) => {
  const config = settings?.admin_product_card_config || {};
  return {
    ...DEFAULT_INTERFACE_SETTINGS,
    ...settings,
    theme_key: validThemes.has(settings?.theme_key) ? settings.theme_key : DEFAULT_INTERFACE_SETTINGS.theme_key,
    admin_product_card_config: {
      fields: uniqueValid(config.fields, validFields, DEFAULT_ADMIN_PRODUCT_CARD_CONFIG.fields),
      buttons: uniqueValid(config.buttons, validButtons, DEFAULT_ADMIN_PRODUCT_CARD_CONFIG.buttons),
    },
    hasCustomSettings: Boolean(settings?.id || settings?.hasCustomSettings),
  };
};

export const fetchInterfaceSettings = async (tenantId = "") => {
  if (!tenantId) return DEFAULT_INTERFACE_SETTINGS;
  const { data, error } = await supabase
    .from("tenant_interface_settings")
    .select("id, tenant_id, theme_key, admin_product_card_config")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !data) return DEFAULT_INTERFACE_SETTINGS;
  return normalizeInterfaceSettings(data);
};

export const saveInterfaceSettings = async (tenantId, settings) => {
  if (!tenantId) throw new Error("No hay empresa activa para guardar personalizacion.");
  const normalized = normalizeInterfaceSettings({ ...settings, hasCustomSettings: true });
  const row = {
    tenant_id: tenantId,
    theme_key: normalized.theme_key,
    admin_product_card_config: normalized.admin_product_card_config,
  };
  const { data, error } = await supabase
    .from("tenant_interface_settings")
    .upsert(row, { onConflict: "tenant_id" })
    .select("id, tenant_id, theme_key, admin_product_card_config")
    .single();
  if (error) throw error;
  return normalizeInterfaceSettings(data);
};
