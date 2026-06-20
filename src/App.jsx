import { useState } from "react";
import AuthGate from "./components/AuthGate";
import AdminDashboard from "./components/AdminDashboard";
import ClientCatalogApp from "./components/ClientCatalogApp";
import SuperAdminDashboard from "./components/superadmin/SuperAdminDashboard";
import QuotePage from "./pages/QuotePage";
import { ImpersonationProvider, useImpersonation } from "./contexts/ImpersonationContext";
import { LanguageProvider } from "./i18n/LanguageContext";
import { isAdminRole, isSuperAdmin } from "./services/tenantUtils";
import { getAppPathname } from "./utils/basePath";

const languageKey = "catalogo-b2b-language";
const isStaging = import.meta.env.VITE_DEPLOY_ENV === "staging";
const appVersion = import.meta.env.VITE_APP_VERSION || "development";

const readLanguage = () => {
  try {
    return JSON.parse(localStorage.getItem(languageKey)) || "es";
  } catch {
    return "es";
  }
};

const writeLanguage = (language) => {
  try {
    localStorage.setItem(languageKey, JSON.stringify(language));
  } catch {
    // localStorage can fail in private mode; language still works for the session.
  }
};

function AuthenticatedApp() {
  const impersonation = useImpersonation();

  return (
    <AuthGate>
      {({ profile }) => {
        if (isSuperAdmin(profile) && !impersonation.impersonating) {
          return <SuperAdminDashboard profile={profile} />;
        }

        if (isAdminRole(profile?.role)) {
          return (
            <AdminDashboard
              profile={profile}
              tenantOverride={impersonation.impersonating ? impersonation.tenantId : ""}
              supportMode={impersonation.impersonating}
              supportTenantName={impersonation.tenantName}
              onExitSupport={impersonation.stopImpersonation}
            />
          );
        }

        return <ClientCatalogApp profile={profile} />;
      }}
    </AuthGate>
  );
}

export default function App() {
  const [language, setLanguageState] = useState(readLanguage);
  const isPublicQuoteRoute = getAppPathname().startsWith("/cotizacion/");

  const setLanguage = (nextLanguage) => {
    setLanguageState(nextLanguage);
    writeLanguage(nextLanguage);
  };

  return (
    <LanguageProvider language={language} setLanguage={setLanguage}>
      {isStaging ? (
        <div className="environment-banner" role="status">
          VERSIÓN DE PRUEBAS · {appVersion}
        </div>
      ) : null}
      <ImpersonationProvider>
        {isPublicQuoteRoute ? <QuotePage /> : <AuthenticatedApp />}
      </ImpersonationProvider>
    </LanguageProvider>
  );
}
