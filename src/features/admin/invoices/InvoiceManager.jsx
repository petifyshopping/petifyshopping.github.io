import { useEffect, useMemo, useRef, useState } from "react";
import { formatProductPrice, parseProductPrice, productOptions } from "../../../lib/productPricing.js";
import { createInvoiceImage } from "../../../lib/invoiceImage.js";
import { uploadProductImages } from "../../../services/admin.js";
import { getInvoices, saveInvoice } from "../../../services/invoices.js";
import AdminNotice from "../components/AdminNotice.jsx";
import ImageUploadField from "../components/ImageUploadField.jsx";
import "./invoiceManager.css";

const headerFields = [
  ["businessName", "Business name"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["address", "Address"],
];

function localDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function createInvoiceNumber() {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `INV-${localDate().replace(/-/g, "")}-${suffix}`;
}

function newInvoice(storefrontBrand) {
  return {
    id: null,
    invoiceNumber: createInvoiceNumber(),
    businessDetails: {
      values: {
        businessName: storefrontBrand?.brandTitle || "Pëtify",
        phone: storefrontBrand?.phone || "",
        email: storefrontBrand?.email || "",
        address: storefrontBrand?.address || "",
        logoUrl: storefrontBrand?.logoUrl || "",
      },
      visible: { businessName: true, phone: false, email: false, address: false, logo: Boolean(storefrontBrand?.logoUrl) },
    },
    customerDetails: { name: "", companyName: "", phone: "", email: "", gstin: "", place: "", address: "" },
    items: [],
    issueDate: localDate(),
    dueDate: "",
    notes: "",
    taxRate: 0,
  };
}

function editableInvoice(invoice) {
  return {
    ...invoice,
    businessDetails: {
      values: {
        ...Object.fromEntries(headerFields.map(([key]) => [key, invoice.businessDetails?.values?.[key] ?? ""])),
        logoUrl: invoice.businessDetails?.values?.logoUrl ?? "",
      },
      visible: {
        ...Object.fromEntries(headerFields.map(([key]) => [key, invoice.businessDetails?.visible?.[key] === true])),
        logo: invoice.businessDetails?.visible?.logo === true,
      },
    },
    customerDetails: {
      name: invoice.customerDetails?.name ?? "",
      companyName: invoice.customerDetails?.companyName ?? "",
      phone: invoice.customerDetails?.phone ?? "",
      email: invoice.customerDetails?.email ?? "",
      gstin: invoice.customerDetails?.gstin ?? "",
      place: invoice.customerDetails?.place ?? "",
      address: invoice.customerDetails?.address ?? "",
    },
    items: (invoice.items ?? []).map((item) => ({
      ...item,
      productId: item.productId ?? "",
      variantIndex: Number(item.variantIndex ?? 0),
      quantity: Number(item.quantity ?? 1),
      unitPrice: Number(item.unitPrice ?? 0),
    })),
    taxRate: Number(invoice.taxRate ?? 0),
  };
}

function lineTotal(item) {
  return Math.round(Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0) * 100) / 100;
}

function InvoicePreview({ invoice, totals, storefrontBrand }) {
  const { values, visible } = invoice.businessDetails;
  return (
    <article className="invoice-paper" aria-label="Invoice print preview">
      <header className="invoice-paper-header">
        <div className="invoice-paper-business">
          {visible.logo && values.logoUrl && (
            <img className={`invoice-paper-logo${values.logoUrl === storefrontBrand?.logoUrl ? " is-store-logo" : ""}`} src={values.logoUrl} alt="" />
          )}
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
      <section className="invoice-paper-customer">
        <h3>Bill to</h3>
        <p>{invoice.customerDetails.name || "Customer name"}</p>
        {invoice.customerDetails.companyName && <p>{invoice.customerDetails.companyName}</p>}
        {invoice.customerDetails.phone && <p>{invoice.customerDetails.phone}</p>}
        {invoice.customerDetails.email && <p>{invoice.customerDetails.email}</p>}
        {invoice.customerDetails.gstin && <p>GSTIN / tax ID: {invoice.customerDetails.gstin}</p>}
        {invoice.customerDetails.place && <p>{invoice.customerDetails.place}</p>}
        {invoice.customerDetails.address && <p>{invoice.customerDetails.address}</p>}
      </section>
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
        {totals.taxRate > 0 && <p><span>Tax ({totals.taxRate}%)</span><strong>{formatProductPrice(totals.taxAmount)}</strong></p>}
        <p className="invoice-paper-grand-total"><span>Total</span><strong>{formatProductPrice(totals.total)}</strong></p>
      </div>
      {invoice.notes && <section className="invoice-paper-notes"><h3>Notes</h3><p>{invoice.notes}</p></section>}
    </article>
  );
}

