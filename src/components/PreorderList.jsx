import { useEffect, useState } from "react";
import { fetchAllPreorders } from "../services/preorderService";
import PreorderEditor from "./PreorderEditor";

const STATUS_LABELS = {
  pendiente:  { label: "Pendiente",  color: "#f59e0b" },
  revision:   { label: "En revisión", color: "#3b82f6" },
  confirmada: { label: "Confirmada", color: "#10b981" },
  cancelada:  { label: "Cancelada",  color: "#ef4444" },
};

const fmt = (n) => n != null ? `$${Number(n).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

export default function PreorderList({ clients, products = [], profile, tenantId = "" }) {
  const [preorders, setPreorders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAllPreorders({ ...profile, tenant_id: tenantId || profile?.tenant_id || "" });
      setPreorders(data);
    } catch (e) {
      console.error(e);
      setStatus(`Error al cargar preórdenes: ${e.message}`);
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tenantId, profile?.tenant_id, profile?.role]);

  const filtered = filter === "all" ? preorders : preorders.filter((p) => p.status === filter);

  return (
    <section className="admin-workspace">
      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[["all", "Todas"], ["pendiente", "Pendientes"], ["revision", "En revisión"], ["confirmada", "Confirmadas"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={filter === key ? "primary-button compact-action" : "secondary-button compact-action"}
            >
              {label}
              {key !== "all" && (
                <span style={{ marginLeft: 6, background: "rgba(255,255,255,0.2)", borderRadius: 10, padding: "1px 6px", fontSize: 11 }}>
                  {preorders.filter((p) => p.status === key).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <button className="primary-button compact-action" onClick={() => setSelected({})}>
          + Nueva preorden
        </button>
      </div>
      {status ? <p className="status info">{status}</p> : null}

      {/* ── TABLA ── */}
      {loading ? (
        <p className="muted">Cargando preórdenes...</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state"><h2>Sin preórdenes</h2><p>Aún no hay preórdenes en esta categoría.</p></div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                {["Folio", "Cliente", "Fecha", "Piezas", "Gramos", "Total MXN", "Estado", ""].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((po) => {
                const { label, color } = STATUS_LABELS[po.status] || STATUS_LABELS.pendiente;
                return (
                  <tr key={po.id} style={{ borderBottom: "1px solid var(--color-border-tertiary)", cursor: "pointer" }}
                    onClick={() => setSelected(po)}>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{po.folio}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div>{po.cliente_empresa || po.cliente_nombre || "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{po.cliente_email}</div>
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      {new Date(po.created_at).toLocaleDateString("es-MX")}
                    </td>
                    <td style={{ padding: "10px 12px" }}>{po.total_piezas} pz</td>
                    <td style={{ padding: "10px 12px" }}>{Number(po.total_gramos || 0).toFixed(2)} g</td>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>{fmt(po.total_mxn)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ background: color + "20", color, border: `1px solid ${color}`, borderRadius: 12, padding: "2px 10px", fontSize: 11 }}>
                        {label}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <button className="secondary-button compact-action" onClick={(e) => { e.stopPropagation(); setSelected(po); }}>
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── EDITOR ── */}
      {selected !== null && (
        <PreorderEditor
          preorder={selected}
          clients={clients}
          products={products}
          tenantId={tenantId || profile?.tenant_id || ""}
          profile={profile}
          onClose={() => setSelected(null)}
          onSaved={async () => {
            setSelected(null);
            await load();
            setStatus("Preorden guardada correctamente.");
          }}
        />
      )}
    </section>
  );
}
