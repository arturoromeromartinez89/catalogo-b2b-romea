import { useCallback, useEffect, useState } from "react";
import AuthGate from "../components/AuthGate";
import DatabaseHealthDashboard from "../components/DatabaseHealthDashboard";
import { useLanguage } from "../i18n/LanguageContext";
import { supabase } from "../lib/supabaseClient";
import { dbProductToProduct, fetchAllProducts } from "../services/supabaseCatalog";
import { getTenantId, isAdminRole } from "../services/tenantUtils";
import { withBasePath } from "../utils/basePath";

const copy = {
  es: {
    eyebrow: "VALIDACION DE DATOS",
    title: "Validacion de SKUs",
    subtitle: "Revision del catalogo por fotos, lineas, pesos, proveedores, visibilidad y datos listos para venta.",
    refresh: "Actualizar",
    back: "Volver al panel",
    signOut: "Salir",
    loading: "Cargando productos...",
    errorTitle: "No se pudo cargar la validacion",
    accessTitle: "Acceso restringido",
    accessText: "Esta vista esta disponible solo para usuarios administradores.",
    products: "productos revisados",
  },
  en: {
    eyebrow: "DATA VALIDATION",
    title: "SKU validation",
    subtitle: "Catalog review by photos, lines, weights, suppliers, visibility and sell-ready data.",
    refresh: "Refresh",
    back: "Back to dashboard",
    signOut: "Sign out",
    loading: "Loading products...",
    errorTitle: "Validation could not be loaded",
    accessTitle: "Restricted access",
    accessText: "This view is available only for administrator users.",
    products: "products reviewed",
  },
};

function DataValidationWorkspace({ profile }) {
  const { language } = useLanguage();
  const text = copy[language] || copy.es;
  const tenantId = getTenantId(profile);
  const canValidate = isAdminRole(profile?.role);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(canValidate);
  const [error, setError] = useState("");

  const loadProducts = useCallback(async () => {
    if (!canValidate) return;
    setLoading(true);
    setError("");
    try {
      const rows = await fetchAllProducts({ tenantId });
      setProducts(rows.map(dbProductToProduct));
    } catch (nextError) {
      setError(nextError.message || text.errorTitle);
    } finally {
      setLoading(false);
    }
  }, [canValidate, tenantId, text.errorTitle]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  if (!canValidate) {
    return (
      <main className="validation-route-shell">
        <section className="validation-route-main">
          <div className="validation-route-header">
            <span className="tool-eyebrow">{text.eyebrow}</span>
            <h1>{text.accessTitle}</h1>
            <p>{text.accessText}</p>
            <div className="validation-route-actions">
              <a className="secondary-button compact-action" href={withBasePath("")}>{text.back}</a>
              <button className="secondary-button compact-action" type="button" onClick={() => supabase.auth.signOut()}>
                {text.signOut}
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="validation-route-shell">
      <section className="validation-route-main">
        <div className="validation-route-header">
          <div>
            <span className="tool-eyebrow">{text.eyebrow}</span>
            <h1>{text.title}</h1>
            <p>{text.subtitle}</p>
            <small>{products.length.toLocaleString(language === "en" ? "en-US" : "es-MX")} {text.products}</small>
          </div>
          <div className="validation-route-actions">
            <button className="primary-button compact-action" type="button" onClick={loadProducts} disabled={loading}>
              {loading ? text.loading : text.refresh}
            </button>
            <a className="secondary-button compact-action" href={withBasePath("")}>{text.back}</a>
          </div>
        </div>

        {error ? (
          <div className="status warning validation-route-status">
            <strong>{text.errorTitle}</strong>
            <span>{error}</span>
          </div>
        ) : null}

        <DatabaseHealthDashboard products={products} language={language} loading={loading} />
      </section>
    </main>
  );
}

export default function DataValidationPage() {
  return (
    <AuthGate>
      {({ profile }) => <DataValidationWorkspace profile={profile} />}
    </AuthGate>
  );
}
