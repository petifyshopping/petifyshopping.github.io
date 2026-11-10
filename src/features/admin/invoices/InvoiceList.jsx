import { useEffect, useMemo, useState } from "react";
import { formatProductPrice } from "../../../lib/productPricing.js";
import { invoiceStatus } from "./invoiceStatus.js";

const statusOptions = [
  { value: "all", label: "All statuses" },
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
  activeTab,
  onTabChange,
  onCreate,
  onEdit,
  onView,
  onDelete,
  onShare,
  onPrint,
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  useEffect(() => {
    function closeOptions(event) {
      if (event.target.closest(".invoice-list-options")) return;
      document.querySelectorAll(".invoice-list-options[open]").forEach((menu) => menu.removeAttribute("open"));
    }
    document.addEventListener("pointerdown", closeOptions);
    return () => document.removeEventListener("pointerdown", closeOptions);
  }, []);

  function toggleOptions(event) {
    const currentMenu = event.currentTarget.parentElement;
    document.querySelectorAll(".invoice-list-options[open]").forEach((menu) => {
      if (menu !== currentMenu) menu.removeAttribute("open");
    });
  }

  function closeMenu(event) {
    event.currentTarget.closest(".invoice-list-options")?.removeAttribute("open");
  }

  function toggleShareOptions(event) {
    event.stopPropagation();
    const currentShareMenu = event.currentTarget.parentElement;
    currentShareMenu.parentElement.querySelectorAll(".invoice-list-share-options[open]").forEach((menu) => {
      if (menu !== currentShareMenu) menu.removeAttribute("open");
    });
  }
  const filteredInvoices = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const sectionInvoices = invoices.filter((record) => (
      activeTab === "drafts"
        ? invoiceStatus(record) === "draft"
        : invoiceStatus(record) !== "draft"
    ));
    return sectionInvoices.filter((record) => {
      const customer = selectedCustomer(record);
      const matchesQuery = !normalizedQuery
        || [record.invoiceNumber, customer.name, customer.phone]
          .some((value) => String(value ?? "").toLocaleLowerCase().includes(normalizedQuery));
      return matchesQuery && (
        activeTab === "drafts"
        || statusFilter === "all"
        || invoiceStatus(record) === statusFilter
      );
    });
  }, [activeTab, invoices, query, statusFilter]);

  if (loading) return <InvoiceSkeletons />;
  if (loadError) return null;

  const draftCount = invoices.filter((record) => invoiceStatus(record) === "draft").length;
  const savedInvoices = invoices.length - draftCount;
  const sectionCount = activeTab === "drafts" ? draftCount : savedInvoices;

  return (
    <section className="invoice-list-section" aria-label="Invoices and drafts">
      <div
        className="invoice-section-tabs"
        role="tablist"
        aria-label="Invoice sections"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
          event.preventDefault();
          const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')];
          const currentTab = event.target.closest('[role="tab"]');
          const currentIndex = tabs.indexOf(currentTab);
          if (currentIndex < 0) return;
          const direction = event.key === "ArrowRight" ? 1 : -1;
          const nextTab = tabs[(currentIndex + direction + tabs.length) % tabs.length];
          nextTab.focus();
          onTabChange(nextTab.dataset.tab);
        }}
      >
        <button
          type="button"
          role="tab"
          id="invoice-tab-saved"
          aria-selected={activeTab === "invoices"}
          aria-controls="invoice-panel"
          tabIndex={activeTab === "invoices" ? 0 : -1}
          data-tab="invoices"
          onClick={() => onTabChange("invoices")}
        >
          Invoices <span>{savedInvoices}</span>
        </button>
        <button
          type="button"
          role="tab"
          id="invoice-tab-drafts"
          aria-selected={activeTab === "drafts"}
          aria-controls="invoice-panel"
          tabIndex={activeTab === "drafts" ? 0 : -1}
          data-tab="drafts"
          onClick={() => onTabChange("drafts")}
        >
          Drafts <span>{draftCount}</span>
        </button>
      </div>
      <div className="invoice-list-toolbar">
        <label className="invoice-search">
          <span className="invoice-visually-hidden">Search invoices</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customer or invoice number"
          />
        </label>
        {activeTab === "invoices" && (
          <label className="invoice-status-filter">
            <span className="invoice-visually-hidden">Filter by invoice status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
        )}
        <span className="invoice-list-count">{filteredInvoices.length} of {sectionCount}</span>
      </div>
      <div
        className="invoice-tab-panel"
        id="invoice-panel"
        role="tabpanel"
        aria-labelledby={activeTab === "drafts" ? "invoice-tab-drafts" : "invoice-tab-saved"}
        tabIndex={0}
      >
        {!sectionCount ? (
          <div className="invoice-empty-state">
            <span className="invoice-empty-icon" aria-hidden="true">{activeTab === "drafts" ? "✎" : "▤"}</span>
            <h2>{activeTab === "drafts" ? "No drafts yet" : "No saved invoices yet"}</h2>
            <p>
              {activeTab === "drafts"
                ? "Save an unfinished invoice as a draft and it will be kept here."
                : "Completed invoices will appear here, separate from your drafts."}
            </p>
            <button className="admin-primary-button" type="button" onClick={onCreate}>Create invoice</button>
          </div>
        ) : !filteredInvoices.length ? (
          <div className="invoice-empty-state is-compact">
            <h2>No matching {activeTab === "drafts" ? "drafts" : "invoices"}</h2>
            <p>Try a different search{activeTab === "invoices" ? " or status filter" : ""}.</p>
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
                  <span className="invoice-list-customer">
                    <strong>{invoicePrimary(record)}</strong>
                    <small>{invoiceSubtitle(record)}</small>
                  </span>
                  <span className="invoice-list-financial">
                    <strong>{formatProductPrice(record.total)}</strong>
                  </span>
                  <span className={`invoice-status-badge is-${status}`}>{status}</span>
                  <details className="invoice-list-options">
                    <summary aria-label={`Options for invoice ${record.invoiceNumber}`} onClick={toggleOptions}>Options</summary>
                    <div>
                      <button type="button" onClick={(event) => { closeMenu(event); onView(record); }}>View</button>
                      <button type="button" onClick={(event) => { closeMenu(event); onEdit(record); }}>Edit</button>
                      <details className="invoice-list-share-options">
                        <summary onClick={toggleShareOptions}>Share</summary>
                        <div>
                          <button type="button" onClick={(event) => { closeMenu(event); onShare(record); }}>Share image</button>
                          <button type="button" onClick={(event) => { closeMenu(event); onPrint(record); }}>Print / PDF</button>
                        </div>
                      </details>
                      <button type="button" disabled={Boolean(deletingInvoiceId)} onClick={(event) => { closeMenu(event); onDelete(record); }}>
                        {deletingInvoiceId === record.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
