export default function CustomerForm({ customer, onChange }) {
  const update = (key, value) => onChange({ ...customer, [key]: value });

  return (
    <div className="cart-form-sections">
      <section className="cart-section">
        <h3>Cliente</h3>
        <div className="form-grid">
          <label>
            Nombre del cliente
            <input value={customer.name} onChange={(event) => update("name", event.target.value)} />
          </label>
          <label>
            Empresa
            <input value={customer.company} onChange={(event) => update("company", event.target.value)} />
          </label>
          <label>
            Teléfono
            <input value={customer.phone} onChange={(event) => update("phone", event.target.value)} />
          </label>
          <label>
            Correo
            <input type="email" value={customer.email} onChange={(event) => update("email", event.target.value)} />
          </label>
          <label>
            RFC
            <input value={customer.rfc} onChange={(event) => update("rfc", event.target.value)} />
          </label>
          <label className="wide">
            Observaciones
            <textarea rows="3" value={customer.notes} onChange={(event) => update("notes", event.target.value)} />
          </label>
        </div>
      </section>

      <section className="cart-section">
        <h3>Enviar a / Ship To</h3>
        <div className="form-grid">
          <label>
            Nombre o empresa destino
            <input value={customer.shipToName} onChange={(event) => update("shipToName", event.target.value)} />
          </label>
          <label>
            Contacto de recepción
            <input value={customer.shipToContact} onChange={(event) => update("shipToContact", event.target.value)} />
          </label>
          <label className="wide">
            Dirección
            <input value={customer.shipToAddress} onChange={(event) => update("shipToAddress", event.target.value)} />
          </label>
          <label>
            Ciudad
            <input value={customer.shipToCity} onChange={(event) => update("shipToCity", event.target.value)} />
          </label>
          <label>
            Estado
            <input value={customer.shipToState} onChange={(event) => update("shipToState", event.target.value)} />
          </label>
          <label>
            Código postal
            <input value={customer.shipToZip} onChange={(event) => update("shipToZip", event.target.value)} />
          </label>
          <label>
            País
            <input value={customer.shipToCountry} onChange={(event) => update("shipToCountry", event.target.value)} />
          </label>
          <label>
            Teléfono de recepción
            <input value={customer.shipToPhone} onChange={(event) => update("shipToPhone", event.target.value)} />
          </label>
        </div>
      </section>
    </div>
  );
}
