import { useState } from "react";
import ActionNotice from "../components/ActionNotice";
import PurchasingWorkspace from "../components/PurchasingWorkspace";
import { purchasingDemoItems } from "../data/purchasingDemo";

export default function PurchasingDemoPage() {
  const [notice, setNotice] = useState(null);

  return (
    <div className="admin-catalog-shell purchase-demo-shell is-purchasing">
      <aside className="admin-romea-sidebar">
        <div className="brand-block purchase-demo-brand">
          <div className="purchase-demo-monogram" aria-label="Vanguardia Joyera">VJ</div>
          <p>Catálogo B2B</p>
        </div>
        <section className="sidebar-section sidebar-menu-section">
          <h3>OPERACIÓN</h3>
          <div className="admin-nav-list">
            <button type="button">Inicio</button>
            <button className="active" type="button">Compras</button>
            <button type="button">Catálogo administrador</button>
            <button type="button">Base de datos</button>
          </div>
        </section>
      </aside>
      <main className="admin-catalog-main">
        <header className="admin-catalog-header app-topbar">
          <div className="topbar-brand"><span className="topbar-brand__role">Vanguardia Joyera · vista de trabajo</span></div>
        </header>
        <PurchasingWorkspace
          demoItems={purchasingDemoItems}
          products={[]}
          onNotice={(type, title, message) => setNotice({ type, title, message })}
        />
      </main>
      <ActionNotice notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
