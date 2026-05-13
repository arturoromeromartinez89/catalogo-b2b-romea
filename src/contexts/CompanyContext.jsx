import { createContext, useContext, useEffect, useState } from "react";
import { fetchCompanySettings, defaultSettings } from "../services/companySettings";

const CompanyContext = createContext(defaultSettings);

export const useCompany = () => useContext(CompanyContext);

export function CompanyProvider({ children }) {
  const [company, setCompany] = useState(defaultSettings);

  useEffect(() => {
    fetchCompanySettings().then(setCompany).catch(() => setCompany(defaultSettings));
  }, []);

  const reload = () => fetchCompanySettings().then(setCompany).catch(() => {});

  return (
    <CompanyContext.Provider value={{ ...company, reload }}>
      {children}
    </CompanyContext.Provider>
  );
}
