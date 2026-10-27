import { useEffect, useRef, useState } from "react";
import { formatProductPrice } from "../../../lib/productPricing.js";
import { getCustomerOrderContactDetails } from "../../../lib/customerOrderDetails.js";
import QuantityStepper from "./QuantityStepper.jsx";

function cartOrderLink(items, whatsappNumber, total, customer, profile, enabledContactFields) {
  const lines = items.map((item) => {
    const option = item.variantLabel ? ` (${item.variantLabel})` : "";
    return `• ${item.title}${option}\n  Qty: ${item.quantity} × ${formatProductPrice(item.price)} = ${formatProductPrice(item.price * item.quantity)}`;
  });
  const customerDetails = [
    profile?.full_name ? `Name: ${profile.full_name}` : "",
    ...getCustomerOrderContactDetails(profile, customer.address, enabledContactFields),
    customer.note ? `Note: ${customer.note}` : "",
  ].filter(Boolean);
  const message = [
    "Hello! I'd like to place an order:",
    "",
    lines.join("\n\n"),
    "",
    `Grand total: ${formatProductPrice(total)}`,
    customerDetails.length ? "" : null,
    ...customerDetails,
    "",
    "Please confirm availability and delivery details.",
  ].filter((line) => line !== null).join("\n");
  const phone = String(whatsappNumber ?? "").replace(/\D/g, "");

  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : "";
}

