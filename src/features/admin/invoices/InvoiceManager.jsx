import { useEffect, useMemo, useRef, useState } from "react";
import { formatProductPrice, parseProductPrice, productOptions } from "../../../lib/productPricing.js";
import { createInvoiceImage } from "../../../lib/invoiceImage.js";
import { uploadProductImages } from "../../../services/admin.js";
import { getAdminCustomerPage } from "../../../services/customers.js";
import useConfirmDialog from "../../../hooks/useConfirmDialog.js";
import {
  deleteInvoice,
  deleteInvoiceCustomCustomer,
  deleteInvoiceCustomProduct,
  deleteInvoiceDeliveryPartner,
  getInvoiceCustomCustomers,
  getInvoiceCustomProducts,
  getInvoiceDeliveryPartners,
  getInvoiceHeaderSettings,
  getInvoices,
  saveInvoiceCustomCustomer,
  saveInvoiceCustomProduct,
  saveInvoiceDeliveryPartner,
  saveInvoice,
  saveInvoiceHeaderSettings,
  updateInvoiceStatus,
} from "../../../services/invoices.js";
import AdminNotice from "../components/AdminNotice.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import InvoiceList from "./InvoiceList.jsx";
import InvoicePreview from "./InvoicePreview.jsx";
import { invoiceStatus } from "./invoiceStatus.js";
import InvoiceSettingsPanel from "./InvoiceSettingsPanel.jsx";
import "./invoiceManager.css";

const headerFields = [
  ["businessName", "Business name"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["address", "Address"],
];

function invoiceCustomerName(customerDetails) {
  if (!customerDetails?.enabled) return "";
  const customer = customerDetails.source === "saved"
    ? customerDetails.savedCustomer
    : customerDetails.source === "invoice"
      ? customerDetails.invoiceCustomer
      : customerDetails.manualCustomer;
  return customer?.name?.trim() || "";
}

function localDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function createInvoiceNumber() {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `INV-${localDate().replace(/-/g, "")}-${suffix}`;
}

function invoiceBusinessDetails(storefrontBrand, savedSettings) {
  const defaults = {
    values: {
      businessName: storefrontBrand?.brandTitle || "Petify",
      phone: storefrontBrand?.phone || "",
      email: storefrontBrand?.email || "",
      address: storefrontBrand?.address || "",
      logoUrl: storefrontBrand?.logoUrl || "",
      tagline: storefrontBrand?.tagline || "",
    },
    logoBlueBackground: false,
    visible: {
      businessName: true,
      phone: false,
      email: false,
      address: false,
      logo: Boolean(storefrontBrand?.logoUrl),
    },
  };
  return {
    logoBlueBackground: savedSettings?.logoBlueBackground === true,
    values: {
      ...defaults.values,
      ...savedSettings?.values,
      tagline: storefrontBrand?.tagline || savedSettings?.values?.tagline || "",
    },
    visible: {
      ...defaults.visible,
      tagline: Boolean(storefrontBrand?.tagline || savedSettings?.values?.tagline),
      ...savedSettings?.visible,
    },
  };
}

function newInvoice(storefrontBrand, headerDefaults) {
  return {
    id: null,
    invoiceNumber: createInvoiceNumber(),
    status: "draft",
    businessDetails: invoiceBusinessDetails(storefrontBrand, headerDefaults),
    customerDetails: {
      enabled: false,
      source: "manual",
      savedCustomer: { profileId: "", name: "", phone: "", address: "" },
      invoiceCustomer: { id: "", name: "", phone: "", address: "" },
      manualCustomer: { name: "", phone: "", address: "" },
      deliveryPartner: "",
      deliveryPartnerId: "",
    },
    items: [],
    issueDate: localDate(),
    dueDate: "",
    notes: "",
    discountRate: 0,
    taxRate: 0,
    deliveryChargeEnabled: false,
    deliveryCharge: 0,
    freeDelivery: false,
  };
}

function editableInvoice(invoice, storefrontTagline = "") {
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
  const invoiceCustomer = customerDetails.invoiceCustomer ?? { id: "", name: "", phone: "", address: "" };
  const manualCustomer = customerDetails.manualCustomer ?? legacyCustomer;
  return {
    ...invoice,
    status: ["draft", "sent", "paid"].includes(invoice.status) ? invoice.status : "draft",
    businessDetails: {
      logoBlueBackground: invoice.businessDetails?.logoBlueBackground === true,
      values: {
        ...Object.fromEntries(headerFields.map(([key]) => [key, invoice.businessDetails?.values?.[key] ?? ""])),
        logoUrl: invoice.businessDetails?.values?.logoUrl ?? "",
        tagline: invoice.businessDetails?.values?.tagline || storefrontTagline,
      },
      visible: {
        ...Object.fromEntries(headerFields.map(([key]) => [key, invoice.businessDetails?.visible?.[key] === true])),
        logo: invoice.businessDetails?.visible?.logo === true,
        tagline: invoice.businessDetails?.visible?.tagline
          ?? Boolean(invoice.businessDetails?.values?.tagline || storefrontTagline),
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
          || invoiceCustomer.id
          || manualCustomer.name
          || manualCustomer.phone
          || manualCustomer.address
        ),
      source: ["saved", "invoice"].includes(customerDetails.source) ? customerDetails.source : "manual",
      savedCustomer: {
        profileId: savedCustomer.profileId ?? "",
        name: savedCustomer.name ?? "",
        phone: savedCustomer.phone ?? "",
        address: savedCustomer.address ?? "",
      },
      invoiceCustomer: {
        id: invoiceCustomer.id ?? "",
        name: invoiceCustomer.name ?? "",
        phone: invoiceCustomer.phone ?? "",
        address: invoiceCustomer.address ?? "",
      },
      manualCustomer: {
        name: manualCustomer.name ?? "",
        phone: manualCustomer.phone ?? "",
        address: manualCustomer.address ?? "",
      },
      deliveryPartner: customerDetails.deliveryPartner ?? "",
      deliveryPartnerId: customerDetails.deliveryPartnerId ?? "",
    },
    items: (invoice.items ?? []).map((item) => ({
      ...item,
      productId: item.productId ?? "",
      invoiceCustomProductId: item.invoiceCustomProductId ?? "",
      variantIndex: Number(item.variantIndex ?? 0),
      quantity: Number(item.quantity ?? 1),
      unitPrice: Number(item.unitPrice ?? 0),
    })),
    discountRate: Number(invoice.discountRate ?? 0),
    taxRate: Number(invoice.taxRate ?? 0),
    deliveryChargeEnabled: invoice.deliveryChargeEnabled === true,
    deliveryCharge: Number(invoice.deliveryCharge ?? 0),
    freeDelivery: invoice.freeDelivery === true,
  };
}

function lineTotal(item) {
  return Math.round(Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unitPrice) || 0) * 100) / 100;
}

