import { useState } from "react";
import { formatProductPrice } from "../../../lib/productPricing.js";
import AdminNotice from "../components/AdminNotice.jsx";
import ImageUploadField from "../components/ImageUploadField.jsx";

const headerFields = [
  ["businessName", "Business name"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["address", "Address"],
];

const tabs = [
  { id: "header", label: "Header" },
  { id: "products", label: "Custom products" },
  { id: "customers", label: "Invoice customers" },
  { id: "delivery", label: "Delivery partners" },
];

export default function InvoiceSettingsPanel({
  businessDetails,
  storefrontBrand,
  uploadingLogo,
  customProducts,
  customCustomers,
  deliveryPartners,
  onHeaderChange,
  onLogoSelected,
  onSaveHeader,
  onSaveProduct,
  onDeleteProduct,
  onSaveCustomer,
  onDeleteCustomer,
  onSaveDeliveryPartner,
  onDeleteDeliveryPartner,
  onBack,
}) {
  const [activeTab, setActiveTab] = useState("header");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "" });
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deliveryPartner, setDeliveryPartner] = useState({ name: "", deliveryCharge: "" });
  const [editingDeliveryPartner, setEditingDeliveryPartner] = useState(null);
  const [savingHeader, setSavingHeader] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [busyRecordId, setBusyRecordId] = useState("");
  const [error, setError] = useState("");
  const motto = businessDetails.values.tagline || storefrontBrand?.tagline || "";

  async function saveHeader() {
    setSavingHeader(true);
    setError("");
    try {
      await onSaveHeader(businessDetails);
      onBack();
    } catch (saveError) {
      setError(saveError.message || "Invoice header settings could not be saved.");
    } finally {
      setSavingHeader(false);
    }
  }

  async function addProduct(event) {
    event.preventDefault();
    setSavingRecord(true);
    setError("");
    try {
      await onSaveProduct({ name: productName, unitPrice: productPrice });
      setProductName("");
      setProductPrice("");
    } catch (saveError) {
      setError(saveError.message || "The custom product could not be saved.");
    } finally {
      setSavingRecord(false);
    }
  }

  async function updateProduct(event) {
    event.preventDefault();
    setSavingRecord(true);
    setError("");
    try {
      await onSaveProduct(editingProduct);
      setEditingProduct(null);
    } catch (saveError) {
      setError(saveError.message || "The custom product could not be updated.");
    } finally {
      setSavingRecord(false);
    }
  }

  async function addCustomer(event) {
    event.preventDefault();
    setSavingRecord(true);
    setError("");
    try {
      await onSaveCustomer(customer);
      setCustomer({ name: "", phone: "", address: "" });
    } catch (saveError) {
      setError(saveError.message || "The invoice customer could not be saved.");
    } finally {
      setSavingRecord(false);
    }
  }

  async function updateCustomer(event) {
    event.preventDefault();
    setSavingRecord(true);
    setError("");
    try {
      await onSaveCustomer(editingCustomer);
      setEditingCustomer(null);
    } catch (saveError) {
      setError(saveError.message || "The invoice customer could not be updated.");
    } finally {
      setSavingRecord(false);
    }

  }

  async function saveDeliveryPartner(event, record, reset) {
    event.preventDefault();
    setSavingRecord(true);
    setError("");
    try {
      await onSaveDeliveryPartner(record);
      if (reset) setDeliveryPartner({ name: "", deliveryCharge: "" });
      else setEditingDeliveryPartner(null);
    } catch (saveError) {
      setError(saveError.message || "The delivery partner could not be saved.");
    } finally {
      setSavingRecord(false);
    }
  }

  async function deleteRecord(id, remove) {
    setBusyRecordId(id);
    setError("");
    try {
      await remove(id);
    } catch (deleteError) {
      setError(deleteError.message || "The record could not be deleted.");
    } finally {
      setBusyRecordId("");
    }
  }

  return (
    <section className="invoice-settings-page">
      <header className="invoice-settings-page-heading">
        <div>
          <p className="admin-eyebrow">INVOICES</p>
          <h2>Invoice settings</h2>
        </div>
        <button className="admin-secondary-button" type="button" onClick={onBack}>Back to invoices</button>
      </header>
      <div className="invoice-settings-tabs" role="tablist" aria-label="Invoice settings">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`invoice-settings-tab-${tab.id}`}
            className={`admin-secondary-button${activeTab === tab.id ? " active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`invoice-settings-panel-${tab.id}`}
            onClick={() => {
              setActiveTab(tab.id);
              setError("");
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {error && <AdminNotice kind="error">{error}</AdminNotice>}
      {activeTab === "header" && (
        <section
          className="invoice-settings-content"
          id="invoice-settings-panel-header"
          role="tabpanel"
          aria-labelledby="invoice-settings-tab-header"
        >
          <h3>Header details</h3>
          <div className={`invoice-logo-controls${businessDetails.values.logoUrl ? " has-logo" : ""}`}>
            {businessDetails.values.logoUrl && (
              <img
                className={`invoice-logo-thumbnail${businessDetails.logoBlueBackground ? " has-blue-background" : ""}`}
                src={businessDetails.values.logoUrl}
                alt="Invoice logo"
              />
            )}
            <div className="invoice-logo-actions">
              <ImageUploadField
                label={uploadingLogo ? "Uploading..." : "Change logo"}
                accept="image/jpeg,image/png,image/webp"
                maxSizeBytes={5 * 1024 * 1024}
                disabled={uploadingLogo}
                onChange={onLogoSelected}
              />
              {storefrontBrand?.logoUrl && businessDetails.values.logoUrl !== storefrontBrand.logoUrl && (
                <button
                  className="admin-secondary-button"
                  type="button"
                  disabled={uploadingLogo}
                  onClick={() => onHeaderChange({
                    ...businessDetails,
                    values: { ...businessDetails.values, logoUrl: storefrontBrand.logoUrl },
                    visible: { ...businessDetails.visible, logo: true },
                  })}
                >
                  Use store logo
                </button>
              )}
              {businessDetails.values.logoUrl && (
                <button
                  className="invoice-remove-item"
                  type="button"
                  disabled={uploadingLogo}
                  onClick={() => onHeaderChange({
                    ...businessDetails,
                    values: { ...businessDetails.values, logoUrl: "" },
                    visible: { ...businessDetails.visible, logo: false },
                  })}
                >
                  Remove logo
                </button>
              )}
            </div>
          </div>
          <div className="invoice-header-fields">
            {businessDetails.values.logoUrl && (
              <>
                <label className="invoice-checkbox invoice-logo-checkbox">
                  <input
                    type="checkbox"
                    checked={businessDetails.visible.logo}
                    onChange={(event) => onHeaderChange({
                      ...businessDetails,
                      visible: { ...businessDetails.visible, logo: event.target.checked },
                    })}
                  />
                  <span>Show logo</span>
                </label>
                <label className="invoice-checkbox invoice-logo-background-checkbox">
                  <input
                    type="checkbox"
                    checked={businessDetails.logoBlueBackground}
                    onChange={(event) => onHeaderChange({
                      ...businessDetails,
                      logoBlueBackground: event.target.checked,
                    })}
                  />
                  <span>Blue logo background</span>
                </label>
              </>
            )}
            {motto && (
              <label className="invoice-checkbox invoice-tagline-checkbox">
                <input
                  type="checkbox"
                  checked={businessDetails.visible.tagline === true}
                  onChange={(event) => onHeaderChange({
                    ...businessDetails,
                    visible: { ...businessDetails.visible, tagline: event.target.checked },
                  })}
                />
                <span>Show motto on invoice</span>
              </label>
            )}
            {headerFields.map(([key, label]) => (
              <div className="invoice-header-field" key={key}>
                <label className="invoice-checkbox">
                  <input
                    type="checkbox"
                    checked={businessDetails.visible[key]}
                    onChange={(event) => onHeaderChange({
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
                  onChange={(event) => onHeaderChange({
                    ...businessDetails,
                    values: { ...businessDetails.values, [key]: event.target.value },
                  })}
                />
              </div>
            ))}
          </div>
          <div className="invoice-settings-done-row">
            <button className="admin-primary-button" type="button" disabled={savingHeader || uploadingLogo} onClick={() => void saveHeader()}>
              {savingHeader ? "Saving..." : "Done"}
            </button>
          </div>
        </section>
      )}
      {activeTab === "products" && (
        <section
          className="invoice-settings-content"
          id="invoice-settings-panel-products"
          role="tabpanel"
          aria-labelledby="invoice-settings-tab-products"
        >
          <h3>Custom invoice products</h3>
          <form className="invoice-settings-create-form" onSubmit={(event) => void addProduct(event)}>
            <label>Product name<input value={productName} onChange={(event) => setProductName(event.target.value)} required /></label>
            <label>Default price<input type="number" min="0" step="0.01" value={productPrice} onChange={(event) => setProductPrice(event.target.value)} required /></label>
            <button className="admin-primary-button" type="submit" disabled={savingRecord}>{savingRecord ? "Saving..." : "Add product"}</button>
          </form>
          <div className="invoice-settings-record-list">
            {!customProducts.length && <p className="invoice-customer-hint">No custom products saved yet.</p>}
            {customProducts.map((product) => (
              <div className="invoice-settings-record" key={product.id}>
                {editingProduct?.id === product.id ? (
                  <form className="invoice-settings-edit-form" onSubmit={(event) => void updateProduct(event)}>
                    <label>Product name<input value={editingProduct.name} onChange={(event) => setEditingProduct({ ...editingProduct, name: event.target.value })} required /></label>
                    <label>Default price<input type="number" min="0" step="0.01" value={editingProduct.unitPrice} onChange={(event) => setEditingProduct({ ...editingProduct, unitPrice: event.target.value })} required /></label>
                    <div className="invoice-settings-record-actions">
                      <button className="admin-primary-button" type="submit" disabled={savingRecord}>{savingRecord ? "Saving..." : "Save"}</button>
                      <button className="admin-secondary-button" type="button" disabled={savingRecord} onClick={() => setEditingProduct(null)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <span><strong>{product.name}</strong><small>{formatProductPrice(product.unitPrice)}</small></span>
                    <div className="invoice-settings-record-actions">
                      <button className="admin-secondary-button" type="button" disabled={Boolean(busyRecordId) || savingRecord} onClick={() => setEditingProduct({ ...product, unitPrice: String(product.unitPrice) })}>Edit</button>
                      <button className="admin-delete-button" type="button" disabled={Boolean(busyRecordId) || savingRecord} onClick={() => void deleteRecord(product.id, onDeleteProduct)}>
                        {busyRecordId === product.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {activeTab === "customers" && (
        <section
          className="invoice-settings-content"
          id="invoice-settings-panel-customers"
          role="tabpanel"
          aria-labelledby="invoice-settings-tab-customers"
        >
          <h3>Invoice-only customers</h3>
          <form className="invoice-settings-create-form" onSubmit={(event) => void addCustomer(event)}>
            <label>Name<input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></label>
            <label>Phone<input type="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label>
            <label className="invoice-settings-wide-field">Address<textarea rows="2" value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} /></label>
            <button className="admin-primary-button" type="submit" disabled={savingRecord}>{savingRecord ? "Saving..." : "Add customer"}</button>
          </form>
          <div className="invoice-settings-record-list">
            {!customCustomers.length && <p className="invoice-customer-hint">No invoice-only customers saved yet.</p>}
            {customCustomers.map((record) => (
              <div className="invoice-settings-record" key={record.id}>
                {editingCustomer?.id === record.id ? (
                  <form className="invoice-settings-edit-form" onSubmit={(event) => void updateCustomer(event)}>
                    <label>Name<input value={editingCustomer.name} onChange={(event) => setEditingCustomer({ ...editingCustomer, name: event.target.value })} /></label>
                    <label>Phone<input type="tel" value={editingCustomer.phone} onChange={(event) => setEditingCustomer({ ...editingCustomer, phone: event.target.value })} /></label>
                    <label className="invoice-settings-wide-field">Address<textarea rows="2" value={editingCustomer.address} onChange={(event) => setEditingCustomer({ ...editingCustomer, address: event.target.value })} /></label>
                    <div className="invoice-settings-record-actions">
                      <button className="admin-primary-button" type="submit" disabled={savingRecord}>{savingRecord ? "Saving..." : "Save"}</button>
                      <button className="admin-secondary-button" type="button" disabled={savingRecord} onClick={() => setEditingCustomer(null)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <span>
                      <strong>{record.name || record.phone || "Invoice customer"}</strong>
                      <small>{[record.phone, record.address].filter(Boolean).join(" · ")}</small>
                    </span>
                    <div className="invoice-settings-record-actions">
                      <button className="admin-secondary-button" type="button" disabled={Boolean(busyRecordId) || savingRecord} onClick={() => setEditingCustomer({ ...record })}>Edit</button>
                      <button className="admin-delete-button" type="button" disabled={Boolean(busyRecordId) || savingRecord} onClick={() => void deleteRecord(record.id, onDeleteCustomer)}>
                        {busyRecordId === record.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {activeTab === "delivery" && (
        <section
          className="invoice-settings-content"
          id="invoice-settings-panel-delivery"
          role="tabpanel"
          aria-labelledby="invoice-settings-tab-delivery"
        >
          <h3>Delivery partners</h3>
          <form className="invoice-settings-create-form" onSubmit={(event) => void saveDeliveryPartner(event, deliveryPartner, true)}>
            <label>Partner name<input value={deliveryPartner.name} onChange={(event) => setDeliveryPartner({ ...deliveryPartner, name: event.target.value })} required /></label>
            <label>Default delivery charge<input type="number" min="0" step="0.01" value={deliveryPartner.deliveryCharge} onChange={(event) => setDeliveryPartner({ ...deliveryPartner, deliveryCharge: event.target.value })} required /></label>
            <button className="admin-primary-button" type="submit" disabled={savingRecord}>{savingRecord ? "Saving..." : "Add partner"}</button>
          </form>
          <div className="invoice-settings-record-list">
            {!deliveryPartners.length && <p className="invoice-customer-hint">No delivery partners saved yet.</p>}
            {deliveryPartners.map((record) => (
              <div className="invoice-settings-record" key={record.id}>
                {editingDeliveryPartner?.id === record.id ? (
                  <form className="invoice-settings-edit-form" onSubmit={(event) => void saveDeliveryPartner(event, editingDeliveryPartner, false)}>
                    <label>Partner name<input value={editingDeliveryPartner.name} onChange={(event) => setEditingDeliveryPartner({ ...editingDeliveryPartner, name: event.target.value })} required /></label>
                    <label>Default delivery charge<input type="number" min="0" step="0.01" value={editingDeliveryPartner.deliveryCharge} onChange={(event) => setEditingDeliveryPartner({ ...editingDeliveryPartner, deliveryCharge: event.target.value })} required /></label>
                    <div className="invoice-settings-record-actions">
                      <button className="admin-primary-button" type="submit" disabled={savingRecord}>{savingRecord ? "Saving..." : "Save"}</button>
                      <button className="admin-secondary-button" type="button" disabled={savingRecord} onClick={() => setEditingDeliveryPartner(null)}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    <span><strong>{record.name}</strong><small>{formatProductPrice(record.deliveryCharge)}</small></span>
                    <div className="invoice-settings-record-actions">
                      <button className="admin-secondary-button" type="button" disabled={Boolean(busyRecordId) || savingRecord} onClick={() => setEditingDeliveryPartner({ ...record, deliveryCharge: String(record.deliveryCharge) })}>Edit</button>
                      <button className="admin-delete-button" type="button" disabled={Boolean(busyRecordId) || savingRecord} onClick={() => void deleteRecord(record.id, onDeleteDeliveryPartner)}>
                        {busyRecordId === record.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
