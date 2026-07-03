import { supabase } from "../lib/supabaseClient";

const ASSET_BUCKET = "company-assets";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;
const ESTUCHES_CHAVEZ_SITE_URL = "https://www.estucheschavez.com.mx";

export const INTERFACE_THEMES = [
  {
    key: "ejecutivo",
    legacyKey: "premium",
    label: "Ejecutivo",
    description: "Azul profundo, superficie clara y acento verde para operacion diaria.",
  },
  {
    key: "jade",
    legacyKey: "verde",
    label: "Jade",
    description: "Verde sobrio con contrastes azul tinta para comercio y seguimiento.",
  },
  {
    key: "marino",
    legacyKey: "azul",
    label: "Marino",
    description: "Azules limpios con acento turquesa para catalogos extensos.",
  },
  {
    key: "grafito",
    legacyKey: "neutro",
    label: "Grafito",
    description: "Neutros profesionales con acento dorado discreto.",
  },
  {
    key: "vino",
    legacyKey: "premium",
    label: "Vino",
    description: "Vino profundo, gris frio y acento rosa suave para una vista editorial.",
  },
];

const LEGACY_THEME_ALIASES = {
  premium: "ejecutivo",
  verde: "jade",
  azul: "marino",
  neutro: "grafito",
};

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

export const DEFAULT_ADMIN_PRODUCT_CARD_CONFIG = {
  fields: ["codigo", "descripcion", "metal", "kilataje", "peso", "precio", "mano_obra"],
  buttons: ["ver_detalle", "editar_producto", "preorden", "catalogo"],
};

export const ESTUCHES_CHAVEZ_DEFAULT_SLIDES = [
  {
    id: "estuches-envio-gratis",
    image_url: `${ESTUCHES_CHAVEZ_SITE_URL}/baner/bannerchicoenviogratis1.png`,
    alt: "Envio gratis Estuches Chavez",
  },
  {
    id: "estuches-banner-03",
    image_url: `${ESTUCHES_CHAVEZ_SITE_URL}/baner/banner-estu03.png`,
    alt: "Banner Estuches Chavez",
  },
  {
    id: "estuches-banner-04",
    image_url: `${ESTUCHES_CHAVEZ_SITE_URL}/baner/estuchez-4.png`,
    alt: "Estuches Chavez",
  },
  {
    id: "estuches-banner-foto",
    image_url: `${ESTUCHES_CHAVEZ_SITE_URL}/baner/325610423_1119270275413616_8671899750654311871_n%20(1).jpg`,
    alt: "Productos Estuches Chavez",
  },
];

export const DEFAULT_CLIENT_PORTAL_CONFIG = {
  announcement: {
    enabled: false,
    text: "",
    dismissible: true,
    animate: true,
    contact: {
      show_whatsapp: false,
      whatsapp_number: "",
      whatsapp_message: "Hola, quiero apoyo con mi pedido.",
      show_phone: false,
      phone: "",
      show_email: false,
      email: "",
    },
    socials: {
      show_website: false,
      website: "",
      show_instagram: false,
      instagram: "",
      show_facebook: false,
      facebook: "",
      show_tiktok: false,
      tiktok: "",
      show_linkedin: false,
      linkedin: "",
    },
  },
  banner: {
    enabled: false,
    autoplay: true,
    interval_ms: 5200,
    slides: [],
  },
  whatsapp: {
    enabled: false,
    number: "",
    message: "Hola, quiero apoyo con mi pedido.",
  },
};

export const DEFAULT_INTERFACE_SETTINGS = {
  theme_key: "premium",
  visual_theme_key: "ejecutivo",
  admin_product_card_config: DEFAULT_ADMIN_PRODUCT_CARD_CONFIG,
  client_portal_config: DEFAULT_CLIENT_PORTAL_CONFIG,
  hasCustomSettings: false,
};

const validVisualThemes = new Set(INTERFACE_THEMES.map((theme) => theme.key));
const validLegacyThemes = new Set(INTERFACE_THEMES.map((theme) => theme.legacyKey));
const validFields = new Set(PRODUCT_CARD_FIELDS.map((field) => field.key));
const validButtons = new Set(PRODUCT_CARD_BUTTONS.map((button) => button.key));

export const normalizeThemeKey = (value = "") => {
  const key = String(value || "").trim();
  if (validVisualThemes.has(key)) return key;
  if (LEGACY_THEME_ALIASES[key]) return LEGACY_THEME_ALIASES[key];
  return DEFAULT_INTERFACE_SETTINGS.visual_theme_key;
};