export default function InvoiceManager({ products, storefrontBrand }) {
  const invoiceFormRef = useRef(null);
  const [invoices, setInvoices] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [invoiceMode, setInvoiceMode] = useState("edit");
  const [livePreviewEnabled, setLivePreviewEnabled] = useState(false);
  const [invoiceSettingsOpen, setInvoiceSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!invoice || !window.matchMedia("(max-width: 760px)").matches) return undefined;
    const frame = window.requestAnimationFrame(() => {
      invoiceFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [invoice]);

  useEffect(() => {
    let active = true;
    getInvoices()
      .then((records) => { if (active) setInvoices(records); })
      .catch((loadError) => { if (active) setError(loadError.message || "Invoices could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const totals = useMemo(() => {
    const subtotal = Math.round((invoice?.items ?? []).reduce((total, item) => total + lineTotal(item), 0) * 100) / 100;
    const taxRate = Math.max(0, Number(invoice?.taxRate) || 0);
    const taxAmount = Math.round(subtotal * taxRate) / 100;
    return { subtotal, taxRate, taxAmount, total: Math.round((subtotal + taxAmount) * 100) / 100 };
  }, [invoice]);

  function updateInvoice(field, value) {
    setInvoice((current) => ({ ...current, [field]: value }));
  }

  function addItem() {
    updateInvoice("items", [...invoice.items, { productId: "", variantIndex: 0, description: "", quantity: 1, unitPrice: 0 }]);
  }

  function updateItem(index, updates) {
    updateInvoice("items", invoice.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...updates } : item));
  }

  function chooseProduct(index, productId) {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) {
      updateItem(index, { productId: "", description: "", unitPrice: 0 });
      return;
    }
    const option = productOptions(product)[0];
    updateItem(index, {
      productId: product.id,
      variantIndex: 0,
      description: [product.title, option?.label].filter(Boolean).join(" — "),
      unitPrice: option?.price ?? parseProductPrice(product.price),
    });
  }

  function chooseVariant(index, product, variantIndex) {
    const option = productOptions(product)[Number(variantIndex)];
    if (!option) return;
    updateItem(index, {
      variantIndex: Number(variantIndex),
      description: [product.title, option.label].filter(Boolean).join(" — "),
      unitPrice: option.price,
    });
  }

  async function handleInvoiceLogoSelected(files) {
    const file = files[0];
    if (!file) return;
    setUploadingLogo(true);
    setError("");
    try {
      const [logoUrl] = await uploadProductImages("invoice-logos", [file], undefined, {
        compress: true,
        maxSizeBytes: 5 * 1024 * 1024,
        maxDimension: 1400,
      });
      setInvoice((current) => ({
        ...current,
        businessDetails: {
          ...current.businessDetails,
          values: { ...current.businessDetails.values, logoUrl },
          visible: { ...current.businessDetails.visible, logo: true },
        },
      }));
      setNotice("Invoice logo uploaded. Save the invoice to keep this choice.");
    } catch (uploadError) {
      setError(uploadError.message || "The invoice logo could not be uploaded.");
    } finally {
      setUploadingLogo(false);
    }
  }

  function downloadImage(file) {
    const imageUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
  }

  async function shareInvoiceAsImage() {
    setSharing(true);
    setError("");
    setNotice("");
    try {
      const blob = await createInvoiceImage(invoice, totals, { defaultLogoUrl: storefrontBrand?.logoUrl });
      const safeNumber = invoice.invoiceNumber.replace(/[^a-z0-9_-]/gi, "-") || "invoice";
      const file = new File([blob], `${safeNumber}.png`, { type: "image/png" });
      const shareData = { files: [file], title: `Invoice ${invoice.invoiceNumber}`, text: `Invoice ${invoice.invoiceNumber}` };
      if (typeof navigator.share === "function" && (
        typeof navigator.canShare !== "function" || navigator.canShare(shareData)
      )) {
        try {
          await navigator.share(shareData);
          setNotice("Invoice image shared.");
          return;
        } catch (shareError) {
          if (shareError.name === "AbortError") return;
        }
      }
      downloadImage(file);
      setNotice("The native share sheet was unavailable, so the invoice image was downloaded.");
    } catch (shareError) {
      setError(shareError.message || "The invoice image could not be shared.");
    } finally {
      setSharing(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!invoice.customerDetails.name.trim()) {
      setError("Enter the customer name before saving the invoice.");
      return;
    }
    if (!invoice.items.length || invoice.items.some((item) => !item.description.trim() || !(Number(item.quantity) > 0) || !(Number(item.unitPrice) >= 0))) {
      setError("Add at least one item and check each item name, quantity, and price.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await saveInvoice({
        ...invoice,
        subtotal: totals.subtotal,
        taxRate: totals.taxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
      });
      setInvoices((current) => [saved, ...current.filter((record) => record.id !== saved.id)]);
      setInvoice(editableInvoice(saved));
      setNotice("Invoice saved.");
    } catch (saveError) {
      setError(saveError.message || "Invoice could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function startNewInvoice() {
    setInvoice(newInvoice(storefrontBrand));
    setInvoiceMode("edit");
    setInvoiceSettingsOpen(false);
    setError("");
    setNotice("");
  }

  if (loading) return <p className="admin-muted">Loading invoices...</p>;

  return (
    <section className={`invoice-manager${invoice ? " is-editing-invoice" : ""}`}>
      <div className="admin-page-heading invoice-page-heading">
        <div><p className="admin-eyebrow">BILLING</p><h1>Invoices</h1><p className="admin-muted">Create, save, and print customer invoices.</p></div>
        <button className="admin-primary-button" type="button" onClick={startNewInvoice}>Create invoice</button>
      </div>
      {error && <AdminNotice kind="error">{error}</AdminNotice>}
      {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
      {!invoice ? (
        <div className="invoice-list">
          {!invoices.length ? <div className="invoice-empty">No invoices yet. Create an invoice to get started.</div> : invoices.map((record) => (
            <button className="invoice-list-row" key={record.id} type="button" onClick={() => { setInvoice(editableInvoice(record)); setInvoiceMode("view"); setError(""); setNotice(""); }}>
              <span><strong>{record.invoiceNumber}</strong><small>{record.customerDetails?.name || "Customer"} · {record.issueDate}</small></span>
              <strong>{formatProductPrice(record.total)}</strong>
            </button>
          ))}
        </div>
      ) : (
        <form ref={invoiceFormRef} className={`invoice-layout${invoiceMode === "edit" ? " is-editing" : ""}${livePreviewEnabled ? " has-live-preview" : ""}`} onSubmit={handleSave}>
          <div className="invoice-editor-toolbar">
            <button type="button" className="admin-secondary-button" onClick={() => { setInvoice(null); setError(""); setNotice(""); }}>← All invoices</button>
            <div className="invoice-mode-switch" role="group" aria-label="Invoice mode">
              <button type="button" className={`admin-secondary-button${invoiceMode === "edit" ? " active" : ""}`} aria-pressed={invoiceMode === "edit"} onClick={() => setInvoiceMode("edit")}>Edit</button>
              <button type="button" className={`admin-secondary-button${invoiceMode === "view" ? " active" : ""}`} aria-pressed={invoiceMode === "view"} onClick={() => {
                setInvoiceMode("view");
                setInvoiceSettingsOpen(false);
              }}>View invoice</button>
              {invoiceMode === "edit" && (
                <button
                  type="button"
                  className={`admin-secondary-button${livePreviewEnabled ? " active" : ""}`}
                  aria-pressed={livePreviewEnabled}
                  onClick={() => setLivePreviewEnabled((enabled) => !enabled)}
                >
                  {livePreviewEnabled ? "Hide live preview" : "Show live preview"}
                </button>
              )}
            </div>
            <div className="invoice-editor-actions">
              <button
                type="button"
                className={`admin-secondary-button${invoiceSettingsOpen ? " active" : ""}`}
                aria-expanded={invoiceSettingsOpen}
                aria-controls="invoice-settings-panel"
                onClick={() => {
                  setInvoiceMode("edit");
                  setInvoiceSettingsOpen((open) => !open);
                }}
              >
                Invoice settings
              </button>
              <button type="button" className="admin-secondary-button" onClick={() => window.print()}>Print / Save PDF</button>
              <button type="button" className="admin-secondary-button" onClick={() => void shareInvoiceAsImage()} disabled={sharing}>{sharing ? "Preparing image..." : "Share image"}</button>
              {invoiceMode === "edit" && <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : invoice.id ? "Save changes" : "Save invoice"}</button>}
            </div>
          </div>
          {invoiceMode === "edit" ? (
            <div className="invoice-editor">
            <section className="invoice-editor-section">
              <h2>Invoice details</h2>
              <div className="invoice-form-grid">
                <label>Invoice number<input required value={invoice.invoiceNumber} onChange={(event) => updateInvoice("invoiceNumber", event.target.value)} /></label>
                <label>Invoice date<input type="date" required value={invoice.issueDate} onChange={(event) => updateInvoice("issueDate", event.target.value)} /></label>
                <label>Due date<input type="date" value={invoice.dueDate} onChange={(event) => updateInvoice("dueDate", event.target.value)} /></label>
              </div>
            </section>
            {invoiceSettingsOpen && <section className="invoice-editor-section" id="invoice-settings-panel">
              <h2>Invoice header</h2>
              <p className="invoice-section-hint">Choose which business details appear at the top-left of the printed invoice.</p>
              <div className="invoice-logo-controls">
                {invoice.businessDetails.values.logoUrl && (
                  <img className={`invoice-logo-thumbnail${invoice.businessDetails.values.logoUrl === storefrontBrand?.logoUrl ? " is-store-logo" : ""}`} src={invoice.businessDetails.values.logoUrl} alt="Current invoice logo" />
                )}
                <div className="invoice-logo-actions">
                  <ImageUploadField
                    label={uploadingLogo ? "Uploading invoice logo..." : "Upload a different invoice logo"}
                    accept="image/jpeg,image/png,image/webp"
                    maxSizeBytes={5 * 1024 * 1024}
                    disabled={uploadingLogo}
                    hint="JPEG, PNG, or WebP. This logo is used on this invoice only."
                    onChange={(files) => void handleInvoiceLogoSelected(files)}
                  />
                  {storefrontBrand?.logoUrl && invoice.businessDetails.values.logoUrl !== storefrontBrand.logoUrl && (
                    <button className="admin-secondary-button" type="button" disabled={uploadingLogo} onClick={() => updateInvoice("businessDetails", {
                      ...invoice.businessDetails,
                      values: { ...invoice.businessDetails.values, logoUrl: storefrontBrand.logoUrl },
                      visible: { ...invoice.businessDetails.visible, logo: true },
                    })}>Use store logo</button>
                  )}
                  {invoice.businessDetails.values.logoUrl && (
                    <button className="invoice-remove-item" type="button" disabled={uploadingLogo} onClick={() => updateInvoice("businessDetails", {
                      ...invoice.businessDetails,
                      values: { ...invoice.businessDetails.values, logoUrl: "" },
                      visible: { ...invoice.businessDetails.visible, logo: false },
                    })}>Remove logo</button>
                  )}
                </div>
              </div>
              <div className="invoice-header-fields">
                {invoice.businessDetails.values.logoUrl && (
                  <label className="invoice-checkbox invoice-logo-checkbox"><input type="checkbox" checked={invoice.businessDetails.visible.logo} onChange={(event) => updateInvoice("businessDetails", {
                    ...invoice.businessDetails,
                    visible: { ...invoice.businessDetails.visible, logo: event.target.checked },
                  })} /><span>Show store logo</span></label>
                )}
                {headerFields.map(([key, label]) => (
                  <div className="invoice-header-field" key={key}>
                    <label className="invoice-checkbox"><input type="checkbox" checked={invoice.businessDetails.visible[key]} onChange={(event) => updateInvoice("businessDetails", {
                      ...invoice.businessDetails,
                      visible: { ...invoice.businessDetails.visible, [key]: event.target.checked },
                    })} /><span>Show {label.toLowerCase()}</span></label>
                    <input aria-label={label} placeholder={label} value={invoice.businessDetails.values[key]} onChange={(event) => updateInvoice("businessDetails", {
                      ...invoice.businessDetails,
                      values: { ...invoice.businessDetails.values, [key]: event.target.value },
                    })} />
                  </div>
                ))}
              </div>
            </section>}
            <section className="invoice-editor-section">
              <h2>Customer</h2>
              <div className="invoice-form-grid">
                <label>Name<input required value={invoice.customerDetails.name} onChange={(event) => updateInvoice("customerDetails", { ...invoice.customerDetails, name: event.target.value })} /></label>
                <label>Company / business<input value={invoice.customerDetails.companyName} onChange={(event) => updateInvoice("customerDetails", { ...invoice.customerDetails, companyName: event.target.value })} /></label>
                <label>Phone<input type="tel" value={invoice.customerDetails.phone} onChange={(event) => updateInvoice("customerDetails", { ...invoice.customerDetails, phone: event.target.value })} /></label>
                <label>Email<input type="email" value={invoice.customerDetails.email} onChange={(event) => updateInvoice("customerDetails", { ...invoice.customerDetails, email: event.target.value })} /></label>
                <label>GSTIN / tax ID<input value={invoice.customerDetails.gstin} onChange={(event) => updateInvoice("customerDetails", { ...invoice.customerDetails, gstin: event.target.value })} /></label>
                <label>Place / city<input value={invoice.customerDetails.place} onChange={(event) => updateInvoice("customerDetails", { ...invoice.customerDetails, place: event.target.value })} /></label>
                <label className="invoice-wide-field">Address<textarea rows="2" value={invoice.customerDetails.address} onChange={(event) => updateInvoice("customerDetails", { ...invoice.customerDetails, address: event.target.value })} /></label>
              </div>
            </section>
            <section className="invoice-editor-section">
              <div className="invoice-section-title"><h2>Items</h2></div>
              {!invoice.items.length && (
                <div className="invoice-empty-item">
                  <p className="invoice-section-hint">Add a product from your catalog or create a custom invoice item.</p>
                  <button className="admin-secondary-button" type="button" onClick={addItem}>Add item</button>
                </div>
              )}
              {invoice.items.map((item, index) => (
                <div className="invoice-item-row" key={`${item.productId || "custom"}-${index}`}>
                  <label>Product from catalog<select value={item.productId} onChange={(event) => chooseProduct(index, event.target.value)}>
                    <option value="">Custom item / choose product</option>
                    {products.map((product) => <option value={product.id} key={product.id}>{product.title}{product.isActive ? "" : " (inactive)"}</option>)}
                  </select></label>
                  {(() => {
                    const selectedProduct = products.find((product) => product.id === item.productId);
                    const options = selectedProduct ? productOptions(selectedProduct) : [];
                    return options.length > 1 ? (
                      <label>Product option<select value={item.variantIndex ?? 0} onChange={(event) => chooseVariant(index, selectedProduct, event.target.value)}>
                        {options.map((option, optionIndex) => <option value={optionIndex} key={option.id || optionIndex}>{option.label || `Option ${optionIndex + 1}`} · {formatProductPrice(option.price)}</option>)}
                      </select></label>
                    ) : null;
                  })()}
                  <label>Item name<input required value={item.description} onChange={(event) => updateItem(index, { description: event.target.value, productId: "" })} /></label>
                  <div className="invoice-item-numbers">
                    <label>Qty<input type="number" min="0.01" step="any" required value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} /></label>
                    <label>Unit price<input type="number" min="0" step="0.01" required value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: event.target.value })} /></label>
                    <strong>{formatProductPrice(lineTotal(item))}</strong>
                  </div>
                  <button className="invoice-remove-item" type="button" aria-label={`Remove ${item.description || "item"}`} onClick={() => updateInvoice("items", invoice.items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                  <button className="invoice-add-item-below admin-secondary-button" type="button" onClick={() => {
                    updateInvoice("items", [
                      ...invoice.items.slice(0, index + 1),
                      { productId: "", variantIndex: 0, description: "", quantity: 1, unitPrice: 0 },
                      ...invoice.items.slice(index + 1),
                    ]);
                  }}>{item.productId ? "Add item below this product" : "Add another item"}</button>
                </div>
              ))}
              <div className="invoice-tax-row">
                <label>Tax rate (%)<input type="number" min="0" step="0.01" value={invoice.taxRate} onChange={(event) => updateInvoice("taxRate", event.target.value)} /></label>
                <p><span>Subtotal</span><strong>{formatProductPrice(totals.subtotal)}</strong></p>
                <p><span>Total</span><strong>{formatProductPrice(totals.total)}</strong></p>
              </div>
            </section>
            <section className="invoice-editor-section">
              <label className="invoice-notes-field">Notes<textarea rows="3" placeholder="Payment terms or a note for the customer" value={invoice.notes} onChange={(event) => updateInvoice("notes", event.target.value)} /></label>
            </section>
            </div>
          ) : null}
          <div className={`invoice-preview-wrap${invoiceMode === "edit" && !livePreviewEnabled ? " is-preview-disabled" : ""}`}>
            <InvoicePreview invoice={invoice} totals={totals} storefrontBrand={storefrontBrand} />
          </div>
        </form>
      )}
    </section>
  );
}
