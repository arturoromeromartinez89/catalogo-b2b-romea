const displayContactEmail = (email) =>
  String(email || "").endsWith("@prospect.local") ? "-" : email || "-";

export default function ProspectsTab({
  filteredProspects,
  allProspectsCount,
  prospectSearch,
  setProspectSearch,
  prospectStatusFilter,
  setProspectStatusFilter,
  badgeObtainedIn,
  setBadgeObtainedIn,
  badgeScanInput,
  setBadgeScanInput,
  badgeComment,
  setBadgeComment,
  handleBadgeScanKeyDown,
  handleSaveBadgeProspect,
  savingProspect,
  cameraScannerOpen,
  cameraVideoRef,
  cameraStatus,
  startCameraScanner,
  closeCameraScanner,
  isProspectFormOpen,
  setIsProspectFormOpen,
  prospectForm,
  setProspectForm,
  blankProspect,
  handleSaveProspect,
  handleDeleteProspect,
  handleConvertProspectToClient,
  prospectForForm,
}) {
  return (
    <section className="admin-workspace clients-workspace prospects-workspace">
      <div className="clients-page-header">
        <div>
          <h2>Prospectos</h2>
          <p>{filteredProspects.length.toLocaleString()} de {allProspectsCount.toLocaleString()} prospectos</p>
        </div>
        <button
          className="new-client-button"
          type="button"
          onClick={() => {
            setProspectForm(blankProspect);
            setIsProspectFormOpen(true);
          }}
        >
          + Nuevo prospecto
        </button>
      </div>

      <div className="clients-filter-card">
        <div className="client-search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={prospectSearch}
            onChange={(event) => setProspectSearch(event.target.value)}
            placeholder="Buscar por nombre, empresa, ciudad, gafete, celular o email..."
          />
        </div>
        <select value={prospectStatusFilter} onChange={(event) => setProspectStatusFilter(event.target.value)}>
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      <section className="prospect-scan-card">
        <div className="prospect-scan-head">
          <div>
            <span className="tool-eyebrow">Registro rápido de feria</span>
            <h3>Escanear gafete</h3>
            <p>Coloca el cursor aquí y lee el gafete. El lector enviará Enter y se guardará como prospecto.</p>
          </div>
          <label>
            Obtenido en
            <input value={badgeObtainedIn} onChange={(event) => setBadgeObtainedIn(event.target.value)} placeholder="JCK" />
          </label>
          <button className="secondary-button camera-scan-button" type="button" onClick={startCameraScanner}>
            Escanear con camara
          </button>
        </div>
        <input
          className="prospect-scan-input"
          value={badgeScanInput}
          onChange={(event) => setBadgeScanInput(event.target.value)}
          onKeyDown={handleBadgeScanKeyDown}
          placeholder="Escanear gafete aquí. Ej. 9477926915224ArturoRomeroRapana JewelersPF"
          autoComplete="off"
        />
        <div className="prospect-scan-bottom">
          <textarea
            value={badgeComment}
            onChange={(event) => setBadgeComment(event.target.value)}
            placeholder='Comentarios. Ej. "Enviar información de vírgenes"'
          />
          <button className="new-client-button prospect-save-button" type="button" onClick={handleSaveBadgeProspect} disabled={savingProspect}>
            {savingProspect ? "Guardando..." : "+ Registrar prospecto"}
          </button>
        </div>
      </section>

      {cameraScannerOpen ? (
        <div className="camera-scanner-backdrop">
          <section className="camera-scanner-modal">
            <header>
              <div>
                <span className="tool-eyebrow">Camara iPad</span>
                <h2>Escanear gafete</h2>
                <p>Permite el acceso a la camara y apunta al codigo del gafete.</p>
              </div>
              <button className="icon-button" type="button" aria-label="Cerrar" onClick={closeCameraScanner}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </header>
            <div className="camera-scanner-frame">
              <video ref={cameraVideoRef} className="camera-scanner-video" muted playsInline autoPlay />
              <div className="camera-scanner-guide" aria-hidden="true" />
            </div>
            <p className="camera-scanner-status">{cameraStatus || "Preparando camara..."}</p>
            <footer>
              <button className="secondary-button" type="button" onClick={closeCameraScanner}>
                Cerrar camara
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      <div className="clients-table-card">
        <div className="responsive-table">
          <table className="simple-admin-table clients-directory-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Ciudad</th>
                <th>Celular</th>
                <th>Email</th>
                <th>Obtenido en</th>
                <th>Comentarios</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProspects.length ? filteredProspects.map((prospect) => {
                const initials = (prospect.company || prospect.name || "?").trim().slice(0, 1).toUpperCase();
                return (
                  <tr key={prospect.id}>
                    <td>
                      <div className="client-name-cell">
                        <span>{initials}</span>
                        <strong>{prospect.company || prospect.name || "Sin nombre"}</strong>
                        {prospect.company && prospect.name ? <small>{prospect.name}</small> : null}
                      </div>
                    </td>
                    <td>{prospect.ciudad || "-"}</td>
                    <td>{prospect.phone || "-"}</td>
                    <td>{displayContactEmail(prospect.email)}</td>
                    <td>{prospect.obtenido_en || "JCK"}</td>
                    <td>{prospect.comentarios || "-"}</td>
                    <td>
                      <span className={`client-status-pill ${prospect.active === false ? "inactive" : "active"}`}>
                        {prospect.active === false ? "Inactivo" : "Activo"}
                      </span>
                    </td>
                    <td>
                      <div className="client-action-row">
                        <button
                          className="secondary-button compact-action"
                          type="button"
                          onClick={() => {
                            setProspectForm(prospectForForm(prospect));
                            setIsProspectFormOpen(true);
                          }}
                        >
                          Editar
                        </button>
                        <button
                          className="primary-button compact-action success-action"
                          type="button"
                          onClick={() => handleConvertProspectToClient(prospect)}
                        >
                          Convertir
                        </button>
                        {handleDeleteProspect ? (
                          <button
                            className="secondary-button compact-action danger-action"
                            type="button"
                            onClick={() => handleDeleteProspect(prospect.id)}
                            title="Eliminar prospecto"
                          >
                            Borrar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="8" className="empty-row">No hay prospectos con esos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isProspectFormOpen ? (
        <div className="client-modal-backdrop">
          <section className="client-modal">
            <header>
              <h2>{prospectForm.id ? "Editar prospecto" : "Nuevo prospecto"}</h2>
              <button className="icon-button" type="button" aria-label="Cerrar" onClick={() => setIsProspectFormOpen(false)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </header>
            <div className="client-modal-body">
              <label className="wide-field">Nombre <span>*</span>
                <input value={prospectForm.name} onChange={(event) => setProspectForm({ ...prospectForm, name: event.target.value })} />
              </label>
              <label>RFC / Tax ID
                <input value={prospectForm.rfc} onChange={(event) => setProspectForm({ ...prospectForm, rfc: event.target.value })} />
              </label>
              <label>Celular
                <input value={prospectForm.phone} onChange={(event) => setProspectForm({ ...prospectForm, phone: event.target.value })} />
              </label>
              <label className="wide-field">Empresa
                <input value={prospectForm.company} onChange={(event) => setProspectForm({ ...prospectForm, company: event.target.value })} />
              </label>
              <label className="wide-field">Email
                <input value={prospectForm.email} onChange={(event) => setProspectForm({ ...prospectForm, email: event.target.value })} />
              </label>
              <label>Ciudad
                <input value={prospectForm.ciudad || ""} onChange={(event) => setProspectForm({ ...prospectForm, ciudad: event.target.value })} />
              </label>
              <label>Obtenido en
                <input value={prospectForm.obtenido_en || "JCK"} onChange={(event) => setProspectForm({ ...prospectForm, obtenido_en: event.target.value })} />
              </label>
              <label className="wide-field">Domicilio
                <input
                  value={prospectForm.domicilio || ""}
                  onChange={(event) => setProspectForm({ ...prospectForm, domicilio: event.target.value })}
                  placeholder="Dirección, ciudad, estado, país"
                />
              </label>
              <label className="wide-field">Lectura de gafete
                <input value={prospectForm.badge_raw || ""} onChange={(event) => setProspectForm({ ...prospectForm, badge_raw: event.target.value })} />
              </label>
              <label>Estado
                <select
                  value={prospectForm.active === false ? "inactive" : "active"}
                  onChange={(event) => setProspectForm({ ...prospectForm, active: event.target.value === "active" })}
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </label>
              <label className="wide-field">Comentarios / datos del gafete
                <textarea
                  value={prospectForm.comentarios || ""}
                  onChange={(event) => setProspectForm({ ...prospectForm, comentarios: event.target.value })}
                  placeholder="Aquí podremos guardar datos leídos del gafete."
                />
              </label>
            </div>
            <footer>
              <button className="secondary-button" type="button" onClick={() => setIsProspectFormOpen(false)}>Cancelar</button>
              <button className="new-client-button" type="button" onClick={handleSaveProspect} disabled={savingProspect}>
                {savingProspect ? "Guardando..." : "Guardar prospecto"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
