import { useState } from "react";
import AuthGate from "./components/AuthGate";
import AdminDashboard from "./components/AdminDashboard";
import ClientCatalogApp from "./components/ClientCatalogApp";
import ClientPortalShell from "./components/ClientPortalShell";
import SuperAdminDashboard from "./components/superadmin/SuperAdminDashboard";
import QuotePage from "./pages/QuotePage";
import ProjectHubDemoPage from "./pages/ProjectHubDemoPage";
import PurchasingDemoPage from "./pages/PurchasingDemoPage";
import StudioDemoPage from "./pages/StudioDemoPage";
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
        if (isSuperAdmin(profile)) {
          if (impersonation.impersonating) {
            return <ClientPortalShell
              tenantId={impersonation.tenantId}
              tenantSlug={impersonation.tenantSlug}
              companyName={impersonation.tenantName}
              initialProjectName="Proyecto del cliente"
              onReturnToStudio={impersonation.stopImpersonation}
            />;
          }
          return <SuperAdminDashboard profile={profile} onOpenClientView={impersonation.startImpersonation} />;
        }

        if (isAdminRole(profile?.role)) {
          return (
            <AdminDashboard
              profile={profile}
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
  const isProjectHubDemoRoute = getAppPathname() === "/demo/project-hub";
  const isPurchasingDemoRoute = getAppPathname() === "/demo/compras";
  const isStudioDemoRoute = getAppPathname() === "/demo/studio";

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
        {isStudioDemoRoute && isStaging ? <StudioDemoPage /> : isPurchasingDemoRoute && isStaging ? <PurchasingDemoPage /> : isProjectHubDemoRoute && isStaging ? <ProjectHubDemoPage /> : isPublicQuoteRoute ? <QuotePage /> : <AuthenticatedApp />}
      </ImpersonationProvider>
    </LanguageProvider>
  );
}