export const legacyThemeKeyFor = (value = "") => {
  const visualKey = normalizeThemeKey(value);
  return INTERFACE_THEMES.find((theme) => theme.key === visualKey)?.legacyKey || DEFAULT_INTERFACE_SETTINGS.theme_key;
};

const uniqueValid = (items, validSet, fallback) => {
  const seen = new Set();
  const next = (Array.isArray(items) ? items : [])
    .filter((item) => validSet.has(item) && !seen.has(item) && seen.add(item));
  return next.length ? next : fallback;
};

const normalizeTextKey = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const isValidHttpUrl = (value = "") => /^https?:\/\//i.test(String(value || "").trim());

const normalizeBannerUrl = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (isValidHttpUrl(text)) return text;
  return `${ESTUCHES_CHAVEZ_SITE_URL}/${text.replace(/^\/+/, "")}`;
};

// Sin trim aqui: normalize corre en cada tecleo del panel de personalizacion
// y recortar espacios al vuelo impide escribirlos. deepTrimStrings limpia al guardar.
const normalizeSlide = (slide = {}, index = 0) => {
  if (!slide || typeof slide !== "object") return null;
  const imageUrl = normalizeBannerUrl(slide.image_url || slide.imageUrl || slide.url);
  if (!imageUrl) return null;
  return {
    id: String(slide.id || `slide-${index + 1}`),
    image_url: imageUrl,
    title: String(slide.title || ""),
    subtitle: String(slide.subtitle || ""),
    link: String(slide.link || ""),
    alt: String(slide.alt || slide.title || "Banner del portal cliente"),
  };
};

const normalizeSlides = (slides) => {
  const seen = new Set();
  return (Array.isArray(slides) ? slides : [])
    .map(normalizeSlide)
    .filter(Boolean)
    .filter((slide) => {
      const key = slide.image_url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const normalizeAnnouncementContact = (announcement = {}, source = {}) => {
  const contact = announcement.contact || source.contact || {};
  const whatsapp = source.whatsapp || {};
  return {
    ...DEFAULT_CLIENT_PORTAL_CONFIG.announcement.contact,
    ...contact,
    show_whatsapp: Boolean(contact.show_whatsapp ?? source.show_whatsapp ?? source.whatsapp_enabled),
    whatsapp_number: String(
      contact.whatsapp_number ||
      contact.whatsapp ||
      source.whatsapp_number ||
      whatsapp.number ||
      ""
    ),
    whatsapp_message: String(
      contact.whatsapp_message ||
      source.whatsapp_message ||
      whatsapp.message ||
      DEFAULT_CLIENT_PORTAL_CONFIG.announcement.contact.whatsapp_message
    ),
    show_phone: Boolean(contact.show_phone ?? source.show_phone),
    phone: String(contact.phone || source.phone || ""),
    show_email: Boolean(contact.show_email ?? source.show_email),
    email: String(contact.email || source.email || ""),
  };
};

const normalizeAnnouncementSocials = (announcement = {}, source = {}) => {
  const socials = announcement.socials || source.socials || {};
  return {
    ...DEFAULT_CLIENT_PORTAL_CONFIG.announcement.socials,
    ...socials,
    show_website: Boolean(socials.show_website ?? source.show_website),
    website: String(socials.website || source.website || ""),
    show_instagram: Boolean(socials.show_instagram ?? source.show_instagram),
    instagram: String(socials.instagram || source.instagram || ""),
    show_facebook: Boolean(socials.show_facebook ?? source.show_facebook),
    facebook: String(socials.facebook || source.facebook || ""),
    show_tiktok: Boolean(socials.show_tiktok ?? source.show_tiktok),
    tiktok: String(socials.tiktok || source.tiktok || ""),
    show_linkedin: Boolean(socials.show_linkedin ?? source.show_linkedin),
    linkedin: String(socials.linkedin || source.linkedin || ""),
  };
};

export const normalizeClientPortalConfig = (config = {}) => {
  const source = config && typeof config === "object" ? config : {};
  const legacySlide = source.banner_image_url
    ? [{
        id: "legacy-banner",
        image_url: source.banner_image_url,
        title: source.banner_title,
        subtitle: source.banner_subtitle,
        link: source.banner_cta_url,
        alt: source.banner_title,
      }]
    : [];
  const announcement = source.announcement || {};
  const banner = source.banner || {};
  const whatsapp = source.whatsapp || {};
  const slides = normalizeSlides(banner.slides || source.slides || legacySlide);

  return {
    announcement: {
      ...DEFAULT_CLIENT_PORTAL_CONFIG.announcement,
      ...announcement,
      enabled: Boolean(announcement.enabled ?? source.announcement_enabled),
      text: String(announcement.text || source.announcement_text || ""),
      dismissible: announcement.dismissible !== false,
      animate: announcement.animate !== false,
      contact: normalizeAnnouncementContact(announcement, source),
      socials: normalizeAnnouncementSocials(announcement, source),
    },
    banner: {
      ...DEFAULT_CLIENT_PORTAL_CONFIG.banner,
      ...banner,
      enabled: Boolean(banner.enabled ?? source.banner_enabled),
      autoplay: banner.autoplay !== false,
      interval_ms: Math.max(3000, Number(banner.interval_ms || source.banner_interval_ms || DEFAULT_CLIENT_PORTAL_CONFIG.banner.interval_ms)),
      slides,
    },
    whatsapp: {
      ...DEFAULT_CLIENT_PORTAL_CONFIG.whatsapp,
      ...whatsapp,
      enabled: Boolean(whatsapp.enabled ?? source.whatsapp_enabled),
      number: String(
        whatsapp.number ||
        source.whatsapp_number ||
        announcement.contact?.whatsapp_number ||
        source.contact?.whatsapp_number ||
        ""
      ),
      message: String(
        whatsapp.message ||
        source.whatsapp_message ||
        announcement.contact?.whatsapp_message ||
        source.contact?.whatsapp_message ||
        DEFAULT_CLIENT_PORTAL_CONFIG.whatsapp.message
      ),
    },
  };
};

const deepTrimStrings = (value) => {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(deepTrimStrings);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deepTrimStrings(item)])
    );
  }
  return value;
};

