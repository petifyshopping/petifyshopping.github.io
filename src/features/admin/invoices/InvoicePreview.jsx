import { formatProductPrice } from "../../../lib/productPricing.js";

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

export default function InvoicePreview({ invoice, totals, storefrontTagline, lineTotal }) {
  const { values, visible } = invoice.businessDetails;
  const customer = selectedCustomerDetails(invoice.customerDetails);
  const tagline = values.tagline || storefrontTagline;

  return (
    <article className="invoice-paper" aria-label="Invoice print preview">
      <header className="invoice-paper-header">
        <div className="invoice-paper-business">
          {visible.logo && values.logoUrl && (
            <img className={`invoice-paper-logo${invoice.businessDetails.logoBlueBackground ? " has-blue-background" : ""}`} src={values.logoUrl} alt="" />
          )}
          {visible.tagline && tagline && <p className="invoice-paper-tagline">{tagline}</p>}
          {headerFields.map(([key]) => visible[key] && values[key] && (
            <p className={key === "businessName" ? "invoice-paper-business-name" : ""} key={key}>{values[key]}</p>
          ))}
        </div>
        <div className="invoice-paper-meta">
          <h2>INVOICE</h2>
          <p><strong>No.</strong> {invoice.invoiceNumber || "—"}</p>
          <p><strong>Date</strong> {invoice.issueDate || "—"}</p>
          {invoice.dueDate && <p><strong>Due</strong> {invoice.dueDate}</p>}
        </div>
      </header>
      {invoice.customerDetails.enabled && (
        <section className="invoice-paper-customer">
          <h3>Customer details</h3>
          {customer.name && <p>{customer.name}</p>}
          {customer.phone && <p>{customer.phone}</p>}
          {customer.address && <p>{customer.address}</p>}
          {invoice.customerDetails.deliveryPartner && <p>Delivery partner: {invoice.customerDetails.deliveryPartner}</p>}
        </section>
      )}
      <div className="invoice-paper-table-wrap">
        <table className="invoice-paper-table">
          <thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
          <tbody>
            {invoice.items.length ? invoice.items.map((item, index) => (
              <tr key={`${item.productId}-${index}`}>
                <td>{item.description || "Item"}</td>
                <td>{item.quantity}</td>
                <td>{formatProductPrice(item.unitPrice)}</td>
                <td>{formatProductPrice(lineTotal(item))}</td>
              </tr>
            )) : <tr><td colSpan="4">No items added</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="invoice-paper-totals">
        <p><span>Subtotal</span><strong>{formatProductPrice(totals.subtotal)}</strong></p>
        {totals.discountRate > 0 && <p><span>Discount ({totals.discountRate}%)</span><strong>−{formatProductPrice(totals.discountAmount)}</strong></p>}
        {totals.taxRate > 0 && <p><span>Tax ({totals.taxRate}%)</span><strong>{formatProductPrice(totals.taxAmount)}</strong></p>}
        <p className="invoice-paper-grand-total"><span>Total</span><strong>{formatProductPrice(totals.total)}</strong></p>
      </div>
      {invoice.notes && <section className="invoice-paper-notes"><h3>Notes</h3><p>{invoice.notes}</p></section>}
    </article>
  );
}
