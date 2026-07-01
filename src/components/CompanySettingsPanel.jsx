import { useEffect, useMemo, useState } from "react";
import { useCompany } from "../contexts/CompanyContext";
import {
  fetchCompanySettings,
  saveCompanySettings,
  uploadLogo,
} from "../services/companySettings";
import {
  DEFAULT_INTERFACE_SETTINGS,
  normalizeInterfaceSettings,
  normalizeClientPortalConfig,
  resolveClientPortalConfig,
  saveInterfaceSettings,
  uploadClientPortalBanner,
} from "../services/interfaceSettingsService";
import InterfaceCustomizationPanel from "./InterfaceCustomizationPanel";
import TenantTopBanner from "./TenantTopBanner";

const toCompanyForm = (settings = {}, interfaceSettings = DEFAULT_INTERFACE_SETTINGS, profile = {}) => {
  const portalConfig = resolveClientPortalConfig(interfaceSettings?.client_portal_config, {
    profile,
    companyName: settings.brand_name || settings.legal_name || settings.name || "",
    phone: settings.phone || "",
    email: settings.email || "",
  });
  const portalContact = portalConfig.announcement.contact || {};
  return {
    brand_name: settings.brand_name || "",
    legal_name: settings.legal_name || "",
    rfc: settings.rfc || "",
    phone: settings.phone || "",
    email: settings.email || "",
    city: settings.city || "",
    state: settings.state || "",
    country: settings.country || "Mexico",
    logo_url: settings.logo_url || "",
    commercial_terms: settings.commercial_terms || "",
    client_portal_config: {
      ...portalConfig,
      whatsapp: {
        ...portalConfig.whatsapp,
        number: portalConfig.whatsapp.number || settings.phone || "",
      },
      announcement: {
        ...portalConfig.announcement,
        contact: {
          ...portalContact,
          phone: portalContact.phone || settings.phone || "",
          email: portalContact.email || settings.email || "",
          whatsapp_number: portalContact.whatsapp_number || portalConfig.whatsapp.number || settings.phone || "",
          whatsapp_message: portalContact.whatsapp_message || portalConfig.whatsapp.message,
        },
      },
    },
  };
};

