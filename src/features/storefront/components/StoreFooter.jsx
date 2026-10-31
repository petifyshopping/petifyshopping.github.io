import { DEFAULT_FOOTER_SOCIAL_URLS } from "../../../config/siteContent.js";
import WhatsAppIcon from "./WhatsAppIcon.jsx";

function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function getSocialUrl(name, visibility, phone) {
  const configuredUrl = visibility[`footer_${name}_url`] ?? DEFAULT_FOOTER_SOCIAL_URLS[name];
  const fallbackUrl = name === "whatsapp" && !configuredUrl && phone
    ? `https://wa.me/${phone}`
    : configuredUrl;
  return safeExternalUrl(String(fallbackUrl ?? "").trim());
}

function SocialIcon({ name }) {
  if (name === "whatsapp") return <WhatsAppIcon />;
  if (name === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" />
      </svg>
    );
  }
  if (name === "facebook") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 21v-8h3l.5-3H14V8c0-.9.3-1.5 1.6-1.5h2V3.8c-.4-.1-1.5-.2-2.8-.2-2.8 0-4.7 1.7-4.7 4.8V10H7v3h3.1v8H14Z" /></svg>;
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8A26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8Z" />
      <path className="store-footer-youtube-play" d="m10 15.5 5.2-3.5L10 8.5v7Z" />
    </svg>
  );
}

export default function StoreFooter({ brandTitle, logoUrl, footerTitle, footerCopyright, footerDisclaimer, footerVersion, contact, visibility }) {
  const phone = String(contact.whatsappNumber ?? "").replace(/\D/g, "");
  const showLogo = visibility.footer_logo ?? true;
  const showTitle = !showLogo && (visibility.footer_title ?? false);
  const showLocation = visibility.footer_location ?? visibility.footer_brand ?? true;
  const showContact = visibility.footer_contact ?? true;
  const socialLinks = [
    ["instagram", "Instagram"],
    ["facebook", "Facebook"],
    ["whatsapp", "WhatsApp"],
    ["youtube", "YouTube"],
  ].flatMap(([name, label]) => {
    const enabled = visibility[`footer_${name}`] ?? (name === "instagram" || (name === "whatsapp" && Boolean(phone)));
    const href = getSocialUrl(name, visibility, phone);
    return enabled && href ? [{ name, label, href }] : [];
  });
  return (
    <footer id="site-footer">
      <div className="store-footer-main">
        {(showLogo || (showTitle && footerTitle) || (showLocation && contact.location)) && (
          <div className="store-footer-brand">
            <div className="store-footer-brand-heading">
              {showLogo && <img className="store-footer-logo" src={logoUrl || "/images/logo.png"} alt={`${brandTitle || footerTitle} logo`} width="144" height="48" />}
              {showTitle && footerTitle && <h3>{footerTitle}</h3>}
            </div>
            {showLocation && contact.location && <p className="footer-location">{contact.location}</p>}
          </div>
        )}
        {showContact && (
          <nav className="store-footer-contact" aria-label="Contact">
            {contact.phoneDisplay && <a href={phone ? `tel:+${phone}` : undefined}>{contact.phoneDisplay}</a>}
            {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
          </nav>
        )}
        {socialLinks.length > 0 && (
          <nav className="store-footer-socials" aria-label="Social media">
            {socialLinks.map(({ name, label, href }) => (
              <a href={href} key={name} aria-label={label} title={label} target="_blank" rel="noopener noreferrer">
                <SocialIcon name={name} />
              </a>
            ))}
          </nav>
        )}
      </div>
      <div className="store-footer-bottom">
        {(visibility.footer_copyright ?? true) && footerCopyright && <p className="footer-legal">{footerCopyright}</p>}
        {(visibility.footer_disclaimer ?? true) && footerDisclaimer && <p className="footer-legal">{footerDisclaimer}</p>}
        {(visibility.footer_version ?? true) && footerVersion && <p className="footer-legal">Version {footerVersion}</p>}
      </div>
    </footer>
  );
}