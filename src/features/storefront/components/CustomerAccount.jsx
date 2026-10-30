import { useEffect, useRef, useState } from "react";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  getCustomerOrders,
  updateCustomerAddress,
  updateCustomerProfile,
} from "../../../services/customers.js";
import {
  resetCustomerPassword,
  signInCustomer,
  signUpCustomer,
} from "../../../services/customerAuth.js";
import { formatProductPrice } from "../../../lib/productPricing.js";
import { getCustomerAddressEntries, parseCustomerAddress, serializeCustomerAddress } from "../../../lib/customerAddress.js";
import "./customerAccounts.css";

function formatOrderDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getProfileDraft(profile) {
  return {
    full_name: profile.full_name,
    phone: profile.phone,
    whatsapp_phone: profile.whatsapp_phone ?? "",
    whatsapp_same_as_phone: profile.whatsapp_same_as_phone ?? true,
    share_email_in_orders: profile.share_email_in_orders ?? false,
    share_phone_in_orders: profile.share_phone_in_orders ?? true,
    share_whatsapp_in_orders: profile.share_whatsapp_in_orders ?? false,
  };
}

export default function CustomerAccount({
  session,
  profile,
  profileLoading,
  customerOrderContactFields = { email: false, phone: true, whatsapp: false },
  message,
  authError,
  onClearMessage,
  onClose,
  onProfileChange,
  onAuthChange,
  onSignOut,
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [mode, setMode] = useState("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
  });
  const [signupAddressOpen, setSignupAddressOpen] = useState(false);
  const [signupAddress, setSignupAddress] = useState({
    address: "",
    pincode: "",
    place: "",
    district: "",
    state: "",
  });
  const [profileDraft, setProfileDraft] = useState(null);
  const [addressDraft, setAddressDraft] = useState({
    id: "",
    label: "",
    address: "",
    pincode: "",
    place: "",
    district: "",
    state: "",
  });
  const [addressEditorOpen, setAddressEditorOpen] = useState(false);
  const [orderState, setOrderState] = useState({ userId: "", rows: [] });
  const orders = session && orderState.userId === session.user.id ? orderState.rows : [];
  const loadingOrders = Boolean(session && orderState.userId !== session.user.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");

  function changeProfileField(field, value) {
    setProfileDraft((current) => ({
      ...(current ?? getProfileDraft(profile)),
      [field]: value,
    }));
  }

  useEffect(() => {
    if (!session) return;
    let active = true;
    getCustomerOrders(session.user.id)
      .then((loadedOrders) => {
        if (!active) return;
        setOrderState({ userId: session.user.id, rows: loadedOrders });
      })
      .catch((loadError) => {
        if (!active) return;
        console.error("Could not load customer orders.", loadError);
        setError("Your order history could not be loaded. Please try again.");
        setOrderState({ userId: session.user.id, rows: [] });
      });
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
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
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, [onClose]);

  async function submitAuth(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setConfirmationEmail("");
    onClearMessage();
    try {
      if (mode === "signup") {
        const result = await signUpCustomer({
          ...form,
          address: signupAddressOpen ? serializeCustomerAddress(signupAddress) : "",
        });
        if (!result.session) {
          if (result.user?.identities?.length === 0) {
            throw new Error("An account may already use this email. Try signing in or use Forgot password to recover it.");
          }
          setForm((current) => ({ ...current, password: "" }));
          setConfirmationEmail(form.email.trim());
        } else {
          onAuthChange(result.session);
        }
      } else {
        const result = await signInCustomer(form.email, form.password);
        onAuthChange(result.session);
      }
    } catch (authError) {
      console.error("Customer authentication failed.", authError);
      setError(authError.message || "We couldn't complete sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset() {
    if (!form.email.trim()) {
      setError("Enter your email address first so we can send a reset link.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await resetCustomerPassword(form.email.trim());
      setNotice("If an account exists for that email, a password reset link has been sent.");
    } catch (resetError) {
      console.error("Could not send the customer password reset email.", resetError);
      setError(resetError.message || "The password reset email could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const draft = profileDraft ?? {
        ...getProfileDraft(profile),
      };
      if (
        customerOrderContactFields.whatsapp
        && draft.share_whatsapp_in_orders
        && !draft.whatsapp_same_as_phone
        && !draft.whatsapp_phone.trim()
      ) {
        throw new Error("Enter your WhatsApp number or select the same number as your phone.");
      }
      const updatedProfile = await updateCustomerProfile(session.user.id, draft);
      onProfileChange({ ...updatedProfile, addresses: profile.addresses ?? [] });
      setProfileDraft(getProfileDraft(updatedProfile));
      setNotice("Your account details have been saved.");
    } catch (saveError) {
      console.error("Could not save the customer profile.", saveError);
      setError(saveError.message || "Your account details could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAddress(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const savedAddress = addressDraft.id
        ? await updateCustomerAddress(session.user.id, addressDraft.id, {
          ...addressDraft,
          address: serializeCustomerAddress(addressDraft),
        })
        : await createCustomerAddress(session.user.id, {
          ...addressDraft,
          address: serializeCustomerAddress(addressDraft),
        });
      const addresses = [
        ...(profile.addresses ?? []).filter((address) => address.id !== savedAddress.id),
        savedAddress,
      ].sort((first, second) => first.created_at.localeCompare(second.created_at));
      onProfileChange({ ...profile, addresses });
      setAddressDraft({ id: "", label: "", address: "", pincode: "", place: "", district: "", state: "" });
      setAddressEditorOpen(false);
      setNotice(addressDraft.id ? "Delivery address updated." : "Delivery address added.");
    } catch (saveError) {
      console.error("Could not save the customer delivery address.", saveError);
      setError(saveError.message || "The delivery address could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAddress(addressId) {
    if (!window.confirm("Delete this saved delivery address?")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await deleteCustomerAddress(session.user.id, addressId);
      onProfileChange({
        ...profile,
        addresses: (profile.addresses ?? []).filter((address) => address.id !== addressId),
      });
      if (addressDraft.id === addressId) {
        setAddressDraft({ id: "", label: "", address: "", pincode: "", place: "", district: "", state: "" });
        setAddressEditorOpen(false);
      }
      setNotice("Delivery address deleted.");
    } catch (deleteError) {
      console.error("Could not delete the customer delivery address.", deleteError);
      setError(deleteError.message || "The delivery address could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      await onSignOut();
      onClose();
    } catch (signOutError) {
      console.error("Could not sign out the customer.", signOutError);
      setError(signOutError.message || "You could not be signed out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const feedback = error || authError || message || notice;

  return (
    <div className="customer-account-overlay">
      <button className="customer-account-backdrop" type="button" onClick={onClose} aria-label="Close account" />
      <section
        className={`customer-account-dialog${!session ? " is-auth" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-account-title"
        ref={dialogRef}
        tabIndex="-1"
      >
        <header className="customer-account-header">
          <div className="customer-account-header-copy">
            {/* <p className="customer-account-eyebrow">Petify</p> */}
            <h2 id="customer-account-title">{session ? "Your account" : confirmationEmail ? "Confirm your email" : mode === "signup" ? "Create your account" : "Welcome back"}</h2>
            {!session && !confirmationEmail && (
              <p className="customer-account-header-description">
                {mode === "signup"
                  ? "A few details to make your next order easier."
                  : "Sign in to pick up where you left off."}
              </p>
            )}
          </div>
          <button className="customer-account-close" type="button" onClick={onClose} aria-label="Close account" ref={closeButtonRef}>×</button>
        </header>
        {!confirmationEmail && feedback && <p className={`customer-account-feedback${error || authError ? " is-error" : ""}`} role={error || authError ? "alert" : "status"}>{feedback}</p>}

        {confirmationEmail ? (
          <div className="customer-account-confirmation" role="status" aria-live="polite">
            <span className="customer-account-confirmation-icon" aria-hidden="true">✓</span>
            <p className="customer-account-section-label">ACCOUNT CREATED SUCCESSFULLY</p>
            <h3>Check your inbox</h3>
            <p>We sent a confirmation link to:</p>
            <strong className="customer-account-confirmation-email">{confirmationEmail}</strong>
            <p>Open the link in that email to confirm your address. Once confirmed, come back and sign in to your account.</p>
            <button
              className="customer-account-primary customer-account-submit"
              type="button"
              onClick={() => {
                setConfirmationEmail("");
                setMode("signin");
                setError("");
                setNotice("");
                setForm((current) => ({ ...current, password: "" }));
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : session ? (
          profileLoading || !profile ? (
            <div className="customer-account-loading" role="status">
              <p>{profileLoading ? "Loading your account…" : "Your profile is unavailable. Check your connection or sign out and try again."}</p>
              {!profileLoading && <button className="customer-account-secondary" type="button" onClick={signOut} disabled={busy}>Sign out</button>}
            </div>
          ) : (
            <div className="customer-account-content">
              <form className="customer-account-form customer-account-profile-form" onSubmit={saveProfile}>
                <p className="customer-account-section-label">ACCOUNT DETAILS</p>
                <label>
                  Name
                  <input value={profileDraft?.full_name ?? profile.full_name} onChange={(event) => changeProfileField("full_name", event.target.value)} autoComplete="name" required maxLength={120} />
                </label>
                <label>
                  Email
                  <input value={profile.email} type="email" autoComplete="email" readOnly />
                </label>
                <label>
                  Phone
                  <input value={profileDraft?.phone ?? profile.phone} onChange={(event) => changeProfileField("phone", event.target.value)} type="tel" autoComplete="tel" required maxLength={40} />
                </label>
                <label className="customer-account-checkbox">
                  <input
                    type="checkbox"
                    checked={profileDraft?.whatsapp_same_as_phone ?? profile.whatsapp_same_as_phone ?? true}
                    onChange={(event) => changeProfileField("whatsapp_same_as_phone", event.target.checked)}
                  />
                  <span>Use the same number for WhatsApp</span>
                </label>
                {!(profileDraft?.whatsapp_same_as_phone ?? profile.whatsapp_same_as_phone ?? true) && (
                  <label className="customer-account-whatsapp-field">
                    WhatsApp number
                    <input
                      value={profileDraft?.whatsapp_phone ?? profile.whatsapp_phone ?? ""}
                      onChange={(event) => changeProfileField("whatsapp_phone", event.target.value)}
                      type="tel"
                      autoComplete="tel"
                      maxLength={40}
                      required={Boolean(
                        customerOrderContactFields.whatsapp
                        && (profileDraft?.share_whatsapp_in_orders ?? profile.share_whatsapp_in_orders),
                      )}
                    />
                  </label>
                )}
                {(customerOrderContactFields.email || customerOrderContactFields.phone || customerOrderContactFields.whatsapp) && (
                  <fieldset className="customer-account-sharing">
                    <legend>Contact details in order messages</legend>
                    <p>Choose which enabled details you are comfortable sharing with the store on WhatsApp.</p>
                    {customerOrderContactFields.email && (
                      <label className="customer-account-checkbox">
                        <input
                          type="checkbox"
                          checked={profileDraft?.share_email_in_orders ?? profile.share_email_in_orders}
                          onChange={(event) => changeProfileField("share_email_in_orders", event.target.checked)}
                        />
                        <span>Include my email address</span>
                      </label>
                    )}
                    {customerOrderContactFields.phone && (
                      <label className="customer-account-checkbox">
                        <input
                          type="checkbox"
                          checked={profileDraft?.share_phone_in_orders ?? profile.share_phone_in_orders}
                          onChange={(event) => changeProfileField("share_phone_in_orders", event.target.checked)}
                        />
                        <span>Include my phone number</span>
                      </label>
                    )}
                    {customerOrderContactFields.whatsapp && (
                      <label className="customer-account-checkbox">
                        <input
                          type="checkbox"
                          checked={profileDraft?.share_whatsapp_in_orders ?? profile.share_whatsapp_in_orders}
                          onChange={(event) => changeProfileField("share_whatsapp_in_orders", event.target.checked)}
                        />
                        <span>Include my WhatsApp number</span>
                      </label>
                    )}
                  </fieldset>
                )}
                <div className="customer-account-actions">
                  <button className="customer-account-primary" type="submit" disabled={busy || profileLoading}>{busy ? "Saving…" : "Save details"}</button>
                  <button className="customer-account-secondary" type="button" onClick={signOut} disabled={busy}>{busy ? "Please wait…" : "Sign out"}</button>
                </div>
              </form>

              <section className="customer-addresses" aria-labelledby="customer-addresses-title">
                <div className="customer-account-orders-heading">
                  <div>
                    <p className="customer-account-section-label">DELIVERY</p>
                    <h3 id="customer-addresses-title">Saved addresses</h3>
                  </div>
                  <span>{profile.addresses?.length ?? 0}/3</span>
                </div>
                {profile.addresses?.length ? (
                  <div className="customer-address-list">
                    {profile.addresses.map((address) => (
                      <article className="customer-address-card" key={address.id}>
                        <div className="customer-address-card-main">
                          <strong>{address.label}</strong>
                          <dl className="customer-address-details">
                            {getCustomerAddressEntries(address.address).map((entry) => (
                              <div key={entry.label}>
                                <dt>{entry.label}</dt>
                                <dd>{entry.value}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                        <div className="customer-address-actions">
                          <button
                            className="customer-account-text-button"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setAddressDraft({
                                id: address.id,
                                label: address.label,
                                ...parseCustomerAddress(address.address),
                              });
                              setAddressEditorOpen(true);
                              setError("");
                              setNotice("");
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="customer-account-text-button is-danger"
                            type="button"
                            disabled={busy}
                            onClick={() => removeAddress(address.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <p className="customer-account-muted">Save an address to make ordering faster. You can keep up to three.</p>}
                {addressEditorOpen ? (
                  <form className="customer-account-form customer-address-editor" onSubmit={saveAddress}>
                    <label>
                      Address label
                      <input
                        value={addressDraft.label}
                        onChange={(event) => setAddressDraft((current) => ({ ...current, label: event.target.value }))}
                        placeholder="Home, work, etc."
                        maxLength={40}
                        required
                      />
                    </label>
                    <label>
                      Address
                      <span>House/building, street, and area/locality</span>
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
                    <div className="customer-address-location-grid">
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
                    <div className="customer-account-actions">
                      <button className="customer-account-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save address"}</button>
                      <button
                        className="customer-account-secondary"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setAddressDraft({ id: "", label: "", address: "", pincode: "", place: "", district: "", state: "" });
                          setAddressEditorOpen(false);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    className="customer-account-secondary customer-address-add"
                    type="button"
                    disabled={busy || (profile.addresses?.length ?? 0) >= 3}
                    onClick={() => {
                      setAddressDraft({ id: "", label: "", address: "", pincode: "", place: "", district: "", state: "" });
                      setAddressEditorOpen(true);
                      setError("");
                      setNotice("");
                    }}
                  >
                    Add address
                  </button>
                )}
              </section>

              <section className="customer-account-orders" aria-labelledby="customer-orders-title">
                <div className="customer-account-orders-heading">
                  <div><p className="customer-account-section-label">PURCHASES</p><h3 id="customer-orders-title">Your orders</h3></div>
                  <span>{orders.length}</span>
                </div>
                {loadingOrders ? <p className="customer-account-muted">Loading your orders…</p> : orders.length === 0 ? (
                  <p className="customer-account-muted">Your WhatsApp order requests will appear here after you continue to WhatsApp.</p>
                ) : (
                  <div className="customer-order-list">
                    {orders.map((order) => (
                      <article className="customer-order-card" key={order.id}>
                        <div className="customer-order-card-heading">
                          <strong>{formatProductPrice(order.total)}</strong>
                          <span>{formatOrderDate(order.created_at)}</span>
                        </div>
                        <ul>
                          {order.items.map((item, index) => (
                            <li key={`${order.id}-${item.product_id}-${item.variant_id}-${index}`}>
                              {item.quantity} × {item.title}{item.variant_label ? ` (${item.variant_label})` : ""}
                            </li>
                          ))}
                        </ul>
                        <span className="customer-order-status">{order.status.replaceAll("_", " ")}</span>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )
        ) : (
          <form className="customer-account-form customer-account-auth-form" onSubmit={submitAuth}>
            <div className="customer-account-auth-intro">
              <span className="customer-account-auth-mark" aria-hidden="true">
                <svg viewBox="0 0 32 32" fill="none">
                  <path d="M16 27c-4.1 0-8-2.1-8-5.8 0-2.7 2.4-4.3 5.2-4.3 1 0 1.8.3 2.8.8 1-.5 1.8-.8 2.8-.8 2.8 0 5.2 1.6 5.2 4.3 0 3.7-3.9 5.8-8 5.8Z" fill="currentColor" />
                  <ellipse cx="9.5" cy="12.2" rx="2.4" ry="3.3" fill="currentColor" />
                  <ellipse cx="15" cy="9.5" rx="2.4" ry="3.3" fill="currentColor" />
                  <ellipse cx="21" cy="10.2" rx="2.4" ry="3.3" fill="currentColor" />
                  <ellipse cx="25" cy="14" rx="2.1" ry="2.8" fill="currentColor" />
                </svg>
              </span>
              <div>
                <p className="customer-account-section-label">
                  {mode === "signup" ? "A BETTER WAY TO SHOP" : "YOUR PETIFY ACCOUNT"}
                </p>
                <p>{mode === "signup" ? "Create an account to save your cart and delivery details." : "Your saved cart and orders are waiting for you."}</p>
              </div>
            </div>
            {mode === "signup" && (
              <label>
                Name
                <input value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} autoComplete="name" required maxLength={120} />
              </label>
            )}
            <label>
              Email
              <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} type="email" autoComplete="email" required maxLength={254} />
            </label>
            {mode === "signup" && (
              <label>
                Phone number
                <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} type="tel" autoComplete="tel" required maxLength={40} />
              </label>
            )}
            <label>
              Password
              <span className="customer-password-control">
                <input
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                />
                <button
                  className="customer-password-toggle"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7" />
                      <path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c5.2 0 8.6 4.5 9.5 6-.4.7-1.3 2-2.8 3.3M6.2 6.3C4.3 7.5 3.1 9.3 2.5 11c.9 1.5 4.3 6 9.5 6 1 0 1.9-.2 2.8-.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  )}
                </button>
              </span>
            </label>
            {mode === "signup" && (
              <div className={`customer-signup-address${signupAddressOpen ? " is-open" : ""}`}>
                <label className="customer-signup-address-toggle">
                  <input
                    type="checkbox"
                    checked={signupAddressOpen}
                    onChange={(event) => setSignupAddressOpen(event.target.checked)}
                  />
                  <span className="customer-signup-address-toggle-copy">
                    <strong>Add address now</strong>
                    <span>Or you can add it later before ordering items.</span>
                  </span>
                  <span className="customer-signup-address-chevron" aria-hidden="true">⌄</span>
                </label>
                {signupAddressOpen && (
                  <div className="customer-signup-address-fields">
                    <label>
                      Address
                      <span>House/building, street, and area/locality</span>
                      <textarea
                        value={signupAddress.address}
                        onChange={(event) => setSignupAddress((current) => ({ ...current, address: event.target.value }))}
                        autoComplete="address-line1"
                        rows="2"
                        minLength={5}
                        maxLength={250}
                        required
                      />
                    </label>
                    <div className="customer-address-location-grid">
                      <label>
                        Pincode
                        <input
                          value={signupAddress.pincode}
                          onChange={(event) => setSignupAddress((current) => ({ ...current, pincode: event.target.value }))}
                          autoComplete="postal-code"
                          inputMode="numeric"
                          maxLength={20}
                          required
                        />
                      </label>
                      <label>
                        Place
                        <input
                          value={signupAddress.place}
                          onChange={(event) => setSignupAddress((current) => ({ ...current, place: event.target.value }))}
                          autoComplete="address-level3"
                          maxLength={60}
                          required
                        />
                      </label>
                      <label>
                        District
                        <input
                          value={signupAddress.district}
                          onChange={(event) => setSignupAddress((current) => ({ ...current, district: event.target.value }))}
                          autoComplete="address-level2"
                          maxLength={60}
                          required
                        />
                      </label>
                      <label>
                        State
                        <input
                          value={signupAddress.state}
                          onChange={(event) => setSignupAddress((current) => ({ ...current, state: event.target.value }))}
                          autoComplete="address-level1"
                          maxLength={60}
                          required
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
            <button className="customer-account-primary customer-account-submit" type="submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
            {mode === "signin" && <button className="customer-account-text-button" type="button" onClick={requestPasswordReset} disabled={busy}>Forgot password?</button>}
            <p className="customer-account-switch">
              {mode === "signup" ? "Already have an account?" : "New to Petify?"}
              <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); setNotice(""); onClearMessage(); }}>
                {mode === "signup" ? "Sign in" : "Create account"}
              </button>
            </p>
            {/* <p className="customer-account-privacy">Your customer account is separate from the store admin workspace.</p> */}
          </form>
        )}
      </section>
    </div>
  );
}
