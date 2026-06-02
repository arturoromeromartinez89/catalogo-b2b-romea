const displayContactEmail = (email) =>
  String(email || "").endsWith("@prospect.local") ? "-" : email || "-";

export default function ClientsTab({
  filteredClients,
  allClientsCount,
  clientSearch,
  setClientSearch,
  clientStatusFilter,
  setClientStatusFilter,
  priceLists,
  clientPriceLists,
  selectedClientId,
  setSelectedClientId,
  selectedClient,
  isClientPriceActive,
  handlePriceListToggle,
  isClientFormOpen,
  setIsClientFormOpen,
  clientForm,
  setClientForm,
  blankClient,
  savingClient,
  handleSaveClient,
}) {
  return (
    <section className="admin-workspace clients-workspace">
      <div className="clients-page-header">
        <div>
          <h2>Clientes</h2>
          <p>{filteredClients.length.toLocaleString()} de {allClientsCount.toLocaleString()} clientes</p>
        </div>
        <button
          className="new-client-button"
          type="button"
          onClick={() => {
            setClientForm(blankClient);
            setIsClientFormOpen(true);
          }}
        >
          + Nuevo cliente
        </button>
      </div>

      <div className="clients-filter-card">
        <div className="client-search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={clientSearch}
            onChange={(event) => setClientSearch(event.target.value)}
            placeholder="Buscar por nombre, empresa, RFC, celular o email..."
          />
        </div>
        <select value={clientStatusFilter} onChange={(event) => setClientStatusFilter(event.target.value)}>
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      <div className="clients-table-card">
        <div className="responsive-table">
          <table className="simple-admin-table clients-directory-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>RFC</th>
                <th>Celular</th>
                <th>Email</th>
                <th>Lista de precios</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length ? filteredClients.map((client) => {
                const assignedPriceList = clientPriceLists.find((item) => item.client_id === client.id);
                const priceList = priceLists.find((item) => item.id === assignedPriceList?.price_list_id);
                const initials = (client.company || client.name || "?").trim().slice(0, 1).toUpperCase();
                return (
                  <tr key={client.id}>
                    <td>
                      <div className="client-name-cell">
                        <span>{initials}</span>
                        <strong>{client.company || client.name || "Sin nombre"}</strong>
                        {client.company && client.name ? <small>{client.name}</small> : null}
                      </div>
                    </td>
                    <td>{client.rfc || "-"}</td>
                    <td>{client.phone || "-"}</td>
                    <td>{displayContactEmail(client.email)}</td>
                    <td>{priceList?.name || "Sin lista"}</td>
                    <td>
                      <span className={`client-status-pill ${client.active === false ? "inactive" : "active"}`}>
                        {client.active === false ? "Inactivo" : "Activo"}
                      </span>
                    </td>
                    <td>
                      <div className="client-action-row">
                        <button
                          className="secondary-button compact-action"
                          type="button"
                          onClick={() => {
                            setClientForm({ ...blankClient, ...client });
                            setIsClientFormOpen(true);
                          }}
                        >
                          Editar
                        </button>
                        <button
                          className="secondary-button compact-action"
                          type="button"
                          onClick={() => setSelectedClientId(client.id)}
                        >
                          Precios
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="7" className="empty-row">No hay clientes con esos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedClient ? (
        <div className="clients-pricing-panel">
          <div>
            <span className="tool-eyebrow">Lista de precios</span>
            <h3>{selectedClient.company || selectedClient.name}</h3>
            <p>Selecciona la lista activa para este cliente.</p>
          </div>
          <div className="client-price-list-options">
            {priceLists.map((priceList) => (
              <label className="switch-row" key={priceList.id}>
                <input
                  type="checkbox"
                  checked={isClientPriceActive(priceList.id)}
                  onChange={(event) => handlePriceListToggle(priceList.id, event.target.checked)}
                />
                <span>{priceList.name}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {isClientFormOpen ? (
        <div className="client-modal-backdrop">
          <section className="client-modal">
            <header>
              <h2>{clientForm.id ? "Editar cliente" : "Nuevo cliente"}</h2>
              <button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setIsClientFormOpen(false)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </header>
            <div className="client-modal-body">
              <label className="wide-field">Nombre <span>*</span>
                <input value={clientForm.name} onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })} />
              </label>
              <label>RFC
                <input value={clientForm.rfc} onChange={(event) => setClientForm({ ...clientForm, rfc: event.target.value })} />
              </label>
              <label>Celular
                <input value={clientForm.phone} onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })} />
              </label>
              <label className="wide-field">Empresa
                <input value={clientForm.company} onChange={(event) => setClientForm({ ...clientForm, company: event.target.value })} />
              </label>
              <label className="wide-field">Email
                <input value={clientForm.email} onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })} />
              </label>
              <label className="wide-field">Estado
                <select
                  value={clientForm.active === false ? "inactive" : "active"}
                  onChange={(event) => setClientForm({ ...clientForm, active: event.target.value === "active" })}
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </label>
            </div>
            <footer>
              <button className="secondary-button" type="button" onClick={() => setIsClientFormOpen(false)}>Cancelar</button>
              <button className="new-client-button" type="button" onClick={handleSaveClient} disabled={savingClient}>
                {savingClient ? "Guardando..." : "Guardar"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
