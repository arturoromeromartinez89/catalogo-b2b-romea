const SOCIAL_ITEMS = [
  { key: "website", showKey: "show_website", label: "Web" },
  { key: "instagram", showKey: "show_instagram", label: "IG" },
  { key: "facebook", showKey: "show_facebook", label: "FB" },
  { key: "tiktok", showKey: "show_tiktok", label: "TK" },
  { key: "linkedin", showKey: "show_linkedin", label: "IN" },
];

const ensureUrl = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text.replace(/^\/+/, "")}`;
};

const phoneHref = (value = "") => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 8 ? `tel:${digits}` : "";
};

const whatsappHref = (number = "", message = "") => {
  const digits = String(number || "").replace(/\D/g, "");
  if (digits.length < 8) return "";
  const normalizedNumber = digits.length === 10 ? `52${digits}` : digits;
  const text = String(message || "Hola, quiero apoyo con mi pedido.").trim();
  return `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(text)}`;
};

export default function TenantTopBanner({ config = {}, compact = false }) {
  const announcement = config?.announcement || {};
  if (!announcement.enabled) return null;

  const contact = announcement.contact || {};
  const socials = announcement.socials || {};
  const text = String(announcement.text || "").trim();
  const contactItems = [];

  const whatsappUrl = whatsappHref(contact.whatsapp_number, contact.whatsapp_message);
  if (contact.show_whatsapp && whatsappUrl) {
    contactItems.push({ key: "whatsapp", label: "WhatsApp", href: whatsappUrl, external: true });
  }

  const telUrl = phoneHref(contact.phone);
  if (contact.show_phone && telUrl) {
    contactItems.push({ key: "phone", label: contact.phone, href: telUrl });
  }

  if (contact.show_email && contact.email) {
    contactItems.push({ key: "email", label: contact.email, href: `mailto:${contact.email}` });
  }

  const socialItems = SOCIAL_ITEMS
    .map((item) => ({
      ...item,
      href: socials[item.showKey] ? ensureUrl(socials[item.key]) : "",
    }))
    .filter((item) => item.href);

  if (!text && !contactItems.length && !socialItems.length) return null;
  const classes = [
    "tenant-top-banner",
    compact ? "tenant-top-banner--compact" : "",
    contactItems.length ? "" : "tenant-top-banner--no-contacts",
    text ? "" : "tenant-top-banner--no-ticker",
    socialItems.length ? "" : "tenant-top-banner--no-socials",
  ].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      {contactItems.length ? <div className="tenant-top-banner__contacts">
        {contactItems.map((item) => (
          <a
            className={`tenant-top-banner__pill tenant-top-banner__pill--${item.key}`}
            href={item.href}
            key={item.key}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noreferrer" : undefined}
          >
            {item.label}
          </a>
        ))}
      </div> : null}

      {text ? (
        <div className={`tenant-top-banner__ticker${announcement.animate ? " is-animated" : ""}`} aria-label={text}>
          <span>{text}</span>
        </div>
      ) : null}

      {socialItems.length ? <div className="tenant-top-banner__socials">
        {socialItems.map((item) => (
          <a
            className="tenant-top-banner__social"
            href={item.href}
            key={item.key}
            target="_blank"
            rel="noreferrer"
            aria-label={item.key}
          >
            {item.label}
          </a>
        ))}
      </div> : null}
    </div>
  );
}
