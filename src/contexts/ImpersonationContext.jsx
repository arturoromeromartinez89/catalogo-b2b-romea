import { createContext, useContext, useMemo, useState } from "react";

const ImpersonationContext = createContext(null);

export const useImpersonation = () => useContext(ImpersonationContext);

export function ImpersonationProvider({ children }) {
  const [context, setContext] = useState(null);

  const value = useMemo(() => ({
    impersonating: Boolean(context?.tenantId),
    tenantId: context?.tenantId || "",
    tenantName: context?.tenantName || "",
    startImpersonation: (tenant) => setContext({
      tenantId: tenant.id,
      tenantName: tenant.name,
    }),
    stopImpersonation: () => setContext(null),
  }), [context]);

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
}
