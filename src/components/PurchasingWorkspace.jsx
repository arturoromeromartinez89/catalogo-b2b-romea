import { useEffect, useMemo, useRef, useState } from "react";
import {
  approvePurchaseIntake,
  completePurchaseMedia,
  confirmPurchaseErpRegistration,
  fetchPurchaseIntakes,
  publishPurchaseIntake,
  savePurchaseIntake,
  uploadPurchasePhoto,
} from "../services/purchasingService";
import {
  CODE_MODES,
  PURCHASE_STAGES,
  emptyPurchaseIntake,
  getMissingPublishRequirements,
  getPurchaseStage,
  getPublishRequirements,
  normalizeLineCode,
  purchaseItemSearchText,
  suggestInternalSku,
  suggestLineFromCost,
} from "../utils/purchasingWorkflow";

const Icons = {
  plus: <><path d="M12 5v14M5 12h14" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 20" /></>,
  box: <><path d="m3 7 9-4 9 4-9 4-9-4Z" /><path d="m3 7 9 4 9-4v10l-9 4-9-4V7Z" /><path d="M12 11v10" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
};

function Icon({ name, size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{Icons[name]}</svg>;
}

const formatDate = (value) => value
  ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
  : "Pendiente";

const stageCopy = {
  proposal: { label: "Por aprobar", help: "Beto revisa la propuesta y asume la decisión operativa.", action: "Aprobar" },
  registration: { label: "Registro ERP", help: "El SKU debe quedar creado individualmente en Pruebas Vanguardia.", action: "Confirmar ERP" },
  media: { label: "Foto y CEDIS", help: "Marco completa fotografía profesional y ubicación física.", action: "Completar foto" },
  ready: { label: "Listo", help: "Cumple los controles y puede publicarse al equipo comercial.", action: "Publicar" },
  published: { label: "Publicado", help: "El producto ya está disponible en el catálogo comercial.", action: "Publicado" },
  rejected: { label: "Rechazado", help: "La propuesta fue descartada.", action: "Revisar" },
};

const blankMedia = { location: "", file: null, uploaded: null };

export default function PurchasingWorkspace({ tenantId = "", products = [], profile = null, demoItems = null, onNotice }) {
  const demoMode = Array.isArray(demoItems);
  const [items, setItems] = useState(demoItems || []);
  const [loading, setLoading] = useState(!demoMode);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(emptyPurchaseIntake);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [media, setMedia] = useState(blankMedia);
  const photoInputRef = useRef(null);

  const load = async () => {
    if (demoMode) return;
    setLoading(true);
    setLoadError("");
    try {
      setItems(await fetchPurchaseIntakes(tenantId));
    } catch (error) {
      setLoadError(error.message || "No se pudo cargar el módulo de Compras.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId]);

  const selectedItem = items.find((item) => item.id === selectedId) || null;
  const productCodes = useMemo(() => new Set(products.map((product) => String(product.codigo || "").toUpperCase())), [products]);
  const counts = useMemo(() => PURCHASE_STAGES.reduce((result, stage) => ({
    ...result,
    [stage.id]: items.filter((item) => getPurchaseStage(item) === stage.id).length,
  }), {}), [items]);
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return items.filter((item) => {
      const stage = getPurchaseStage(item);
      const matchesStage = stageFilter === "all" ? stage !== "published" && stage !== "rejected" : stage === stageFilter;
      return matchesStage && (!normalizedQuery || purchaseItemSearchText(item).includes(normalizedQuery));
    });
  }, [items, query, stageFilter]);

  const replaceItem = (nextItem) => {
    if (!nextItem) return;
    setItems((current) => current.map((item) => item.id === nextItem.id ? nextItem : item));
    setSelectedId(nextItem.id);
  };

  const announce = (type, title, message) => onNotice?.(type, title, message);

  const openNew = () => {
    setForm({ ...emptyPurchaseIntake });
    setEditorOpen(true);
  };

  const updateForm = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "supplierCostMxn" && !current.lineCode) next.lineCode = suggestLineFromCost(value);
      if (["codeMode", "supplierPrefix", "supplierPartNumber"].includes(field)) {
        const previousSuggestion = suggestInternalSku({ ...current, internalSku: "" });
        if (!current.internalSku || current.internalSku === previousSuggestion) {
          next.internalSku = suggestInternalSku({ ...next, internalSku: "" });
        }
      }
      return next;
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const sku = suggestInternalSku(form);
    if (!form.supplierName.trim() || !sku || !form.description.trim() || !form.lineCode || Number(form.weightGrams) <= 0) {
      announce("warning", "Faltan datos para registrar", "Completa proveedor, SKU, descripción, línea y un peso mayor a cero.");
      return;
    }
    if (productCodes.has(sku) || items.some((item) => item.internalSku === sku)) {
      announce("warning", "SKU ya utilizado", `${sku} ya existe en el catálogo o en el flujo de Compras.`);
      return;
    }
    setSaving(true);
    try {
      let saved;
      if (demoMode) {
        const timestamp = new Date().toISOString();
        saved = { ...form, id: `demo-${Date.now()}`, internalSku: sku, lineCode: normalizeLineCode(form.lineCode), status: "proposal", createdAt: timestamp, updatedAt: timestamp };
        setItems((current) => [saved, ...current]);
      } else {
        saved = await savePurchaseIntake({ ...form, internalSku: sku }, tenantId);
        setItems((current) => [saved, ...current]);
      }
      setSelectedId(saved.id);
      setEditorOpen(false);
      announce("success", "Producto formalizado", `${saved.internalSku} quedó en la bandeja de aprobación de Beto.`);
    } catch (error) {
      announce("error", "No se pudo guardar", error.message);
    } finally {
      setSaving(false);
    }
  };

  const runTransition = async (action, successTitle, successMessage) => {
    if (!selectedItem) return;
    setBusyAction(action.name);
    try {
      let next;
      if (demoMode) {
        const timestamp = new Date().toISOString();
        next = action.name === "approve"
          ? { ...selectedItem, approvedAt: timestamp, status: "registration", updatedAt: timestamp }
          : action.name === "erp"
            ? { ...selectedItem, erpRegisteredAt: timestamp, status: "media", updatedAt: timestamp }
            : { ...selectedItem, status: "published", publishedAt: timestamp, updatedAt: timestamp };
      } else {
        next = await action.run(selectedItem.id);
      }
      replaceItem(next);
      announce("success", successTitle, successMessage(next));
    } catch (error) {
      announce("error", "No se pudo avanzar", error.message);
    } finally {
      setBusyAction("");
    }
  };

  const handleMediaComplete = async () => {
    if (!selectedItem) return;
    const location = media.location.trim() || selectedItem.cedisLocation;
    const existingPhoto = media.uploaded?.photoUrl || selectedItem.photoUrl;
    if (!location || (!media.file && !existingPhoto)) {
      announce("warning", "Falta completar CEDIS", "Marco debe registrar ubicación y fotografía profesional.");
      return;
    }
    setBusyAction("media");
    try {
      let upload = media.uploaded;
      if (!demoMode && media.file && !upload) upload = await uploadPurchasePhoto({ intake: selectedItem, file: media.file, tenantId });
      const timestamp = new Date().toISOString();
      const next = demoMode
        ? { ...selectedItem, cedisLocation: location, photoUrl: upload?.photoUrl || existingPhoto || "demo-photo-ready", photoCompletedAt: timestamp, cedisLocationAt: timestamp, status: "ready", updatedAt: timestamp }
        : await completePurchaseMedia({
          intakeId: selectedItem.id,
          location,
          photoUrl: upload?.photoUrl || selectedItem.photoUrl,
          photoStoragePath: upload?.photoStoragePath || selectedItem.photoStoragePath,
        });
      replaceItem(next);
      setMedia(blankMedia);
      announce("success", "Ficha CEDIS completa", `${next.internalSku} ya puede pasar a publicación comercial.`);
    } catch (error) {
      announce("error", "No se pudo completar la ficha", error.message);
    } finally {
      setBusyAction("");
    }
  };

  const selectItem = (item) => {
    setSelectedId(item.id);
    setMedia({ location: item.cedisLocation || "", file: null, uploaded: null });
  };

  const selectedStage = selectedItem ? getPurchaseStage(selectedItem) : "";
  const requirements = selectedItem ? getPublishRequirements(selectedItem) : [];
  const missing = selectedItem ? getMissingPublishRequirements(selectedItem) : [];

  return (
    <section className="purchase-workspace" aria-labelledby="purchase-title">
      <header className="purchase-head">
        <div>
          <h1 id="purchase-title">Compras · alta de productos</h1>
          <p>Una sola ruta desde la aprobación de Beto hasta la publicación comercial.</p>
        </div>
        <button className="primary-button purchase-new-button" type="button" onClick={openNew}>
          <Icon name="plus" /> Registrar modelo
        </button>
      </header>

      {demoMode ? <p className="purchase-demo-note">Vista de ejemplo. Los estados del flujo son simulados y no modifican staging.</p> : null}

      <p className="purchase-open-question">
        <strong>Definición pendiente</strong>
        ¿Beto entrega primero una muestra a Marco para fotografía o traspasa el lote completo con bloqueo comercial? Hasta confirmarlo, este flujo controla la publicación, no el movimiento físico.
      </p>

      <nav className="purchase-release-line" aria-label="Etapas de liberación">
        {PURCHASE_STAGES.map((stage, index) => (
          <button
            type="button"
            key={stage.id}
            className={stageFilter === stage.id ? "active" : ""}
            onClick={() => setStageFilter((current) => current === stage.id ? "all" : stage.id)}
            aria-pressed={stageFilter === stage.id}
          >
            <span>{index + 1}</span>
            <div><strong>{stage.label}</strong><small>{stage.owner} · {counts[stage.id] || 0} {(counts[stage.id] || 0) === 1 ? "modelo" : "modelos"}</small></div>
            {index < PURCHASE_STAGES.length - 1 ? <Icon name="arrow" size={16} /> : null}
          </button>
        ))}
      </nav>

      <div className={`purchase-body${selectedItem || editorOpen ? " has-inspector" : ""}`}>
        <div className="purchase-ledger">
          <div className="purchase-toolbar">
            <label className="purchase-search">
              <Icon name="search" />
              <span className="sr-only">Buscar productos</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar SKU, descripción o proveedor" />
            </label>
            <button className="secondary-button" type="button" onClick={() => { setQuery(""); setStageFilter("all"); }}>Ver todo el flujo</button>
          </div>

          {loading ? <div className="purchase-state">Cargando flujo de Compras…</div> : null}
          {loadError ? (
            <div className="purchase-state purchase-state--error">
              <strong>El módulo todavía no está conectado en esta base.</strong>
              <span>{loadError}</span>
              <button className="secondary-button" type="button" onClick={load}>Intentar de nuevo</button>
            </div>
          ) : null}
          {!loading && !loadError && !visibleItems.length ? (
            <div className="purchase-state"><strong>No hay modelos en esta etapa.</strong><span>Registra un modelo nuevo o cambia el filtro.</span></div>
          ) : null}

          <div className="purchase-rows" role="list">
            {visibleItems.map((item) => {
              const stage = getPurchaseStage(item);
              const stageInfo = stageCopy[stage];
              return (
                <button
                  type="button"
                  role="listitem"
                  className={`purchase-row${selectedId === item.id ? " selected" : ""}`}
                  key={item.id}
                  onClick={() => selectItem(item)}
                >
                  <span className={`purchase-status-mark is-${stage}`} aria-hidden="true" />
                  <span className="purchase-row-code">{item.internalSku || "SKU pendiente"}</span>
                  <span className="purchase-row-description">
                    <strong>{item.description || "Sin descripción"}</strong>
                    <small>{item.supplierName} · Línea {item.lineCode || "pendiente"}</small>
                  </span>
                  <span className="purchase-row-weight">{Number(item.weightGrams || 0).toFixed(2)} g</span>
                  <span className={`purchase-stage-label is-${stage}`}>{stageInfo.label}</span>
                  <span className="purchase-row-next">{stageInfo.action} <Icon name="arrow" size={15} /></span>
                </button>
              );
            })}
          </div>
        </div>

        {editorOpen ? (
          <aside className="purchase-inspector purchase-editor" aria-label="Registrar modelo nuevo">
            <div className="purchase-inspector-head">
              <div><strong>Registrar modelo</strong><span>Los datos que realmente captura Compras.</span></div>
              <button type="button" onClick={() => setEditorOpen(false)} aria-label="Cerrar formulario"><Icon name="close" /></button>
            </div>
            <form onSubmit={handleSave}>
              <label>Proveedor<input value={form.supplierName} onChange={(event) => updateForm("supplierName", event.target.value)} placeholder="RAJOI, JR, Chrysos…" /></label>
              <label>Cómo se forma el código<select value={form.codeMode} onChange={(event) => updateForm("codeMode", event.target.value)}>{CODE_MODES.map((mode) => <option value={mode.id} key={mode.id}>{mode.label}</option>)}</select><small>{CODE_MODES.find((mode) => mode.id === form.codeMode)?.help}</small></label>
              <div className="purchase-form-pair">
                <label>Prefijo<input value={form.supplierPrefix} onChange={(event) => updateForm("supplierPrefix", event.target.value)} placeholder="RJ" /></label>
                <label>Consecutivo o número del proveedor<input value={form.supplierPartNumber} onChange={(event) => updateForm("supplierPartNumber", event.target.value)} placeholder="DRP257 o 255" /></label>
              </div>
              <label>SKU de Vanguardia<input value={form.internalSku} onChange={(event) => updateForm("internalSku", event.target.value.toUpperCase())} placeholder="RJDRP257" /><small>El sistema comprueba que no exista en catálogo ni en este flujo.</small></label>
              <label>Descripción<input value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="Descripción proporcionada por el proveedor" /></label>
              <div className="purchase-form-pair">
                <label>Metal<input value={form.metal} onChange={(event) => updateForm("metal", event.target.value)} placeholder="Plata" /></label>
                <label>Ley / kilataje<input value={form.karat} onChange={(event) => updateForm("karat", event.target.value)} placeholder="925" /></label>
              </div>
              <div className="purchase-form-pair">
                <label>Costo del proveedor<input type="number" min="0" step="0.01" value={form.supplierCostMxn} onChange={(event) => updateForm("supplierCostMxn", event.target.value)} placeholder="10.00" /></label>
                <label>Línea<input value={form.lineCode} onChange={(event) => updateForm("lineCode", event.target.value)} onBlur={() => updateForm("lineCode", normalizeLineCode(form.lineCode))} placeholder="010" /><small>Se sugiere a partir del costo.</small></label>
              </div>
              <div className="purchase-form-pair">
                <label>Peso medido<input type="number" min="0.01" step="0.01" value={form.weightGrams} onChange={(event) => updateForm("weightGrams", event.target.value)} placeholder="0.00" /></label>
                <label>Familia<input value={form.family} onChange={(event) => updateForm("family", event.target.value)} placeholder="DIJE RELIGIOSO…" /></label>
              </div>
              <label>Origen de la propuesta<select value={form.proposalSource} onChange={(event) => updateForm("proposalSource", event.target.value)}><option value="rafael">Rafael</option><option value="sales">Vendedores</option><option value="supplier">Proveedor</option><option value="other">Otro</option></select></label>
              <label>Quién lo propuso<input value={form.proposedByName} onChange={(event) => updateForm("proposedByName", event.target.value)} /></label>
              <label>Observaciones<textarea rows="3" value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Entrega de muestra, lote recibido o contexto de aprobación" /></label>
              <div className="purchase-editor-actions"><button className="secondary-button" type="button" onClick={() => setEditorOpen(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar propuesta"}</button></div>
            </form>
          </aside>
        ) : null}

        {selectedItem && !editorOpen ? (
          <aside className="purchase-inspector" aria-label={`Detalle de ${selectedItem.internalSku}`}>
            <div className="purchase-inspector-head">
              <div><strong>{selectedItem.internalSku || "SKU pendiente"}</strong><span>{stageCopy[selectedStage].label}</span></div>
              <button type="button" onClick={() => setSelectedId("")} aria-label="Cerrar detalle"><Icon name="close" /></button>
            </div>
            <div className="purchase-product-identity">
              <span className="purchase-product-placeholder"><Icon name={selectedItem.photoUrl ? "image" : "box"} size={28} /></span>
              <div><h2>{selectedItem.description}</h2><p>{selectedItem.supplierName} · {selectedItem.supplierPartNumber || "Sin código de proveedor"}</p></div>
            </div>
            <p className="purchase-next-action"><strong>Siguiente control</strong>{stageCopy[selectedStage].help}</p>
            <dl className="purchase-facts">
              <div><dt>Línea</dt><dd>{selectedItem.lineCode || "Pendiente"}</dd></div>
              <div><dt>Peso</dt><dd>{Number(selectedItem.weightGrams || 0).toFixed(2)} g</dd></div>
              <div><dt>Propuesto por</dt><dd>{selectedItem.proposedByName || "Sin registrar"}</dd></div>
              <div><dt>Alta</dt><dd>{formatDate(selectedItem.createdAt)}</dd></div>
            </dl>
            <div className="purchase-checklist">
              <strong>Control de liberación</strong>
              {requirements.map((requirement) => <div key={requirement.id} className={requirement.complete ? "complete" : ""}><span><Icon name="check" size={13} /></span>{requirement.label}</div>)}
            </div>

            {selectedStage === "proposal" ? <button className="primary-button purchase-next-button" type="button" disabled={Boolean(busyAction)} onClick={() => runTransition({ name: "approve", run: approvePurchaseIntake }, "Producto aprobado", (item) => `${item.internalSku} pasa a registro individual en ERP.`)}>{busyAction === "approve" ? "Aprobando…" : "Aprobar como Beto"}</button> : null}
            {selectedStage === "registration" ? <button className="primary-button purchase-next-button" type="button" disabled={Boolean(busyAction)} onClick={() => runTransition({ name: "erp", run: confirmPurchaseErpRegistration }, "Registro confirmado", (item) => `${item.internalSku} queda bajo seguimiento de Marco.`)}>{busyAction === "erp" ? "Confirmando…" : "Confirmar registro en ERP"}</button> : null}
            {selectedStage === "media" ? (
              <div className="purchase-media-form">
                <label>Ubicación CEDIS<input value={media.location} onChange={(event) => setMedia((current) => ({ ...current, location: event.target.value }))} placeholder="Ej. 010-A-03" /></label>
                <button className="secondary-button" type="button" onClick={() => photoInputRef.current?.click()}><Icon name="image" />{media.file ? media.file.name : selectedItem.photoUrl ? "Cambiar fotografía" : "Agregar fotografía"}</button>
                <input ref={photoInputRef} className="visually-hidden-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setMedia((current) => ({ ...current, file: event.target.files?.[0] || null, uploaded: null }))} />
                <button className="primary-button" type="button" disabled={Boolean(busyAction)} onClick={handleMediaComplete}>{busyAction === "media" ? "Guardando…" : "Completar foto y CEDIS"}</button>
              </div>
            ) : null}
            {selectedStage === "ready" ? <button className="primary-button purchase-next-button" type="button" disabled={Boolean(busyAction) || missing.length > 0} onClick={() => runTransition({ name: "publish", run: publishPurchaseIntake }, "Producto publicado", (item) => `${item.internalSku} ya está visible para Comercial.`)}>{busyAction === "publish" ? "Publicando…" : "Publicar en catálogo comercial"}</button> : null}
          </aside>
        ) : null}
      </div>
    </section>
  );
}
