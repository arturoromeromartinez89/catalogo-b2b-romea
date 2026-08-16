export function NexorNodeMark({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path d="M50 50 24 24M50 50l26-26M50 50 24 76M50 50l26 26" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="24" cy="24" r="8" fill="var(--nexor-signal)" />
      <circle cx="76" cy="24" r="8" fill="var(--nexor-link)" />
      <circle cx="24" cy="76" r="8" fill="var(--nexor-link)" />
      <circle cx="76" cy="76" r="8" fill="var(--nexor-signal)" />
      <circle cx="50" cy="50" r="12" fill="var(--nexor-fog)" />
    </svg>
  );
}

export default function NexorBrand({ compact = false, subtitle = "", showHandle = false }) {
  return (
    <div className={`nexor-brand${compact ? " nexor-brand--compact" : ""}`}>
      <div className="nexor-brand__lockup" aria-label="NEXOR IA">
        <span aria-hidden="true">ne</span>
        <NexorNodeMark className="nexor-brand__glyph" />
        <span aria-hidden="true">or</span>
        <span className="nexor-brand__ia" aria-hidden="true">IA</span>
      </div>
      {subtitle ? <span className="nexor-brand__subtitle">{subtitle}</span> : null}
      {showHandle ? <span className="nexor-brand__handle"><i />nexor-app.com</span> : null}
    </div>
  );
}
