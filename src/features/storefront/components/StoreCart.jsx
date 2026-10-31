import { useEffect, useRef, useState } from "react";
import { formatProductPrice } from "../../../lib/productPricing.js";
import { getCustomerOrderContactDetails } from "../../../lib/customerOrderDetails.js";
import { serializeCustomerAddress } from "../../../lib/customerAddress.js";
import QuantityStepper from "./QuantityStepper.jsx";
import WhatsAppIcon from "./WhatsAppIcon.jsx";

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
  onSaveAddress,
  customerOrderContactFields,
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [customer, setCustomer] = useState({ note: "" });
  const [checkoutError, setCheckoutError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [addressMode, setAddressMode] = useState("auto");
  const [showAddressChooser, setShowAddressChooser] = useState(false);
  const [addressDraft, setAddressDraft] = useState({
    label: "Home",
    address: "",
    pincode: "",
    place: "",
    district: "",
    state: "",
  });
  const [saveAddressForLater, setSaveAddressForLater] = useState(true);
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);
  const totalPrice = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const deliveryAddress = profile?.addresses?.find((address) => address.id === selectedAddressId);
  const resolvedAddressMode = addressMode === "auto"
    ? deliveryAddress ? "saved" : "new"
    : addressMode;
  const isNewAddressComplete = Boolean(
    addressDraft.address.trim().length >= 5
    && addressDraft.pincode.trim()
    && addressDraft.place.trim()
    && addressDraft.district.trim()
    && addressDraft.state.trim()
    && (!saveAddressForLater || addressDraft.label.trim()),
  );
  const addressText = resolvedAddressMode === "saved"
    ? deliveryAddress?.address ?? ""
    : serializeCustomerAddress(addressDraft);
  const hasValidAddress = resolvedAddressMode === "saved"
    ? Boolean(deliveryAddress && addressText.trim().length >= 5)
    : isNewAddressComplete && addressText.trim().length >= 5;
  const canSaveAddress = (profile?.addresses?.length ?? 0) < 3;
  const customerDetails = { ...customer, address: addressText };
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
    if (!hasValidAddress) {
      setCheckoutError("Enter a delivery address to continue.");
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
      let addressId = resolvedAddressMode === "saved" ? deliveryAddress?.id ?? null : null;
      const temporaryAddress = resolvedAddressMode === "new" && !saveAddressForLater ? addressText : null;
      if (resolvedAddressMode === "new" && saveAddressForLater) {
        if (!canSaveAddress) throw new Error("You can save up to three delivery addresses. Choose a one-time address or manage saved addresses in your account.");
        const savedAddress = await onSaveAddress({
          label: addressDraft.label.trim(),
          address: addressText,
        });
        addressId = savedAddress.id;
        setAddressMode("saved");
        onAddressSelect(addressId);
      }
      await onCheckout({
        items,
        addressId,
        temporaryAddress,
        note: customer.note.trim(),
      });
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
              <div className="store-cart-footer-details">
                <p className="store-cart-note">Delivery and availability are confirmed on WhatsApp.</p>
                <div className="store-cart-customer-fields">
                  <label>
                    {/* <span>Order note (optional)</span> */}
                    <input
                      value={customer.note}
                      onChange={(event) => setCustomer((current) => ({ ...current, note: event.target.value }))}
                      placeholder="Add a delivery note (Optional)"
                      maxLength={500}
                    />
                  </label>
                </div>
                <section className="store-cart-delivery-card" aria-label="Delivery address">
                  {!authenticated ? (
                    <button
                      className="store-cart-address-action"
                      type="button"
                      onClick={() => onOpenAccount("Sign in or create an account before placing an order.")}
                      disabled={authLoading || submitting}
                    >
                      <WhatsAppIcon />
                      Sign in to order
                    </button>
                  ) : resolvedAddressMode === "saved" && deliveryAddress ? (
                    <>
                      <button
                        className="store-cart-selected-address"
                        type="button"
                        onClick={() => setShowAddressChooser((visible) => !visible)}
                        aria-expanded={showAddressChooser}
                        disabled={authLoading || submitting}
                      >
                        <span>Delivering to - {deliveryAddress.label}.</span>
                        <span>Choose another</span>
                      </button>
                      {showAddressChooser && (
                        <label className="store-cart-address-select">
                          <span className="visually-hidden">Choose or add a delivery address</span>
                          <select
                            autoFocus
                            value={deliveryAddress.id}
                            onChange={(event) => {
                              if (event.target.value === "new") {
                                setAddressMode("new");
                                setSaveAddressForLater(canSaveAddress);
                                setAddressDraft((current) => ({ ...current, label: "Home" }));
                              } else {
                                setAddressMode("saved");
                                onAddressSelect(event.target.value);
                                setShowAddressChooser(false);
                              }
                              setCheckoutError("");
                            }}
                            disabled={authLoading || submitting}
                          >
                            {(profile?.addresses ?? []).map((address) => (
                              <option value={address.id} key={address.id}>{address.label}</option>
                            ))}
                            <option value="new">Add address…</option>
                          </select>
                        </label>
                      )}
                    </>
                  ) : authenticated && (
                  <div className="store-cart-address-editor">
                    <label>
                      Address
                      <textarea
                        value={addressDraft.address}
                        onChange={(event) => setAddressDraft((current) => ({ ...current, address: event.target.value }))}
                        autoComplete="address-line1"
                        rows="2"
                        minLength={5}
                        maxLength={250}
                        required
                      />
                    </label>
                    <div className="store-cart-address-fields">
                      <label>
                        Pincode
                        <input
                          value={addressDraft.pincode}
                          onChange={(event) => setAddressDraft((current) => ({ ...current, pincode: event.target.value }))}
                          autoComplete="postal-code"
                          inputMode="numeric"
                          maxLength={20}
                          required
                        />
                      </label>
                      <label>
                        Place
                        <input
                          value={addressDraft.place}
                          onChange={(event) => setAddressDraft((current) => ({ ...current, place: event.target.value }))}
                          autoComplete="address-level3"
                          maxLength={60}
                          required
                        />
                      </label>
                      <label>
                        District
                        <input
                          value={addressDraft.district}
                          onChange={(event) => setAddressDraft((current) => ({ ...current, district: event.target.value }))}
                          autoComplete="address-level2"
                          maxLength={60}
                          required
                        />
                      </label>
                      <label>
                        State
                        <input
                          value={addressDraft.state}
                          onChange={(event) => setAddressDraft((current) => ({ ...current, state: event.target.value }))}
                          autoComplete="address-level1"
                          maxLength={60}
                          required
                        />
                      </label>
                    </div>
                    <label className="store-cart-save-address">
                      <input
                        type="checkbox"
                        checked={canSaveAddress && saveAddressForLater}
                        onChange={(event) => setSaveAddressForLater(event.target.checked)}
                        disabled={!canSaveAddress || submitting}
                      />
                      <span>{canSaveAddress ? "Save this address for future orders" : "Address limit reached; this address will be used once"}</span>
                    </label>
                  </div>
                  )}
                </section>
              {checkoutError && <p className="store-cart-phone-error" role="alert">{checkoutError}</p>}
              {!canCheckout ? (
                <div className="store-cart-validation" role="status" aria-live="polite">
                  <p>{validationMessage}</p>
                  {validationMessage.includes("paused") && (
                    <button type="button" onClick={onRetryValidation}>Retry validation</button>
                  )}
                </div>
              ) : !checkoutLink ? <p className="store-cart-phone-error" role="alert">WhatsApp checkout is unavailable because a contact number has not been configured.</p> : null}
              <p className="store-cart-secure-note">Your order request opens directly in WhatsApp.</p>
              </div>
              <div className="store-cart-checkout-summary">
                <div className="store-cart-subtotal">
                  <span>Total for {totalQuantity} {totalQuantity === 1 ? "item" : "items"}</span>
                  <strong>{formatProductPrice(totalPrice)}</strong>
                </div>
                <button
                  className="store-cart-checkout"
                  type="button"
                  onClick={beginCheckout}
                  disabled={authLoading || submitting || !authenticated || !hasValidAddress || !canCheckout || !checkoutLink}
                >
                  <WhatsAppIcon />
                  <span>
                    {submitting
                      ? "Saving order…"
                      : !authenticated
                        ? "Sign in to order"
                        : !canCheckout
                          ? "Checkout unavailable"
                          : !checkoutLink
                            ? "WhatsApp unavailable"
                            : !hasValidAddress
                              ? "Add address to order"
                              : resolvedAddressMode === "new" && saveAddressForLater
                                ? "Save address & order"
                                : "Order via WhatsApp"}
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
