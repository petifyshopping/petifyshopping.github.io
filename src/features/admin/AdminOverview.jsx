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

  return (
    <section className="admin-overview" aria-labelledby="admin-overview-title">
      <div className="admin-overview-heading">
        <div>
          <p className="admin-eyebrow">STORE PERFORMANCE</p>
          <h2 id="admin-overview-title">Dashboard</h2>
        </div>
        <AdminButton onClick={refreshOverview} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </AdminButton>
      </div>
      {error && <p className="admin-overview-error" role="alert">{error}</p>}
      {overview && (
        <>
          <section className="admin-overview-group admin-overview-total" aria-labelledby="admin-overview-total-title">
            <h3 id="admin-overview-total-title">Overall total</h3>
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
          <details className="admin-overview-group admin-overview-collapsible">
            <summary>
              <strong>WhatsApp orders</strong>
              <span>{overview.orderStats.total_orders} orders</span>
            </summary>
            <div className="admin-overview-group-content">
              <div className="admin-overview-metrics">
                <article className="admin-overview-metric">
                  <span>Total orders</span>
                  <strong>{overview.orderStats.total_orders}</strong>
                </article>
                <article className="admin-overview-metric">
                  <span>Requested</span>
                  <strong>{overview.orderStats.requested_orders}</strong>
                </article>
                <article className="admin-overview-metric">
                  <span>Confirmed</span>
                  <strong>{overview.orderStats.confirmed_orders}</strong>
                </article>
                <article className="admin-overview-metric">
                  <span>Completed</span>
                  <strong>{overview.orderStats.fulfilled_orders}</strong>
                </article>
                <article className="admin-overview-metric">
                  <span>Cancelled</span>
                  <strong>{overview.orderStats.cancelled_orders}</strong>
                </article>
                <article className="admin-overview-metric admin-overview-metric-value">
                  <span>Completed value</span>
                  <strong>{formatProductPrice(overview.orderStats.fulfilled_total)}</strong>
                </article>
              </div>
            </div>
          </details>
          <details className="admin-overview-group admin-overview-collapsible">
            <summary>
              <strong>Manually entered invoices</strong>
              <span>{overview.invoiceStats.totalInvoices} invoices</span>
            </summary>
            <div className="admin-overview-group-content">
              <div className="admin-overview-metrics">
                <article className="admin-overview-metric">
                  <span>Total invoices</span>
                  <strong>{overview.invoiceStats.totalInvoices}</strong>
                </article>
                <article className="admin-overview-metric">
                  <span>Draft invoices</span>
                  <strong>{overview.invoiceStats.draftInvoices}</strong>
                </article>
                <article className="admin-overview-metric">
                  <span>Sent invoices</span>
                  <strong>{overview.invoiceStats.sentInvoices}</strong>
                </article>
                <article className="admin-overview-metric">
                  <span>Paid invoices</span>
                  <strong>{overview.invoiceStats.paidInvoices}</strong>
                </article>
                <article className="admin-overview-metric">
                  <span>Total invoice value</span>
                  <strong>{formatProductPrice(overview.invoiceStats.invoiceTotal)}</strong>
                </article>
                <article className="admin-overview-metric admin-overview-metric-value">
                  <span>Paid value</span>
                  <strong>{formatProductPrice(overview.invoiceStats.paidTotal)}</strong>
                </article>
              </div>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
