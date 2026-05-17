export const companyInfo = {
  brandName: "",
  commercialName: "",
  legalName: "",
  rfc: "",
  phone: "",
  email: "",
  city: "",
  state: "",
  country: "México",
  logoPath: "",
  markPath: "",
  bankAccounts: [
    {
      bank: "Banco",
      accountHolder: "",
      accountNumber: "",
      clabe: "",
      currency: "MXN",
    },
  ],
  orderInstructions: [
    "Revisar códigos y cantidades.",
    "Enviar esta preorden a su asesor.",
    "Esperar confirmación de existencia y precio final.",
    "Realizar pago o anticipo.",
    "Enviar comprobante.",
    "La orden queda confirmada hasta validación comercial.",
  ],
  commercialTerms:
    "Esta preorden no es factura ni orden confirmada. Disponibilidad, precios, crédito, tiempos de entrega y envío están sujetos a confirmación.",
};

export const bankAccounts = companyInfo.bankAccounts;
