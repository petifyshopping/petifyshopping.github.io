import { formatProductPrice, parseProductPrice } from "../../../lib/productPricing.js";
import WhatsAppIcon from "./WhatsAppIcon.jsx";

export default function ProductOrderLink({ product, whatsappNumber, combo, variant, compact = false, onOrder }) {
  const price = variant?.price ?? parseProductPrice(product.price);
  const productDetails = [
    `Hello, I'm interested in ${product.title}.`,
    variant?.label ? `Option: ${variant.label}` : "",
    price ? `Price: ${formatProductPrice(price)}` : "",
  ].filter(Boolean).join("\n");
  const message = [productDetails, product.defaultWhatsappMsg?.trim()]
    .filter(Boolean)
    .join("\n\n");
  const phone = String(whatsappNumber ?? "").replace(/\D/g, "");
  const link = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : "";

  const className = `btn btn-direct-order${compact ? " product-tile-whatsapp" : ""}${link ? "" : " is-unavailable"}`;
  const content = (
    <>
      <WhatsAppIcon />
      <span>{link ? (compact ? "WhatsApp order" : combo ? "Order Combo via WhatsApp" : "Order directly via WhatsApp") : "WhatsApp unavailable"}</span>
    </>
  );
  if (onOrder) {
    return (
      <button
        className={className}
        type="button"
        onClick={() => onOrder({ product, variant, link })}
        disabled={!link}
        aria-label={link ? `Order ${product.title} via WhatsApp` : "WhatsApp contact number unavailable"}
      >
        {content}
      </button>
    );
  }
  return (
    <a className={className} href={link || undefined} target="_blank" rel="noopener noreferrer" aria-label={link ? `Order ${product.title} via WhatsApp` : "WhatsApp contact number unavailable"} aria-disabled={!link} tabIndex={link ? undefined : -1}>
      {content}
    </a>
  );
}
