export default function ActionNotice({ notice, onClose }) {
  if (!notice?.message) return null;

  const type = notice.type || "info";
  const title = notice.title || (type === "error" ? "Revisar acción" : type === "success" ? "Acción realizada" : "Aviso");

  return (
    <div className={`action-notice ${type}`} role="status" aria-live="polite">
      <div>
        <strong>{title}</strong>
        <span>{notice.message}</span>
      </div>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Cerrar aviso">
          x
        </button>
      ) : null}
    </div>
  );
}
