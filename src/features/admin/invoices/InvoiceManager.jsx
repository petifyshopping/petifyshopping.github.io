import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatProductPrice, parseProductPrice, productOptions } from "../../../lib/productPricing.js";
import { createInvoiceImage } from "../../../lib/invoiceImage.js";
import { uploadProductImages } from "../../../services/admin.js";
import { getAdminCustomerPage } from "../../../services/customers.js";
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
      logoBlueBackground: false,
      visible: { businessName: true, phone: false, email: false, address: false, logo: Boolean(storefrontBrand?.logoUrl) },
    },
    customerDetails: {
      enabled: false,
      source: "manual",
      savedCustomer: { profileId: "", name: "", phone: "", address: "" },
      manualCustomer: { name: "", phone: "", address: "" },
      deliveryPartner: "",
    },
    items: [],
    issueDate: localDate(),
    dueDate: "",
    notes: "",
    taxRate: 0,
  };
}

function editableInvoice(invoice) {
  const customerDetails = invoice.customerDetails ?? {};
  const hasSeparateCustomerData = customerDetails.savedCustomer || customerDetails.manualCustomer;
  const legacyCustomer = hasSeparateCustomerData
    ? {}
    : {
      name: customerDetails.name ?? "",
      phone: customerDetails.phone ?? "",
      address: customerDetails.address ?? "",
    };
  const savedCustomer = customerDetails.savedCustomer ?? { profileId: "", name: "", phone: "", address: "" };
  const manualCustomer = customerDetails.manualCustomer ?? legacyCustomer;
  return {
    ...invoice,
    businessDetails: {
      logoBlueBackground: invoice.businessDetails?.logoBlueBackground === true,
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
      enabled: customerDetails.enabled === true
        || Boolean(
          customerDetails.name
          || customerDetails.phone
          || customerDetails.address
          || customerDetails.deliveryPartner
          || customerDetails.companyName
          || customerDetails.email
          || customerDetails.gstin
          || customerDetails.place
          || savedCustomer.profileId
          || manualCustomer.name
          || manualCustomer.phone
          || manualCustomer.address
        ),
      source: customerDetails.source === "saved" && savedCustomer.profileId ? "saved" : "manual",
      savedCustomer: {
        profileId: savedCustomer.profileId ?? "",
        name: savedCustomer.name ?? "",
        phone: savedCustomer.phone ?? "",
        address: savedCustomer.address ?? "",
      },
      manualCustomer: {
        name: manualCustomer.name ?? "",
        phone: manualCustomer.phone ?? "",
        address: manualCustomer.address ?? "",
      },
      deliveryPartner: customerDetails.deliveryPartner ?? "",
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

function selectedCustomerDetails(customerDetails) {
  return customerDetails.source === "saved"
    ? customerDetails.savedCustomer ?? {}
    : customerDetails.manualCustomer ?? customerDetails;
}

function invoiceCustomerName(customerDetails) {
  return selectedCustomerDetails(customerDetails ?? {}).name || "No customer details";
}

function lineTotal(item) {
  return Math.round(Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0) * 100) / 100;
}

function InvoicePreview({ invoice, totals }) {
  const { values, visible } = invoice.businessDetails;
  const customer = selectedCustomerDetails(invoice.customerDetails);
  return (
    <article className="invoice-paper" aria-label="Invoice print preview">
      <header className="invoice-paper-header">
        <div className="invoice-paper-business">
          {visible.logo && values.logoUrl && (
            <img className={`invoice-paper-logo${invoice.businessDetails.logoBlueBackground ? " has-blue-background" : ""}`} src={values.logoUrl} alt="" />
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
        {totals.taxRate > 0 && <p><span>Tax ({totals.taxRate}%)</span><strong>{formatProductPrice(totals.taxAmount)}</strong></p>}
        <p className="invoice-paper-grand-total"><span>Total</span><strong>{formatProductPrice(totals.total)}</strong></p>
      </div>
      {invoice.notes && <section className="invoice-paper-notes"><h3>Notes</h3><p>{invoice.notes}</p></section>}
    </article>
  );
}

function InvoiceSettingsDialog({
  open,
  businessDetails,
  storefrontBrand,
  uploadingLogo,
  onChange,
  onLogoSelected,
  onClose,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return undefined;
  }, [open]);

  if (!open) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="invoice-settings-dialog"
      aria-labelledby="invoice-settings-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header className="invoice-settings-dialog-header">
        <div>
          <p className="admin-eyebrow">INVOICE OPTIONS</p>
          <h2 id="invoice-settings-title">Invoice settings</h2>
        </div>
        <button className="admin-secondary-button" type="button" aria-label="Close invoice settings" onClick={onClose}>×</button>
      </header>
      <p className="invoice-section-hint">Choose which business details appear at the top-left of the invoice.</p>
      <div className="invoice-logo-controls">
        {businessDetails.values.logoUrl && (
          <img
            className={`invoice-logo-thumbnail${businessDetails.logoBlueBackground ? " has-blue-background" : ""}`}
            src={businessDetails.values.logoUrl}
            alt="Current invoice logo"
          />
        )}
        <div className="invoice-logo-actions">
          <ImageUploadField
            label={uploadingLogo ? "Uploading invoice logo..." : "Upload a different invoice logo"}
            accept="image/jpeg,image/png,image/webp"
            maxSizeBytes={5 * 1024 * 1024}
            disabled={uploadingLogo}
            hint="JPEG, PNG, or WebP. This logo is used on this invoice only."
            onChange={onLogoSelected}
          />
          {storefrontBrand?.logoUrl && businessDetails.values.logoUrl !== storefrontBrand.logoUrl && (
            <button className="admin-secondary-button" type="button" disabled={uploadingLogo} onClick={() => onChange({
              ...businessDetails,
              values: { ...businessDetails.values, logoUrl: storefrontBrand.logoUrl },
              visible: { ...businessDetails.visible, logo: true },
            })}>Use store logo</button>
          )}
          {businessDetails.values.logoUrl && (
            <button className="invoice-remove-item" type="button" disabled={uploadingLogo} onClick={() => onChange({
              ...businessDetails,
              values: { ...businessDetails.values, logoUrl: "" },
              visible: { ...businessDetails.visible, logo: false },
            })}>Remove logo</button>
          )}
        </div>
      </div>
      <div className="invoice-header-fields">
        {businessDetails.values.logoUrl && (
          <label className="invoice-checkbox invoice-logo-checkbox">
            <input
              type="checkbox"
              checked={businessDetails.visible.logo}
              onChange={(event) => onChange({
                ...businessDetails,
                visible: { ...businessDetails.visible, logo: event.target.checked },
              })}
            />
            <span>Show logo</span>
          </label>
        )}
        {businessDetails.values.logoUrl && (
          <label className="invoice-checkbox invoice-logo-background-checkbox">
            <input
              type="checkbox"
              checked={businessDetails.logoBlueBackground}
              onChange={(event) => onChange({
                ...businessDetails,
                logoBlueBackground: event.target.checked,
              })}
            />
            <span>Add blue background behind logo</span>
          </label>
        )}
        {headerFields.map(([key, label]) => (
          <div className="invoice-header-field" key={key}>
            <label className="invoice-checkbox">
              <input
                type="checkbox"
                checked={businessDetails.visible[key]}
                onChange={(event) => onChange({
                  ...businessDetails,
                  visible: { ...businessDetails.visible, [key]: event.target.checked },
                })}
              />
              <span>Show {label.toLowerCase()}</span>
            </label>
            <input
              aria-label={label}
              placeholder={label}
              value={businessDetails.values[key]}
              onChange={(event) => onChange({
                ...businessDetails,
                values: { ...businessDetails.values, [key]: event.target.value },
              })}
            />
          </div>
        ))}
      </div>
      <footer className="invoice-settings-dialog-footer">
        <p>Changes are saved with this invoice when you select Save invoice.</p>
        <button className="admin-primary-button" type="button" onClick={onClose}>Done</button>
      </footer>
    </dialog>,
    document.body,
  );
}

export default function InvoiceManager({ products, storefrontBrand }) {
  const [invoices, setInvoices] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [invoiceMode, setInvoiceMode] = useState("edit");
  const [livePreviewEnabled, setLivePreviewEnabled] = useState(false);
  const [invoiceSettingsOpen, setInvoiceSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPickerError, setCustomerPickerError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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

  async function loadCustomers(append = false) {
    if (customersLoading) return;
    setCustomersLoading(true);
    setCustomerPickerError("");
    try {
      const page = await getAdminCustomerPage(append ? customers.length : 0, 30);
      setCustomers((current) => append ? [...current, ...page.rows] : page.rows);
      setCustomerTotal(page.total);
      setCustomersLoaded(true);
    } catch (loadError) {
      setCustomerPickerError(loadError.message || "Customer records could not be loaded.");
    } finally {
      setCustomersLoading(false);
    }
  }

  const matchingCustomers = customers.filter((customer) => (
    [customer.full_name, customer.email, customer.phone, customer.address]
      .some((value) => String(value ?? "").toLocaleLowerCase().includes(customerSearch.trim().toLocaleLowerCase()))
  ));

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
      const blob = await createInvoiceImage(invoice, totals);
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
              <span><strong>{record.invoiceNumber}</strong><small>{invoiceCustomerName(record.customerDetails)} · {record.issueDate}</small></span>
              <strong>{formatProductPrice(record.total)}</strong>
            </button>
          ))}
        </div>
      ) : (
        <form className={`invoice-layout${invoiceMode === "edit" ? " is-editing" : ""}${livePreviewEnabled ? " has-live-preview" : ""}`} onSubmit={handleSave}>
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
                aria-haspopup="dialog"
                aria-expanded={invoiceSettingsOpen}
                onClick={() => {
                  setInvoiceMode("edit");
                  setInvoiceSettingsOpen(true);
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
            <section className="invoice-editor-section">
              <label className="invoice-customer-toggle">
                <input
                  type="checkbox"
                  checked={invoice.customerDetails.enabled}
                  onChange={(event) => updateInvoice("customerDetails", event.target.checked
                    ? { ...invoice.customerDetails, enabled: true }
                    : {
                      enabled: false,
                      source: "manual",
                      savedCustomer: { profileId: "", name: "", phone: "", address: "" },
                      manualCustomer: { name: "", phone: "", address: "" },
                      deliveryPartner: "",
                    })}
                />
                <span><strong>Add customer details</strong><small>Add these details to the invoice if needed.</small></span>
              </label>
              {invoice.customerDetails.enabled && (
                <>
                  <label className="invoice-customer-source">
                    Customer source
                    <select
                      value={invoice.customerDetails.source}
                      onChange={(event) => {
                        const source = event.target.value;
                        updateInvoice("customerDetails", { ...invoice.customerDetails, source });
                        if (source === "saved" && !customersLoaded) void loadCustomers();
                      }}
                    >
                      <option value="manual">Enter invoice-only customer details</option>
                      <option value="saved">Choose from saved customers</option>
                    </select>
                  </label>
                  {invoice.customerDetails.source === "saved" ? (
                    <div className="invoice-customer-picker">
                      <label>
                        Saved customer
                        <select
                          value={invoice.customerDetails.savedCustomer.profileId}
                          onChange={(event) => {
                            const selected = customers.find((customer) => customer.user_id === event.target.value);
                            updateInvoice("customerDetails", {
                              ...invoice.customerDetails,
                              savedCustomer: selected
                                ? {
                                  profileId: selected.user_id,
                                  name: selected.full_name,
                                  phone: selected.phone,
                                  address: selected.address ?? "",
                                }
                                : { profileId: "", name: "", phone: "", address: "" },
                            });
                          }}
                        >
                          <option value="">Select a saved customer</option>
                          {invoice.customerDetails.savedCustomer.profileId
                            && !matchingCustomers.some((customer) => customer.user_id === invoice.customerDetails.savedCustomer.profileId)
                            && (
                              <option value={invoice.customerDetails.savedCustomer.profileId} key={invoice.customerDetails.savedCustomer.profileId}>
                                {invoice.customerDetails.savedCustomer.name}
                                {invoice.customerDetails.savedCustomer.phone && ` · ${invoice.customerDetails.savedCustomer.phone}`}
                              </option>
                            )}
                          {matchingCustomers.map((customer) => (
                            <option key={customer.user_id} value={customer.user_id}>
                              {[customer.full_name, customer.phone || customer.email].filter(Boolean).join(" · ")}
                            </option>
                          ))}
                        </select>
                      </label>
                      {customers.length > 0 && (
                        <label>
                          Find loaded customers
                          <input
                            type="search"
                            value={customerSearch}
                            onChange={(event) => setCustomerSearch(event.target.value)}
                            placeholder="Search name, phone, or email"
                          />
                        </label>
                      )}
                      {customerPickerError && <p className="invoice-customer-error" role="alert">{customerPickerError}</p>}
                      {customersLoading && <p className="invoice-customer-hint">Loading customers...</p>}
                      {!customersLoading && customersLoaded && !customers.length && (
                        <p className="invoice-customer-hint">No saved customers are available. You can enter invoice-only details instead.</p>
                      )}
                      {!customersLoading && customers.length > 0 && customers.length < customerTotal && (
                        <button className="admin-secondary-button" type="button" disabled={customersLoading} onClick={() => void loadCustomers(true)}>
                          {customersLoading ? "Loading customers..." : "Load more customers"}
                        </button>
                      )}
                      {invoice.customerDetails.savedCustomer.profileId && (
                        <p className="invoice-customer-hint">
                          Invoice snapshot: {invoice.customerDetails.savedCustomer.name}
                          {invoice.customerDetails.savedCustomer.phone && ` · ${invoice.customerDetails.savedCustomer.phone}`}
                          {invoice.customerDetails.savedCustomer.address && ` · ${invoice.customerDetails.savedCustomer.address}`}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="invoice-form-grid">
                      <label>Name<input value={invoice.customerDetails.manualCustomer.name} onChange={(event) => updateInvoice("customerDetails", {
                        ...invoice.customerDetails,
                        manualCustomer: { ...invoice.customerDetails.manualCustomer, name: event.target.value },
                      })} /></label>
                      <label>Phone<input type="tel" value={invoice.customerDetails.manualCustomer.phone} onChange={(event) => updateInvoice("customerDetails", {
                        ...invoice.customerDetails,
                        manualCustomer: { ...invoice.customerDetails.manualCustomer, phone: event.target.value },
                      })} /></label>
                      <label className="invoice-wide-field">Address<textarea rows="2" value={invoice.customerDetails.manualCustomer.address} onChange={(event) => updateInvoice("customerDetails", {
                        ...invoice.customerDetails,
                        manualCustomer: { ...invoice.customerDetails.manualCustomer, address: event.target.value },
                      })} /></label>
                    </div>
                  )}
                  <label className="invoice-customer-source">
                    Delivery partner
                    <input value={invoice.customerDetails.deliveryPartner} onChange={(event) => updateInvoice("customerDetails", {
                      ...invoice.customerDetails,
                      deliveryPartner: event.target.value,
                    })} />
                  </label>
                </>
              )}
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
            <InvoicePreview invoice={invoice} totals={totals} />
          </div>
        </form>
      )}
      {invoice && (
        <InvoiceSettingsDialog
          open={invoiceSettingsOpen}
          businessDetails={invoice.businessDetails}
          storefrontBrand={storefrontBrand}
          uploadingLogo={uploadingLogo}
          onChange={(businessDetails) => updateInvoice("businessDetails", businessDetails)}
          onLogoSelected={(files) => void handleInvoiceLogoSelected(files)}
          onClose={() => setInvoiceSettingsOpen(false)}
        />
      )}
    </section>
  );
}
