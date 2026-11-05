import { useCallback, useEffect, useState } from "react";
import { formatProductPrice } from "../../lib/productPricing.js";
import { getAdminCustomerOrderStats, getAdminCustomerPage } from "../../services/customers.js";
import { getInvoiceDashboardStats } from "../../services/invoices.js";
import AdminButton from "./components/AdminButton.jsx";
import AdminState from "./components/AdminState.jsx";
import "./adminOverview.css";

async function loadOverview() {
  const [customers, orderStats, invoiceStats] = await Promise.all([
    getAdminCustomerPage(0, 1),
    getAdminCustomerOrderStats(),
    getInvoiceDashboardStats(),
  ]);
  const normalizedOrderStats = {
    total_orders: Number(orderStats.total_orders),
    requested_orders: Number(orderStats.requested_orders),
    confirmed_orders: Number(orderStats.confirmed_orders),
    fulfilled_orders: Number(orderStats.fulfilled_orders),
    cancelled_orders: Number(orderStats.cancelled_orders),
    fulfilled_total: Number(orderStats.fulfilled_total),
  };
  if (Object.values(normalizedOrderStats).some((value) => !Number.isFinite(value))) {
    throw new Error("WhatsApp order dashboard returned invalid statistics.");
  }
  return {
    customerCount: customers.total,
    orderStats: normalizedOrderStats,
    invoiceStats,
    combinedRecordCount: normalizedOrderStats.total_orders + invoiceStats.totalInvoices,
    combinedCompletedCount: normalizedOrderStats.fulfilled_orders + invoiceStats.paidInvoices,
    combinedCompletedValue: normalizedOrderStats.fulfilled_total + invoiceStats.paidTotal,
  };
}

function StatusBreakdown({ title, total, items, footer }) {
  return (
    <section className="admin-overview-breakdown" aria-label={title}>
      <div className="admin-overview-breakdown-heading">
        <div>
          <h3>{title}</h3>
          <p>{total} {total === 1 ? "record" : "records"}</p>
        </div>
        <span className="admin-overview-breakdown-total">{total}</span>
      </div>
      <div className="admin-overview-status-list">
        {items.map(({ label, value, tone }) => {
          const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <div className="admin-overview-status-row" key={label}>
              <span className="admin-overview-status-label">{label}</span>
              <div
                className={`admin-overview-status-track ${tone}`}
                role="progressbar"
                aria-label={`${label} records`}
                aria-valuemin="0"
                aria-valuemax={Math.max(total, 1)}
                aria-valuenow={value}
              >
                <span style={{ "--status-width": `${percentage}%` }} />
              </div>
              <strong>{value}</strong>
              <span className="admin-overview-status-percent">{percentage}%</span>
            </div>
          );
        })}
      </div>
      {footer && <div className="admin-overview-breakdown-footer">{footer}</div>}
    </section>
  );
}

export default function AdminOverview() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const refreshOverview = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      setOverview(await loadOverview());
    } catch (loadError) {
      console.error("Could not load admin dashboard statistics.", loadError);
      setError(loadError.message || "Dashboard statistics could not be loaded. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadOverview()
      .then((data) => {
        if (active) setOverview(data);
      })
      .catch((loadError) => {
        if (!active) return;
        console.error("Could not load admin dashboard statistics.", loadError);
        setError(loadError.message || "Dashboard statistics could not be loaded. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) return <AdminState kind="loading" description="Loading dashboard..." />;

  const orderStatusItems = [
    { label: "Requested", value: overview?.orderStats.requested_orders ?? 0, tone: "is-accent" },
    { label: "Confirmed", value: overview?.orderStats.confirmed_orders ?? 0, tone: "is-primary" },
    { label: "Completed", value: overview?.orderStats.fulfilled_orders ?? 0, tone: "is-success" },
    { label: "Cancelled", value: overview?.orderStats.cancelled_orders ?? 0, tone: "is-muted" },
  ];
  const invoiceStatusItems = [
    { label: "Draft", value: overview?.invoiceStats.draftInvoices ?? 0, tone: "is-muted" },
    { label: "Sent", value: overview?.invoiceStats.sentInvoices ?? 0, tone: "is-primary" },
    { label: "Paid", value: overview?.invoiceStats.paidInvoices ?? 0, tone: "is-success" },
  ];

  return (
    <section className="admin-overview" aria-labelledby="admin-overview-title">
      <div className="admin-overview-heading">
        <div>
          <p className="admin-eyebrow">YOUR STORE AT A GLANCE</p>
          <h2 id="admin-overview-title">Dashboard</h2>
          <p className="admin-overview-intro">A clear view of your customers, orders, and invoices.</p>
        </div>
        <AdminButton onClick={refreshOverview} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </AdminButton>
      </div>
      {error && <p className="admin-overview-error" role="alert">{error}</p>}
      {overview && (
        <>
          <section className="admin-overview-summary" aria-labelledby="admin-overview-total-title">
            <div className="admin-overview-section-heading">
              <div>
                <h3 id="admin-overview-total-title">Store summary</h3>
                <p>All-time totals across your current admin records.</p>
              </div>
            </div>
            <div className="admin-overview-metrics">
              <article className="admin-overview-metric">
                <span>Customers</span>
                <strong>{overview.customerCount}</strong>
              </article>
              <article className="admin-overview-metric">
                <span>Total orders + invoices</span>
                <strong>{overview.combinedRecordCount}</strong>
              </article>
              <article className="admin-overview-metric">
                <span>WhatsApp orders</span>
                <strong>{overview.orderStats.total_orders}</strong>
              </article>
              <article className="admin-overview-metric">
                <span>Invoice orders</span>
                <strong>{overview.invoiceStats.totalInvoices}</strong>
              </article>
              <article className="admin-overview-metric">
                <span>Completed + paid</span>
                <strong>{overview.combinedCompletedCount}</strong>
              </article>
              <article className="admin-overview-metric admin-overview-metric-value">
                <span>Completed + paid value</span>
                <strong>{formatProductPrice(overview.combinedCompletedValue)}</strong>
              </article>
            </div>
          </section>
          <section className="admin-overview-activity" aria-labelledby="admin-overview-activity-title">
            <div className="admin-overview-section-heading">
              <div>
                <h3 id="admin-overview-activity-title">Order and invoice activity</h3>
                <p>See how records are moving through each workflow.</p>
              </div>
            </div>
            <div className="admin-overview-breakdowns">
              <StatusBreakdown
                title="Customer orders"
                total={overview.orderStats.total_orders}
                items={orderStatusItems}
                footer={<><span>Completed value</span><strong>{formatProductPrice(overview.orderStats.fulfilled_total)}</strong></>}
              />
              <StatusBreakdown
                title="Invoices"
                total={overview.invoiceStats.totalInvoices}
                items={invoiceStatusItems}
                footer={<><span>Invoice total</span><strong>{formatProductPrice(overview.invoiceStats.invoiceTotal)}</strong><span>Paid value</span><strong>{formatProductPrice(overview.invoiceStats.paidTotal)}</strong></>}
              />
            </div>
          </section>
        </>
      )}
    </section>
  );
}