const move = (items, index, direction) => {
  const next = [...items];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

export default function CompanySettingsPanel({
  tenantId = "",
  profile = {},
  interfaceSettings = DEFAULT_INTERFACE_SETTINGS,
  onInterfaceSettingsChange,
}) {
  const company = useCompany();
  const [form, setForm] = useState(() => toCompanyForm(company, interfaceSettings, profile));
  const [activeSection, setActiveSection] = useState("company");
  const [interfaceDraft, setInterfaceDraft] = useState(() => normalizeInterfaceSettings(interfaceSettings));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [newSlideUrl, setNewSlideUrl] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    fetchCompanySettings(tenantId)
      .then((settings) => setForm(toCompanyForm(settings, interfaceSettings, profile)))
      .catch(() => {});
  }, [tenantId, interfaceSettings, profile]);

  useEffect(() => {
    setInterfaceDraft(normalizeInterfaceSettings(interfaceSettings));
  }, [interfaceSettings]);

  const portalConfig = useMemo(
    () => normalizeClientPortalConfig(form.client_portal_config),
    [form.client_portal_config]
  );

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const updatePortal = (updater) => {
    setForm((current) => {
      const currentPortal = normalizeClientPortalConfig(current.client_portal_config);
      const nextPortal = typeof updater === "function" ? updater(currentPortal) : updater;
      return {
        ...current,
        client_portal_config: normalizeClientPortalConfig(nextPortal),
      };
    });
  };

  const setPortalSection = (section, key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    updatePortal((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value,
      },
    }));
  };

  const setPortalNested = (section, group, key) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    updatePortal((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [group]: {
          ...(current[section]?.[group] || {}),
          [key]: value,
        },
      },
    }));
  };

  const addSlide = (slide) => {
    updatePortal((current) => ({
      ...current,
      banner: {
        ...current.banner,
        enabled: true,
        slides: [
          ...current.banner.slides,
          {
            id: `slide-${Date.now()}`,
            image_url: slide.image_url,
            title: slide.title || "",
            subtitle: slide.subtitle || "",
            link: slide.link || "",
            alt: slide.alt || "Banner del portal cliente",
          },
        ],
      },
    }));
  };

  const handleAddSlideUrl = () => {
    const url = newSlideUrl.trim();
    if (!url) {
      setStatus("Agrega una URL de imagen para crear el slide.");
      return;
    }
    addSlide({ image_url: url });
    setNewSlideUrl("");
    setStatus("Imagen agregada al carrusel.");
  };

  const updateSlide = (index, key, value) => {
    updatePortal((current) => ({
      ...current,
      banner: {
        ...current.banner,
        slides: current.banner.slides.map((slide, slideIndex) =>
          slideIndex === index ? { ...slide, [key]: value } : slide
        ),
      },
    }));
  };

  const removeSlide = (index) => {
    updatePortal((current) => ({
      ...current,
      banner: {
        ...current.banner,
        slides: current.banner.slides.filter((_, slideIndex) => slideIndex !== index),
      },
    }));
  };

  const moveSlide = (index, direction) => {
    updatePortal((current) => ({
      ...current,
      banner: {
        ...current.banner,
        slides: move(current.banner.slides, index, direction),
      },
    }));
  };

  const handleLogo = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!tenantId) {
      setStatus("Error: no se detecto empresa activa. No se puede subir el logo.");
      event.target.value = "";
      return;
    }
    setUploading(true);
    setStatus("Subiendo logo...");
    try {
      const url = await uploadLogo(file, tenantId);
      setForm((current) => ({ ...current, logo_url: url }));
      setStatus("Logo subido correctamente.");
    } catch (error) {
      setStatus("Error al subir logo: " + error.message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleBanner = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!tenantId) {
      setStatus("Error: no se detecto empresa activa. No se puede subir el banner.");
      event.target.value = "";
      return;
    }
    setUploadingBanner(true);
    setStatus("Subiendo banner...");
    try {
      const url = await uploadClientPortalBanner(file, tenantId);
      addSlide({ image_url: url, alt: file.name || "Banner del portal cliente" });
      setStatus("Banner subido y agregado al carrusel.");
    } catch (error) {
      setStatus("Error al subir banner: " + error.message);
    } finally {
      setUploadingBanner(false);
      event.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!tenantId) {
      setStatus("Error: no se detecto empresa activa. Contacta al administrador.");
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      const { client_portal_config, ...companySettings } = form;
      await saveCompanySettings(companySettings, tenantId);
      const savedInterface = await saveInterfaceSettings(tenantId, {
        ...interfaceDraft,
        client_portal_config: normalizeClientPortalConfig(client_portal_config),
      });
      setInterfaceDraft(savedInterface);
      onInterfaceSettingsChange?.(savedInterface);
      window.dispatchEvent(new CustomEvent("company-settings-updated", { detail: { tenantId, settings: companySettings } }));
      setStatus("Configuracion de empresa y personalizacion guardada correctamente.");
    } catch (error) {
      setStatus("Error al guardar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const firstSlide = portalConfig.banner.slides[0];

  return (
    <section className="admin-workspace company-settings-workspace">
      <div className="company-settings-page">
        <header className="company-settings-title">
          <h2>Configuracion del sistema</h2>
          <p>Ajustes generales de la empresa, identidad comercial y portal del cliente.</p>
        </header>

        <nav className="company-subnav" aria-label="Secciones de empresa">
          <button
            className={activeSection === "company" ? "active" : ""}
            type="button"
            onClick={() => setActiveSection("company")}
          >
            Datos de empresa
          </button>
          <button
            className={activeSection === "personalization" ? "active" : ""}
            type="button"
            onClick={() => setActiveSection("personalization")}
          >
            Personalizacion
          </button>
        </nav>

        {activeSection === "company" ? (
          <>
        <section className="company-config-card">
          <header>
            <span aria-hidden="true">B</span>
            <h3>Datos de empresa</h3>
          </header>
          <div className="company-form-grid">
            <label className="wide-field">
              Nombre de empresa
              <input placeholder="Ej. ROMEA Joyeria" value={form.brand_name} onChange={set("brand_name")} />
            </label>
            <label>
              Razon social
              <input placeholder="Ej. Comercializadora XYZ S.A. de C.V." value={form.legal_name} onChange={set("legal_name")} />
            </label>
            <label>
              RFC
              <input placeholder="XYZZ010101ABC" value={form.rfc} onChange={set("rfc")} />
            </label>
            <label>
              Telefono
              <input placeholder="+52 33 1234 5678" value={form.phone} onChange={set("phone")} />
            </label>
            <label>
              Correo
              <input placeholder="contacto@miempresa.com" value={form.email} onChange={set("email")} />
            </label>
            <label>
              Ciudad
              <input placeholder="Guadalajara" value={form.city} onChange={set("city")} />
            </label>
            <label>
              Estado
              <input placeholder="Jalisco" value={form.state} onChange={set("state")} />
            </label>
            <label className="wide-field">
              Pais
              <input placeholder="Mexico" value={form.country} onChange={set("country")} />
            </label>
          </div>
        </section>

        <section className="company-config-card">
          <header>
            <span aria-hidden="true">L</span>
            <h3>Logo de empresa</h3>
          </header>
          <div className="company-logo-row">
            <div className="company-logo-preview">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo de empresa" />
              ) : (
                <span aria-hidden="true">Logo</span>
              )}
            </div>
            <div className="company-logo-actions">
              <label className="upload-logo-button">
                {uploading ? "Subiendo..." : "Subir logo"}
                <input type="file" accept="image/*" onChange={handleLogo} disabled={uploading} />
              </label>
              <p>PNG, JPG o WebP. Recomendado: fondo transparente y formato horizontal.</p>
              <label>
                URL de logo
                <input placeholder="https://..." value={form.logo_url} onChange={set("logo_url")} />
              </label>
            </div>
          </div>
        </section>

        <section className="company-config-card">
          <header>
            <span aria-hidden="true">T</span>
            <h3>Terminos comerciales</h3>
          </header>
          <label>
            Texto para PDFs de preorden
            <textarea
              rows={4}
              placeholder="Ej. Esta preorden no es factura ni orden confirmada..."
              value={form.commercial_terms}
              onChange={set("commercial_terms")}
            />
          </label>
        </section>

          </>
        ) : (
          <>
        <section className="company-config-card client-portal-settings-card">
          <header>
            <span aria-hidden="true">P</span>
            <div>
              <h3>Banner superior e inicio</h3>
              <p>Contacto visible, mensaje animado y pizarron principal para administrador y clientes.</p>
            </div>
          </header>

          <div className="client-portal-settings-grid">
            <div className="client-portal-settings-controls">
              <section className="portal-setting-block">
                <h4>Barra superior</h4>
                <label className="company-toggle-field">
                  <input
                    type="checkbox"
                    checked={!!portalConfig.announcement.enabled}
                    onChange={setPortalSection("announcement", "enabled")}
                  />
                  Mostrar barra superior en administrador y clientes
                </label>
                <label className="company-toggle-field">
                  <input
                    type="checkbox"
                    checked={!!portalConfig.announcement.animate}
                    onChange={setPortalSection("announcement", "animate")}
                  />
                  Animar el mensaje
                </label>
                <label>
                  Mensaje principal
                  <input
                    placeholder="Ej. Envio gratis en pedidos mayoristas seleccionados"
                    value={portalConfig.announcement.text}
                    onChange={setPortalSection("announcement", "text")}
                  />
                </label>

                <div className="portal-contact-grid">
                  <label className="company-toggle-field">
                    <input
                      type="checkbox"
                      checked={!!portalConfig.announcement.contact.show_whatsapp}
                      onChange={setPortalNested("announcement", "contact", "show_whatsapp")}
                    />
                    Boton WhatsApp
                  </label>
                  <label>
                    Numero para WhatsApp
                    <input
                      placeholder="+52 33 1234 5678"
                      value={portalConfig.announcement.contact.whatsapp_number}
                      onChange={setPortalNested("announcement", "contact", "whatsapp_number")}
                    />
                  </label>
                  <label className="wide-field">
                    Mensaje de WhatsApp
                    <input
                      placeholder="Hola, quiero apoyo con mi pedido."
                      value={portalConfig.announcement.contact.whatsapp_message}
                      onChange={setPortalNested("announcement", "contact", "whatsapp_message")}
                    />
                  </label>
                  <label className="company-toggle-field">
                    <input
                      type="checkbox"
                      checked={!!portalConfig.announcement.contact.show_phone}
                      onChange={setPortalNested("announcement", "contact", "show_phone")}
                    />
                    Telefono visible
                  </label>
                  <label>
                    Telefono
                    <input
                      placeholder="+52 33 1234 5678"
                      value={portalConfig.announcement.contact.phone}
                      onChange={setPortalNested("announcement", "contact", "phone")}
                    />
                  </label>
                  <label className="company-toggle-field">
                    <input
                      type="checkbox"
                      checked={!!portalConfig.announcement.contact.show_email}
                      onChange={setPortalNested("announcement", "contact", "show_email")}
                    />
                    Correo visible
                  </label>
                  <label>
                    Correo
                    <input
                      placeholder="contacto@miempresa.com"
                      value={portalConfig.announcement.contact.email}
                      onChange={setPortalNested("announcement", "contact", "email")}
                    />
                  </label>
                </div>

                <div className="portal-social-grid">
                  {[
                    ["website", "show_website", "Sitio web"],
                    ["instagram", "show_instagram", "Instagram"],
                    ["facebook", "show_facebook", "Facebook"],
                    ["tiktok", "show_tiktok", "TikTok"],
                    ["linkedin", "show_linkedin", "LinkedIn"],
                  ].map(([key, showKey, label]) => (
                    <div className="portal-social-row" key={key}>
                      <label className="company-toggle-field">
                        <input
                          type="checkbox"
                          checked={!!portalConfig.announcement.socials[showKey]}
                          onChange={setPortalNested("announcement", "socials", showKey)}
                        />
                        {label}
                      </label>
                      <input
                        placeholder="https://..."
                        value={portalConfig.announcement.socials[key]}
                        onChange={setPortalNested("announcement", "socials", key)}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="portal-setting-block">
                <h4>Banner de inicio</h4>
                <label className="company-toggle-field">
                  <input
                    type="checkbox"
                    checked={!!portalConfig.banner.enabled}
                    onChange={setPortalSection("banner", "enabled")}
                  />
                  Mostrar carrusel en la pagina de inicio
                </label>
                <label className="company-toggle-field">
                  <input
                    type="checkbox"
                    checked={!!portalConfig.banner.autoplay}
                    onChange={setPortalSection("banner", "autoplay")}
                  />
                  Autoplay automatico
                </label>
                <div className="client-banner-add-row">
                  <label>
                    Agregar imagen por URL
                    <input
                      placeholder="https://..."
                      value={newSlideUrl}
                      onChange={(event) => setNewSlideUrl(event.target.value)}
                    />
                  </label>
                  <button className="secondary-button compact-action" type="button" onClick={handleAddSlideUrl}>
                    Agregar
                  </button>
                </div>
                <label className="upload-logo-button client-banner-upload">
                  {uploadingBanner ? "Subiendo..." : "Subir imagen"}
                  <input type="file" accept="image/*" onChange={handleBanner} disabled={uploadingBanner} />
                </label>

                <div className="client-slide-list">
                  {portalConfig.banner.slides.length ? portalConfig.banner.slides.map((slide, index) => (
                    <article className="client-slide-item" key={slide.id || slide.image_url}>
                      <img src={slide.image_url} alt={slide.alt || "Slide del portal"} />
                      <div className="client-slide-fields">
                        <label>
                          Titulo del banner
                          <input
                            placeholder="Texto opcional sobre la imagen"
                            value={slide.title}
                            onChange={(event) => updateSlide(index, "title", event.target.value)}
                          />
                        </label>
                        <label>
                          Subtitulo
                          <input
                            placeholder="Promocion, aviso o mensaje para clientes"
                            value={slide.subtitle}
                            onChange={(event) => updateSlide(index, "subtitle", event.target.value)}
                          />
                        </label>
                        <label>
                          Liga opcional
                          <input
                            placeholder="https://..."
                            value={slide.link}
                            onChange={(event) => updateSlide(index, "link", event.target.value)}
                          />
                        </label>
                      </div>
                      <div className="client-slide-actions">
                        <button type="button" onClick={() => moveSlide(index, -1)} disabled={index === 0}>Subir</button>
                        <button type="button" onClick={() => moveSlide(index, 1)} disabled={index === portalConfig.banner.slides.length - 1}>Bajar</button>
                        <button type="button" onClick={() => removeSlide(index)}>Eliminar</button>
                      </div>
                    </article>
                  )) : (
                    <p className="portal-settings-empty">Sin imagenes configuradas. Agrega una URL o sube una imagen.</p>
                  )}
                </div>
              </section>

              <section className="portal-setting-block">
                <h4>Boton flotante de WhatsApp</h4>
                <label className="company-toggle-field">
                  <input
                    type="checkbox"
                    checked={!!portalConfig.whatsapp.enabled}
                    onChange={setPortalSection("whatsapp", "enabled")}
                  />
                  Mostrar acceso fijo de WhatsApp en clientes
                </label>
                <label>
                  Numero WhatsApp
                  <input
                    placeholder="+52 33 1234 5678"
                    value={portalConfig.whatsapp.number}
                    onChange={setPortalSection("whatsapp", "number")}
                  />
                </label>
                <label>
                  Mensaje sugerido
                  <input
                    placeholder="Hola, quiero apoyo con mi pedido."
                    value={portalConfig.whatsapp.message}
                    onChange={setPortalSection("whatsapp", "message")}
                  />
                </label>
              </section>
            </div>

            <aside className="client-portal-preview" aria-label="Vista previa del portal cliente">
              <p className="tool-eyebrow">Vista previa cliente</p>
              <TenantTopBanner config={portalConfig} compact />
              <div className="client-carousel-preview">
                {firstSlide ? (
                  <img src={firstSlide.image_url} alt={firstSlide.alt || "Banner del portal"} />
                ) : (
                  <span>Banner de inicio</span>
                )}
                {firstSlide?.title ? <strong>{firstSlide.title}</strong> : null}
                {firstSlide?.subtitle ? <em>{firstSlide.subtitle}</em> : null}
              </div>
              <div className="client-preview-actions">
                <button className="primary-button compact-action" type="button">Ver catalogo</button>
                {portalConfig.whatsapp.enabled ? (
                  <button className="secondary-button compact-action" type="button">WhatsApp</button>
                ) : null}
              </div>
            </aside>
          </div>
        </section>

        <InterfaceCustomizationPanel
          tenantId={tenantId}
          settings={interfaceDraft}
          draftSettings={interfaceDraft}
          onDraftChange={setInterfaceDraft}
          onSaved={onInterfaceSettingsChange}
          hideSave
        />
          </>
        )}

        {status ? <p className="status info">{status}</p> : null}

        <div className="company-save-row">
          <button className="primary-button compact-action" type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar configuracion"}
          </button>
        </div>
      </div>
    </section>
  );
}