export const hasClientPortalConfig = (config = {}) => {
  const normalized = normalizeClientPortalConfig(config);
  const contact = normalized.announcement.contact || {};
  const socials = normalized.announcement.socials || {};
  return Boolean(
    (normalized.announcement.enabled && normalized.announcement.text.trim()) ||
    (normalized.announcement.enabled && contact.show_whatsapp && contact.whatsapp_number) ||
    (normalized.announcement.enabled && contact.show_phone && contact.phone) ||
    (normalized.announcement.enabled && contact.show_email && contact.email) ||
    (normalized.announcement.enabled && socials.show_website && socials.website) ||
    (normalized.announcement.enabled && socials.show_instagram && socials.instagram) ||
    (normalized.announcement.enabled && socials.show_facebook && socials.facebook) ||
    (normalized.announcement.enabled && socials.show_tiktok && socials.tiktok) ||
    (normalized.announcement.enabled && socials.show_linkedin && socials.linkedin) ||
    (normalized.banner.enabled && normalized.banner.slides.length) ||
    (normalized.whatsapp.enabled && normalized.whatsapp.number)
  );
};

const withCompanyContactFallbacks = (config, { email = "", phone = "" } = {}) => {
  const normalized = normalizeClientPortalConfig(config);
  const contact = normalized.announcement.contact || {};
  return normalizeClientPortalConfig({
    ...normalized,
    announcement: {
      ...normalized.announcement,
      contact: {
        ...contact,
        phone: contact.phone || phone || "",
        email: contact.email || email || "",
        whatsapp_number: contact.whatsapp_number || normalized.whatsapp.number || phone || "",
        whatsapp_message: contact.whatsapp_message || normalized.whatsapp.message || DEFAULT_CLIENT_PORTAL_CONFIG.whatsapp.message,
      },
    },
    whatsapp: {
      ...normalized.whatsapp,
      number: normalized.whatsapp.number || contact.whatsapp_number || phone || "",
      message: normalized.whatsapp.message || contact.whatsapp_message || DEFAULT_CLIENT_PORTAL_CONFIG.whatsapp.message,
    },
  });
};

