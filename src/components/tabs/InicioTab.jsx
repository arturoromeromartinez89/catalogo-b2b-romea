import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { fetchAllPreorders } from "../../services/preorderService";
import { preorderSavedAt, sortPreordersByLastSaved } from "../../utils/preorderSorting";
import { fetchClientAccessStatuses } from "../../services/supabaseCatalog";
import {
  DEFAULT_INTERFACE_SETTINGS,
  resolveClientPortalConfig,
} from "../../services/interfaceSettingsService";

/**
 * InicioTab — página de inicio del portal de administrador (versión central,
 * para cualquier tenant). Muestra el resumen de operación:
 *   - Saludo con el nombre del usuario y la marca de su empresa.
 *   - Tarjetas: preórdenes nuevas / en revisión / confirmadas, # de códigos
 *     en el catálogo y cuántos están sin foto.
 *   - "Pendientes": preórdenes que generaron sus clientes y esperan su revisión.
 *   - "Acceso de clientes": cuántos clientes ya tienen cuenta en el portal.
 *
 * Solo lee datos vía servicios existentes (RLS-safe, sin SQL ni cambios de
 * contrato). No modifica nada del lado de seguridad ni de tenant_id.
 */

const titleCase = (value = "") =>
  String(value).replace(/[._-]+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());

const resolveDisplayName = (profile) => {
  const raw =
    profile?.full_name ||
    profile?.name ||
    profile?.nombre ||
    (profile?.email ? profile.email.split("@")[0] : "");
  return titleCase(raw);
};