export default function StoreCart({
  items,
  whatsappNumber,
  brandTitle,
  canCheckout,
  validationMessage,
  onRetryValidation,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onRemoveAllItems,
  profile,
  selectedAddressId,
  onAddressSelect,
  authenticated,
  authLoading,
  onOpenAccount,
  onCheckout,
  onOrderHandoff,
  customerOrderContactFields,
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [customer, setCustomer] = useState({ note: "" });
  const [checkoutError, setCheckoutError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
  const totalPrice = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const deliveryAddress = profile?.addresses?.find((address) => address.id === selectedAddressId);
  const customerDetails = { ...customer, address: deliveryAddress?.address ?? "" };
  const whatsappDetails = [
    profile?.full_name ? { label: "Name", value: profile.full_name } : null,
    ...getCustomerOrderContactDetails(profile, deliveryAddress?.address, customerOrderContactFields)
      .map((detail) => {
        const separatorIndex = detail.indexOf(":");
        return {
          label: detail.slice(0, separatorIndex),
          value: detail.slice(separatorIndex + 1).trim(),
        };
      }),
  ].filter(Boolean);
  const checkoutLink = cartOrderLink(items, whatsappNumber, totalPrice, customerDetails, profile, customerOrderContactFields);

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
        'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
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

  async function beginCheckout() {
    setCheckoutError("");
    if (!authenticated) {
      onOpenAccount("Sign in or create an account before placing an order.");
      return;
    }
    if (!deliveryAddress) {
      setCheckoutError("Add and select a delivery address before ordering.");
      return;
    }
    const whatsappWindow = window.open("about:blank", "_blank");
    if (!whatsappWindow) {
      setCheckoutError("Allow pop-ups to continue to WhatsApp after your order is saved.");
      return;
    }
    whatsappWindow.opener = null;
    setSubmitting(true);
    try {
      await onCheckout({ items, addressId: deliveryAddress.id, note: customer.note.trim() });
      whatsappWindow.location.href = cartOrderLink(
        items,
        whatsappNumber,
        totalPrice,
        customerDetails,
        profile,
        customerOrderContactFields,
      );
      await onOrderHandoff();
    } catch (orderError) {
      whatsappWindow.close();
      console.error("Could not save the cart order.", orderError);
      setCheckoutError(orderError.message || "Your order could not be saved. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="store-cart-overlay">
      <button className="store-cart-backdrop" type="button" onClick={onClose} aria-label="Close cart" />
      <aside
        className="store-cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-cart-title"
        ref={dialogRef}
        tabIndex="-1"
      >
        <div className="store-cart-header">
          <div>
            <p className="store-cart-eyebrow">YOUR SELECTION</p>
            <h2 id="store-cart-title">Your {brandTitle} Cart</h2>
            <span className="store-cart-item-count">{totalQuantity} {totalQuantity === 1 ? "item" : "items"}</span>
          </div>
          <div className="store-cart-header-actions">
            {items.length > 0 && (
              <button className="store-cart-remove-all" type="button" onClick={onRemoveAllItems}>
                Remove all
              </button>
            )}
            <button
              className="store-cart-close"
              type="button"
              onClick={onClose}
              aria-label="Close cart"
              ref={closeButtonRef}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="store-cart-empty">
            <span className="store-cart-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M6 7h12l1 14H5L6 7Z" />
                <path d="M9 8V6a3 3 0 0 1 6 0v2" />
              </svg>
            </span>
            <h3>Your cart is empty</h3>
            <p>Explore the catalog and add your favorites. You can still order any item directly via WhatsApp.</p>
            <button className="store-cart-continue" type="button" onClick={onClose}>Continue browsing</button>
          </div>
        ) : (
          <>
            <div className="store-cart-items" role="list" aria-label="Cart items">
              {items.map((item) => (
                <article className="store-cart-item" key={item.key} role="listitem">
                  {item.image
                    ? <img src={item.image} alt="" className="store-cart-item-image" />
                    : <span className="store-cart-item-image store-cart-item-placeholder" aria-hidden="true" />}
                  <div className="store-cart-item-copy">
                    <h3>{item.title}</h3>
                    {item.variantLabel && <span className="store-cart-item-option">{item.variantLabel}</span>}
                    <strong className="store-cart-item-unit-price">{formatProductPrice(item.price)} each</strong>
                    <QuantityStepper
                      value={item.quantity}
                      label={`${item.title} quantity`}
                      onDecrease={() => onUpdateQuantity(item.key, -1)}
                      onIncrease={() => onUpdateQuantity(item.key, 1)}
                    />
                  </div>
                  <div className="store-cart-item-total">
                    <strong>{formatProductPrice(item.price * item.quantity)}</strong>
                    <button type="button" onClick={() => onRemoveItem(item.key)} aria-label={`Remove ${item.title} from cart`}>
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="store-cart-footer">
              <div className="store-cart-subtotal">
                <span>Grand total</span>
                <strong>{formatProductPrice(totalPrice)}</strong>
              </div>
              <p className="store-cart-note">Shipping and availability are confirmed by our team on WhatsApp.</p>
              <section className="store-cart-delivery-card" aria-label="Delivery details">
                <div className="store-cart-delivery-heading">
                  <div>
                    <span>WHATSAPP ORDER MESSAGE</span>
                    <strong>{authenticated ? "Details shared with the store" : "Sign in to add delivery details"}</strong>
                  </div>
                  {authenticated && profile?.addresses?.length > 0 && (
                    <label className="store-cart-address-select">
                      <span className="visually-hidden">Choose delivery address</span>
                      <select
                        value={deliveryAddress?.id ?? ""}
                        onChange={(event) => {
                          onAddressSelect(event.target.value);
                          setCheckoutError("");
                        }}
                        disabled={authLoading || submitting}
                      >
                        {profile.addresses.map((address) => (
                          <option value={address.id} key={address.id}>{address.label}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {deliveryAddress ? (
                  <dl className="store-cart-delivery-address">
                    {whatsappDetails.map((entry) => (
                      <div key={entry.label}>
                        <dt>{entry.label}</dt>
                        <dd>{entry.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="store-cart-no-address">
                    <p>{authenticated ? "Add a saved delivery address to continue." : "Sign in to choose a saved delivery address."}</p>
                    <button
                      type="button"
                      onClick={() => onOpenAccount(authenticated
                        ? "Save a delivery address to continue with your order."
                        : "Sign in or create an account to save a delivery address.")}
                      disabled={authLoading || submitting}
                    >
                      {authenticated ? "Add address" : "Sign in"}
                    </button>
                  </div>
                )}
              </section>
              <div className="store-cart-customer-fields">
                <label>
                  <span>Order note (optional)</span>
                  <input
                    value={customer.note}
                    onChange={(event) => setCustomer((current) => ({ ...current, note: event.target.value }))}
                    placeholder="Add a delivery note"
                    maxLength={500}
                  />
                </label>
              </div>
              {checkoutError && <p className="store-cart-phone-error" role="alert">{checkoutError}</p>}
              {!canCheckout ? (
                <div className="store-cart-validation" role="status" aria-live="polite">
                  <p>{validationMessage}</p>
                  {validationMessage.includes("paused") && (
                    <button type="button" onClick={onRetryValidation}>Retry validation</button>
                  )}
                </div>
              ) : checkoutLink ? (
                <button className="store-cart-checkout" type="button" onClick={beginCheckout} disabled={authLoading || submitting || !authenticated || !deliveryAddress}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.5 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.6A8.5 8.5 0 1 1 20.5 11.5Z" />
                  <path d="M8.5 8.2c.5 2.7 2.1 4.3 4.8 5" />
                </svg>
                  <span>{submitting ? "Saving order…" : authenticated ? "Order via WhatsApp" : "Sign in to order"}</span>
                </button>
              ) : <p className="store-cart-phone-error" role="alert">WhatsApp checkout is unavailable because a contact number has not been configured.</p>}
              <p className="store-cart-secure-note">Your order request opens directly in WhatsApp. No online payment is taken here.</p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
