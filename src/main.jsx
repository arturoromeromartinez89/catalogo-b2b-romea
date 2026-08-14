import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { CompanyProvider } from "./contexts/CompanyContext";
import { initSentry } from "./lib/sentry";
// Design system — cargar ANTES que styles.css para que los tokens estén disponibles
import "./styles/tokens.css";
import "./styles/buttons.css";
import "./styles.css";
import "./projectHub.css";

// Inicializar monitoreo de errores antes del primer render.
// Solo activo si VITE_SENTRY_DSN está definido en .env
initSentry();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CompanyProvider>
      <App />
    </CompanyProvider>
  </StrictMode>
);
