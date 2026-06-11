import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { normalizeText } from "../../utils/textNormalizer";
import { fetchClientAccessStatuses, fetchClientPreorderStats } from "../../services/supabaseCatalog";

const displayContactEmail = (email) =>
  String(email || "").endsWith("@prospect.local") ? "-" : email || "-";

const fmtDate = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

// ─── Panel de gestión de catálogo personalizado por cliente ───────────────────

function ClientSkuPanel({ client, products = [], onSave, onClose }) {
  const [search, setSearch]         = useState("");
  const [allowedSkus, setAllowedSkus] = useState(() => client?.allowed_skus || []);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState("");
  const [importing, setImporting]   = useState(false);
  const [importMsg, setImportMsg]   = useState("");
  const importFileRef               = useRef(null);
  const isRestricted                = allowedSkus.length > 0;

  const handleExcelImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setImporting(true);
    setImportMsg("");
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      const sheetName = workbook.SheetNames.find((n) => normalizeText(n) === "preorden")
        ?? workbook.SheetNames[0];

      if (!sheetName) { setImportMsg("❌ El archivo no contiene hojas."); return; }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!rows.length) { setImportMsg("❌ La hoja está vacía."); return; }

      const sampleRow = rows[0];
      const codigoKey = Object.keys(sampleRow).find(
        (k) => normalizeText(String(k)) === "codigo"
      );

      if (!codigoKey) { setImportMsg("❌ No se encontró columna 'codigo' en el archivo."); return; }

      const rawCodes = rows
        .map((row) => String(row[codigoKey] ?? "").trim())
        .filter((c) => c && c.toLowerCase() !== "codigo");

      const uniqueCodes = [...new Set(rawCodes)];
      const productCodes = new Set(products.map((p) => p.codigo));
      const validCodes   = uniqueCodes.filter((c) => productCodes.has(c));
      const invalidCodes = uniqueCodes.filter((c) => !productCodes.has(c));
      const existingSet  = new Set(allowedSkus);
      const newCodes     = validCodes.filter((c) => !existingSet.has(c));

      if (newCodes.length > 0) setAllowedSkus((prev) => [...prev, ...newCodes]);

      let summary = `✅ ${newCodes.length} SKU${newCodes.length !== 1 ? "s" : ""} importados`;
      const alreadyIn = validCodes.length - newCodes.length;
      if (alreadyIn > 0) summary += ` (${alreadyIn} ya estaban en la lista)`;
      if (invalidCodes.length > 0) {
        const preview = invalidCodes.slice(0, 5).join(", ");
        const extra   = invalidCodes.length > 5 ? ` y ${invalidCodes.length - 5} más…` : "";
        summary += `. ${invalidCodes.length} no encontrados en el catálogo: ${preview}${extra}`;
      }
      setImportMsg(summary);
    } catch (err) {
      setImportMsg(`❌ Error al leer el archivo: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

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

  const addSku    = (codigo) => { if (!codigo || allowedSkus.includes(codigo)) return; setAllowedSkus((prev) => [...prev, codigo]); setSearch(""); };
  const removeSku = (codigo) => setAllowedSkus((prev) => prev.filter((s) => s !== codigo));

  const handleSave = async () => {
    setSaving(true); setMsg("");
    try {
      await onSave(client.id, allowedSkus);
      setMsg(`✅ Catálogo guardado — ${allowedSkus.length} SKU${allowedSkus.length !== 1 ? "s" : ""} asignados.`);
      window.setTimeout(() => onClose(), 1400);
    } catch (e) { setMsg(`❌ Error: ${e.message}`); setSaving(false); }
  };

  const handleClearRestriction = async () => {
    setSaving(true); setMsg("");
    try {
      await onSave(client.id, []);
      setAllowedSkus([]);
      setMsg("✅ Restricción eliminada. El cliente verá todos los productos.");
      window.setTimeout(() => onClose(), 1400);
    } catch (e) { setMsg(`❌ Error: ${e.message}`); setSaving(false); }
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

        <div className="sku-panel-body">
          <div className="sku-panel-toprow">
            <div className="sku-restriction-status">
              {isRestricted ? (
                <span className="sku-badge sku-badge--restricted">
                  🔒 Catálogo limitado — solo verá {allowedSkus.length} de {products.length} productos
                </span>
              ) : (
                <span className="sku-badge sku-badge--open">
                  🌐 Sin límite — verá todos los productos ({products.length})
                </span>
              )}
            </div>
            <div className="sku-import-row">
              <input ref={importFileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleExcelImport} />
              <button type="button" className="secondary-button sku-import-btn" onClick={() => importFileRef.current?.click()} disabled={importing} title="Carga un Excel con el mismo formato que la descarga de preorden">
                {importing ? "Importando…" : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Cargar desde Excel
                  </>
                )}
              </button>
              <span className="sku-import-hint">Usa el mismo archivo que descargas de la preorden</span>
            </div>
          </div>

          {importMsg && <p className={`sku-import-msg ${importMsg.startsWith("✅") ? "sku-import-msg--ok" : "sku-import-msg--err"}`}>{importMsg}</p>}

          <div className="sku-panel-workspace">
            <div className="sku-panel-search">
              <label className="sku-search-label">Agregar producto al catálogo</label>
              <div style={{ position: "relative" }}>
                <input className="rem-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por SKU, descripción, línea..." autoFocus />
                {suggestions.length > 0 && (
                  <div className="sku-suggestions">
                    {suggestions.map((p) => (
                      <button key={p.codigo} type="button" className="sku-suggestion-item" onClick={() => addSku(p.codigo)}>
                        <strong>{p.codigo}</strong><span>{p.descripcion?.slice(0, 60)}</span><b>+ Agregar</b>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="sku-panel-list">
              {isRestricted ? (
                <>
                  <div className="sku-search-label">Productos visibles para el cliente ({allowedSkus.length})</div>
                  <div className="sku-assigned-list">
                    {allowedSkus.map((codigo) => {
                      const product = products.find((p) => p.codigo === codigo);
                      return (
                        <div key={codigo} className="sku-assigned-item">
                          <span className="sku-code">{codigo}</span>
                          {product && <span className="sku-desc">{product.descripcion?.slice(0, 50)}</span>}
                          <button type="button" className="sku-remove" onClick={() => removeSku(codigo)} title={`Quitar ${codigo}`}>×</button>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="sku-empty-hint">Sin límite activo — el cliente ve todos los productos. Carga un Excel o busca productos para definir su catálogo personalizado.</p>
              )}
            </div>
          </div>

          {msg && <p className={`sku-import-msg ${msg.startsWith("✅") ? "sku-import-msg--ok" : "sku-import-msg--err"}`}>{msg}</p>}
        </div>

        <footer>
          <div style={{ display: "flex", gap: 8, flex: 1 }}>
            {isRestricted && (
              <button type="button" className="secondary-button" onClick={handleClearRestriction} disabled={saving} title="Quitar el límite — el cliente vuelve a ver todos los productos">
                Sin límite (ver todo)
              </button>
            )}
          </div>
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="primary-button" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : isRestricted ? `Habilitar ${allowedSkus.length} SKU${allowedSkus.length !== 1 ? "s" : ""} visibles` : "Guardar sin límite"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Mini-center de actividad por cliente ─────────────────────────────────────

function ClientMiniCenter({ client, hasAccess, stats, onViewPreorders, onClose }) {
  const [inviteMsg, setInviteMsg] = useState("");

  const handleCopyInvite = () => {
    const appUrl = window.location.origin;
    const clientName = client.company || client.name || "cliente";
    const text =
      `Hola ${clientName}!\n\n` +
      `Te invitamos a acceder a nuestro catálogo B2B en:\n${appUrl}\n\n` +
      `Regístrate usando el correo: ${client.email}\n\n` +
      `Una vez registrado podrás explorar el catálogo y generar preórdenes directamente.`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => { setInviteMsg("Mensaje copiado al portapapeles"); window.setTimeout(() => setInviteMsg(""), 3000); })
        .catch(() => window.prompt("Copia este mensaje para el cliente:", text));
    } else {
      window.prompt("Copia este mensaje para el cliente:", text);
    }
  };

  const total    = stats?.total    ?? 0;
  const active   = stats?.active   ?? 0;
  const skuCount = client.allowed_skus?.length ?? 0;
  const lastDate = fmtDate(stats?.lastDate);

  return (
    <div className="client-mini-center">
      <div className="client-mini-center-header">
        <span className="client-mini-center-eyebrow">Centro de actividad — {client.company || client.name}</span>
        {hasAccess ? (
          <span className="client-access-badge client-access-badge--active">
            <span className="client-access-badge__dot" />
            Con acceso
          </span>
        ) : (
          <span className="client-access-badge client-access-badge--none">Sin cuenta activa</span>
        )}
      </div>

      <div className="client-mini-center-stats">
        <div className="client-stat-box">
          <div className="client-stat-value">{total}</div>
          <div className="client-stat-label">Preórdenes total</div>
        </div>
        <div className="client-stat-box">
          <div className={`client-stat-value${active > 0 ? " client-stat-value--warn" : ""}`}>{active}</div>
          <div className="client-stat-label">Activas / pendientes</div>
        </div>
        <div className="client-stat-box">
          <div className="client-stat-value">{skuCount > 0 ? skuCount : "—"}</div>
          <div className="client-stat-label">{skuCount > 0 ? "SKUs asignados" : "Sin límite de SKU"}</div>
        </div>
        <div className="client-stat-box">
          <div className="client-stat-value" style={{ fontSize: lastDate ? 13 : 20 }}>
            {lastDate || "—"}
          </div>
          <div className="client-stat-label">Última preorden</div>
        </div>
      </div>

      <div className="client-mini-center-actions">
        <button
          type="button"
          className="primary-button compact-action"
          onClick={() => { onViewPreorders(client.id); onClose(); }}
          disabled={total === 0}
          title={total === 0 ? "Este cliente no tiene preórdenes aún" : `Ver las ${total} preórdenes de ${client.company || client.name}`}
        >
          Ver preórdenes del cliente ↗
        </button>
        {!hasAccess ? (
          <button type="button" className="secondary-button compact-action" onClick={handleCopyInvite}>
            Copiar invitación al portapapeles
          </button>
        ) : (
          <button type="button" className="secondary-button compact-action" onClick={handleCopyInvite}>
            Copiar link de acceso
          </button>
        )}
        {inviteMsg && <span className="client-invite-msg">{inviteMsg}</span>}
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
  // Labor list management
  laborLists = [],
  onSaveClientLaborList,
  // Access management
  tenantId = "",
  onViewClientPreorders,
}) {
  const [skuClient,         setSkuClient]         = useState(null);
  const [expandedClientId,  setExpandedClientId]  = useState(null);
  const [accessMap,         setAccessMap]         = useState(new Map());
  const [statsMap,          setStatsMap]          = useState(new Map());

  // Stable key to avoid re-loading on every render while still reacting to list changes
  const clientIdKey = useMemo(
    () => filteredClients.map((c) => c.id).join(","),
    [filteredClients]
  );

  useEffect(() => {
    if (!filteredClients.length) return;
    let cancelled = false;
    const emails    = filteredClients.map((c) => c.email).filter(Boolean);
    const ids       = filteredClients.map((c) => c.id).filter(Boolean);
    const timer = window.setTimeout(async () => {
      try {
        const [access, stats] = await Promise.all([
          fetchClientAccessStatuses(emails),
          fetchClientPreorderStats(ids, tenantId),
        ]);
        if (!cancelled) { setAccessMap(access); setStatsMap(stats); }
      } catch {
        // non-fatal — badges just stay empty
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientIdKey, tenantId]);

  const toggleExpanded = (clientId) =>
    setExpandedClientId((prev) => (prev === clientId ? null : clientId));

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
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="Buscar por nombre, empresa, RFC, celular o email..."
          />
        </div>
        <select value={clientStatusFilter} onChange={(e) => setClientStatusFilter(e.target.value)}>
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
                const priceList   = priceLists.find((item) => item.id === assignedPriceList?.price_list_id);
                const initials    = (client.company || client.name || "?").trim().slice(0, 1).toUpperCase();
                const skuCount    = client.allowed_skus?.length || 0;
                const isExpanded  = expandedClientId === client.id;
                const hasAccess   = accessMap.get(String(client.email || "").toLowerCase()) === true;
                return (
                  <Fragment key={client.id}>
                    <tr className={isExpanded ? "client-row--expanded" : ""}>
                      <td>
                        <div className="client-name-cell">
                          <span>{initials}</span>
                          <div>
                            <strong>{client.company || client.name || "Sin nombre"}</strong>
                            {client.company && client.name ? <small>{client.name}</small> : null}
                          </div>
                          {/* Inline access dot — visible at a glance without expanding */}
                          <span
                            title={hasAccess ? "Cliente con cuenta activa" : "Sin cuenta activa"}
                            style={{
                              width: 7, height: 7, borderRadius: "50%",
                              background: hasAccess ? "#22c55e" : "#d1d5db",
                              display: "inline-block", flexShrink: 0,
                            }}
                          />
                        </div>
                      </td>
                      <td>{client.rfc || "-"}</td>
                      <td>{client.phone || "-"}</td>
                      <td>{displayContactEmail(client.email)}</td>
                      <td>{priceList?.name || "Sin lista"}</td>
                      <td>
                        {skuCount > 0 ? (
                          <span className="sku-badge sku-badge--restricted sku-badge--sm">🔒 {skuCount} SKUs</span>
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
                          <button className="secondary-button compact-action" type="button"
                            onClick={() => { setClientForm({ ...blankClient, ...client }); setIsClientFormOpen(true); }}>
                            Editar
                          </button>
                          <button className="secondary-button compact-action" type="button"
                            onClick={() => setSelectedClientId(client.id)}>
                            Precios
                          </button>
                          <button className="secondary-button compact-action" type="button"
                            onClick={() => setSkuClient(client)} title="Administrar catálogo personalizado">
                            Catálogo
                          </button>
                          <button
                            className={`secondary-button compact-action${isExpanded ? " active-detail" : ""}`}
                            type="button"
                            onClick={() => toggleExpanded(client.id)}
                            title={isExpanded ? "Cerrar actividad" : "Ver actividad, accesos y preórdenes"}
                          >
                            {isExpanded ? "▴ Cerrar" : "▾ Actividad"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr key={`${client.id}-detail`} className="client-detail-row">
                        <td colSpan="8">
                          <ClientMiniCenter
                            client={client}
                            hasAccess={hasAccess}
                            stats={statsMap.get(client.id)}
                            onViewPreorders={onViewClientPreorders || (() => {})}
                            onClose={() => setExpandedClientId(null)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
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
                  onChange={(e) => handlePriceListToggle(priceList.id, e.target.checked)}
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
                <input value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} />
              </label>
              <label>RFC
                <input value={clientForm.rfc} onChange={(e) => setClientForm({ ...clientForm, rfc: e.target.value })} />
              </label>
              <label>Celular
                <input value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} />
              </label>
              <label className="wide-field">Empresa
                <input value={clientForm.company} onChange={(e) => setClientForm({ ...clientForm, company: e.target.value })} />
              </label>
              <label className="wide-field">Email
                <input value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} />
              </label>
              <label className="wide-field">Estado
                <select
                  value={clientForm.active === false ? "inactive" : "active"}
                  onChange={(e) => setClientForm({ ...clientForm, active: e.target.value === "active" })}
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </label>
              {laborLists.length > 0 && (
                <label className="wide-field">
                  Lista de labores
                  <select
                    value={clientForm.labor_list_id || ""}
                    onChange={(e) => setClientForm({ ...clientForm, labor_list_id: e.target.value || null })}
                  >
                    <option value="">Sin lista (precios base)</option>
                    {laborLists
                      .filter((list) => list.status === "activa")
                      .map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name} ({list.currency || "MXN"})
                        </option>
                      ))}
                  </select>
                  <small style={{ color: "var(--romea-muted)", fontSize: 11, marginTop: 3, display: "block" }}>
                    Se auto-aplica cuando el cliente crea su preorden
                  </small>
                </label>
              )}
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
