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
    country: company.country || "México",
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
        country: settings.country || "México",
        logo_url: settings.logo_url || "",
        commercial_terms: settings.commercial_terms || "",
      }))
      .catch(() => {});
  }, [tenantId]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setStatus("Subiendo logo...");
    try {
      const url = await uploadLogo(file);
      setForm((f) => ({ ...f, logo_url: url }));
      setStatus("Logo subido ✓");
    } catch (err) {
      setStatus("Error al subir logo: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus("");
    try {
      await saveCompanySettings(form, tenantId);
      company.reload();
      setStatus("¡Guardado correctamente!");
    } catch (err) {
      setStatus("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-workspace">
      <div className="admin-soft-panel compact-panel" style={{ maxWidth: 640 }}>
        <h2>Información de la empresa</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Estos datos aparecen en la app y en los PDFs de preorden.
        </p>

        <div className="form-grid">
          <label>
            Nombre comercial
            <input placeholder="Ej. Vanguardia Joyera" value={form.brand_name} onChange={set("brand_name")} />
          </label>
          <label>
            Razón social
            <input placeholder="Ej. Comercializadora XYZ S.A. de C.V." value={form.legal_name} onChange={set("legal_name")} />
          </label>
          <label>
            RFC
            <input placeholder="XYZZ010101ABC" value={form.rfc} onChange={set("rfc")} />
          </label>
          <label>
            Teléfono
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
          <label>
            País
            <input placeholder="México" value={form.country} onChange={set("country")} />
          </label>
        </div>

        <label style={{ marginTop: 16, display: "block" }}>
          Términos comerciales (aparece en el PDF)
          <textarea
            rows={3}
            placeholder="Ej. Esta preorden no es factura ni orden confirmada..."
            value={form.commercial_terms}
            onChange={set("commercial_terms")}
          />
        </label>

        <div style={{ marginTop: 20 }}>
          <h3>Logo de la empresa</h3>
          {form.logo_url ? (
            <div style={{ marginBottom: 12 }}>
              <img
                src={form.logo_url}
                alt="Logo"
                style={{ maxHeight: 80, maxWidth: 240, objectFit: "contain", border: "1px solid #eee", borderRadius: 8, padding: 8 }}
              />
            </div>
          ) : (
            <p className="muted" style={{ marginBottom: 8 }}>Sin logo cargado — se mostrará el nombre de texto.</p>
          )}
          <input type="file" accept="image/*" onChange={handleLogo} disabled={uploading} style={{ background: "transparent", border: "none", padding: 0 }} />
          {form.logo_url && (
            <div style={{ marginTop: 8 }}>
              <label>O pega una URL de imagen</label>
              <input placeholder="https://..." value={form.logo_url} onChange={set("logo_url")} />
            </div>
          )}
        </div>

        {status ? <p className="status info" style={{ marginTop: 12 }}>{status}</p> : null}

        <button
          className="primary-button compact-action"
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ marginTop: 20, width: "100%" }}
        >
          {saving ? "Guardando..." : "Guardar información"}
        </button>
      </div>
    </section>
  );
}