const formatDate = (value, language) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString(language === "en" ? "en-US" : "es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

function MetricCard({ icon, label, value, hint, tone = "neutral", onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      className={`inicio-metric inicio-metric--${tone}${onClick ? " inicio-metric--clickable" : ""}`}
      onClick={onClick}
    >
      <span className="inicio-metric__top">
        <span className="inicio-metric__label">{label}</span>
        <span className="inicio-metric__icon" aria-hidden="true">{icon}</span>
      </span>
      <strong className="inicio-metric__value">{value}</strong>
      {hint ? <span className="inicio-metric__hint">{hint}</span> : null}
    </Tag>
  );
}

const notificationType = (preorder = {}) => {
  const created = new Date(preorder.created_at || 0).getTime() || 0;
  const saved = new Date(preorderSavedAt(preorder) || 0).getTime() || 0;
  return saved - created > 60000 ? "modificada" : "nueva";
};

const toWhatsAppUrl = (config) => {
  if (!config?.whatsapp?.enabled) return "";
  const digits = String(config.whatsapp.number || "").replace(/\D/g, "");
  if (digits.length < 8) return "";
  const normalizedNumber = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(config.whatsapp.message || "Hola, quiero apoyo con mi pedido.")}`;
};

export default function InicioTab({
  profile,
  tenantId,
  products = [],
  clients = [],
  brandName = "",
  company = {},
  interfaceSettings = DEFAULT_INTERFACE_SETTINGS,
  onGoToPreorders,
  onGoToCatalog,
  onGoToClients,
  onReviewClient,
}) {
  const { language, t } = useLanguage();
  const [preorders, setPreorders] = useState([]);
  const [accessCount, setAccessCount] = useState(null);
  const [loading, setLoading] = useState(true);

  const displayName = resolveDisplayName(profile);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const list = await fetchAllPreorders({ ...profile, tenant_id: tenantId || profile?.tenant_id || "" });
        if (alive) setPreorders(Array.isArray(list) ? list : []);
      } catch {
        if (alive) setPreorders([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tenantId, profile]);

  useEffect(() => {
    let alive = true;
    const emails = (clients || []).map((c) => c?.email).filter(Boolean);
    if (!emails.length) { setAccessCount(0); return undefined; }
    (async () => {
      try {
        const statuses = await fetchClientAccessStatuses(emails);
        if (!alive) return;
        const withAccess = emails.filter((e) => statuses.get(String(e).toLowerCase())).length;
        setAccessCount(withAccess);
      } catch {
        if (alive) setAccessCount(null);
      }
    })();
    return () => { alive = false; };
  }, [clients]);

  const counts = useMemo(() => {
    const c = { nuevas: 0, revision: 0, confirmadas: 0 };
    for (const p of preorders) {
      if (p.status === "pendiente") c.nuevas += 1;
      else if (p.status === "revision") c.revision += 1;
      else if (p.status === "confirmada") c.confirmadas += 1;
    }
    return c;
  }, [preorders]);

  const clientNotifications = useMemo(
    () => sortPreordersByLastSaved(preorders.filter(
      (p) => p?.creator?.role === "client" && (p.status === "pendiente" || p.status === "revision")
    )),
    [preorders]
  );
  const totalCodigos = products.length;
  const sinFoto = useMemo(() => products.filter((p) => !p.fotoUrl).length, [products]);
  const totalClientes = clients.length;
  const accesoPendiente = accessCount === null ? null : Math.max(totalClientes - accessCount, 0);
  const companyName = company?.brand_name || company?.legal_name || brandName || t("b2bCatalog");
  const portalConfig = resolveClientPortalConfig(interfaceSettings?.client_portal_config, {
    profile,
    companyName,
    phone: company?.phone,
    email: company?.email,
  });
  const firstSlide = portalConfig.banner.slides[0];
  const whatsappUrl = toWhatsAppUrl(portalConfig);

  return (
    <div className="inicio-page">
      <section className="inicio-hero">
        <div className="inicio-hero__copy">
          <p className="inicio-hero__eyebrow">{companyName}</p>
          <h1 className="inicio-hero__title">
            {displayName ? t("iniHello", displayName) : t("iniHelloNoName")}
          </h1>
          <p className="inicio-hero__sub">Bienvenido a tu sistema.</p>
        </div>
      </section>

      {portalConfig.banner.enabled && firstSlide ? (
        <section className="inicio-client-preview">
          <div className="inicio-client-preview__surface">
            <div className="inicio-client-preview__banner">
              {firstSlide ? (
                <img src={firstSlide.image_url} alt={firstSlide.alt || "Banner del portal cliente"} />
              ) : (
                <span>Banner de inicio</span>
              )}
              {firstSlide?.title ? <strong>{firstSlide.title}</strong> : null}
              {firstSlide?.subtitle ? <em>{firstSlide.subtitle}</em> : null}
            </div>
          </div>
          <div className="inicio-client-preview__actions">
            <button className="primary-button compact-action" type="button" onClick={onGoToCatalog}>
              Ver catalogo
            </button>
            {whatsappUrl ? (
              <a className="secondary-button compact-action inicio-client-preview__whatsapp" href={whatsappUrl} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="inicio-metrics" aria-label={t("iniResumen")}>
        <MetricCard
          tone="info"
          label={t("iniCardNuevas")}
          value={loading ? "—" : counts.nuevas}
          hint={t("iniCardNuevasHint")}
          icon="✦"
          onClick={onGoToPreorders}
        />
        <MetricCard
          tone="warning"
          label={t("iniCardPendientes")}
          value={loading ? "—" : counts.nuevas + counts.revision}
          hint={t("iniCardPendientesHint")}
          icon="!"
          onClick={onGoToPreorders}
        />
        <MetricCard
          tone="neutral"
          label={t("iniCardRevision")}
          value={loading ? "—" : counts.revision}
          hint={t("iniCardRevisionHint")}
          icon="?"
          onClick={onGoToPreorders}
        />
        <MetricCard
          tone="success"
          label={t("iniCardConfirmadas")}
          value={loading ? "—" : counts.confirmadas}
          hint={t("iniCardConfirmadasHint")}
          icon="OK"
          onClick={onGoToPreorders}
        />
        <MetricCard
          tone="neutral"
          label={t("iniCardCodigos")}
          value={totalCodigos}
          hint={t("iniCardCodigosHint")}
          icon="#"
          onClick={onGoToCatalog}
        />
        <MetricCard
          tone={sinFoto > 0 ? "danger" : "neutral"}
          label={t("iniCardSinFoto")}
          value={sinFoto}
          hint={t("iniCardSinFotoHint", totalCodigos)}
          icon="IMG"
          onClick={onGoToCatalog}
        />
        <MetricCard
          tone={accesoPendiente ? "warning" : "neutral"}
          label={t("iniCardAccesoPendiente")}
          value={accesoPendiente === null ? "—" : accesoPendiente}
          hint={t("iniCardAccesoPendienteHint")}
          icon="ID"
          onClick={onGoToClients}
        />
      </section>

      <section className="inicio-columns">
        <article className="inicio-panel">
          <header className="inicio-panel__head">
            <div>
              <h2>Notificaciones</h2>
              <p>Actividad reciente de clientes en preordenes.</p>
            </div>
            {clientNotifications.length ? <span className="inicio-badge">{clientNotifications.length}</span> : null}
          </header>
          {loading ? (
            <p className="inicio-empty">{t("iniCargando")}</p>
          ) : clientNotifications.length === 0 ? (
            <div className="inicio-empty-state">
              <strong>Sin notificaciones nuevas</strong>
              <span>Cuando un cliente cree o modifique una preorden, aparecera aqui.</span>
            </div>
          ) : (
            <ul className="inicio-notification-list">
              {clientNotifications.slice(0, 8).map((p) => {
                const type = notificationType(p);
                return (
                  <li key={p.id} className="inicio-notification-item">
                    <span className={`inicio-notification-dot inicio-notification-dot--${type}`} aria-hidden="true" />
                    <div className="inicio-pend-item__info">
                      <span className={`inicio-status inicio-status--${type}`}>
                        {type === "modificada" ? "Preorden modificada" : "Nueva preorden"}
                      </span>
                      <strong>{p.cliente_nombre || p.cliente_empresa || t("iniSinNombre")}</strong>
                      <span className="inicio-pend-item__meta">
                        {p.folio ? `${p.folio} - ` : ""}Guardada {formatDate(preorderSavedAt(p), language)}
                      </span>
                    </div>
                    <button
                      className="secondary-button inicio-pend-item__action"
                      type="button"
                      onClick={() => onReviewClient?.(p.client_id)}
                    >
                      {t("iniRevisar")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="inicio-panel">
          <header className="inicio-panel__head">
            <div>
              <h2>{t("iniAccesoTitle")}</h2>
              <p>{t("iniAccesoSub", accesoPendiente === null ? "—" : accesoPendiente)}</p>
            </div>
          </header>
          <div className="inicio-acceso">
            <div className="inicio-acceso__ring" aria-hidden="true">
              <strong>{accessCount === null ? "—" : accessCount}</strong>
              <span>/ {totalClientes}</span>
            </div>
            <div className="inicio-acceso__text">
              <p>{t("iniAccesoCount", accessCount === null ? "—" : accessCount, totalClientes)}</p>
              <button className="secondary-button" type="button" onClick={onGoToClients}>
                {t("iniAccesoVer")}
              </button>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
