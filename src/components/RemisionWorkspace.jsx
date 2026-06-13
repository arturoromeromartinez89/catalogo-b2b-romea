/**
 * RemisionWorkspace.jsx
 * Workspace idéntico en patrón a PreorderWorkspace.
 * - Barra de pestañas (po-tab-bar) con la misma lógica de dirty state.
 * - Lista de remisiones con pills de filtro.
 * - Editor abierto en pestañas (RemisionEditor).
 */
import { useEffect, useState } from "react";
import RemisionEditor from "./RemisionEditor";
import CobrarModal from "./CobrarModal";
import { fetchRemisiones, generateFolio, registrarCobro, fetchCuentas } from "../services/adminModuleService";

// ─── Constantes ────────────────────────────────────────────────────────────────

const STATUS_LABELS = {
  borrador:  { label: "Borrador",   color: "#94a3b8" },
  emitida:   { label: "Emitida",    color: "#2563eb" },
  entregada: { label: "Entregada",  color: "#059669" },
  cancelada: { label: "Cancelada",  color: "#dc2626" },
};

const TAB_LIST = "list";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const fmt = (n, currency = "USD") =>
  n != null && n !== 0
    ? new Intl.NumberFormat("es-MX", { style: "currency", currency, minimumFractionDigits: 2 }).format(Number(n || 0))
    : "—";

// ─── Pestaña individual (idéntica a PreorderWorkspace/Tab) ─────────────────────

