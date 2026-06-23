import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { normalizeText } from "../../utils/textNormalizer";
import { fetchClientAccessStatuses, fetchClientPreorderStats, fetchClientProfileStatus, sendClientAccessEmail, setClientProfileActive } from "../../services/supabaseCatalog";
import { getAppUrl } from "../../utils/basePath";

const displayContactEmail = (email) =>
  String(email || "").endsWith("@prospect.local") ? "-" : email || "-";

const fmtDate = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
};

// ─── Catálogo permitido dentro de la página del cliente ──────────────────────

function ClientCatalogAccessSection({ client, products = [], onSave }) {
  const [search, setSearch] = useState("");
  const [allowedSkus, setAllowedSkus] = useState(() => client?.allowed_skus || []);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const importFileRef = useRef(null);
  const isRestricted = allowedSkus.length > 0;
  const isNew = !client?.id;

  useEffect(() => {
    setAllowedSkus(client?.allowed_skus || []);
    setSearch("");
    setMsg("");
    setImportMsg("");
  }, [client?.id, client?.allowed_skus]);

  const handleExcelImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    setImporting(true);
    setImportMsg("");
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames.find((name) => normalizeText(name) === "preorden") || workbook.SheetNames[0];
      if (!sheetName) {
        setImportMsg("El archivo no contiene hojas.");
        return;
      }

      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
      if (!rows.length) {
        setImportMsg("La hoja está vacía.");
        return;
      }

      const codigoKey = Object.keys(rows[0]).find((key) => normalizeText(String(key)) === "codigo");
      if (!codigoKey) {
        setImportMsg("No se encontró columna 'codigo' en el archivo.");
        return;
      }

      const rawCodes = rows
        .map((row) => String(row[codigoKey] ?? "").trim())
        .filter((code) => code && code.toLowerCase() !== "codigo");
      const uniqueCodes = [...new Set(rawCodes)];
      const productCodes = new Set(products.map((product) => product.codigo));
      const validCodes = uniqueCodes.filter((code) => productCodes.has(code));
      const invalidCodes = uniqueCodes.filter((code) => !productCodes.has(code));
      const existing = new Set(allowedSkus);
      const newCodes = validCodes.filter((code) => !existing.has(code));

      if (newCodes.length) setAllowedSkus((prev) => [...prev, ...newCodes]);
      const invalidText = invalidCodes.length
        ? ` ${invalidCodes.length} no encontrados: ${invalidCodes.slice(0, 5).join(", ")}${invalidCodes.length > 5 ? "..." : ""}.`
        : "";
      setImportMsg(`${newCodes.length} productos importados.${invalidText}`);
    } catch (error) {
      setImportMsg(`Error al leer el archivo: ${error.message}`);
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
      .slice(0, 8);
  }, [search, products, allowedSkus]);

  const addSku = (codigo) => {
    if (!codigo || allowedSkus.includes(codigo)) return;
    setAllowedSkus((prev) => [...prev, codigo]);
    setSearch("");
  };
  const removeSku = (codigo) => setAllowedSkus((prev) => prev.filter((s) => s !== codigo));

  const save = async (nextSkus = allowedSkus) => {
    if (isNew) {
      setMsg("Primero guarda la información comercial del cliente.");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      await onSave(client.id, nextSkus);
      setAllowedSkus(nextSkus);
      setMsg(nextSkus.length ? `Catálogo guardado: ${nextSkus.length} productos visibles.` : "Sin límite: el cliente verá todo el catálogo.");
    } catch (e) {
      setMsg(`No se pudo guardar: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="client-management-section">
      <div className="client-management-section__head">
        <div>
          <h3>Catálogo permitido</h3>
          <p>Define si este cliente ve todo el catálogo o solo productos seleccionados.</p>
        </div>
        {isRestricted ? (
          <span className="sku-badge sku-badge--restricted sku-badge--sm">🔒 {allowedSkus.length} productos</span>
        ) : (
          <span className="sku-badge sku-badge--open sku-badge--sm">Sin límite</span>
        )}
      </div>

      {isNew ? (
        <p className="client-credentials-hint warn">Primero crea el cliente para poder configurar su catálogo permitido.</p>
      ) : null}

      <div className="sku-panel-toprow client-catalog-status-row">
        <div className="sku-restriction-status">
          {isRestricted ? (
            <span className="sku-badge sku-badge--restricted">
              🔒 Catálogo limitado: verá {allowedSkus.length} de {products.length} productos
            </span>
          ) : (
            <span className="sku-badge sku-badge--open">
              Sin límite: verá todos los productos ({products.length})
            </span>
          )}
        </div>
        <div className="sku-import-row">
          <input ref={importFileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleExcelImport} />
          <button type="button" className="secondary-button sku-import-btn" onClick={() => importFileRef.current?.click()} disabled={importing || isNew}>
            {importing ? "Importando..." : "Cargar desde Excel"}
          </button>
          <span className="sku-import-hint">Usa un Excel con columna codigo.</span>
        </div>
      </div>

      {importMsg ? <p className={`sku-import-msg ${importMsg.startsWith("Error") || importMsg.startsWith("No ") || importMsg.startsWith("La ") ? "sku-import-msg--err" : "sku-import-msg--ok"}`}>{importMsg}</p> : null}

      <div className="client-catalog-access">
        <div className="client-catalog-search">
          <label className="sku-search-label">Agregar producto</label>
          <div className="client-catalog-search__box">
            <input
              className="rem-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por código, descripción, línea..."
            />
            {suggestions.length > 0 ? (
              <div className="sku-suggestions">
                {suggestions.map((p) => (
                  <button key={p.codigo} type="button" className="sku-suggestion-item" onClick={() => addSku(p.codigo)}>
                    <strong>{p.codigo}</strong><span>{p.descripcion?.slice(0, 60)}</span><b>+ Agregar</b>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <p className="client-mini-hint">Al agregar uno o más productos, el catálogo queda limitado a esa selección.</p>
        </div>

        <div className="client-catalog-list">
          {isRestricted ? (
            <div className="sku-assigned-list client-catalog-list__items">
              {allowedSkus.map((codigo) => {
                const product = products.find((p) => p.codigo === codigo);
                return (
                  <div key={codigo} className="sku-assigned-item">
                    <span className="sku-code">{codigo}</span>
                    {product ? <span className="sku-desc">{product.descripcion?.slice(0, 56)}</span> : null}
                    <button type="button" className="sku-remove" onClick={() => removeSku(codigo)} title={`Quitar ${codigo}`}>×</button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="sku-empty-hint">Sin límite activo. El cliente ve todos los productos visibles del tenant.</p>
          )}
        </div>
      </div>

      {msg ? <p className={`client-cred-msg${msg.startsWith("No ") ? " client-cred-msg--err" : ""}`}>{msg}</p> : null}

      <div className="client-management-actions">
        {isRestricted ? (
          <button type="button" className="secondary-button" onClick={() => save([])} disabled={saving || isNew}>
            Quitar límite
          </button>
        ) : null}
        <button type="button" className="primary-button" onClick={() => save()} disabled={saving || isNew}>
          {saving ? "Guardando..." : "Guardar catálogo"}
        </button>
      </div>
    </div>
  );
}

function ClientInfoSection({ client, blankClient, saving, onSave }) {
  const [draft, setDraft] = useState(() => ({ ...blankClient, ...client }));
  const [msg, setMsg] = useState("");
  const isNew = !client?.id;

  useEffect(() => {
    setDraft({ ...blankClient, ...client });
    setMsg("");
  }, [client, blankClient]);

  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    setMsg("");
    const saved = await onSave(draft);
    if (saved) setMsg(isNew ? "Cliente creado. Ya puedes configurar accesos, precios y catálogo." : "Información guardada.");
  };

  return (
    <div className="client-management-section client-management-section--wide">
      <div className="client-management-section__head">
        <div>
          <h3>Información comercial</h3>
          <p>Datos base del cliente. Esta es la primera parte de su hoja madre.</p>
        </div>
      </div>
      <div className="client-info-form">
        <label>Nombre
          <input value={draft.name || ""} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label>Empresa
          <input value={draft.company || ""} onChange={(e) => set("company", e.target.value)} />
        </label>
        <label>Correo
          <input value={draft.email && !String(draft.email).endsWith("@prospect.local") ? draft.email : ""} onChange={(e) => set("email", e.target.value)} />
        </label>
        <label>Celular
          <input value={draft.phone || ""} onChange={(e) => set("phone", e.target.value)} />
        </label>
        <label>RFC
          <input value={draft.rfc || ""} onChange={(e) => set("rfc", e.target.value)} />
        </label>
        <label>Estado
          <select value={draft.active === false ? "inactive" : "active"} onChange={(e) => set("active", e.target.value === "active")}>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </label>
      </div>
      {msg ? <p className="client-cred-msg">{msg}</p> : null}
      <div className="client-management-actions">
        <button type="button" className="primary-button" onClick={save} disabled={saving}>
          {saving ? "Guardando..." : isNew ? "Crear cliente" : "Guardar información"}
        </button>
      </div>
    </div>
  );
}

// ─── Página de gestión por cliente ───────────────────────────────────────────

function ClientManagementPage({
  client,
  blankClient,
  savingClient,
  onSaveClientDetails,
  hasAccess,
  stats,
  onViewPreorders,
  onBack,
  onAccessGranted,
  laborLists = [],
  onSaveLaborList,
  products = [],
  onSaveClientSkus,
}) {
  const rawEmail = client.email && !String(client.email).endsWith("@prospect.local") ? client.email : "";
  const [laborSel, setLaborSel] = useState(client.labor_list_id || "");
  const [savingLabor, setSavingLabor] = useState(false);
  const [creating,     setCreating]     = useState(false);
  const [passwordForm, setPasswordForm] = useState({ password: "", confirm: "" });
  const [accessStatus, setAccessStatus] = useState(hasAccess ? "active" : "none");
  const [profileActive, setProfileActive] = useState(null);  // null=cargando, true/false
  const [toggling,     setToggling]     = useState(false);
  const [msg,          setMsg]          = useState({ text: "", ok: true });

  const total    = stats?.total    ?? 0;
  const active   = stats?.active   ?? 0;
  const skuCount = client.allowed_skus?.length ?? 0;
  const lastDate = fmtDate(stats?.lastDate);
  const isProspectEmail = !rawEmail;
  const isNew = !client?.id;

  // Cargar estado activo/suspendido del perfil cuando hay cuenta
  useEffect(() => {
    if (!rawEmail || accessStatus !== "active") return;
    fetchClientProfileStatus(rawEmail).then((p) => {
      setProfileActive(p ? p.active !== false : true);
    }).catch(() => setProfileActive(true));
  }, [rawEmail, accessStatus]);

  const showMsg = (text, ok = true) => {
    setMsg({ text, ok });
    if (ok) window.setTimeout(() => setMsg({ text: "", ok: true }), 4000);
  };

  const handleSaveLabor = async (val) => {
    setLaborSel(val);
    setSavingLabor(true);
    try {
      await onSaveLaborList?.(client.id, val || null);
      showMsg("Lista de precios actualizada. El cliente verá esa mano de obra.");
    } catch (e) {
      showMsg(`No se pudo guardar la lista: ${e.message}`, false);
    } finally {
      setSavingLabor(false);
    }
  };

  const handleSendAccess = async () => {
    if (!rawEmail) { showMsg("Guarda primero un correo válido para este cliente.", false); return; }
    setCreating(true);
    try {
      const action = accessStatus === "active" ? "reset" : "invite";
      await sendClientAccessEmail(client.id, action);
      if (action === "invite") {
        setAccessStatus("active");
        setProfileActive(true);
        onAccessGranted?.();
      }
      showMsg(action === "invite"
        ? "Invitación enviada. El cliente creará su propia contraseña desde el correo."
        : "Correo de recuperación enviado.", true);
    } catch (e) {
      showMsg(e.message, false);
    } finally {
      setCreating(false);
    }
  };

  const handleSetPassword = async () => {
    if (!client.id) { showMsg("Primero guarda la información comercial del cliente.", false); return; }
    if (!rawEmail) { showMsg("Guarda primero un correo válido para este cliente.", false); return; }
    if (passwordForm.password.length < 6) { showMsg("La contraseña debe tener al menos 6 caracteres.", false); return; }
    if (passwordForm.password !== passwordForm.confirm) { showMsg("Las contraseñas no coinciden.", false); return; }
    setCreating(true);
    try {
      await sendClientAccessEmail(client.id, "set_password", { password: passwordForm.password });
      setAccessStatus("active");
      setProfileActive(true);
      setPasswordForm({ password: "", confirm: "" });
      onAccessGranted?.();
      showMsg("Acceso creado o actualizado con la contraseña indicada.", true);
    } catch (e) {
      showMsg(e.message, false);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async () => {
    if (profileActive === null) return;
    const next = !profileActive;
    setToggling(true);
    try {
      await setClientProfileActive(rawEmail, next);
      setProfileActive(next);
      showMsg(next ? "✅ Cuenta reactivada." : "✅ Cuenta suspendida. El cliente no podrá acceder.", true);
    } catch (e) {
      showMsg(`❌ ${e.message}`, false);
    } finally {
      setToggling(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!rawEmail) { showMsg("Guarda primero un correo válido para este cliente.", false); return; }
    const appUrl = getAppUrl();
    const clientName = client.company || client.name || "cliente";
    const text =
      `Hola ${clientName},\n\n` +
      `Te enviamos por correo el acceso al catálogo B2B.\n\n` +
      `🔗 Enlace: ${appUrl}\n` +
      `📧 Correo: ${rawEmail}\n\n` +
      `Abre el correo de invitación para crear tu contraseña. Nadie más podrá verla.\n` +
      `Si tienes dudas, contáctanos.`;
    try {
      await navigator.clipboard.writeText(text);
      showMsg("Invitación copiada — pégala en WhatsApp", true);
    } catch {
      window.prompt("Copia este mensaje y envíalo al cliente:", text);
    }
  };

  return (
    <div className="client-management-page">
      <div className="client-management-header">
        <button type="button" className="secondary-button client-back-button" onClick={onBack}>
          Volver a clientes
        </button>
        <div className="client-management-title">
          <span className="client-mini-center-eyebrow">Cliente</span>
          <h2>{client.company || client.name || "Sin nombre"}</h2>
          <p>{displayContactEmail(client.email)}{client.phone ? ` · ${client.phone}` : ""}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {accessStatus === "active" ? (
            <span className={`client-access-badge ${profileActive === false ? "client-access-badge--suspended" : "client-access-badge--active"}`}>
              <span className="client-access-badge__dot" />
              {profileActive === false ? "Suspendida" : "Con acceso"}
            </span>
          ) : (
            <span className="client-access-badge client-access-badge--none">Sin cuenta</span>
          )}
          {/* Toggle encender/apagar — solo visible cuando hay cuenta */}
          {accessStatus === "active" && profileActive !== null && (
            <button
              type="button"
              className={`client-toggle-btn${profileActive ? " client-toggle-btn--on" : " client-toggle-btn--off"}`}
              onClick={handleToggleActive}
              disabled={toggling}
              title={profileActive ? "Suspender acceso del cliente" : "Reactivar acceso del cliente"}
            >
              <span className="client-toggle-knob" />
            </button>
          )}
        </div>
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
          <div className="client-stat-value" style={{ fontSize: lastDate ? 13 : 20 }}>{lastDate || "—"}</div>
          <div className="client-stat-label">Última preorden</div>
        </div>
      </div>

      <div className="client-management-grid">
      <ClientInfoSection
        client={client}
        blankClient={blankClient}
        saving={savingClient}
        onSave={onSaveClientDetails}
      />

      <div className="client-management-section">
        <div className="client-management-section__head">
          <div>
            <h3>Lista de precios</h3>
            <p>Controla qué precios verá el cliente dentro de su catálogo.</p>
          </div>
        </div>
        <p className="client-mini-hint">
          El cliente verá la <strong>mano de obra</strong> de esta lista al ver los productos y al armar su preorden.
        </p>
        <select
          className="client-labor-select"
          value={laborSel}
          onChange={(e) => handleSaveLabor(e.target.value)}
          disabled={savingLabor}
        >
          <option value="">Sin lista (mano de obra base)</option>
          {laborLists
            .filter((list) => (list.status || "activa") === "activa")
            .map((list) => (
              <option key={list.id} value={list.id}>{list.name} ({list.currency || "MXN"})</option>
            ))}
        </select>
        {laborLists.length === 0 ? (
          <p className="client-mini-hint">Aún no hay listas de labores. Créalas en “Menú de precios”.</p>
        ) : null}
      </div>

      <div className="client-management-section">
        <div className="client-management-section__head">
          <div>
            <h3>Accesos</h3>
            <p>Crea o actualiza la cuenta de acceso del cliente.</p>
          </div>
        </div>

        {isProspectEmail ? (
          <p className="client-credentials-hint warn">
            Sin correo real registrado. Edita el cliente y agrega su email antes de crear acceso.
          </p>
        ) : (
          <>
            <div className="client-credentials-row">
              <div className="client-cred-label">
                Correo de acceso
                <strong className="client-access-email">{rawEmail}</strong>
              </div>
              <p className="client-credentials-hint">
                Puedes asignar una contraseña temporal aquí o enviar recuperación por correo.
              </p>
            </div>

            <div className="client-password-grid">
              <label>Nueva contraseña
                <input
                  type="password"
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm((current) => ({ ...current, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                />
              </label>
              <label>Confirmar contraseña
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm((current) => ({ ...current, confirm: e.target.value }))}
                  placeholder="Repite la contraseña"
                />
              </label>
            </div>

            {msg.text && (
              <p className={`client-cred-msg${msg.ok ? "" : " client-cred-msg--err"}`}>{msg.text}</p>
            )}

            {/* Acciones */}
            <div className="client-access-actions-grid">
              <div className="client-access-action-card">
                <button type="button" className="primary-button" style={{ width: "100%" }}
                  onClick={handleSetPassword}
                  disabled={creating || !rawEmail || isNew}>
                  {creating ? "Guardando..." : "Guardar contraseña"}
                </button>
                <p className="client-access-action-desc">
                  Crea o actualiza la cuenta con el correo del cliente y la contraseña indicada.
                </p>
              </div>

              <div className="client-access-action-card">
                <button type="button" className="secondary-button" style={{ width: "100%" }}
                  onClick={handleSendAccess}
                  disabled={creating || !rawEmail || isNew}>
                  {creating
                    ? "Enviando..."
                    : accessStatus === "active" ? "Enviar recuperación" : "Enviar acceso"}
                </button>
                <p className="client-access-action-desc">
                  {accessStatus === "active"
                    ? "El cliente recibirá un enlace para elegir una contraseña nueva."
                    : "El cliente recibirá una invitación para crear su propia contraseña."}
                </p>
              </div>

              <div className="client-access-action-card">
                <button type="button" className="secondary-button" style={{ width: "100%" }}
                  onClick={handleCopyInvite} disabled={!rawEmail || isNew}>
                  Copiar invitación
                </button>
                <p className="client-access-action-desc">
                  Copia un mensaje con el enlace y el correo, sin compartir contraseñas.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="client-management-section">
        <div className="client-management-section__head">
          <div>
            <h3>Preórdenes</h3>
            <p>Historial y pendientes generados por este cliente.</p>
          </div>
        </div>
        <div className="client-preorder-summary">
          <div><strong>{total}</strong><span>Total</span></div>
          <div><strong>{active}</strong><span>Activas</span></div>
          <div><strong>{lastDate || "-"}</strong><span>Última</span></div>
        </div>
        <div className="client-management-actions">
          <button type="button" className="secondary-button" onClick={() => onViewPreorders(client.id)} disabled={isNew || total === 0}>
            Ver preórdenes
          </button>
        </div>
      </div>

      <ClientCatalogAccessSection client={client} products={products} onSave={onSaveClientSkus} />
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
  isClientFormOpen,
  setIsClientFormOpen,
  clientForm,
  setClientForm,
  blankClient,
  savingClient,
  handleSaveClient,
  handleDeleteClient,
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
  const [managedClientId,   setManagedClientId]   = useState(null);
  const [draftManagedClient, setDraftManagedClient] = useState(null);
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

  const managedClient = draftManagedClient || (managedClientId
    ? filteredClients.find((client) => client.id === managedClientId)
    : null);

  if (managedClient) {
    const email = String(managedClient.email || "").toLowerCase();
    const hasAccess = accessMap.get(email) === true;
    const saveClientDetails = async (draft) => {
      const saved = await handleSaveClient(draft);
      if (saved) {
        setDraftManagedClient(null);
        setManagedClientId(saved.id);
      }
      return saved;
    };
    return (
      <section className="admin-workspace clients-workspace">
        <ClientManagementPage
          key={managedClient.id || "new-client"}
          client={managedClient}
          blankClient={blankClient}
          savingClient={savingClient}
          onSaveClientDetails={saveClientDetails}
          hasAccess={hasAccess}
          stats={statsMap.get(managedClient.id)}
          laborLists={laborLists}
          products={products}
          onSaveLaborList={onSaveClientLaborList}
          onSaveClientSkus={onSaveClientSkus}
          onViewPreorders={onViewClientPreorders || (() => {})}
          onBack={() => { setManagedClientId(null); setDraftManagedClient(null); }}
          onAccessGranted={() => {
            if (email) setAccessMap((prev) => new Map(prev).set(email, true));
          }}
        />
      </section>
    );
  }

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
          onClick={() => { setClientForm(blankClient); setDraftManagedClient({ ...blankClient }); setManagedClientId(null); }}
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
                const priceList   = laborLists.find((item) => item.id === client.labor_list_id);
                const initials    = (client.company || client.name || "?").trim().slice(0, 1).toUpperCase();
                const skuCount    = client.allowed_skus?.length || 0;
                const hasAccess   = accessMap.get(String(client.email || "").toLowerCase()) === true;
                return (
                  <Fragment key={client.id}>
                    <tr>
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
                          <button
                            className="secondary-button compact-action active-detail"
                            type="button"
                            onClick={() => setManagedClientId(client.id)}
                            title="Gestionar accesos, precios y catálogo del cliente"
                          >
                            Gestionar
                          </button>
                          {handleDeleteClient ? (
                            <button className="secondary-button compact-action danger-action" type="button"
                              onClick={() => handleDeleteClient(client.id)} title="Eliminar cliente">
                              Borrar
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              }) : (
                <tr><td colSpan="8" className="empty-row">No hay clientes con esos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
              {/* La lista de precios del cliente se asigna desde su página de gestión. */}
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

    </section>
  );
}
