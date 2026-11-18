import { formatProductPrice } from "../../../lib/productPricing.js";
import { formatDate } from "../../../lib/formatters.js";

const headerFields = [
  ["businessName", "Business name"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["address", "Address"],
];

function selectedCustomerDetails(customerDetails) {
  if (customerDetails.source === "saved") return customerDetails.savedCustomer ?? {};
  if (customerDetails.source === "invoice") return customerDetails.invoiceCustomer ?? {};
  return customerDetails.manualCustomer ?? customerDetails;
}

function formatInvoiceDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : formatDate(date);
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export default function InvoicePreview({ invoice, totals, storefrontTagline, lineTotal }) {
  const { values, visible } = invoice.businessDetails;
  const reviewInvitation = invoice.businessDetails.reviewInvitation;
  const reviewInvitationUrl = safeHttpUrl(reviewInvitation?.url ?? "");
  const customer = {
    ...invoice.customerDetails,
    ...selectedCustomerDetails(invoice.customerDetails),
  };
  const tagline = values.tagline || storefrontTagline;
  const customerFields = [
    ["Name", customer.name],
    ["Company", customer.companyName],
    ["Phone", customer.phone],
    ["Email", customer.email],
    ["Address", customer.address],
    ["Place", customer.place],
    ["GSTIN", customer.gstin],
    ["Delivery partner", invoice.customerDetails.deliveryPartner],
  ]
    .map(([label, value]) => [label, String(value ?? "").trim()])
    .filter(([, value]) => value);

  return (
    <article className="invoice-paper" aria-label="Invoice print preview">
      <header className="invoice-paper-header">
        <div className="invoice-paper-business">
          {visible.logo && values.logoUrl && (
            <span className={`invoice-paper-logo-wrap${invoice.businessDetails.logoBlueBackground ? " has-blue-background" : ""}`}>
              <img
                className={`invoice-paper-logo${invoice.businessDetails.logoBlueBackground ? " has-blue-background" : ""}`}
                src={values.logoUrl}
                alt=""
              />
            </span>
          )}
          {visible.tagline && tagline && <p className="invoice-paper-tagline">{tagline}</p>}
          {headerFields.map(([key]) => visible[key] && values[key] && (
            <p className={key === "businessName" ? "invoice-paper-business-name" : ""} key={key}>{values[key]}</p>
          ))}
        </div>
        <div className="invoice-paper-meta">
          <h2>Invoice</h2>
          <p className="invoice-paper-meta-number"><strong>No.</strong> {invoice.invoiceNumber || "—"}</p>
          <p><strong>Issued</strong> {formatInvoiceDate(invoice.issueDate)}</p>
          {invoice.dueDate && <p><strong>Due</strong> {formatInvoiceDate(invoice.dueDate)}</p>}
          {invoice.createdAt && <p><strong>Created</strong> {formatDate(invoice.createdAt)}</p>}
        </div>
      </header>
      {invoice.customerDetails.enabled && (
        <section className="invoice-paper-customer">
          <h3>Customer details</h3>
          {customerFields.length ? (
            <dl className="invoice-paper-customer-fields">
              {customerFields.map(([label, value]) => (
                <div className={label === "Name" ? "is-primary" : ""} key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          ) : <p>No customer details provided.</p>}
        </section>
      )}
      <div className="invoice-paper-table-wrap">
        <table className="invoice-paper-table">
          <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
          <tbody>
            {invoice.items.length ? invoice.items.map((item, index) => (
              <tr key={`${item.productId}-${index}`}>
                <td data-label="Item">{item.description || "Item"}</td>
                <td data-label="Qty">{item.quantity}</td>
                <td data-label="Unit price">{formatProductPrice(item.unitPrice)}</td>
                <td data-label="Amount">{formatProductPrice(lineTotal(item))}</td>
              </tr>
            )) : <tr className="invoice-paper-empty-row"><td colSpan="4">No items added</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="invoice-paper-totals">
        <p><span>Subtotal</span><strong>{formatProductPrice(totals.subtotal)}</strong></p>
        {totals.discountRate > 0 && <p><span>Discount ({totals.discountRate}%)</span><strong>−{formatProductPrice(totals.discountAmount)}</strong></p>}
        {totals.taxRate > 0 && <p><span>Tax ({totals.taxRate}%)</span><strong>{formatProductPrice(totals.taxAmount)}</strong></p>}
        {totals.deliveryChargeEnabled && (
          <>
            <p><span>Delivery charge</span><strong>{formatProductPrice(totals.deliveryCharge)}</strong></p>
            {totals.freeDelivery && <p><span>Free delivery</span><strong>−{formatProductPrice(totals.deliveryCharge)}</strong></p>}
          </>
        )}
        <p className="invoice-paper-grand-total"><span>Total</span><strong>{formatProductPrice(totals.total)}</strong></p>
      </div>
      {invoice.notes && <section className="invoice-paper-notes"><h3>Notes</h3><p>{invoice.notes}</p></section>}
      {reviewInvitation?.enabled && reviewInvitationUrl && (
        <section className="invoice-paper-review-invitation" aria-label="Review invitation">
          <span>{reviewInvitation.heading} </span>
          <a href={reviewInvitationUrl}>{reviewInvitation.linkText}</a>
        </section>
      )}
    </article>
  );
}
