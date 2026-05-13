import { createContext, useContext } from "react";
import { makeTranslator } from "./translations";

const LanguageContext = createContext({
  language: "es",
  setLanguage: () => {},
  t: makeTranslator("es"),
});

export const LanguageProvider = ({ language, setLanguage, children }) => (
  <LanguageContext.Provider value={{ language, setLanguage, t: makeTranslator(language) }}>
    {children}
  </LanguageContext.Provider>
);

export const useLanguage = () => useContext(LanguageContext);
