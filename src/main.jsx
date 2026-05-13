import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { CompanyProvider } from "./contexts/CompanyContext";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CompanyProvider>
      <App />
    </CompanyProvider>
  </StrictMode>
);
