import { useEffect, useRef, useState } from "react";
import { formatProductPrice, parseProductPrice, productOptions } from "../../../lib/productPricing.js";
import ProductGallery from "./ProductGallery.jsx";
import ProductOrderLink from "./ProductOrderLink.jsx";

export default function ProductDetailsDialog({ product, whatsappNumber, onAddToCart, onDirectOrder, onClose, initialVariantId }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const combo = product.type === "combo";
  const variants = productOptions(product);
  const [selectedVariantId, setSelectedVariantId] = useState(initialVariantId ?? variants[0]?.id ?? "");
  const [shareStatus, setShareStatus] = useState("");
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? variants[0];
  const isVariantProduct = Boolean(product.variants?.length);
  const displayPrice = isVariantProduct
    ? formatProductPrice(selectedVariant?.price)
    : product.price ? formatProductPrice(parseProductPrice(product.price)) : "";
  const displayOldPrice = isVariantProduct
    ? (selectedVariant?.oldPrice ? formatProductPrice(selectedVariant.oldPrice) : "")
    : product.oldPrice ? formatProductPrice(parseProductPrice(product.oldPrice)) : "";
  const currentPrice = isVariantProduct ? selectedVariant?.price : parseProductPrice(product.price);
  const oldPrice = isVariantProduct ? selectedVariant?.oldPrice : parseProductPrice(product.oldPrice);
  const discount = currentPrice > 0 && oldPrice > currentPrice ? Math.round((1 - currentPrice / oldPrice) * 100) : 0;
  const canAddToCart = Boolean(selectedVariant && selectedVariant.price > 0);
  const titleId = `product-details-title-${product.id}`;

  async function copyProductLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("product", String(product.id));
    if (selectedVariant?.id) url.searchParams.set("variant", String(selectedVariant.id));
    else url.searchParams.delete("variant");
    try {
      await navigator.clipboard.writeText(url.toString());
      setShareStatus("Product link copied.");
    } catch (error) {
      console.error("Could not copy the product link.", error);
      setShareStatus("Could not copy the link. You can share the URL in your browser address bar.");
    }
  }

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  return (
    <div className="product-details-overlay">
      <button className="product-details-backdrop" type="button" onClick={onClose} aria-label="Close product details" />
      <section
        className="product-details-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex="-1"
      >
        <header className="product-details-header">
          <h2 id={titleId}>Product details</h2>
          <div className="product-details-header-actions">
            <button className="product-details-share" type="button" onClick={copyProductLink}>Share</button>
            <button
              className="product-details-close"
              type="button"
              onClick={onClose}
              aria-label="Close product details"
              ref={closeButtonRef}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </header>
        <div className="product-details-content">
          <div className="product-details-gallery">
            <ProductGallery product={product} />
          </div>
          <div className="product-details-copy">
            {combo && product.saveTag && <span className="save-tag">{product.saveTag}</span>}
            {product.badge && <span className="card-badge">{product.badge}</span>}
            <h3>{product.title}</h3>
            {discount > 0 && <span className="product-discount">{discount}% off</span>}
            {product.description && <p>{product.description}</p>}
            {!combo && product.specs?.length > 0 && (
              <ul className="specs">
                {product.specs.map((spec) => {
                  const labelEnd = spec.indexOf("</strong>");
                  const hasLabel = spec.startsWith("<strong>") && labelEnd !== -1;
                  return (
                    <li key={spec}>
                      {hasLabel
                        ? <><strong>{spec.slice(8, labelEnd)}</strong>{spec.slice(labelEnd + 9)}</>
                        : spec}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {isVariantProduct && (
            <div className="price-box price-box-variants">
              <span className="price-box-heading">Available sizes &amp; prices</span>
              <div className="product-variant-prices" role="radiogroup" aria-label={`${product.title} sizes and prices`}>
                {variants.map((variant) => (
                  <label className="product-variant-price" key={variant.id}>
                    <input
                      type="radio"
                      name={`variant-${product.id}`}
                      value={variant.id}
                      checked={String(variant.id) === String(selectedVariantId)}
                      onChange={() => setSelectedVariantId(variant.id)}
                      aria-label={`${variant.label}, ${formatProductPrice(variant.price)}`}
                    />
                    <span className="product-variant-label">{variant.label}</span>
                    <span className="product-variant-amounts">
                      <strong className="price">{formatProductPrice(variant.price)}</strong>
                      {variant.oldPrice > variant.price && (
                        <span className="old-price">{formatProductPrice(variant.oldPrice)}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {!isVariantProduct && (displayPrice || displayOldPrice) && (
            <div className="price-box">
              <span className="price">{displayPrice}</span>
              {displayOldPrice && <del className="old-price">{displayOldPrice}</del>}
            </div>
          )}
          <div className="card-actions">
            <button
              className="btn btn-add-to-cart"
              type="button"
              disabled={!canAddToCart}
              onClick={() => onAddToCart(product, selectedVariant)}
              title={canAddToCart ? `Add ${product.title} to cart` : "Price unavailable; order directly via WhatsApp"}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 7h12l1 14H5L6 7Z" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" />
              </svg>
              <span>Add to cart</span>
            </button>
            <ProductOrderLink
              product={product}
              whatsappNumber={whatsappNumber}
              combo={combo}
              variant={isVariantProduct ? selectedVariant : null}
              onOrder={onDirectOrder}
            />
          </div>
          <p className="product-share-status" role="status" aria-live="polite">{shareStatus}</p>
        </div>
      </section>
    </div>
  );
}
