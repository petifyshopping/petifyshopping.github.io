import { useMemo, useState } from "react";
import { formatProductPrice } from "../../../lib/productPricing.js";
import { invoiceStatus } from "./invoiceStatus.js";

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

function selectedCustomer(record) {
  const details = record.customerDetails ?? {};
  if (details.source === "saved") return details.savedCustomer ?? {};
  if (details.source === "invoice") return details.invoiceCustomer ?? {};
  return details.manualCustomer ?? details;
}

function invoicePrimary(record) {
  const customer = selectedCustomer(record);
  const name = customer.name?.trim();
  const phone = customer.phone?.trim();
  if (name && phone) return `${name} - ${phone}`;
  return name || phone || record.invoiceNumber;
}

function invoiceSubtitle(record) {
  const customer = selectedCustomer(record);
  return customer.name?.trim() || customer.phone?.trim()
    ? `${record.invoiceNumber} · ${record.issueDate}`
    : record.issueDate;
}

function InvoiceStatusBadge({ status }) {
  return <span className={`invoice-status-badge is-${status}`}>{status}</span>;
}

function InvoiceSkeletons() {
  return (
    <div className="invoice-skeleton-list" role="status" aria-label="Loading invoices" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div className="invoice-skeleton-card" key={index}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

export default function InvoiceList({
  invoices,
  loading,
  loadError,
  deletingInvoiceId,
  onCreate,
  onOpen,
  onDelete,
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const filteredInvoices = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return invoices.filter((record) => {
      const customer = selectedCustomer(record);
      const matchesQuery = !normalizedQuery
        || [record.invoiceNumber, customer.name, customer.phone]
          .some((value) => String(value ?? "").toLocaleLowerCase().includes(normalizedQuery));
      return matchesQuery && (statusFilter === "all" || invoiceStatus(record) === statusFilter);
    });
  }, [invoices, query, statusFilter]);

  if (loading) return <InvoiceSkeletons />;
  if (loadError) return null;

  if (!invoices.length) {
    return (
      <div className="invoice-empty-state">
        <span className="invoice-empty-icon" aria-hidden="true">▤</span>
        <h2>No invoices yet</h2>
        <p>Create your first invoice and it will appear here for later viewing, printing, or sharing.</p>
        <button className="admin-primary-button" type="button" onClick={onCreate}>Create invoice</button>
      </div>
    );
  }

  return (
    <section className="invoice-list-section" aria-label="Saved invoices">
      <div className="invoice-list-toolbar">
        <label className="invoice-search">
          <span className="invoice-visually-hidden">Search invoices</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customer, phone, or invoice number"
          />
        </label>
        <label className="invoice-status-filter">
          <span className="invoice-visually-hidden">Filter by invoice status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </label>
        <span className="invoice-list-count">{filteredInvoices.length} of {invoices.length}</span>
      </div>
      {!filteredInvoices.length ? (
        <div className="invoice-empty-state is-compact">
          <h2>No matching invoices</h2>
          <p>Try a different search or status filter.</p>
          <button
            className="admin-secondary-button"
            type="button"
            onClick={() => { setQuery(""); setStatusFilter("all"); }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="invoice-list">
          {filteredInvoices.map((record) => {
            const status = invoiceStatus(record);
            return (
              <article className="invoice-list-row" key={record.id}>
                <button
                  className="invoice-list-open"
                  type="button"
                  aria-label={`Open invoice for ${invoicePrimary(record)}`}
                  onClick={() => onOpen(record)}
                >
                  <span className="invoice-list-customer">
                    <strong>{invoicePrimary(record)}</strong>
                    <small>{invoiceSubtitle(record)}</small>
                  </span>
                  <span className="invoice-list-financial">
                    <InvoiceStatusBadge status={status} />
                    <strong>{formatProductPrice(record.total)}</strong>
                  </span>
                </button>
                <button
                  className="admin-delete-button invoice-list-delete"
                  type="button"
                  aria-label={`Delete invoice ${record.invoiceNumber}`}
                  disabled={Boolean(deletingInvoiceId)}
                  onClick={() => onDelete(record)}
                >
                  {deletingInvoiceId === record.id ? "Deleting..." : "Delete"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
