import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const todayLabel = () =>
  new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date());

const isRealClient = (client) => {
  if ((client.type || "") === "prospecto") return false;
  return !String(client.email || "").endsWith("@prospect.local");
};

const preorderNeedsAttention = (status = "") => {
  const value = String(status || "").toLowerCase();
  return !["confirmada", "confirmed", "cancelada", "cancelled"].includes(value);
};

export default function AdminHomeTab({
  activeCompany,
  activeTenant,
  clients = [],
  products = [],
  tenantId,
  profile,
  onNavigate,
}) {
  const [preorders, setPreorders] = useState([]);
  const [clientAccessIds, setClientAccessIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const companyName =
    activeCompany?.brand_name ||
    activeCompany?.legal_name ||
    activeTenant?.name ||
    "tu empresa";

  const displayName =
    activeCompany?.contact_name ||
    profile?.full_name ||
    profile?.email?.split("@")[0] ||
    "admin";

  useEffect(() => {
    let cancelled = false;
    const loadHome = async () => {
      if (!tenantId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setNotice("");
      try {
        const [{ data: preorderRows, error: preorderError }, { data: profileRows, error: profileError }] =
          await Promise.all([
            supabase
              .from("preorders")
              .select("id, folio, status, created_at, updated_at, client_id, client_name, company")
              .eq("tenant_id", tenantId)
              .order("updated_at", { ascending: false })
              .limit(30),
            supabase
              .from("profiles")
              .select("client_id")
              .eq("tenant_id", tenantId)
              .eq("role", "client"),
          ]);

        if (cancelled) return;
        if (preorderError) throw preorderError;
        if (profileError) throw profileError;
        setPreorders(preorderRows || []);
        setClientAccessIds(new Set((profileRows || []).map((row) => row.client_id).filter(Boolean)));
      } catch (error) {
        if (!cancelled) {
          setNotice(error.message || "No se pudo cargar el resumen.");
          setPreorders([]);
          setClientAccessIds(new Set());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadHome();
    return () => { cancelled = true; };
  }, [tenantId]);

  const realClients = useMemo(() => clients.filter(isRealClient), [clients]);
  const pendingAccess = useMemo(
    () => realClients.filter((client) => !clientAccessIds.has(client.id)).length,
    [realClients, clientAccessIds]
  );
  const visibleProducts = products.filter((product) => product.visibleWeb !== false);
  const withoutPhoto = products.filter((product) => !product.fotoUrl && !product.foto_url).length;
  const pendingPreorders = preorders.filter((item) => preorderNeedsAttention(item.status));
  const confirmedPreorders = preorders.filter((item) => !preorderNeedsAttention(item.status));

  const statCards = [
    {
      label: "Preordenes nuevas",
      value: pendingPreorders.length,
      help: "Requieren revision",
      tone: "blue",
    },
    {
      label: "Por confirmar",
      value: pendingPreorders.length,
      help: "Clientes esperan respuesta",
      tone: "amber",
    },
    {
      label: "Confirmadas",
      value: confirmedPreorders.length,
      help: "Listas o activas",
      tone: "green",
    },
    {
      label: "Codigos en catalogo",
      value: visibleProducts.length,
      help: "Productos cargados",
      tone: "slate",
    },
    {
      label: "Sin foto",
      value: withoutPhoto,
      help: `de ${products.length} productos`,
      tone: "slate",
    },
    {
      label: "Acceso pendiente",
      value: pendingAccess,
      help: "Clientes por invitar",
      tone: "amber",
    },
  ];

  return (
    <div className="portal-home">
      <section className="portal-hero">
        <p className="portal-kicker">{companyName}</p>
        <h1>Hola, {displayName}</h1>
        <p>Bienvenido a tu sistema. Revisa operacion, catalogo, clientes y pendientes desde un solo lugar.</p>
      </section>

      <section className="portal-stats" aria-label="Resumen operativo">
        {statCards.map((card) => (
          <button
            type="button"
            className={`portal-stat portal-stat--${card.tone}`}
            key={card.label}
            onClick={() => {
              if (card.label.includes("Preorden") || card.label.includes("confirmar") || card.label.includes("Confirmadas")) onNavigate?.("preorders");
              else if (card.label.includes("Acceso")) onNavigate?.("clients");
              else onNavigate?.("catalog");
            }}
          >
            <span>{card.label}</span>
            <strong>{loading ? "..." : card.value}</strong>
            <small>{card.help}</small>
          </button>
        ))}
      </section>

      <section className="portal-grid">
        <article className="portal-panel">
          <div className="portal-panel__head">
            <div>
              <h2>Pendientes</h2>
              <p>Lo que requiere atencion.</p>
            </div>
            <button type="button" className="secondary-button compact-action" onClick={() => onNavigate?.("preorders")}>
              Ver preordenes
            </button>
          </div>
          {notice ? <p className="status info">{notice}</p> : null}
          {pendingPreorders.length ? (
            <div className="portal-list">
              {pendingPreorders.slice(0, 5).map((item) => (
                <button type="button" className="portal-list-item" key={item.id} onClick={() => onNavigate?.("preorders")}>
                  <span>
                    <strong>{item.folio || "Preorden"}</strong>
                    <small>{item.company || item.client_name || "Cliente sin nombre"}</small>
                  </span>
                  <em>{item.status || "Pendiente"}</em>
                </button>
              ))}
            </div>
          ) : (
            <div className="portal-empty">
              <strong>Todo al dia</strong>
              <span>No tienes preordenes pendientes.</span>
            </div>
          )}
        </article>

        <article className="portal-panel">
          <div className="portal-panel__head">
            <div>
              <h2>Clientes</h2>
              <p>Accesos y actividad comercial.</p>
            </div>
            <button type="button" className="secondary-button compact-action" onClick={() => onNavigate?.("clients")}>
              Ver clientes
            </button>
          </div>
          <div className="portal-client-summary">
            <div>
              <span>Total clientes</span>
              <strong>{realClients.length}</strong>
            </div>
            <div>
              <span>Con acceso</span>
              <strong>{clientAccessIds.size}</strong>
            </div>
            <div>
              <span>Por invitar</span>
              <strong>{pendingAccess}</strong>
            </div>
          </div>
        </article>
      </section>

      <div className="portal-footnote">Hoy {todayLabel()} · Vista de pruebas para presentacion.</div>
    </div>
  );
}
