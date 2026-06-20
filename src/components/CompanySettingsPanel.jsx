import { useEffect, useState } from "react";
import { useCompany } from "../contexts/CompanyContext";
import { fetchCompanySettings, saveCompanySettings, uploadLogo } from "../services/companySettings";

export default function CompanySettingsPanel({ tenantId = "" }) {
  const company = useCompany();
  const [form, setForm] = useState({
    brand_name: company.brand_name || "",
    legal_name: company.legal_name || "",
    rfc: company.rfc || "",
    phone: company.phone || "",
    email: company.email || "",
    city: company.city || "",
    state: company.state || "",
    country: company.country || "Mexico",
    logo_url: company.logo_url || "",
    commercial_terms: company.commercial_terms || "",
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    fetchCompanySettings(tenantId)
      .then((settings) => setForm({
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
      }))
      .catch(() => {});
  }, [tenantId]);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const handleLogo = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    // Guard: no subir sin empresa activa — evita guardar en bucket global equivocado
    if (!tenantId) {
      setStatus("Error: no se detectó empresa activa. No se puede subir el logo.");
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

  const handleSave = async () => {
    // Guard: no guardar sin empresa activa — evita sobreescribir settings globales
    if (!tenantId) {
      setStatus("Error: no se detectó empresa activa. Contacta al administrador.");
      return;
    }
    setSaving(true);
    setStatus("");
    try {
      await saveCompanySettings(form, tenantId);
      // No llamamos company.reload() sin tenantId porque recargaría el registro
      // global (tenant_id IS NULL) y pisaría visualmente los datos de esta empresa.
      // El evento company-settings-updated actualiza tenantCompany en AdminDashboard
      // directamente con los datos correctos que acabamos de guardar.
      window.dispatchEvent(new CustomEvent("company-settings-updated", { detail: { tenantId, settings: form } }));
      setStatus("Datos de empresa guardados correctamente.");
    } catch (error) {
      setStatus("Error al guardar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-workspace company-settings-workspace">
      <div className="company-settings-page">
        <header className="company-settings-title">
          <h2>Configuracion del sistema</h2>
          <p>Ajustes generales de la empresa, identidad comercial y datos para PDFs.</p>
        </header>

        <section className="company-config-card">
          <header>
            <span aria-hidden="true">▦</span>
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
            <span aria-hidden="true">▧</span>
            <h3>Logo de empresa</h3>
          </header>
          <div className="company-logo-row">
            <div className="company-logo-preview">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo de empresa" />
              ) : (
                <span aria-hidden="true">□</span>
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
            <span aria-hidden="true">☰</span>
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
