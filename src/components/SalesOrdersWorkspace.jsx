import { useEffect, useMemo, useState } from "react";
import { fetchSalesOrders, updateSalesOrderStatus } from "../services/salesOrderService";

const STATUS = {
  confirmada: { label: "Confirmada", tone: "success" },
  en_produccion: { label: "En produccion", tone: "info" },
  lista: { label: "Lista", tone: "warning" },
  entregada: { label: "Entregada", tone: "success" },
  cancelada: { label: "Cancelada", tone: "danger" },
};

const money = (value) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value || 0));

const date = (value) => value ? new Date(value).toLocaleDateString("es-MX") : "-";

function OrderStatusBadge({ status }) {
  const config = STATUS[status] || STATUS.confirmada;
  return <span className={`order-status order-status--${config.tone}`}>{config.label}</span>;
}

function OrderDetail({ order, onStatusChange }) {
  const saldo = Math.max(0, Number(order.totalMxn || 0) - Number(order.anticipoMxn || 0));
  return (
    <section className="order-detail-panel">
      <header className="order-detail-head">
        <div>
          <span className="tool-eyebrow">Orden de compra</span>
          <h2>{order.folio}</h2>
          <p>{order.clienteEmpresa || order.clienteNombre || "Cliente sin nombre"} &middot; Confirmada el {date(order.confirmedAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </header>

      <div className="order-summary-grid">
        <div><span>Total</span><strong>{money(order.totalMxn)}</strong></div>
        <div><span>Anticipo</span><strong>{money(order.anticipoMxn)}</strong></div>
        <div><span>Saldo estimado</span><strong>{money(saldo)}</strong></div>
        <div><span>Piezas</span><strong>{order.totalPiezas.toLocaleString("es-MX")}</strong></div>
      </div>

      <section className="order-legal-card">
        <header>
          <h3>Respaldo legal y comercial</h3>
          <p>Esta orden congela precios, cantidades y condiciones aceptadas para comparar despues contra remision.</p>
        </header>
        <div className="order-legal-grid">
          <div className={order.termsAccepted ? "legal-check ok" : "legal-check pending"}>
            <strong>Terminos aceptados</strong>
            <span>{order.termsAccepted ? `Aceptado por ${order.acceptedByName || "cliente"}` : "Pendiente de aceptacion formal"}</span>
          </div>
          <div className={order.comprobanteUrl ? "legal-check ok" : "legal-check pending"}>
            <strong>Comprobante / anticipo</strong>
            <span>{order.comprobanteUrl ? "Comprobante registrado" : order.anticipoMxn > 0 ? "Anticipo registrado sin comprobante" : "Sin anticipo registrado"}</span>
          </div>
        </div>
        {order.termsText ? <p className="order-terms-text">{order.termsText}</p> : null}
        {order.comprobanteUrl ? (
          <a className="secondary-button compact-action" href={order.comprobanteUrl} target="_blank" rel="noreferrer">Ver comprobante</a>
        ) : null}
      </section>

      <section className="order-lines-card">
        <header>
          <h3>Partidas confirmadas</h3>
          <select value={order.status} onChange={(event) => onStatusChange(order.id, event.target.value)}>
            {Object.entries(STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
        </header>
        <div className="order-lines-table-wrap">
          <table className="order-lines-table">
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Descripcion</th>
                <th className="right">Piezas</th>
                <th className="right">Gramos</th>
                <th className="right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.codigo || "-"}</strong></td>
                  <td>{item.descripcion || "-"}</td>
                  <td className="right">{item.piezas}</td>
                  <td className="right">{item.gramosTotal.toFixed(2)}</td>
                  <td className="right">{money(item.subtotalMxn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

export default function SalesOrdersWorkspace({ tenantId = "", initialOrderId = "", onInitialOrderViewed }) {
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(initialOrderId || "");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedId) || orders[0] || null,
    [orders, selectedId]
  );

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSalesOrders(tenantId);
      setOrders(data);
      if (initialOrderId) {
        setSelectedId(initialOrderId);
        onInitialOrderViewed?.();
      } else if (!selectedId && data[0]) {
        setSelectedId(data[0].id);
      }
    } catch (error) {
      setStatus(`No se pudieron cargar las ordenes: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenantId, initialOrderId]);

  const changeStatus = async (id, nextStatus) => {
    setStatus("Actualizando orden...");
    try {
      await updateSalesOrderStatus(id, nextStatus);
      setOrders((current) => current.map((order) => order.id === id ? { ...order, status: nextStatus } : order));
      setStatus("Orden actualizada.");
    } catch (error) {
      setStatus(`No se pudo actualizar: ${error.message}`);
    }
  };

  return (
    <section className="admin-workspace orders-workspace">
      <div className="orders-page-header">
        <div>
          <span className="tool-eyebrow">Pedidos confirmados</span>
          <h2>Ordenes de compra</h2>
          <p>Documentos confirmados con folio propio, condiciones y partidas congeladas.</p>
        </div>
        <button className="secondary-button compact-action" type="button" onClick={load}>Actualizar</button>
      </div>

      {status ? <p className="status info">{status}</p> : null}

      {loading ? (
        <div className="empty-state"><h2>Cargando ordenes...</h2></div>
      ) : !orders.length ? (
        <div className="empty-state">
          <h2>Aun no hay ordenes confirmadas</h2>
          <p>Confirma una preorden para generar la primera orden de compra.</p>
        </div>
      ) : (
        <div className="orders-layout">
          <aside className="orders-list-panel">
            {orders.map((order) => (
              <button
                key={order.id}
                type="button"
                className={`order-list-item${selectedOrder?.id === order.id ? " active" : ""}`}
                onClick={() => setSelectedId(order.id)}
              >
                <strong>{order.folio}</strong>
                <span>{order.clienteEmpresa || order.clienteNombre || "Cliente"}</span>
                <small>{money(order.totalMxn)} &middot; {date(order.confirmedAt)}</small>
              </button>
            ))}
          </aside>
          <OrderDetail order={selectedOrder} onStatusChange={changeStatus} />
        </div>
      )}
    </section>
  );
}
