import { useState } from "react";
import { formatProductPrice, parseProductPrice, productOptions } from "../../../lib/productPricing.js";
import ProductOrderLink from "./ProductOrderLink.jsx";
import QuantityStepper from "./QuantityStepper.jsx";

const placeholderImage = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='100%25' height='100%25' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='50%25' fill='%2394a3b8' font-family='sans-serif' font-size='16' text-anchor='middle' dy='.3em'%3ENo Image%3C/svg%3E";

function handleImageError(event) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = placeholderImage;
}

export default function ProductCard({ product, whatsappNumber, cartItems, onAddToCart, onUpdateQuantity, onOpenDetails, onDirectOrder }) {
  const variants = productOptions(product);
  const isVariantProduct = Boolean(product.variants?.length);
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id ?? "");
  const selectedVariant = variants.find((variant) => String(variant.id) === String(selectedVariantId)) ?? variants[0];
  const price = isVariantProduct ? selectedVariant?.price : parseProductPrice(product.price);
  const hasPrice = isVariantProduct ? Boolean(selectedVariant) : Boolean(product.price);
  const canAddToCart = Boolean(selectedVariant && selectedVariant.price > 0);
  const combo = product.type === "combo";
  const image = product.images?.[0] || placeholderImage;
  const cartKey = `${product.id}:${selectedVariant?.id ?? ""}`;
  const cartItem = cartItems.find((item) => item.key === cartKey);
  const oldPrice = isVariantProduct ? selectedVariant?.oldPrice : parseProductPrice(product.oldPrice);
  const discount = price > 0 && oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0;

  return (
    <article className={`card product-list-card${combo ? " combo-card" : ""}`}>
      <div className="product-tile">
        <button
          className="product-tile-image-button"
          type="button"
          onClick={() => onOpenDetails(product, selectedVariant?.id)}
          aria-label={`View ${product.title} images and details`}
        >
          <img
            className="product-tile-image"
            src={image}
            alt={product.title}
            width="600"
            height="600"
            loading="lazy"
            decoding="async"
            onError={handleImageError}
          />
        </button>
        <div className="product-tile-content">
          <div className="product-tile-heading">
            <div className="product-tile-title-group">
              <h3>
                <button
                  className="product-tile-title"
                  type="button"
                  onClick={() => onOpenDetails(product, selectedVariant?.id)}
                  aria-haspopup="dialog"
                  aria-label={`View details for ${product.title}`}
                >
                  {product.title}
                </button>
              </h3>
              {(product.badge || combo) && (
                <div className="product-tile-labels">
                  {product.badge && <span className="product-summary-badge">{product.badge}</span>}
                  {combo && (
                    <span className="product-summary-badge product-tile-savings">
                      {product.saveTag || "Combo"}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          {isVariantProduct && variants.length > 1 && (
            <label className="product-tile-variant">
              <span>Size</span>
              <select value={selectedVariantId} onChange={(event) => setSelectedVariantId(event.target.value)} aria-label={`Choose size for ${product.title}`}>
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>{variant.label} — {formatProductPrice(variant.price)}</option>
                ))}
              </select>
            </label>
          )}
          <div className="product-tile-purchase">
            <div className="product-tile-price">
              <strong>{hasPrice ? formatProductPrice(price) : "Price on request"}</strong>
              {isVariantProduct && variants.length === 1 && <span>{selectedVariant.label}</span>}
              {oldPrice > price && <del>{formatProductPrice(oldPrice)}</del>}
              {discount > 0 && <span className="product-discount">{discount}% off</span>}
            </div>
            <div className={`product-tile-actions${cartItem ? " has-cart-quantity" : ""}`}>
              {cartItem ? (
                <QuantityStepper
                  value={cartItem.quantity}
                  label={`${product.title} quantity`}
                  onDecrease={() => onUpdateQuantity(cartKey, -1)}
                  onIncrease={() => onUpdateQuantity(cartKey, 1)}
                />
              ) : (
                <button
                  className="btn btn-add-to-cart product-tile-add"
                  type="button"
                  disabled={!canAddToCart}
                  onClick={() => onAddToCart(product, selectedVariant)}
                  aria-label={canAddToCart ? `Add ${product.title}${selectedVariant?.label ? `, ${selectedVariant.label}` : ""} to cart` : `${product.title} price unavailable`}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 7h12l1 14H5L6 7Z" />
                    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
                  </svg>
                  <span>Add to cart</span>
                </button>
              )}
              <ProductOrderLink
                product={product}
                whatsappNumber={whatsappNumber}
                combo={combo}
                variant={isVariantProduct ? selectedVariant : null}
                compact
                onOrder={onDirectOrder}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
