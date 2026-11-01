import { useEffect, useMemo, useRef, useState } from "react";
import { formatProductPrice } from "../../lib/productPricing.js";
import { formatDateTime } from "../../lib/formatters.js";
import {
  getAdminCustomerOrderContactFields,
  getAdminCustomerLatestOrderTimes,
  getAdminCustomerPage,
  getAdminOrderPage,
  updateAdminCustomerOrderStatus,
  updateAdminCustomerOrderContactFields,
} from "../../services/customers.js";
import "./customerManagement.css";

const PAGE_SIZE = 30;
const ORDER_POLL_INTERVAL_MS = 30_000;
const UNNOTICED_ORDERS_STORAGE_KEY = "petify-admin-unnoticed-orders";
const ORDER_STATUSES = [
  { value: "whatsapp_requested", label: "WhatsApp requested" },
  { value: "confirmed", label: "Confirmed" },
  { value: "fulfilled", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function readUnnoticedOrderIds() {
  try {
    const storedIds = JSON.parse(window.localStorage.getItem(UNNOTICED_ORDERS_STORAGE_KEY) ?? "[]");
    return new Set(Array.isArray(storedIds) ? storedIds.filter((id) => typeof id === "string") : []);
  } catch (storageError) {
    console.warn("Could not read unnoticed order markers from browser storage.", storageError);
    return new Set();
  }
}

function persistUnnoticedOrderIds(orderIds) {
  try {
    window.localStorage.setItem(UNNOTICED_ORDERS_STORAGE_KEY, JSON.stringify([...orderIds]));
  } catch (storageError) {
    console.warn("Could not save unnoticed order markers to browser storage.", storageError);
  }
}

export default function CustomerManagement() {
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [latestOrderTimes, setLatestOrderTimes] = useState({});
  const [orderTotal, setOrderTotal] = useState(0);
  const [contactFields, setContactFields] = useState(null);
  const [contactFieldsSaving, setContactFieldsSaving] = useState(false);
  const [contactFieldsError, setContactFieldsError] = useState("");
  const [contactFieldsNotice, setContactFieldsNotice] = useState("");
  const [statusDrafts, setStatusDrafts] = useState({});
  const [updatingOrderIds, setUpdatingOrderIds] = useState([]);
  const [statusErrors, setStatusErrors] = useState({});
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSortBy, setCustomerSortBy] = useState("name");
  const [customerSortDirection, setCustomerSortDirection] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [loadingMoreCustomers, setLoadingMoreCustomers] = useState(false);
  const [loadingMoreOrders, setLoadingMoreOrders] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [unnoticedOrderIds, setUnnoticedOrderIds] = useState(readUnnoticedOrderIds);
  const [incomingOrder, setIncomingOrder] = useState(null);
  const [showOrderNotifications, setShowOrderNotifications] = useState(false);
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const privacySettingsCloseRef = useRef(null);
  const knownOrderIdsRef = useRef(new Set());

  useEffect(() => {
    let active = true;
    Promise.all([
      getAdminCustomerPage(0, PAGE_SIZE),
      getAdminOrderPage(0, PAGE_SIZE),
      getAdminCustomerOrderContactFields(),
    ])
      .then(([customerPage, orderPage, enabledContactFields]) => {
        if (!active) return;
        setCustomers(customerPage.rows);
        setCustomerTotal(customerPage.total);
        setOrders(orderPage.rows);
        setOrderTotal(orderPage.total);
        knownOrderIdsRef.current = new Set(orderPage.rows.map((order) => order.id));
        setContactFields(enabledContactFields);
      })
      .catch((loadError) => {
        if (!active) return;
        console.error("Could not load customer management data.", loadError);
        setError("Customer and order data could not be loaded. Check the customer-account migration and try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!customers.length) {
      setLatestOrderTimes({});
      return undefined;
    }
    let active = true;
    const lookupErrorMessage = "Customer last-order dates could not be loaded. Please refresh and try again.";
    getAdminCustomerLatestOrderTimes(customers.map((customer) => customer.user_id))
      .then((times) => {
        if (!active) return;
        setLatestOrderTimes(times);
        setError((current) => current === lookupErrorMessage ? "" : current);
      })
      .catch((lookupError) => {
        if (!active) return;
        console.error("Could not load customer last-order dates.", lookupError);
        setError(lookupErrorMessage);
      });
    return () => { active = false; };
  }, [customers]);

  useEffect(() => {
    if (loading) return undefined;
    let active = true;
    let checking = false;

    async function checkForNewOrders() {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const page = await getAdminOrderPage(0, PAGE_SIZE);
        if (!active) return;
        const newOrders = page.rows.filter((order) => !knownOrderIdsRef.current.has(order.id));
        knownOrderIdsRef.current = new Set([
          ...knownOrderIdsRef.current,
          ...page.rows.map((order) => order.id),
        ]);
        if (newOrders.length) {
          setOrders((current) => {
            const mergedOrders = new Map(current.map((order) => [order.id, order]));
            for (const order of page.rows) mergedOrders.set(order.id, order);
            return [...mergedOrders.values()].sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at));
          });
          setOrderTotal(page.total);
          setUnnoticedOrderIds((current) => {
            const next = new Set(current);
            for (const order of newOrders) next.add(order.id);
            persistUnnoticedOrderIds(next);
            return next;
          });
          setIncomingOrder(newOrders[0]);
        }
      } catch (refreshError) {
        if (!active) return;
        console.error("Could not check for new customer orders.", refreshError);
        setError("New orders could not be checked. The list will retry automatically.");
      } finally {
        checking = false;
      }
    }

    const intervalId = window.setInterval(checkForNewOrders, ORDER_POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", checkForNewOrders);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", checkForNewOrders);
    };
  }, [loading]);

  useEffect(() => {
    if (!showPrivacySettings) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = "hidden";
    privacySettingsCloseRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") setShowPrivacySettings(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
    };
  }, [showPrivacySettings]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLocaleLowerCase();
    return customers
      .filter((customer) => (
        [customer.full_name, customer.email, customer.phone, customer.address]
          .some((value) => String(value ?? "").toLocaleLowerCase().includes(query))
      ))
      .sort((first, second) => {
        let comparison;
        if (customerSortBy === "lastOrder") {
          const firstOrder = Date.parse(latestOrderTimes[first.user_id]);
          const secondOrder = Date.parse(latestOrderTimes[second.user_id]);
          const hasFirstOrder = Number.isFinite(firstOrder);
          const hasSecondOrder = Number.isFinite(secondOrder);
          if (!hasFirstOrder || !hasSecondOrder) {
            return hasFirstOrder === hasSecondOrder ? 0 : hasFirstOrder ? -1 : 1;
          }
          comparison = firstOrder - secondOrder;
        } else {
          comparison = String(first.full_name ?? "").localeCompare(
            String(second.full_name ?? ""),
            undefined,
            { sensitivity: "base" },
          );
        }
        return customerSortDirection === "asc" ? comparison : -comparison;
      });
  }, [customerSearch, customerSortBy, customerSortDirection, customers, latestOrderTimes]);

  const orderGroups = useMemo(() => {
    const groups = new Map();
    for (const order of orders) {
      const key = order.user_id || `order:${order.id}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name: order.customer_name || "Customer",
          email: order.customer_email || "",
          phone: order.customer_phone || "",
          orders: [],
        });
      }
      groups.get(key).orders.push(order);
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        orders: group.orders.sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at)),
      }))
      .sort((first, second) => Date.parse(second.orders[0].created_at) - Date.parse(first.orders[0].created_at));
  }, [orders]);

  const unnoticedOrders = useMemo(
    () => orders.filter((order) => unnoticedOrderIds.has(order.id)),
    [orders, unnoticedOrderIds],
  );

  function markOrdersNoticed(orderIds) {
    setUnnoticedOrderIds((current) => {
      const next = new Set(current);
      for (const id of orderIds) next.delete(id);
      persistUnnoticedOrderIds(next);
      return next;
    });
  }

  function markCustomerOrdersNoticed(group) {
    markOrdersNoticed(group.orders.map((order) => order.id));
  }

  async function loadMoreCustomers() {
    setLoadingMoreCustomers(true);
    setError("");
    try {
      const page = await getAdminCustomerPage(customers.length, PAGE_SIZE);
      setCustomers((current) => [...current, ...page.rows]);
      setCustomerTotal(page.total);
    } catch (loadError) {
      console.error("Could not load more customer profiles.", loadError);
      setError("More customer profiles could not be loaded.");
    } finally {
      setLoadingMoreCustomers(false);
    }
  }

  async function loadMoreOrders() {
    setLoadingMoreOrders(true);
    setError("");
    try {
      const page = await getAdminOrderPage(orders.length, PAGE_SIZE);
      setOrders((current) => [...current, ...page.rows]);
      setOrderTotal(page.total);
    } catch (loadError) {
      console.error("Could not load more customer orders.", loadError);
      setError("More customer orders could not be loaded.");
    } finally {
      setLoadingMoreOrders(false);
    }
  }

  async function refreshCustomerData() {
    setRefreshing(true);
    setError("");
    try {
      const [customerPage, orderPage, enabledContactFields] = await Promise.all([
        getAdminCustomerPage(0, Math.max(customers.length, PAGE_SIZE)),
        getAdminOrderPage(0, Math.max(orders.length, PAGE_SIZE)),
        getAdminCustomerOrderContactFields(),
      ]);
      const newOrders = orderPage.rows.filter((order) => !knownOrderIdsRef.current.has(order.id));
      knownOrderIdsRef.current = new Set(orderPage.rows.map((order) => order.id));
      setCustomers(customerPage.rows);
      setCustomerTotal(customerPage.total);
      setOrders(orderPage.rows);
      setOrderTotal(orderPage.total);
      setContactFields(enabledContactFields);
      if (newOrders.length) {
        setUnnoticedOrderIds((current) => {
          const next = new Set(current);
          for (const order of newOrders) next.add(order.id);
          persistUnnoticedOrderIds(next);
          return next;
        });
        setIncomingOrder(newOrders[0]);
      }
    } catch (refreshError) {
      console.error("Could not refresh customer management data.", refreshError);
      setError("Customer, order, and message settings could not be refreshed. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }

  async function saveOrderStatus(order, selectedStatus = statusDrafts[order.id] ?? order.status) {
    const nextStatus = selectedStatus;
    if (nextStatus === order.status) return;
    setUpdatingOrderIds((current) => [...current, order.id]);
    setStatusErrors((current) => ({ ...current, [order.id]: "" }));
    try {
      await updateAdminCustomerOrderStatus(order.id, nextStatus);
      setOrders((current) => current.map((item) => item.id === order.id
        ? { ...item, status: nextStatus }
        : item));
      setStatusDrafts((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
    } catch (updateError) {
      console.error("Could not update customer order status.", updateError);
      setStatusErrors((current) => ({
        ...current,
        [order.id]: updateError.message || "Order status could not be updated.",
      }));
    } finally {
      setUpdatingOrderIds((current) => current.filter((id) => id !== order.id));
    }
  }

  async function saveContactFields(event) {
    event.preventDefault();
    if (!contactFields) return;
    setContactFieldsSaving(true);
    setContactFieldsError("");
    setContactFieldsNotice("");
    try {
      const savedFields = await updateAdminCustomerOrderContactFields(contactFields);
      setContactFields(savedFields);
      setContactFieldsNotice("WhatsApp order message settings saved.");
    } catch (saveError) {
      console.error("Could not save WhatsApp order message settings.", saveError);
      setContactFieldsError(saveError.message || "WhatsApp order message settings could not be saved.");
    } finally {
      setContactFieldsSaving(false);
    }
  }

  return (
    <div className="customer-management">
      <div className="customer-management-page-actions customer-management-top-actions">
        <button
          className="customer-management-settings-trigger"
          type="button"
          onClick={() => setShowPrivacySettings(true)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
            <path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.4.8l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.4-.8l-1.7.7-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.4-.8l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.4.8l1.7-.7 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.7Z" transform="translate(-1 -1)" />
          </svg>
          Settings
        </button>
        <button
          className="customer-management-refresh"
          type="button"
          onClick={refreshCustomerData}
          disabled={loading || refreshing}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 7v5h-5M4 17v-5h5" />
            <path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2" />
          </svg>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {error && <p className="customer-management-error" role="alert">{error}</p>}

      {showPrivacySettings && (
        <div
          className="customer-management-settings-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowPrivacySettings(false);
          }}
        >
          <section
            className="customer-management-settings-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-message-fields-title"
          >
            <div className="customer-management-section-heading">
              <div>
                <p className="admin-eyebrow">CUSTOMER PRIVACY</p>
                <h2 id="order-message-fields-title">WhatsApp order message details</h2>
              </div>
              <button
                className="customer-management-settings-close"
                type="button"
                ref={privacySettingsCloseRef}
                onClick={() => setShowPrivacySettings(false)}
                aria-label="Close customer privacy settings"
              >
                ×
              </button>
            </div>
            <p className="customer-management-muted">
              Choose which optional contact details customers may enable in order messages. Delivery address and customer name remain included for order handling.
            </p>
            {contactFields && (
              <form className="customer-contact-settings" onSubmit={saveContactFields}>
                {[
                  ["email", "Email address"],
                  ["phone", "Phone number"],
                  ["whatsapp", "WhatsApp number"],
                ].map(([field, label]) => (
                  <label className="customer-contact-setting" key={field}>
                    <input
                      type="checkbox"
                      checked={contactFields[field]}
                      disabled={contactFieldsSaving}
                      onChange={(event) => {
                        setContactFields((current) => ({ ...current, [field]: event.target.checked }));
                        setContactFieldsNotice("");
                        setContactFieldsError("");
                      }}
                    />
                    <span>
                      <strong>Allow {label.toLowerCase()}</strong>
                      <small>Customers can choose whether to include this detail.</small>
                    </span>
                  </label>
                ))}
                {contactFieldsError && <p className="customer-management-error" role="alert">{contactFieldsError}</p>}
                {contactFieldsNotice && <p className="customer-contact-settings-notice" role="status">{contactFieldsNotice}</p>}
                <button className="customer-contact-settings-save" type="submit" disabled={contactFieldsSaving || loading}>
                  {contactFieldsSaving ? "Saving…" : "Save message settings"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}

      <details className="customer-management-section customer-management-directory">
        <summary aria-label={`${customerTotal} customers. Expand customer directory.`}>
          <strong id="customer-list-title">Customer directory</strong>
          <span>{customerTotal} customers</span>
        </summary>
        <div className="customer-management-directory-content">
          <div className="customer-management-directory-tools">
            <label className="customer-management-search">
              <span className="visually-hidden">Search customers</span>
              <input type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search name, email or phone" />
            </label>
            <label className="customer-management-sort">
              <span>Sort by</span>
              <select value={customerSortBy} onChange={(event) => setCustomerSortBy(event.target.value)}>
                <option value="name">Name</option>
                <option value="lastOrder">Last order</option>
              </select>
            </label>
            <label className="customer-management-sort">
              <span>Direction</span>
              <select value={customerSortDirection} onChange={(event) => setCustomerSortDirection(event.target.value)}>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
          </div>
          {loading ? <p className="customer-management-empty">Loading customer accounts…</p> : filteredCustomers.length === 0 ? (
            <p className="customer-management-empty">{customers.length ? "No customers match your search." : "No customer accounts have been created yet."}</p>
          ) : (
            <div className="customer-management-table-wrap">
              <table className="customer-management-table">
                <thead><tr><th>Customer</th><th>Phone</th><th>Last Delivery address</th><th>Joined</th></tr></thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.user_id}>
                      <td><strong>{customer.full_name}</strong><span>{customer.email}</span></td>
                      <td>{customer.phone}</td>
                      <td>{customer.address || <span className="customer-management-muted">Not provided</span>}</td>
                      <td>{formatDateTime(customer.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {customers.length < customerTotal && !customerSearch && (
            <button className="customer-management-load-more" type="button" onClick={loadMoreCustomers} disabled={loadingMoreCustomers}>
              {loadingMoreCustomers ? "Loading…" : "Load more customers"}
            </button>
          )}
        </div>
      </details>

      <section className="customer-management-section" aria-labelledby="customer-orders-admin-title">
        <div className="customer-management-section-heading customer-order-checkout-heading">
          <div className="customer-order-checkout-title">
            <p className="admin-eyebrow">WHATSAPP CHECKOUT</p>
            <h2 id="customer-orders-admin-title">Order requests</h2>
          </div>
          <div className="customer-order-admin-tools">
            <span className="customer-management-count">{orderTotal} total</span>
            <div className="customer-order-notifications">
              <button
                className="customer-order-notifications-trigger"
                type="button"
                aria-label={`Order notifications${unnoticedOrders.length ? `, ${unnoticedOrders.length} unnoticed` : ""}`}
                aria-expanded={showOrderNotifications}
                onClick={() => setShowOrderNotifications((visible) => !visible)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                  <path d="M10 21h4" />
                </svg>
                {unnoticedOrders.length > 0 && <span>{unnoticedOrders.length}</span>}
              </button>
              {showOrderNotifications && (
                <div className="customer-order-notifications-panel">
                  <strong>Unnoticed orders</strong>
                  {unnoticedOrders.length === 0 ? (
                    <p>All caught up.</p>
                  ) : (
                    <>
                      <ul>
                        {unnoticedOrders.slice(0, 5).map((order) => (
                          <li key={order.id}>
                            <span>{order.customer_name || "Customer"} · {formatDateTime(order.created_at)}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const groupKey = order.user_id || `order:${order.id}`;
                                document.getElementById(`customer-order-group-${groupKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                                const groupElement = document.getElementById(`customer-order-group-${groupKey}`);
                                if (groupElement instanceof HTMLDetailsElement) groupElement.open = true;
                                markOrdersNoticed([order.id]);
                              }}
                            >
                              View
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        className="customer-order-notifications-clear"
                        type="button"
                        onClick={() => markOrdersNoticed(unnoticedOrders.map((order) => order.id))}
                      >
                        Mark all noticed
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {incomingOrder && (
          <div className="customer-order-new-alert" role="alert">
            <span>New order from {incomingOrder.customer_name || "a customer"}</span>
            <button type="button" onClick={() => {
              const groupKey = incomingOrder.user_id || `order:${incomingOrder.id}`;
              const groupElement = document.getElementById(`customer-order-group-${groupKey}`);
              groupElement?.scrollIntoView({ behavior: "smooth", block: "center" });
              if (groupElement instanceof HTMLDetailsElement) groupElement.open = true;
              markOrdersNoticed([incomingOrder.id]);
              setIncomingOrder(null);
            }}>
              View order
            </button>
            <button className="customer-order-new-alert-dismiss" type="button" aria-label="Dismiss new order alert" onClick={() => setIncomingOrder(null)}>×</button>
          </div>
        )}
        {loading ? <p className="customer-management-empty">Loading orders…</p> : orders.length === 0 ? (
          <p className="customer-management-empty">Customer orders will appear here when they continue to WhatsApp.</p>
        ) : (
          <div className="customer-order-admin-groups">
            {orderGroups.map((group) => (
              <details
                className="customer-order-admin-group"
                id={`customer-order-group-${group.key}`}
                key={group.key}
                onToggle={(event) => {
                  if (event.currentTarget.open) markCustomerOrdersNoticed(group);
                }}
              >
                <summary className="customer-order-admin-group-heading">
                  <div className="customer-order-admin-group-customer">
                    <h3>{group.name}</h3>
                    {group.email && <a href={`mailto:${group.email}`}>{group.email}</a>}
                    {group.phone && <a href={`tel:${group.phone}`}>{group.phone}</a>}
                  </div>
                  <div className="customer-order-admin-group-meta">
                    <strong>{group.orders.length} {group.orders.length === 1 ? "order" : "orders"}</strong>
                    <span>Last ordered {formatDateTime(group.orders[0].created_at)}</span>
                    {unnoticedOrderIds.has(group.orders[0].id) && <span className="customer-order-unnoticed-mark">New order</span>}
                  </div>
                </summary>
                <div className="customer-order-admin-list">
                  {group.orders.map((order) => (
                    <article className="customer-order-admin-card" key={order.id}>
                      <details>
                        <summary className="customer-order-admin-heading">
                          <h4>Order details</h4>
                          <div className="customer-order-admin-total">
                            <strong>{formatProductPrice(order.total)}</strong>
                            <span>{formatDateTime(order.created_at)}</span>
                          </div>
                        </summary>
                        <div className="customer-order-admin-contact">
                          <span>{order.delivery_address}</span>
                        </div>
                        <ul className="customer-order-admin-items">
                          {order.items.map((item, index) => (
                            <li key={`${order.id}-${item.product_id}-${item.variant_id}-${index}`}>
                              <span>{item.quantity} × {item.title}{item.variant_label ? ` (${item.variant_label})` : ""}</span>
                              <strong>{item.unit_price > 0 ? formatProductPrice(item.line_total) : "Price on request"}</strong>
                            </li>
                          ))}
                        </ul>
                        {order.order_note && <p className="customer-order-admin-note"><strong>Note:</strong> {order.order_note}</p>}
                      </details>
                      <div className="customer-order-admin-actions">
                        <label>
                          <span className="visually-hidden">Order status for {group.name}</span>
                          <select
                            className={`customer-order-admin-status-select is-${statusDrafts[order.id] ?? order.status}`}
                            value={statusDrafts[order.id] ?? order.status}
                            disabled={updatingOrderIds.includes(order.id)}
                            onChange={(event) => {
                              const { value } = event.target;
                              setStatusDrafts((current) => ({ ...current, [order.id]: value }));
                              setStatusErrors((current) => ({ ...current, [order.id]: "" }));
                              saveOrderStatus(order, value);
                            }}
                          >
                            {ORDER_STATUSES.map((status) => (
                              <option value={status.value} key={status.value}>{status.label}</option>
                            ))}
                          </select>
                        </label>
                        {updatingOrderIds.includes(order.id) && <span className="customer-order-admin-saving">Saving…</span>}
                      </div>
                      {statusErrors[order.id] && <p className="customer-management-error" role="alert">{statusErrors[order.id]}</p>}
                    </article>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
        {orders.length < orderTotal && (
          <button className="customer-management-load-more" type="button" onClick={loadMoreOrders} disabled={loadingMoreOrders}>
            {loadingMoreOrders ? "Loading…" : "Load more orders"}
          </button>
        )}
      </section>
    </div>
  );
}
