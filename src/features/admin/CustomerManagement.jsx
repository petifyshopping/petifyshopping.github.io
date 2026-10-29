import { useEffect, useMemo, useState } from "react";
import { formatProductPrice } from "../../lib/productPricing.js";
import {
  getAdminCustomerOrderStats,
  getAdminCustomerOrderContactFields,
  getAdminCustomerPage,
  getAdminOrderPage,
  updateAdminCustomerOrderStatus,
  updateAdminCustomerOrderContactFields,
} from "../../services/customers.js";
import "./customerManagement.css";

const PAGE_SIZE = 30;
const ORDER_STATUSES = [
  { value: "whatsapp_requested", label: "WhatsApp requested" },
  { value: "confirmed", label: "Confirmed" },
  { value: "fulfilled", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function CustomerManagement() {
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderStats, setOrderStats] = useState(null);
  const [contactFields, setContactFields] = useState(null);
  const [contactFieldsSaving, setContactFieldsSaving] = useState(false);
  const [contactFieldsError, setContactFieldsError] = useState("");
  const [contactFieldsNotice, setContactFieldsNotice] = useState("");
  const [statusDrafts, setStatusDrafts] = useState({});
  const [updatingOrderIds, setUpdatingOrderIds] = useState([]);
  const [statusErrors, setStatusErrors] = useState({});
  const [customerSearch, setCustomerSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMoreCustomers, setLoadingMoreCustomers] = useState(false);
  const [loadingMoreOrders, setLoadingMoreOrders] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      getAdminCustomerPage(0, PAGE_SIZE),
      getAdminOrderPage(0, PAGE_SIZE),
      getAdminCustomerOrderStats(),
      getAdminCustomerOrderContactFields(),
    ])
      .then(([customerPage, orderPage, stats, enabledContactFields]) => {
        if (!active) return;
        setCustomers(customerPage.rows);
        setCustomerTotal(customerPage.total);
        setOrders(orderPage.rows);
        setOrderTotal(orderPage.total);
        setOrderStats(stats);
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

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLocaleLowerCase();
    if (!query) return customers;
    return customers.filter((customer) => (
      [customer.full_name, customer.email, customer.phone, customer.address]
        .some((value) => String(value ?? "").toLocaleLowerCase().includes(query))
    ));
  }, [customerSearch, customers]);

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

  async function saveOrderStatus(order) {
    const nextStatus = statusDrafts[order.id] ?? order.status;
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
      try {
        setOrderStats(await getAdminCustomerOrderStats());
      } catch (statsError) {
        console.error("Order status was updated, but order stats could not be refreshed.", statsError);
        setError("Order status was updated, but the order statistics could not be refreshed. Reload the page to update them.");
      }
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
      <div className="customer-management-summary" aria-label={`${customerTotal} customers and ${orderTotal} orders`}>
        <span><strong>{customerTotal}</strong> customers</span>
        <span><strong>{orderTotal}</strong> orders</span>
        {orderStats && (
          <>
            <span><strong>{orderStats.confirmed_orders}</strong> confirmed</span>
            <span><strong>{orderStats.fulfilled_orders}</strong> completed</span>
            <span><strong>{formatProductPrice(orderStats.fulfilled_total)}</strong> completed value</span>
          </>
        )}
      </div>

      {error && <p className="customer-management-error" role="alert">{error}</p>}

      <section className="customer-management-section" aria-labelledby="order-message-fields-title">
        <div className="customer-management-section-heading">
          <div>
            <p className="admin-eyebrow">CUSTOMER PRIVACY</p>
            <h2 id="order-message-fields-title">WhatsApp order message details</h2>
          </div>
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
            <button className="customer-order-admin-save" type="submit" disabled={contactFieldsSaving || loading}>
              {contactFieldsSaving ? "Saving…" : "Save message settings"}
            </button>
          </form>
        )}
      </section>

      <section className="customer-management-section" aria-labelledby="customer-list-title">
        <div className="customer-management-section-heading">
          <div><p className="admin-eyebrow">CUSTOMER DIRECTORY</p><h2 id="customer-list-title">Customers</h2></div>
          <label className="customer-management-search">
            <span className="visually-hidden">Search customers</span>
            <input type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search name, email or phone" />
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
                    <td>{formatDate(customer.created_at)}</td>
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
      </section>

      <section className="customer-management-section" aria-labelledby="customer-orders-admin-title">
        <div className="customer-management-section-heading">
          <div><p className="admin-eyebrow">WHATSAPP CHECKOUT</p><h2 id="customer-orders-admin-title">Order requests</h2></div>
          <span className="customer-management-count">{orderTotal} total</span>
        </div>
        {loading ? <p className="customer-management-empty">Loading orders…</p> : orders.length === 0 ? (
          <p className="customer-management-empty">Customer orders will appear here when they continue to WhatsApp.</p>
        ) : (
          <div className="customer-order-admin-list">
            {orders.map((order) => (
              <article className="customer-order-admin-card" key={order.id}>
                <div className="customer-order-admin-heading">
                  <div><h3>{order.customer_name}</h3><a href={`mailto:${order.customer_email}`}>{order.customer_email}</a></div>
                  <div className="customer-order-admin-total">
                    <strong>{formatProductPrice(order.total)}</strong>
                    <span>{formatDate(order.created_at)}</span>
                  </div>
                </div>
                <div className="customer-order-admin-contact">
                  <a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>
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
                <div className="customer-order-admin-actions">
                  <span className={`customer-order-admin-status is-${order.status}`}>{order.status.replaceAll("_", " ")}</span>
                  <label>
                    <span className="visually-hidden">Update status for order from {order.customer_name}</span>
                    <select
                      value={statusDrafts[order.id] ?? order.status}
                      disabled={updatingOrderIds.includes(order.id)}
                      onChange={(event) => {
                        const { value } = event.target;
                        setStatusDrafts((current) => ({ ...current, [order.id]: value }));
                        setStatusErrors((current) => ({ ...current, [order.id]: "" }));
                      }}
                    >
                      {ORDER_STATUSES.map((status) => (
                        <option value={status.value} key={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="customer-order-admin-save"
                    type="button"
                    disabled={updatingOrderIds.includes(order.id) || (statusDrafts[order.id] ?? order.status) === order.status}
                    onClick={() => saveOrderStatus(order)}
                  >
                    {updatingOrderIds.includes(order.id) ? "Saving…" : "Update"}
                  </button>
                </div>
                {statusErrors[order.id] && <p className="customer-management-error" role="alert">{statusErrors[order.id]}</p>}
              </article>
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
