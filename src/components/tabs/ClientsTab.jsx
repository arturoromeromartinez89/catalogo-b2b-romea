import { useMemo, useState } from "react";
import { normalizeText } from "../../utils/textNormalizer";

const displayContactEmail = (email) =>
  String(email || "").endsWith("@prospect.local") ? "-" : email || "-";

// ─── Panel de gestión de catálogo personalizado por cliente ───────────────────

function ClientSkuPanel({ client, products = [], onSave, onClose }) {
  const [search, setSearch]     = useState("");
  const [allowedSkus, setAllowedSkus] = useState(() => client?.allowed_skus || []);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState("");
  const isRestricted            = allowedSkus.length > 0;

  // Sugerencias de búsqueda para agregar SKUs
  const suggestions = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = normalizeText(search);
    return products
      .filter((p) =>
        !allowedSkus.includes(p.codigo) &&
        normalizeText([p.codigo, p.descripcion, p.linea, p.familia].join(" ")).includes(q)
      )
      .slice(0, 10);
  }, [search, products, allowedSkus]);

  const addSku = (codigo) => {
    if (!codigo || allowedSkus.includes(codigo)) return;
    setAllowedSkus((prev) => [...prev, codigo]);
    setSearch("");
  };

  const removeSku = (codigo) =>
    setAllowedSkus((prev) => prev.filter((s) => s !== codigo));

  const handleSave = async () => {
    setSaving(true);
    setMsg("");
    try {
      await onSave(client.id, allowedSkus);
      setMsg("Catálogo guardado.");
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClearRestriction = async () => {
    setSaving(true);
    setMsg("");
    try {
      await onSave(client.id, []);
      setAllowedSkus([]);
      setMsg("Restricción eliminada. El cliente verá todos los productos.");
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="client-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="client-modal client-modal--wide">
        <header>
          <div>
            <h2>Catálogo personalizado</h2>
            <p style={{ fontSize: 13, color: "var(--romea-muted)", margin: "2px 0 0" }}>
              {client.company || client.name}
            </p>
          </div>
          <button className="icon-button" type="button" aria-label="Cerrar" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </header>

        <div className="client-modal-body" style={{ gap: 16 }}>

          {/* Estado actual */}
          <div className="sku-restriction-status">
            {isRestricted ? (
              <span className="sku-badge sku-badge--restricted">
                🔒 Restringido — {allowedSkus.length} SKU{allowedSkus.length !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="sku-badge sku-badge--open">
                🌐 Sin restricción — ve todos los productos ({products.length})
              </span>
            )}
          </div>

          {/* Buscador para agregar SKUs */}
          <div style={{ position: "relative" }}>
            <label style={{ fontWeight: 700, fontSize: 12, display: "block", marginBottom: 6 }}>
              Agregar producto al catálogo personalizado
            </label>
            <input
              className="rem-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por SKU, descripción, línea..."
              autoFocus
            />
            {suggestions.length > 0 && (
              <div className="sku-suggestions">
                {suggestions.map((p) => (
                  <button key={p.codigo} type="button" className="sku-suggestion-item" onClick={() => addSku(p.codigo)}>
                    <strong>{p.codigo}</strong>
                    <span>{p.descripcion?.slice(0, 60)}</span>
                    <b>+ Agregar</b>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lista de SKUs asignados */}
          {isRestricted ? (
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8 }}>
                SKUs asignados ({allowedSkus.length})
              </div>
              <div className="sku-assigned-list">
                {allowedSkus.map((codigo) => {
                  const product = products.find((p) => p.codigo === codigo);
                  return (
                    <div key={codigo} className="sku-assigned-item">
                      <span className="sku-code">{codigo}</span>
                      {product && (
                        <span className="sku-desc">{product.descripcion?.slice(0, 50)}</span>
                      )}
                      <button
                        type="button"
                        className="sku-remove"
                        onClick={() => removeSku(codigo)}
                        title={`Quitar ${codigo}`}
                      >×</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p style={{ color: "var(--romea-muted)", fontSize: 13 }}>
              Este cliente tiene acceso a todo el catálogo. Agrega productos arriba para crear una selección personalizada.
            </p>
          )}

          {msg && <p className="status info">{msg}</p>}
        </div>

        <footer>
          <div style={{ display: "flex", gap: 8, flex: 1 }}>
            {isRestricted && (
              <button
                type="button"
                className="danger-button"
                onClick={handleClearRestriction}
                disabled={saving}
                title="Eliminar la restricción y dar acceso a todos los productos"
              >
                Quitar restricción
              </button>
            )}
          </div>
          <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="primary-button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar catálogo"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

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
  // SKU management
  products = [],
  onSaveClientSkus,
}) {
  const [skuClient, setSkuClient] = useState(null);

  return (
    <section className="admin-workspace clients-workspace">
      <div className="clients-page-header">
        <div>
          <h2>Clientes</h2>
          <p>
            {filteredClients.length.toLocaleString()} de {allClientsCount.toLocaleString()} clientes
          </p>
        </div>
        <button
          className="new-client-button"
          type="button"
          onClick={() => { setClientForm(blankClient); setIsClientFormOpen(true); }}
        >
          + Nuevo cliente
        </button>
      </div>

      <div className="clients-filter-card">
        <div className="client-search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
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
                <th>Catálogo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length ? filteredClients.map((client) => {
                const assignedPriceList = clientPriceLists.find((item) => item.client_id === client.id);
                const priceList = priceLists.find((item) => item.id === assignedPriceList?.price_list_id);
                const initials = (client.company || client.name || "?").trim().slice(0, 1).toUpperCase();
                const skuCount = client.allowed_skus?.length || 0;
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
                      {skuCount > 0 ? (
                        <span className="sku-badge sku-badge--restricted sku-badge--sm">
                          🔒 {skuCount} SKUs
                        </span>
                      ) : (
                        <span className="sku-badge sku-badge--open sku-badge--sm">Todo</span>
                      )}
                    </td>
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
                          onClick={() => { setClientForm({ ...blankClient, ...client }); setIsClientFormOpen(true); }}
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
                        <button
                          className="secondary-button compact-action"
                          type="button"
                          onClick={() => setSkuClient(client)}
                          title="Administrar catálogo personalizado"
                        >
                          Catálogo
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="8" className="empty-row">No hay clientes con esos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Panel de lista de precios */}
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

      {/* Modal editar/crear cliente */}
      {isClientFormOpen ? (
        <div className="client-modal-backdrop">
          <section className="client-modal">
            <header>
              <h2>{clientForm.id ? "Editar cliente" : "Nuevo cliente"}</h2>
              <button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setIsClientFormOpen(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
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
              <button className="secondary-button" type="button" onClick={() => setIsClientFormOpen(false)}>
                Cancelar
              </button>
              <button className="new-client-button" type="button" onClick={handleSaveClient} disabled={savingClient}>
                {savingClient ? "Guardando..." : "Guardar"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {/* Modal de catálogo personalizado */}
      {skuClient ? (
        <ClientSkuPanel
          client={skuClient}
          products={products}
          onSave={async (clientId, skus) => {
            await onSaveClientSkus(clientId, skus);
            setSkuClient((prev) => prev ? { ...prev, allowed_skus: skus.length ? skus : null } : null);
          }}
          onClose={() => setSkuClient(null)}
        />
      ) : null}
    </section>
  );
}