export default function InvoiceManager({ products, storefrontBrand }) {
  const [invoices, setInvoices] = useState([]);
  const [invoice, setInvoice] = useState(null);
  const [invoiceHeaderDefaults, setInvoiceHeaderDefaults] = useState(null);
  const [settingsBusinessDetails, setSettingsBusinessDetails] = useState(null);
  const [invoiceMode, setInvoiceMode] = useState("edit");
  const [livePreviewEnabled, setLivePreviewEnabled] = useState(false);
  const moreActionsRef = useRef(null);
  const shareActionsRef = useRef(null);
  const topShareActionsRef = useRef(null);
  const [invoiceSettingsOpen, setInvoiceSettingsOpen] = useState(false);
  const [customProducts, setCustomProducts] = useState([]);
  const [customCustomers, setCustomCustomers] = useState([]);
  const [deliveryPartners, setDeliveryPartners] = useState([]);
  const [addingDeliveryPartner, setAddingDeliveryPartner] = useState(false);
  const [newDeliveryPartner, setNewDeliveryPartner] = useState({ name: "", deliveryCharge: "" });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState("");
  const [updatingInvoiceStatus, setUpdatingInvoiceStatus] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPickerError, setCustomerPickerError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { confirm, dialogProps } = useConfirmDialog();

  function handleActionMenuToggle(event) {
    const currentMenu = event.currentTarget.parentElement;
    const layout = currentMenu?.closest(".invoice-layout");
    layout?.querySelectorAll("details.invoice-action-menu[open]").forEach((menu) => {
      if (menu !== currentMenu) menu.removeAttribute("open");
    });
  }

  useEffect(() => {
    function closeActionMenus(event) {
      if (event.target.closest(".invoice-action-menu")) return;
      document.querySelectorAll("details.invoice-action-menu[open]").forEach((menu) => {
        menu.removeAttribute("open");
      });
    }

    document.addEventListener("pointerdown", closeActionMenus);
    return () => document.removeEventListener("pointerdown", closeActionMenus);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      getInvoices(),
      getInvoiceHeaderSettings(),
      getInvoiceCustomProducts(),
      getInvoiceCustomCustomers(),
      getInvoiceDeliveryPartners(),
    ])
      .then(([records, headerDefaults, savedCustomProducts, savedCustomCustomers, savedDeliveryPartners]) => {
        if (!active) return;
        setInvoices(records);
        setInvoiceHeaderDefaults(headerDefaults);
        setCustomProducts(savedCustomProducts);
        setCustomCustomers(savedCustomCustomers);
        setDeliveryPartners(savedDeliveryPartners);
      })
      .catch((loadError) => {
        if (!active) return;
        setLoadError(true);
        setError(loadError.message || "Invoices could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const totals = useMemo(() => {
    const subtotal = Math.round((invoice?.items ?? []).reduce((total, item) => total + lineTotal(item), 0) * 100) / 100;
    const discountRate = Math.min(100, Math.max(0, Number(invoice?.discountRate) || 0));
    const discountAmount = Math.round(subtotal * discountRate) / 100;
    const taxableSubtotal = Math.max(0, subtotal - discountAmount);
    const taxRate = Math.max(0, Number(invoice?.taxRate) || 0);
    const taxAmount = Math.round(taxableSubtotal * taxRate) / 100;
    const deliveryChargeEnabled = invoice?.deliveryChargeEnabled === true;
    const deliveryCharge = deliveryChargeEnabled
      ? Math.round(Math.max(0, Number(invoice?.deliveryCharge) || 0) * 100) / 100
      : 0;
    const freeDelivery = deliveryChargeEnabled && invoice?.freeDelivery === true;
    const deliveryAmount = freeDelivery ? 0 : deliveryCharge;
    return {
      subtotal,
      discountRate,
      discountAmount,
      taxableSubtotal,
      taxRate,
      taxAmount,
      deliveryChargeEnabled,
      deliveryCharge,
      freeDelivery,
      deliveryAmount,
      total: Math.round((taxableSubtotal + taxAmount + deliveryAmount) * 100) / 100,
    };
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
    updateInvoice("items", [...invoice.items, { productId: "", invoiceCustomProductId: "", variantIndex: 0, description: "", quantity: 1, unitPrice: 0 }]);
  }

  function updateItem(index, updates) {
    updateInvoice("items", invoice.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...updates } : item));
  }

  function chooseProduct(index, productId) {
    const [source, id] = productId.split(":", 2);
    if (source === "custom") {
      const product = customProducts.find((candidate) => candidate.id === id);
      if (!product) return;
      updateItem(index, {
        productId: "",
        invoiceCustomProductId: product.id,
        variantIndex: 0,
        description: product.name,
        unitPrice: product.unitPrice,
      });
      return;
    }
    const product = products.find((candidate) => candidate.id === (source === "catalog" ? id : productId));
    if (!product) {
      updateItem(index, { productId: "", invoiceCustomProductId: "", description: "", unitPrice: 0 });
      return;
    }
    const option = productOptions(product)[0];
    updateItem(index, {
      productId: product.id,
      invoiceCustomProductId: "",
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
      setInvoice((current) => current ? ({
        ...current,
        businessDetails: {
          ...current.businessDetails,
          values: { ...current.businessDetails.values, logoUrl },
          visible: { ...current.businessDetails.visible, logo: true },
        },
      }) : current);
      setSettingsBusinessDetails((current) => current ? ({
        ...current,
        values: { ...current.values, logoUrl },
        visible: { ...current.visible, logo: true },
      }) : current);
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
    let savedInvoice = null;
    let shareCompleted = false;
    try {
      savedInvoice = await persistInvoice();
      if (!savedInvoice) return;
      const savedTotals = {
        subtotal: savedInvoice.subtotal,
        discountRate: savedInvoice.discountRate,
        discountAmount: savedInvoice.discountAmount,
        taxRate: savedInvoice.taxRate,
        taxAmount: savedInvoice.taxAmount,
        total: savedInvoice.total,
      };
      const blob = await createInvoiceImage(savedInvoice, savedTotals);
      const safeNumber = savedInvoice.invoiceNumber.replace(/[^a-z0-9_-]/gi, "-") || "invoice";
      const file = new File([blob], `${safeNumber}.png`, { type: "image/png" });
      const shareData = { files: [file], title: `Invoice ${savedInvoice.invoiceNumber}`, text: `Invoice ${savedInvoice.invoiceNumber}` };
      if (typeof navigator.share === "function" && (
        typeof navigator.canShare !== "function" || navigator.canShare(shareData)
      )) {
        try {
          await navigator.share(shareData);
          setNotice("Invoice image shared.");
          shareCompleted = true;
          return;
        } catch (shareError) {
          if (shareError.name === "AbortError") return;
        }

      }
      downloadImage(file);
      setNotice("The native share sheet was unavailable, so the invoice image was downloaded.");
      shareCompleted = true;
    } catch (shareError) {
      setError(shareError.message || "The invoice image could not be shared.");
    } finally {
      setSharing(false);
      if (savedInvoice) {
        setInvoice(null);
        setInvoiceMode("edit");
        if (!shareCompleted) setNotice("Invoice saved.");
      }

    }
  }

  async function shareSavedInvoice(record) {
    setError("");
    setNotice("");
    try {
      const savedTotals = {
        subtotal: record.subtotal,
        discountRate: record.discountRate,
        discountAmount: record.discountAmount,
        taxRate: record.taxRate,
        taxAmount: record.taxAmount,
        deliveryChargeEnabled: record.deliveryChargeEnabled,
        deliveryCharge: record.deliveryCharge,
        freeDelivery: record.freeDelivery,
        total: record.total,
      };
      const blob = await createInvoiceImage(record, savedTotals);
      const file = new File([blob], `${record.invoiceNumber.replace(/[^a-z0-9_-]/gi, "-") || "invoice"}.png`, { type: "image/png" });
      const shareData = { files: [file], title: `Invoice ${record.invoiceNumber}`, text: `Invoice ${record.invoiceNumber}` };
      if (typeof navigator.share === "function" && (
        typeof navigator.canShare !== "function" || navigator.canShare(shareData)
      )) {
        await navigator.share(shareData);
        setNotice("Invoice image shared.");
      } else {
        downloadImage(file);
        setNotice("The native share sheet was unavailable, so the invoice image was downloaded.");
      }

    } catch (shareError) {
      if (shareError.name !== "AbortError") setError(shareError.message || "The invoice image could not be shared.");
    }
  }

  function printSavedInvoice(record) {
    const printableInvoice = editableInvoice(record, storefrontBrand?.tagline || "");
    setInvoice(printableInvoice);
    setInvoiceMode("view");
    const previousTitle = document.title;
    document.title = (invoiceCustomerName(record.customerDetails) || record.invoiceNumber)
      .replace(/[\\/:*?"<>|]+/g, "-").trim() || record.invoiceNumber;
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => { document.title = previousTitle; }, 1000);
    }, 0);
  }

  async function persistInvoice(overrides = {}) {
    if (!invoice.items.length || invoice.items.some((item) => !item.description.trim() || !(Number(item.quantity) > 0) || !(Number(item.unitPrice) >= 0))) {
      setError("Add at least one item and check each item name, quantity, and price.");
      return null;
    }
    const discountRate = Number(invoice.discountRate);
    if (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > 100) {
      setError("Discount must be between 0 and 100 percent.");
      return null;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const savedProducts = [];
      for (const item of invoice.items.filter((lineItem) => !lineItem.productId)) {
        savedProducts.push(await saveInvoiceCustomProduct({ name: item.description, unitPrice: item.unitPrice }));
      }
      const customProductsByName = new Map(savedProducts.map((product) => [product.name.toLocaleLowerCase(), product]));
      const items = invoice.items.map((item) => {
        if (item.productId) return item;
        const product = customProductsByName.get(item.description.trim().toLocaleLowerCase());
        return { ...item, invoiceCustomProductId: product?.id ?? item.invoiceCustomProductId ?? "" };
      });
      let customerDetails = invoice.customerDetails;
      if (customerDetails.source === "manual") {
        const manualCustomer = customerDetails.manualCustomer;
        if ([manualCustomer.name, manualCustomer.phone, manualCustomer.address].some((value) => value.trim())) {
          const savedCustomer = await saveInvoiceCustomCustomer(manualCustomer);
          customerDetails = {
            ...customerDetails,
            invoiceCustomer: savedCustomer,
          };
          setCustomCustomers((current) => [savedCustomer, ...current.filter((record) => record.id !== savedCustomer.id)]);
        }
      }
      setCustomProducts((current) => {
        const updated = new Map(current.map((product) => [product.id, product]));
        savedProducts.forEach((product) => updated.set(product.id, product));
        return [...updated.values()].sort((first, second) => first.name.localeCompare(second.name));
      });
      const saved = await saveInvoice({
        ...invoice,
        ...overrides,
        businessDetails: {
          ...invoice.businessDetails,
          values: {
            ...invoice.businessDetails.values,
            tagline: storefrontBrand?.tagline || invoice.businessDetails.values.tagline || "",
          },
        },
        items,
        customerDetails,
        subtotal: totals.subtotal,
        discountRate: totals.discountRate,
        discountAmount: totals.discountAmount,
        taxRate: totals.taxRate,
        taxAmount: totals.taxAmount,
        deliveryChargeEnabled: totals.deliveryChargeEnabled,
        deliveryCharge: totals.deliveryCharge,
        freeDelivery: totals.freeDelivery,
        total: totals.total,
      });
      setInvoices((current) => [saved, ...current.filter((record) => record.id !== saved.id)]);
      setNotice("Invoice saved.");
      return saved;
    } catch (saveError) {
      setError(saveError.message || "Invoice could not be saved.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    const savedInvoice = await persistInvoice();
    if (!savedInvoice) return;
    setInvoice(null);
    setInvoiceMode("edit");
  }

  async function saveAsDraft() {
    const savedInvoice = await persistInvoice({ status: "draft" });
    if (!savedInvoice) return;
    setInvoice(null);
    setInvoiceMode("edit");
  }

  async function discardInvoiceChanges() {
    if (!await confirm({
      title: invoice.id ? "Discard invoice changes?" : "Discard this invoice?",
      description: invoice.id
        ? "Your unsaved changes will be lost. The saved invoice will not be deleted."
        : "This unsaved invoice will be removed.",
      confirmLabel: "Discard",
    })) return;
    setInvoice(null);
    setInvoiceMode("edit");
    setError("");
    setNotice("");
  }

  async function printInvoice() {
    setPrinting(true);
    setError("");
    setNotice("");
    let savedInvoice = null;
    try {
      savedInvoice = await persistInvoice();
      if (!savedInvoice) return;
      const previousTitle = document.title;
      const fileName = invoiceCustomerName(savedInvoice.customerDetails) || savedInvoice.invoiceNumber;
      document.title = fileName.replace(/[\\/:*?"<>|]+/g, "-").trim() || savedInvoice.invoiceNumber;
      window.print();
      window.setTimeout(() => { document.title = previousTitle; }, 1000);
    } catch (printError) {
      setError(printError.message || "The invoice could not be printed.");
    } finally {
      setPrinting(false);
      if (savedInvoice) {
        setInvoice(null);
        setInvoiceMode("edit");
        setNotice("Invoice saved.");
      }
    }
  }

  async function saveHeaderDefaults(businessDetails) {
    const savedDefaults = await saveInvoiceHeaderSettings(businessDetails);
    setInvoiceHeaderDefaults(savedDefaults);
    setSettingsBusinessDetails(savedDefaults);
    setInvoice((current) => current ? { ...current, businessDetails: savedDefaults } : current);
    setNotice("Invoice header defaults saved for future invoices.");
  }

  function openInvoiceSettings() {
    setSettingsBusinessDetails(invoice?.businessDetails ?? invoiceBusinessDetails(storefrontBrand, invoiceHeaderDefaults));
    if (invoice) setInvoiceMode("edit");
    setInvoiceSettingsOpen(true);
    setError("");
    setNotice("");
  }

  async function saveCustomProduct(product) {
    const savedProduct = await saveInvoiceCustomProduct(product);
    setCustomProducts((current) => [
      ...current.filter((record) => record.id !== savedProduct.id),
      savedProduct,
    ].sort((first, second) => first.name.localeCompare(second.name)));
  }

  async function removeCustomProduct(id) {
    await deleteInvoiceCustomProduct(id);
    setCustomProducts((current) => current.filter((product) => product.id !== id));
  }

  async function saveCustomCustomer(customer) {
    const savedCustomer = await saveInvoiceCustomCustomer(customer);
    setCustomCustomers((current) => [
      ...current.filter((record) => record.id !== savedCustomer.id),
      savedCustomer,
    ].sort((first, second) => first.name.localeCompare(second.name)));
  }

  async function removeCustomCustomer(id) {
    await deleteInvoiceCustomCustomer(id);
    setCustomCustomers((current) => current.filter((customer) => customer.id !== id));
  }

  async function saveDeliveryPartner(partner) {
    const savedPartner = await saveInvoiceDeliveryPartner(partner);
    setDeliveryPartners((current) => [
      ...current.filter((record) => record.id !== savedPartner.id),
      savedPartner,
    ].sort((first, second) => first.name.localeCompare(second.name)));
    return savedPartner;
  }

  async function addDeliveryPartnerFromInvoice() {
    setError("");
    try {
      const partner = await saveDeliveryPartner(newDeliveryPartner);
      setInvoice((current) => ({
        ...current,
        customerDetails: {
          ...current.customerDetails,
          deliveryPartnerId: partner.id,
          deliveryPartner: partner.name,
        },
        deliveryChargeEnabled: true,
        deliveryCharge: partner.deliveryCharge,
      }));
      setNewDeliveryPartner({ name: "", deliveryCharge: "" });
      setAddingDeliveryPartner(false);
      setNotice("Delivery partner added and selected.");
    } catch (saveError) {
      setError(saveError.message || "The delivery partner could not be saved.");
    }
  }

  async function removeDeliveryPartner(id) {
    await deleteInvoiceDeliveryPartner(id);
    setDeliveryPartners((current) => current.filter((partner) => partner.id !== id));
  }

  async function removeInvoice(record) {
    if (!await confirm({
      title: `Delete invoice ${record.invoiceNumber}?`,
      description: "This invoice will be permanently deleted and cannot be recovered.",
      confirmLabel: "Delete invoice",
    })) return;

    setDeletingInvoiceId(record.id);
    setError("");
    setNotice("");
    try {
      await deleteInvoice(record.id);
      setInvoices((current) => current.filter((invoiceRecord) => invoiceRecord.id !== record.id));
      setNotice(`Invoice ${record.invoiceNumber} deleted.`);
    } catch (deleteError) {
      setError(deleteError.message || "The invoice could not be deleted.");
    } finally {
      setDeletingInvoiceId("");
    }
  }

  async function changeInvoiceStatus(status) {
    if (!invoice?.id) {
      updateInvoice("status", status);
      return;
    }
    setUpdatingInvoiceStatus(true);
    setError("");
    setNotice("");
    try {
      const saved = await updateInvoiceStatus(invoice.id, status);
      setInvoice(editableInvoice(saved, storefrontBrand?.tagline || ""));
      setInvoices((current) => current.map((record) => record.id === saved.id ? saved : record));
      setNotice("Invoice status updated.");
    } catch (statusError) {
      setError(statusError.message || "Invoice status could not be updated.");
    } finally {
      setUpdatingInvoiceStatus(false);
    }
  }

  function startNewInvoice() {
    setInvoice(newInvoice(storefrontBrand, invoiceHeaderDefaults));
    setInvoiceMode("edit");
    setInvoiceSettingsOpen(false);
    setError("");
    setNotice("");
  }

  return (
    <section className={`invoice-manager${invoice ? " is-editing-invoice" : ""}`}>
      {!invoiceSettingsOpen && !invoice && (
        <div className="invoice-page-actions" role="group" aria-label="Invoice actions">
          <button className="admin-secondary-button" type="button" disabled={loading} onClick={openInvoiceSettings}>Settings</button>
          <button className="admin-primary-button" type="button" disabled={loading} onClick={startNewInvoice}>Create invoice</button>
        </div>
      )}
      {error && <AdminNotice kind="error">{error}</AdminNotice>}
      {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
      {invoiceSettingsOpen ? (
        <InvoiceSettingsPanel
          businessDetails={settingsBusinessDetails ?? invoiceBusinessDetails(storefrontBrand, invoiceHeaderDefaults)}
          storefrontBrand={storefrontBrand}
          uploadingLogo={uploadingLogo}
          customProducts={customProducts}
          customCustomers={customCustomers}
          deliveryPartners={deliveryPartners}
          onHeaderChange={setSettingsBusinessDetails}
          onLogoSelected={(files) => void handleInvoiceLogoSelected(files)}
          onSaveHeader={saveHeaderDefaults}
          onSaveProduct={saveCustomProduct}
          onDeleteProduct={removeCustomProduct}
          onSaveCustomer={saveCustomCustomer}
          onDeleteCustomer={removeCustomCustomer}
          onSaveDeliveryPartner={saveDeliveryPartner}
          onDeleteDeliveryPartner={removeDeliveryPartner}
          onBack={() => setInvoiceSettingsOpen(false)}
        />
      ) : !invoice ? (
        <InvoiceList
          invoices={invoices}
          loading={loading}
          loadError={loadError}
          deletingInvoiceId={deletingInvoiceId}
          onCreate={startNewInvoice}
          onEdit={(record) => {
            setInvoice(editableInvoice(record, storefrontBrand?.tagline || ""));
            setInvoiceMode("edit");
            setError("");
            setNotice("");
          }}
          onDelete={(record) => void removeInvoice(record)}
          onShare={(record) => void shareSavedInvoice(record)}
          onPrint={printSavedInvoice}
        />
      ) : (
        <form className={`invoice-layout${invoiceMode === "edit" ? " is-editing" : ""}${livePreviewEnabled ? " has-live-preview" : ""}`} onSubmit={handleSave}>
          <div className="invoice-editor-toolbar">
            <div className="invoice-toolbar-main">
              <button type="button" className="invoice-back-button" onClick={() => { setInvoice(null); setError(""); setNotice(""); }} aria-label="Back to all invoices">← Invoices</button>
              <div className="invoice-toolbar-title">
                <strong>{invoice.id ? invoice.invoiceNumber : "New invoice"}</strong>
                <small>{invoice.id ? "Saved" : "Unsaved"}</small>
              </div>
              {invoiceStatus(invoice) === "overdue" && (
                <span className="invoice-status-badge is-overdue">{updatingInvoiceStatus ? "Updating..." : "Overdue"}</span>
              )}
              <div className="invoice-mode-switch" role="group" aria-label="Invoice mode">
                <button type="button" className={`admin-secondary-button${invoiceMode === "edit" ? " active" : ""}`} aria-pressed={invoiceMode === "edit"} onClick={() => setInvoiceMode("edit")}>Edit</button>
                <button type="button" className={`admin-secondary-button${invoiceMode === "view" ? " active" : ""}`} aria-pressed={invoiceMode === "view"} onClick={() => setInvoiceMode("view")}>View</button>
              </div>
              <details className="invoice-share-actions invoice-action-menu" ref={topShareActionsRef}>
                <summary aria-label="Share or export invoice" onClick={handleActionMenuToggle}>Share</summary>
                <div>
                  <button type="button" onClick={() => { topShareActionsRef.current.open = false; void printInvoice(); }} disabled={saving || sharing || printing || updatingInvoiceStatus}>{printing ? "Preparing PDF..." : "Print / PDF"}</button>
                  <button type="button" onClick={() => { topShareActionsRef.current.open = false; void shareInvoiceAsImage(); }} disabled={saving || sharing || printing || updatingInvoiceStatus}>{sharing ? "Preparing image..." : "Share image"}</button>
                  {invoiceMode === "edit" && (
                    <button
                      type="button"
                      aria-pressed={livePreviewEnabled}
                      onClick={() => {
                        setLivePreviewEnabled((enabled) => !enabled);
                        topShareActionsRef.current.open = false;
                      }}
                    >
                      {livePreviewEnabled ? "Hide preview" : "Show preview"}
                    </button>
                  )}
                </div>
              </details>
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
                      invoiceCustomer: { id: "", name: "", phone: "", address: "" },
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
                      <option value="invoice">Choose an invoice-only customer</option>
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
                  ) : invoice.customerDetails.source === "invoice" ? (
                    <div className="invoice-customer-picker">
                      <label>
                        Invoice-only customer
                        <select
                          value={invoice.customerDetails.invoiceCustomer.id}
                          onChange={(event) => {
                            const selected = customCustomers.find((record) => record.id === event.target.value);
                            updateInvoice("customerDetails", {
                              ...invoice.customerDetails,
                              invoiceCustomer: selected ?? { id: "", name: "", phone: "", address: "" },
                            });
                          }}
                        >
                          <option value="">Select an invoice-only customer</option>
                          {invoice.customerDetails.invoiceCustomer.id
                            && !customCustomers.some((record) => record.id === invoice.customerDetails.invoiceCustomer.id)
                            && (
                              <option value={invoice.customerDetails.invoiceCustomer.id} key={invoice.customerDetails.invoiceCustomer.id}>
                                {invoice.customerDetails.invoiceCustomer.name || invoice.customerDetails.invoiceCustomer.phone || "Saved invoice customer"}
                              </option>
                            )}
                          {customCustomers.map((record) => (
                            <option key={record.id} value={record.id}>
                              {[record.name, record.phone].filter(Boolean).join(" · ") || "Invoice customer"}
                            </option>
                          ))}
                        </select>
                      </label>
                      {!customCustomers.length && <p className="invoice-customer-hint">Add invoice-only customers in Invoice settings.</p>}
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
                    <span className="invoice-delivery-partner-picker">
                      <select value={invoice.customerDetails.deliveryPartnerId} onChange={(event) => {
                        const partner = deliveryPartners.find((record) => record.id === event.target.value);
                        updateInvoice("customerDetails", {
                          ...invoice.customerDetails,
                          deliveryPartnerId: event.target.value,
                          deliveryPartner: partner?.name ?? "",
                        });
                        if (partner) {
                          setInvoice((current) => ({
                            ...current,
                            deliveryChargeEnabled: true,
                            deliveryCharge: partner.deliveryCharge,
                          }));
                        }
                      }}>
                        <option value="">No delivery partner</option>
                        {deliveryPartners.map((partner) => (
                          <option key={partner.id} value={partner.id}>{partner.name}</option>
                        ))}
                      </select>
                      <button className="admin-secondary-button" type="button" onClick={() => setAddingDeliveryPartner((current) => !current)}>
                        {addingDeliveryPartner ? "Cancel" : "Add delivery partner"}
                      </button>
                    </span>
                  </label>
                  {addingDeliveryPartner && (
                    <div className="invoice-inline-delivery-form">
                      <label>Partner name<input value={newDeliveryPartner.name} onChange={(event) => setNewDeliveryPartner({ ...newDeliveryPartner, name: event.target.value })} required /></label>
                      <label>Delivery charge<input type="number" min="0" step="0.01" value={newDeliveryPartner.deliveryCharge} onChange={(event) => setNewDeliveryPartner({ ...newDeliveryPartner, deliveryCharge: event.target.value })} required /></label>
                      <button className="admin-primary-button" type="button" onClick={() => void addDeliveryPartnerFromInvoice()}>Add and select</button>
                    </div>
                  )}
                </>
              )}
            </section>
            <section className="invoice-editor-section">
              <div className="invoice-section-title"><h2>Items</h2></div>
              {!invoice.items.length && (
                <div className="invoice-empty-item">
                  <p className="invoice-section-hint">Add products from your catalog or create custom invoice items.</p>
                </div>
              )}
              {invoice.items.map((item, index) => {
                const selectedProduct = products.find((product) => product.id === item.productId);
                const options = selectedProduct ? productOptions(selectedProduct) : [];
                return (
                <div className="invoice-item-row" key={`${item.productId || "custom"}-${index}`}>
                  <div className="invoice-item-product-fields">
                    <label>Product<select value={item.productId ? `catalog:${item.productId}` : item.invoiceCustomProductId ? `custom:${item.invoiceCustomProductId}` : ""} onChange={(event) => chooseProduct(index, event.target.value)}>
                    <option value="">Custom item / choose product</option>
                    {products.length > 0 && (
                      <optgroup label="Store catalog">
                        {products.map((product) => <option value={`catalog:${product.id}`} key={product.id}>{product.title}{product.isActive ? "" : " (inactive)"}</option>)}
                      </optgroup>
                    )}
                    {customProducts.length > 0 && (
                      <optgroup label="Saved invoice products">
                        {customProducts.map((product) => <option value={`custom:${product.id}`} key={product.id}>{product.name}</option>)}
                      </optgroup>
                    )}
                    </select></label>
                    {options.length > 1 && (
                      <label>Product option<select value={item.variantIndex ?? 0} onChange={(event) => chooseVariant(index, selectedProduct, event.target.value)}>
                        {options.map((option, optionIndex) => <option value={optionIndex} key={option.id || optionIndex}>{option.label || `Option ${optionIndex + 1}`} · {formatProductPrice(option.price)}</option>)}
                      </select></label>
                    )}
                  </div>
                  <label>Item name<input required value={item.description} onChange={(event) => updateItem(index, { description: event.target.value, productId: "", invoiceCustomProductId: "" })} /></label>
                  <div className="invoice-item-numbers">
                    <label>Qty<input type="number" min="0.01" step="any" required value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} /></label>
                    <label>Unit price<input type="number" min="0" step="0.01" required value={item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: event.target.value })} /></label>
                    <div className="invoice-item-line-total">
                      <span>Total</span>
                      <strong>{formatProductPrice(lineTotal(item))}</strong>
                    </div>
                  </div>
                  <button className="invoice-remove-item" type="button" aria-label={`Remove ${item.description || "item"}`} onClick={() => updateInvoice("items", invoice.items.filter((_, itemIndex) => itemIndex !== index))}>
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                      <path d="M3.5 5.5h13m-11.5 0 .7 11h9.6l.7-11M8 5.5V3.8h4v1.7m-3 3v5m3-5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Remove</span>
                  </button>
                </div>
                );
              })}
              <button className="invoice-add-item-button admin-secondary-button" type="button" onClick={addItem}>
                {invoice.items.length ? "Add another" : "Add item"}
              </button>
              <div className="invoice-tax-row">
                <label>Tax rate (%)<input type="number" min="0" step="0.01" value={invoice.taxRate} onChange={(event) => updateInvoice("taxRate", event.target.value)} /></label>
                <label>Discount (%)<input type="number" min="0" max="100" step="0.01" value={invoice.discountRate} onChange={(event) => updateInvoice("discountRate", event.target.value)} /></label>
                <p><span>Subtotal</span><strong>{formatProductPrice(totals.subtotal)}</strong></p>
                {totals.discountRate > 0 && <p><span>Discount ({totals.discountRate}%)</span><strong>−{formatProductPrice(totals.discountAmount)}</strong></p>}
                {totals.taxRate > 0 && <p><span>Tax ({totals.taxRate}%)</span><strong>{formatProductPrice(totals.taxAmount)}</strong></p>}
                {totals.deliveryChargeEnabled && <p><span>Delivery charge</span><strong>{formatProductPrice(totals.deliveryCharge)}</strong></p>}
                {totals.freeDelivery && <p><span>Free delivery</span><strong>−{formatProductPrice(totals.deliveryCharge)}</strong></p>}
                <p className="invoice-tax-total"><span>Total</span><strong>{formatProductPrice(totals.total)}</strong></p>
              </div>
            </section>
            <section className="invoice-editor-section invoice-delivery-section">
              <label className="invoice-customer-toggle">
                <input
                  type="checkbox"
                  checked={invoice.deliveryChargeEnabled}
                  onChange={(event) => updateInvoice("deliveryChargeEnabled", event.target.checked)}
                />
                <span><strong>Add delivery charge</strong><small>Include delivery pricing in this invoice.</small></span>
              </label>
              {invoice.deliveryChargeEnabled && (
                <div className="invoice-delivery-fields">
                  <label>Delivery charge<input type="number" min="0" step="0.01" value={invoice.deliveryCharge} onChange={(event) => updateInvoice("deliveryCharge", event.target.value)} /></label>
                  <label className="invoice-customer-toggle invoice-free-delivery-toggle">
                    <input type="checkbox" checked={invoice.freeDelivery} onChange={(event) => updateInvoice("freeDelivery", event.target.checked)} />
                    <span><strong>Free delivery</strong></span>
                  </label>
                </div>
              )}
            </section>
            <section className="invoice-editor-section">
              <label className="invoice-notes-field">Notes<textarea rows="3" placeholder="Payment terms or a note for the customer" value={invoice.notes} onChange={(event) => updateInvoice("notes", event.target.value)} /></label>
            </section>
            </div>
          ) : null}
          <div className={`invoice-preview-wrap${invoiceMode === "edit" && !livePreviewEnabled ? " is-preview-disabled" : ""}`}>
            <InvoicePreview
              invoice={invoice}
              totals={totals}
              storefrontTagline={storefrontBrand?.tagline || ""}
              lineTotal={lineTotal}
            />
          </div>
          <div className="invoice-bottom-actions">
            <span className="invoice-bottom-actions-label">Invoice actions</span>
            <div className="invoice-editor-actions">
              <button
                type="button"
                className="invoice-back-button invoice-go-to-list-button"
                onClick={() => {
                  setInvoice(null);
                  setInvoiceMode("edit");
                  setError("");
                  setNotice("");
                }}
              >
                ← Invoices
              </button>
              <details className="invoice-share-actions invoice-action-menu" ref={shareActionsRef}>
                <summary aria-label="Share or export invoice" onClick={handleActionMenuToggle}>Share</summary>
                <div>
                  <button type="button" onClick={() => { shareActionsRef.current.open = false; void printInvoice(); }} disabled={saving || sharing || printing || updatingInvoiceStatus}>{printing ? "Preparing PDF..." : "Print / PDF"}</button>
                  <button type="button" onClick={() => { shareActionsRef.current.open = false; void shareInvoiceAsImage(); }} disabled={saving || sharing || printing || updatingInvoiceStatus}>{sharing ? "Preparing image..." : "Share image"}</button>
                  {invoiceMode === "edit" && (
                    <button
                      type="button"
                      aria-pressed={livePreviewEnabled}
                      onClick={() => {
                        setLivePreviewEnabled((enabled) => !enabled);
                        shareActionsRef.current.open = false;
                      }}
                    >
                      {livePreviewEnabled ? "Hide preview" : "Show preview"}
                    </button>
                  )}
                </div>
              </details>
              <details className="invoice-more-actions invoice-action-menu" ref={moreActionsRef}>
                <summary aria-label="More invoice actions" onClick={handleActionMenuToggle}>More</summary>
                <div>
                  <button type="button" onClick={() => { moreActionsRef.current.open = false; openInvoiceSettings(); }}>Settings</button>
                  <label className="invoice-more-status">
                    <span>Status</span>
                    <select
                      value={invoice.status ?? "draft"}
                      disabled={updatingInvoiceStatus}
                      onChange={(event) => {
                        if (invoiceMode === "view") void changeInvoiceStatus(event.target.value);
                        else updateInvoice("status", event.target.value);
                      }}
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="paid">Paid</option>
                    </select>
                  </label>
                  {invoiceMode === "edit" && <button type="button" onClick={() => { moreActionsRef.current.open = false; void saveAsDraft(); }} disabled={saving || sharing || printing || updatingInvoiceStatus}>{saving ? "Saving..." : "Save as draft"}</button>}
                  <button type="button" className="invoice-discard-action" onClick={() => { moreActionsRef.current.open = false; void discardInvoiceChanges(); }} disabled={saving || sharing || printing || updatingInvoiceStatus}>Discard</button>
                </div>
              </details>
              {invoiceMode === "edit" && <button className="admin-primary-button invoice-save-button" type="submit" disabled={saving || sharing || printing || updatingInvoiceStatus}>{saving ? "Saving..." : "Save"}</button>}
            </div>
          </div>
        </form>
      )}
      <ConfirmDialog {...dialogProps} />
    </section>
  );
}