export const resolveClientPortalConfig = (baseConfig = {}, { profile = {}, companyName = "", phone = "", email = "" } = {}) => {
  const config = normalizeClientPortalConfig(baseConfig);
  if (hasClientPortalConfig(config)) return withCompanyContactFallbacks(config, { email, phone });

  const isStaging = import.meta.env.VITE_DEPLOY_ENV === "staging";
  const profileEmailKey = normalizeTextKey(profile?.email || "");
  const tenantName = normalizeTextKey(companyName);
  const isPacoDemo =
    profileEmailKey.includes("paco") ||
    profileEmailKey.endsWith("@demo-paco.local") ||
    tenantName.includes("estuches chavez");

  if (!isStaging || !isPacoDemo) return withCompanyContactFallbacks(config, { email, phone });

  return withCompanyContactFallbacks({
    announcement: {
      enabled: true,
      text: "Envio gratis en pedidos mayoristas seleccionados",
      dismissible: true,
      animate: true,
      contact: {
        show_whatsapp: true,
        whatsapp_number: phone || "5213326551832",
        whatsapp_message: "Hola, quiero apoyo con mi pedido del catalogo B2B.",
        show_phone: true,
        phone: phone || "33 2655 1832",
        show_email: Boolean(email),
        email,
      },
    },
    banner: {
      enabled: true,
      autoplay: true,
      interval_ms: 5200,
      slides: ESTUCHES_CHAVEZ_DEFAULT_SLIDES,
    },
    whatsapp: {
      enabled: true,
      number: phone || "5213326551832",
      message: "Hola, quiero apoyo con mi pedido del catalogo B2B.",
    },
  }, { email, phone });
};

export const normalizeInterfaceSettings = (settings = null) => {
  const config = settings?.admin_product_card_config || {};
  const visualThemeKey = normalizeThemeKey(
    settings?.visual_theme_key ||
    config.visual_theme_key ||
    settings?.theme_key
  );
  return {
    ...DEFAULT_INTERFACE_SETTINGS,
    ...settings,
    theme_key: validLegacyThemes.has(settings?.theme_key) ? settings.theme_key : legacyThemeKeyFor(visualThemeKey),
    visual_theme_key: visualThemeKey,
    admin_product_card_config: {
      fields: uniqueValid(config.fields, validFields, DEFAULT_ADMIN_PRODUCT_CARD_CONFIG.fields),
      buttons: uniqueValid(config.buttons, validButtons, DEFAULT_ADMIN_PRODUCT_CARD_CONFIG.buttons),
      visual_theme_key: visualThemeKey,
    },
    client_portal_config: normalizeClientPortalConfig(settings?.client_portal_config),
    hasCustomSettings: Boolean(settings?.id || settings?.hasCustomSettings),
  };
};

export const fetchInterfaceSettings = async (tenantId = "") => {
  if (!tenantId) return DEFAULT_INTERFACE_SETTINGS;
  let { data, error } = await supabase
    .from("tenant_interface_settings")
    .select("id, tenant_id, theme_key, admin_product_card_config, client_portal_config")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error && String(error.message || "").toLowerCase().includes("client_portal_config")) {
    const fallback = await supabase
      .from("tenant_interface_settings")
      .select("id, tenant_id, theme_key, admin_product_card_config")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data) return DEFAULT_INTERFACE_SETTINGS;
  return normalizeInterfaceSettings(data);
};

export const saveInterfaceSettings = async (tenantId, settings) => {
  if (!tenantId) throw new Error("No hay empresa activa para guardar personalizacion.");
  const normalized = normalizeInterfaceSettings({ ...settings, hasCustomSettings: true });
  const row = {
    tenant_id: tenantId,
    theme_key: legacyThemeKeyFor(normalized.visual_theme_key),
    admin_product_card_config: normalized.admin_product_card_config,
    client_portal_config: deepTrimStrings(normalized.client_portal_config),
  };
  const { data, error } = await supabase
    .from("tenant_interface_settings")
    .upsert(row, { onConflict: "tenant_id" })
    .select("id, tenant_id, theme_key, admin_product_card_config, client_portal_config")
    .single();
  if (error && String(error.message || "").toLowerCase().includes("client_portal_config")) {
    throw new Error("Falta aplicar la migracion de personalizacion del portal cliente.");
  }
  if (error) throw error;
  return normalizeInterfaceSettings(data);
};

const imageExtension = (fileName = "") => {
  const ext = String(fileName).split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return ext;
  return "png";
};

const signedAssetUrl = async (path) => {
  const { data, error } = await supabase.storage
    .from(ASSET_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
};

export const uploadClientPortalBanner = async (file, tenantId = "") => {
  if (!tenantId) throw new Error("No hay empresa activa para subir el banner.");
  const ext = imageExtension(file.name);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const path = `${tenantId}/banners/${stamp}.${ext}`;
  const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || `image/${ext}`,
    upsert: false,
  });
  if (error) throw error;
  return signedAssetUrl(path);
};