function Tab({ tab, active, onClick, onClose }) {
  return (
    <button
      type="button"
      className={`po-tab${active ? " po-tab--active" : ""}${tab.dirty ? " po-tab--dirty" : ""}`}
      onClick={onClick}
    >
      {tab.type === TAB_LIST ? (
        /* icono lista */
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      ) : (
        /* icono documento */
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
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

// ─── Vista: lista de remisiones ────────────────────────────────────────────────

function RemisionListView({ remisiones, loading, statusMsg, onOpen, onNew, onCobrar }) {
  const [filter, setFilter] = useState("all");

  const filtered =
    filter === "all"
      ? remisiones
      : remisiones.filter((r) => r.estado === filter);

  return (
    <div className="po-list-view">
      {/* Toolbar */}
      <div className="po-list-toolbar">
        <div className="po-filter-pills">
          {[
            ["all",       "Todas"],
            ["borrador",  "Borrador"],
            ["emitida",   "Emitidas"],
            ["entregada", "Entregadas"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={filter === key ? "primary-button compact-action" : "secondary-button compact-action"}
              onClick={() => setFilter(key)}
            >
              {label}
              {key !== "all" ? (
                <span className="po-filter-count">
                  {remisiones.filter((r) => r.estado === key).length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <button className="primary-button compact-action" type="button" onClick={onNew}>
          + Nueva remisión
        </button>
      </div>

      {statusMsg ? <p className="status info">{statusMsg}</p> : null}

      {loading ? (
        <div className="po-list-empty">
          <span className="loading-spinner" />
          <p>Cargando remisiones...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="po-list-empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--romea-line)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <p>Sin remisiones en esta categoría</p>
        </div>
      ) : (
        <div className="po-table-wrap">
          <table className="po-table">
            <thead>
              <tr>
                <th>Folio</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th className="right">Gramos</th>
                <th className="right">Total</th>
                <th className="right">Cobrado</th>
                <th className="right">Saldo</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((rem) => {
                const { label, color } = STATUS_LABELS[rem.estado] || STATUS_LABELS.borrador;
                const conSaldo = (Number(rem.saldoDinero) > 0 || Number(rem.saldoPlataGramos) > 0) && rem.estado !== "cancelada";
                return (
                  <tr key={rem.id} className="po-table-row" onClick={() => onOpen(rem)}>
                    <td><strong>{rem.folio || "—"}</strong></td>
                    <td>
                      <div className="po-client-cell">
                        <span>{rem.clienteEmpresa || rem.clienteNombre || "—"}</span>
                      </div>
                    </td>
                    <td className="po-date-cell">
                      {rem.fecha
                        ? new Date(rem.fecha).toLocaleDateString("es-MX")
                        : rem.createdAt ? new Date(rem.createdAt).toLocaleDateString("es-MX") : "—"}
                    </td>
                    <td className="right">
                      {Number(rem.totalGramos) > 0 ? Number(rem.totalGramos).toFixed(2) : "—"}
                    </td>
                    <td className="right">
                      <strong>{fmt(rem.total, rem.moneda === "MXN" ? "MXN" : "USD")}</strong>
                    </td>
                    <td className="right">{fmt(rem.montoCobrado, rem.moneda === "MXN" ? "MXN" : "USD")}</td>
                    <td className={`right ${conSaldo ? "rem-saldo--pendiente" : "rem-saldo--ok"}`}>
                      <strong>
                        {Number(rem.saldoDinero) > 0 ? fmt(rem.saldoDinero, rem.moneda === "MXN" ? "MXN" : "USD") : "—"}
                        {Number(rem.saldoPlataGramos) > 0 ? ` · ${Number(rem.saldoPlataGramos).toFixed(1)} g` : ""}
                      </strong>
                    </td>
                    <td>
                      <span
                        className="po-status-badge"
                        style={{
                          background:  `${color}18`,
                          color,
                          borderColor: `${color}55`,
                        }}
                      >
                        {label}
                      </span>
                    </td>
                    <td>
                      <div className="rem-row-actions">
                        {conSaldo && (
                          <button
                            className="primary-button compact-action"
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCobrar(rem); }}
                          >
                            Cobrar
                          </button>
                        )}
                        <button
                          className="secondary-button compact-action"
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onOpen(rem); }}
                        >
                          Abrir
                        </button>
                      </div>
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

// ─── Workspace principal ───────────────────────────────────────────────────────

export default function RemisionWorkspace({
  clients = [],
  products = [],
  profile,
  tenantId = "",
  /** Datos de remisión a abrir automáticamente (e.g. importada desde preorden) */
  initialDraft = null,
  isInitialDraftOpen = false,
  onInitialDraftClose,
  onInitialDraftSaved,
}) {
  const [tabs, setTabs] = useState([
    { id: TAB_LIST, type: TAB_LIST, label: "Remisiones", dirty: false },
  ]);
  const [activeId, setActiveId]       = useState(TAB_LIST);
  const [remisiones, setRemisiones]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [listMsg, setListMsg]         = useState("");
  const [cobrarRem, setCobrarRem]     = useState(null);
  const [cuentas, setCuentas]         = useState([]);
  const [savingCobro, setSavingCobro] = useState(false);

  // Cuentas de destino para registrar cobros
  useEffect(() => {
    const tid = tenantId || profile?.tenant_id || "";
    if (!tid) return;
    fetchCuentas(tid).then(setCuentas).catch(() => setCuentas([]));
  }, [tenantId, profile?.tenant_id]);

  const handleCobrar = async (cobro) => {
    setSavingCobro(true);
    try {
      await registrarCobro(cobro, tenantId || profile?.tenant_id || "");
      setCobrarRem(null);
      setListMsg("Cobro registrado correctamente.");
      loadRemisiones();
    } catch (e) {
      alert(`No se pudo registrar el cobro: ${e.message}`);
    } finally {
      setSavingCobro(false);
    }
  };

  // Cargar listado
  const loadRemisiones = async () => {
    setLoading(true);
    try {
      const data = await fetchRemisiones(tenantId || profile?.tenant_id || "");
      setRemisiones(data || []);
    } catch (e) {
      setListMsg(`Error al cargar remisiones: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRemisiones();
  }, [tenantId, profile?.tenant_id, profile?.role]);

  // Abrir draft externo (desde PreorderWorkspace → "Crear remisión")
  useEffect(() => {
    if (!isInitialDraftOpen || !initialDraft) return;
    const tabId = "draft-remision";
    const folio = generateFolio(
      "REM",
      remisiones.map((r) => r.folio)
    );
    const tab = {
      id:       tabId,
      type:     "remision",
      remision: { estado: "borrador", folio, ...initialDraft },
      label:    "Remisión en proceso",
      dirty:    true,
      isDraft:  true,
    };
    setTabs((prev) => {
      const exists = prev.some((t) => t.id === tabId);
      return exists
        ? prev.map((t) => (t.id === tabId ? { ...t, ...tab } : t))
        : [...prev, tab];
    });
    setActiveId(tabId);
  }, [isInitialDraftOpen, initialDraft]);

  // Abre una remisión en pestaña (si ya está abierta la activa)
  const openTab = (remision) => {
    const currentActive = tabs.find((t) => t.id === activeId);
    if (
      currentActive?.dirty &&
      currentActive.type !== TAB_LIST &&
      !window.confirm(
        "Hay una remisión con cambios sin guardar. ¿Quieres cambiar de pestaña sin guardar?"
      )
    ) {
      return;
    }
    const tabId = UUID_RE.test(String(remision?.id || ""))
      ? remision.id
      : `new-${Date.now()}`;
    const existing = tabs.find((t) => t.id === tabId);
    if (existing) { setActiveId(tabId); return; }
    const label = remision?.folio || "Nueva remisión";
    setTabs((prev) => [...prev, { id: tabId, type: "remision", remision, label, dirty: false }]);
    setActiveId(tabId);
  };

  const openNewTab = () =>
    openTab({
      folio:  generateFolio("REM", remisiones.map((r) => r.folio)),
      estado: "borrador",
    });

  const closeTab = (tabId, updatedDraft) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.dirty && !window.confirm("¿Cerrar sin guardar los cambios?")) return;
    if (tab?.isDraft) onInitialDraftClose?.(updatedDraft || tab.remision);
    setTabs((prev) => prev.filter((t) => t.id !== tabId));
    if (activeId === tabId) setActiveId(TAB_LIST);
  };

  const markDirty = (tabId) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, dirty: true } : t)));
  };

  const handleSaved = (tabId, savedData) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (tab?.isDraft) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                label:    savedData?.folio || "Remisión guardada",
                dirty:    false,
                isDraft:  false,
                remision: { ...(t.remision || {}), ...savedData },
              }
            : t
        )
      );
      setActiveId(tabId);
      onInitialDraftSaved?.(savedData);
      loadRemisiones();
      setListMsg("Remisión creada. Ya puedes generar el documento.");
      return;
    }
    // Remisión existente actualizada
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? {
              ...t,
              label:    savedData?.folio || t.label,
              dirty:    false,
              remision: { ...(t.remision || {}), ...savedData },
            }
          : t
      )
    );
    loadRemisiones();
    setListMsg("Remisión guardada.");
  };

  const activeTab = tabs.find((t) => t.id === activeId) || tabs[0];

  return (
    <div className="po-workspace">
      {/* ── Barra de pestañas ── */}
      <nav className="po-tab-bar" aria-label="Pestañas de remisiones">
        {tabs.map((tab) => (
          <Tab
            key={tab.id}
            tab={tab}
            active={tab.id === activeId}
            onClick={() => {
              const currentActive = tabs.find((t) => t.id === activeId);
              if (
                currentActive?.dirty &&
                currentActive.id !== tab.id &&
                currentActive.type !== TAB_LIST &&
                !window.confirm(
                  "Hay una remisión con cambios sin guardar. ¿Quieres cambiar de pestaña sin guardar?"
                )
              ) {
                return;
              }
              setActiveId(tab.id);
            }}
            onClose={closeTab}
          />
        ))}
        <button
          className="po-tab-new"
          type="button"
          onClick={openNewTab}
          title="Nueva remisión"
        >
          +
        </button>
      </nav>

      {/* ── Contenido de la pestaña activa ── */}
      <div className="po-tab-content">
        {activeTab.type === TAB_LIST ? (
          <RemisionListView
            remisiones={remisiones}
            loading={loading}
            statusMsg={listMsg}
            onOpen={openTab}
            onNew={openNewTab}
            onCobrar={setCobrarRem}
          />
        ) : (
          <RemisionEditor
            key={activeTab.id}
            remision={activeTab.remision}
            clients={clients}
            products={products}
            tenantId={tenantId}
            profile={profile}
            existingFolios={remisiones.map((r) => r.folio)}
            onClose={(updatedDraft) => closeTab(activeTab.id, updatedDraft)}
            onSaved={(savedData) => handleSaved(activeTab.id, savedData)}
            onDirty={() => markDirty(activeTab.id)}
          />
        )}
      </div>

      {cobrarRem && (
        <CobrarModal
          remision={cobrarRem}
          cuentas={cuentas}
          onSave={handleCobrar}
          onClose={() => setCobrarRem(null)}
          saving={savingCobro}
        />
      )}
    </div>
  );
}
