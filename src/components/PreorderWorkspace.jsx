import { useEffect, useState } from "react";
import PreorderEditor from "./PreorderEditor";
import { fetchAllPreorders } from "../services/preorderService";

const STATUS_LABELS = {
  pendiente:  { label: "Pendiente revision",  color: "#f59e0b" },
  revision:   { label: "En revisión", color: "#3b82f6" },
  confirmada: { label: "Confirmada", color: "#10b981" },
  cancelada:  { label: "Cancelada",  color: "#ef4444" },
};

const fmt = (n) =>
  n != null
    ? `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";

const TAB_LIST = "list";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isClientPreorder = (po) => po?.creator?.role === "client";

// ─── Pestaña individual ───────────────────────────────────────────────────────
function Tab({ tab, active, onClick, onClose }) {
  return (
    <button
      type="button"
      className={`po-tab${active ? " po-tab--active" : ""}${tab.dirty ? " po-tab--dirty" : ""}`}
      onClick={onClick}
    >
      {tab.type === TAB_LIST ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      )}
      <span className="po-tab-label">{tab.label}</span>
      {tab.dirty ? <span className="po-tab-dot" aria-label="Sin guardar" /> : null}
      {tab.type !== TAB_LIST ? (
        <span
          className="po-tab-close"
          role="button"
          tabIndex={-1}
          aria-label="Cerrar pestaña"
          onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
        >
          ×
        </span>
      ) : null}
    </button>
  );
}

// ─── Vista: lista de preórdenes ───────────────────────────────────────────────
function PreorderListView({
  clients,
  products,
  profile,
  tenantId,
  onOpen,
  onNew,
  preorders,
  loading,
  onReload,
  statusMsg,
  clientFilter,
  onClearClientFilter,
}) {
  const [filter, setFilter] = useState("all");

  // When an external clientFilter is applied, reset the status filter
  useEffect(() => {
    if (clientFilter) setFilter("all");
  }, [clientFilter]);

  // Find the client name for the filter banner
  const filterClientName = clientFilter
    ? (() => {
        const po = preorders.find((p) => p.client_id === clientFilter);
        if (po) return po.cliente_empresa || po.cliente_nombre || null;
        const cl = (clients || []).find((c) => c.id === clientFilter);
        return cl ? (cl.company || cl.name) : null;
      })()
    : null;

  // Base list: if a clientFilter is active, show only that client's preorders
  const baseList = clientFilter
    ? preorders.filter((p) => p.client_id === clientFilter)
    : preorders;

  const filtered = (() => {
    if (filter === "all")     return baseList;
    if (filter === "clients") return baseList.filter(isClientPreorder);
    return baseList.filter((p) => p.status === filter);
  })();

  const countFor = (key) => {
    if (key === "clients") return baseList.filter(isClientPreorder).length;
    return baseList.filter((p) => p.status === key).length;
  };

  return (
    <div className="po-list-view">
      {/* Banner de filtro por cliente */}
      {clientFilter && (
        <div className="po-client-filter-bar">
          <strong>
            Preórdenes de: {filterClientName || "cliente seleccionado"} ({baseList.length})
          </strong>
          <button type="button" onClick={onClearClientFilter}>Ver todas las preórdenes</button>
        </div>
      )}

      {/* Toolbar de la lista */}
      <div className="po-list-toolbar">
        <div className="po-filter-pills">
          {[["all", "Todas"], ["pendiente", "Pendientes"], ["revision", "En revisión"], ["confirmada", "Confirmadas"]].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={filter === key ? "primary-button compact-action" : "secondary-button compact-action"}
              onClick={() => setFilter(key)}
            >
              {label}
              {key !== "all" ? (
                <span className="po-filter-count">{countFor(key)}</span>
              ) : null}
            </button>
          ))}
          {/* Filtro "De clientes" — solo se muestra si hay alguna preorden de cliente */}
          {baseList.some(isClientPreorder) ? (
            <button
              type="button"
              className={filter === "clients" ? "primary-button compact-action" : "secondary-button compact-action"}
              onClick={() => setFilter(filter === "clients" ? "all" : "clients")}
              style={filter === "clients" ? { background: "#6d28d9", borderColor: "#6d28d9" } : { borderColor: "#7c3aed", color: "#6d28d9" }}
            >
              De clientes
              <span className="po-filter-count" style={filter === "clients" ? { background: "rgba(255,255,255,0.25)" } : { background: "#6d28d9", color: "#fff" }}>
                {countFor("clients")}
              </span>
            </button>
          ) : null}
        </div>
        <button className="primary-button compact-action" type="button" onClick={onNew}>
          + Nueva preorden
        </button>
      </div>

      {statusMsg ? <p className="status info">{statusMsg}</p> : null}

      {/* Tabla */}
      {loading ? (
        <div className="po-list-empty"><span className="loading-spinner" /><p>Cargando preórdenes...</p></div>
      ) : filtered.length === 0 ? (
        <div className="po-list-empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--romea-line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <p>Sin preórdenes en esta categoría</p>
        </div>
      ) : (
        <div className="po-table-wrap">
          <table className="po-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Origen</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th className="right">Piezas</th>
                <th className="right">Gramos</th>
                <th className="right">Total MXN</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((po) => {
                const incomplete = po._integrity_issue === "missing_items";
                const status = incomplete
                  ? { label: "Incompleta: sin articulos", color: "#b42318" }
                  : (STATUS_LABELS[po.status] || STATUS_LABELS.pendiente);
                const { label, color } = status;
                const fromClient = isClientPreorder(po);
                return (
                  <tr key={po.id} className="po-table-row" onClick={() => onOpen(po)}>
                    <td><strong>{po.folio || "—"}</strong></td>
                    <td>
                      {fromClient ? (
                        <span className="po-origin-tag po-origin-tag--client">Cliente</span>
                      ) : (
                        <span className="po-origin-tag" style={{ background: "#f1f5f9", color: "#64748b" }}>Admin</span>
                      )}
                    </td>
                    <td>
                      <div className="po-client-cell">
                        <span>{po.cliente_empresa || po.cliente_nombre || "—"}</span>
                        {po.cliente_email ? <small>{po.cliente_email}</small> : null}
                      </div>
                    </td>
                    <td className="po-date-cell">{new Date(po.created_at).toLocaleDateString("es-MX")}</td>
                    <td className="right">{po.total_piezas ?? "—"}</td>
                    <td className="right">{po.total_gramos != null ? Number(po.total_gramos).toFixed(2) : "—"}</td>
                    <td className="right"><strong>{fmt(po.total_mxn)}</strong></td>
                    <td>
                      <span className="po-status-badge" style={{ background: `${color}18`, color, borderColor: `${color}55` }}>
                        {label}
                      </span>
                    </td>
                    <td>
                      <button
                        className="secondary-button compact-action"
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpen(po); }}
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Workspace principal ──────────────────────────────────────────────────────
export default function PreorderWorkspace({
  clients,
  products = [],
  profile,
  tenantId = "",
  draftPreorder = null,
  isDraftOpen = false,
  onDraftClose,
  onDraftSaved,
  onOrderConfirmed,
  onCreateRemision,
  clientFilter = null,
  onClearClientFilter,
  configurableCatalogEnabled = false,
}) {
  const [tabs, setTabs] = useState([{ id: TAB_LIST, type: TAB_LIST, label: "Preórdenes", dirty: false }]);
  const [activeId, setActiveId] = useState(TAB_LIST);
  const [preorders, setPreorders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listMsg, setListMsg] = useState("");

  const loadPreorders = async () => {
    setLoading(true);
    try {
      const data = await fetchAllPreorders({ ...profile, tenant_id: tenantId || profile?.tenant_id || "" });
      setPreorders(data);
    } catch (e) {
      setListMsg(`Error al cargar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPreorders(); }, [tenantId, profile?.tenant_id, profile?.role]);

  useEffect(() => {
    if (!isDraftOpen || !draftPreorder?.preorder_items?.length) return;
    const tabId = "draft-preorder";
    const tab = {
      id: tabId,
      type: "preorder",
      preorder: draftPreorder,
      label: "Preorden en proceso",
      dirty: true,
      isDraft: true,
    };
    setTabs((prev) => {
      const exists = prev.some((item) => item.id === tabId);
      return exists ? prev.map((item) => (item.id === tabId ? { ...item, ...tab } : item)) : [...prev, tab];
    });
    setActiveId(tabId);
  }, [isDraftOpen, draftPreorder]);

  const openTab = (preorder) => {
    const currentActive = tabs.find((t) => t.id === activeId);
    if (currentActive?.dirty && currentActive.type !== TAB_LIST && !window.confirm("Hay una preorden con cambios sin guardar. Guarda antes de salir. ¿Quieres cambiar de pestaña sin guardar?")) {
      return;
    }
    const tabId = UUID_RE.test(String(preorder?.id || "")) ? preorder.id : `new-${Date.now()}`;
    const existing = tabs.find((t) => t.id === tabId);
    if (existing) { setActiveId(tabId); return; }
    const label = preorder?.folio || "Nueva preorden";
    setTabs((prev) => [...prev, { id: tabId, type: "preorder", preorder, label, dirty: false }]);
    setActiveId(tabId);
  };

  const openNewTab = () => {
    if (clientFilter) {
      const cl = (clients || []).find((c) => c.id === clientFilter);
      openTab({
        client_id: clientFilter,
        cliente_nombre: cl?.name || "",
        cliente_empresa: cl?.company || "",
        cliente_email: cl?.email && !String(cl.email).endsWith("@prospect.local") ? cl.email : "",
        cliente_telefono: cl?.phone || "",
      });
    } else {
      openTab({});
    }
  };

  const closeTab = (tabId, updatedDraft) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.dirty && !window.confirm("¿Cerrar sin guardar los cambios?")) return;
    if (tab?.isDraft) onDraftClose?.(updatedDraft || tab.preorder);
    setTabs((prev) => prev.filter((t) => t.id !== tabId));
    if (activeId === tabId) setActiveId(TAB_LIST);
  };

  const markDirty = (tabId) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, dirty: true } : t)));
  };

  const handleSaved = (tabId, savedData) => {
    const tab = tabs.find((item) => item.id === tabId);
    if (tab?.isDraft) {
      setTabs((prev) =>
        prev.map((item) =>
          item.id === tabId
            ? { ...item, label: savedData?.folio || "Preorden guardada", dirty: false, isDraft: false, preorder: { ...(item.preorder || {}), ...savedData } }
            : item
        )
      );
      setActiveId(tabId);
      onDraftSaved?.(savedData);
      loadPreorders();
      setListMsg("Preorden guardada. Ya puedes generar PDF.");
      return;
    }
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? { ...t, label: savedData?.folio || t.label, dirty: false, preorder: { ...(t.preorder || {}), ...savedData } }
          : t
      )
    );
    loadPreorders();
    setListMsg("Preorden guardada.");
  };

  const activeTab = tabs.find((t) => t.id === activeId) || tabs[0];

  return (
    <div className="po-workspace">
      <nav className="po-tab-bar" aria-label="Pestañas de preórdenes">
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            tab={tab}
            active={tab.id === activeId}
            onClick={() => {
              const currentActive = tabs.find((item) => item.id === activeId);
              if (currentActive?.dirty && currentActive.id !== tab.id && currentActive.type !== TAB_LIST && !window.confirm("Hay una preorden con cambios sin guardar. Guarda antes de salir. ¿Quieres cambiar de pestaña sin guardar?")) return;
              setActiveId(tab.id);
            }}
            onClose={closeTab}
          />
        ))}
        <button className="po-tab-new" type="button" onClick={openNewTab} title="Nueva preorden">+</button>
      </nav>

      <div className="po-tab-content">
        {activeTab.type === TAB_LIST ? (
          <PreorderListView
            clients={clients}
            products={products}
            profile={profile}
            tenantId={tenantId}
            preorders={preorders}
            loading={loading}
            statusMsg={listMsg}
            onOpen={openTab}
            onNew={openNewTab}
            onReload={loadPreorders}
            clientFilter={clientFilter}
            onClearClientFilter={onClearClientFilter}
          />
        ) : (
          <PreorderEditor
            key={activeTab.id}
            preorder={activeTab.preorder}
            clients={clients}
            products={products}
            tenantId={tenantId}
            profile={profile}
            onClose={(updatedDraft) => closeTab(activeTab.id, updatedDraft)}
            onSaved={(savedData) => handleSaved(activeTab.id, savedData)}
            onOrderConfirmed={(order) => {
              loadPreorders();
              setListMsg(`Orden ${order?.folio || ""} confirmada.`);
              onOrderConfirmed?.(order);
            }}
            onDirty={() => markDirty(activeTab.id)}
            onCreateRemision={onCreateRemision}
            configurableCatalogEnabled={configurableCatalogEnabled}
          />
        )}
      </div>
    </div>
  );
}
