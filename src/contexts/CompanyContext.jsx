import { createContext, useContext, useEffect, useState } from "react";
import { fetchCompanySettings, defaultSettings } from "../services/companySettings";

const CompanyContext = createContext(defaultSettings);

export const useCompany = () => useContext(CompanyContext);

export function CompanyProvider({ children }) {
  const [company, setCompany] = useState(defaultSettings);

  useEffect(() => {
    fetchCompanySettings().then(setCompany).catch(() => setCompany(defaultSettings));
  }, []);

  // tenantId opcional: si se pasa, recarga settings del tenant correcto.
  // Sin argumento sigue cargando el registro global (tenant_id IS NULL) para
  // el contexto base de la app (Vanguardia / configuración por defecto).
  const reload = (tenantId = "") => fetchCompanySettings(tenantId).then(setCompany).catch(() => {});

  return (
    <CompanyContext.Provider value={{ ...company, reload }}>
      {children}
    </CompanyContext.Provider>
  );
}
