import { adminSupabase } from "../lib/supabase.js";

function requireAdminClient() {
  if (!adminSupabase) throw new Error("Supabase is not configured.");
  return adminSupabase;
}

export async function getInvoiceHeaderSettings() {
  const { data, error } = await requireAdminClient()
    .from("invoice_settings")
    .select("business_details")
    .eq("id", "default")
    .maybeSingle();
  if (error) throw error;
  return data?.business_details ?? null;
}

export async function saveInvoiceHeaderSettings(businessDetails) {
  const { data, error } = await requireAdminClient()
    .from("invoice_settings")
    .upsert({
      id: "default",
      business_details: businessDetails,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })
    .select("business_details")
    .single();
  if (error) throw error;
  return data.business_details;
}

function mapCustomProduct(row) {
  return {
    id: row.id,
    name: row.name,
    unitPrice: Number(row.default_unit_price),
  };
}

function mapCustomCustomer(row) {
  return {
    id: row.id,
    name: row.name ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
  };
}

export async function getInvoiceCustomProducts() {
  const { data, error } = await requireAdminClient()
    .from("invoice_custom_products")
    .select("id, name, default_unit_price")
    .order("name");
  if (error) throw error;
  return data.map(mapCustomProduct);
}

export async function saveInvoiceCustomProduct({ id, name, unitPrice }) {
  const normalizedName = name.trim().toLocaleLowerCase();
  if (!normalizedName) throw new Error("Enter a product name.");
  const parsedUnitPrice = Number(unitPrice);
  if (!Number.isFinite(parsedUnitPrice) || parsedUnitPrice < 0) {
    throw new Error("Enter a valid product price.");
  }
  const client = requireAdminClient();
  const values = {
    normalized_name: normalizedName,
    name: name.trim(),
    default_unit_price: parsedUnitPrice,
    updated_at: new Date().toISOString(),
  };
  const query = id
    ? client.from("invoice_custom_products").update(values).eq("id", id)
    : client.from("invoice_custom_products").upsert(values, { onConflict: "normalized_name" });
  const { data, error } = await query.select("id, name, default_unit_price").single();
  if (error) throw error;
  return mapCustomProduct(data);
}

export async function deleteInvoiceCustomProduct(id) {
  const { error } = await requireAdminClient()
    .from("invoice_custom_products")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function getInvoiceCustomCustomers() {
  const { data, error } = await requireAdminClient()
    .from("invoice_custom_customers")
    .select("id, name, phone, address")
    .order("name");
  if (error) throw error;
  return data.map(mapCustomCustomer);
}

export async function saveInvoiceCustomCustomer({ id, name = "", phone = "", address = "" }) {
  const customer = {
    name: name.trim(),
    phone: phone.trim(),
    address: address.trim(),
  };
  const normalizedKey = JSON.stringify([
    customer.name.toLocaleLowerCase(),
    customer.phone.toLocaleLowerCase(),
    customer.name || customer.phone ? "" : customer.address.toLocaleLowerCase(),
  ]);
  if (!customer.name && !customer.phone && !customer.address) {
    throw new Error("Enter at least one customer detail.");
  }
  const client = requireAdminClient();
  const values = {
    normalized_key: normalizedKey,
    ...customer,
    updated_at: new Date().toISOString(),
  };
  const query = id
    ? client.from("invoice_custom_customers").update(values).eq("id", id)
    : client.from("invoice_custom_customers").upsert(values, { onConflict: "normalized_key" });
  const { data, error } = await query.select("id, name, phone, address").single();
  if (error) throw error;
  return mapCustomCustomer(data);
}

export async function deleteInvoiceCustomCustomer(id) {
  const { error } = await requireAdminClient()
    .from("invoice_custom_customers")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

function mapInvoice(row) {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    businessDetails: row.business_details,
    customerDetails: row.customer_details,
    items: row.items,
    issueDate: row.issue_date,
    dueDate: row.due_date ?? "",
    status: row.status ?? "draft",
    notes: row.notes ?? "",
    subtotal: Number(row.subtotal),
    discountRate: Number(row.discount_rate ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
    taxRate: Number(row.tax_rate),
    taxAmount: Number(row.tax_amount),
    total: Number(row.total),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getInvoices() {
  const { data, error } = await requireAdminClient()
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapInvoice);
}

export async function saveInvoice(invoice) {
  const client = requireAdminClient();
  const values = {
    invoice_number: invoice.invoiceNumber.trim(),
    business_details: invoice.businessDetails,
    customer_details: invoice.customerDetails,
    items: invoice.items.map((item) => ({
      productId: item.productId || null,
      invoiceCustomProductId: item.invoiceCustomProductId || null,
      variantIndex: Number(item.variantIndex ?? 0),
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })),
    issue_date: invoice.issueDate,
    due_date: invoice.dueDate || null,
    status: invoice.status ?? "draft",
    notes: invoice.notes.trim(),
    subtotal: invoice.subtotal,
    discount_rate: invoice.discountRate ?? 0,
    discount_amount: invoice.discountAmount ?? 0,
    tax_rate: invoice.taxRate,
    tax_amount: invoice.taxAmount,
    total: invoice.total,
    updated_at: new Date().toISOString(),
  };
  const query = invoice.id
    ? client.from("invoices").update(values).eq("id", invoice.id)
    : client.from("invoices").insert(values);
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return mapInvoice(data);
}

export async function deleteInvoice(id) {
  const { error } = await requireAdminClient()
    .from("invoices")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function updateInvoiceStatus(id, status) {
  if (!["draft", "sent", "paid"].includes(status)) {
    throw new Error("Choose a valid invoice status.");
  }
  const { data, error } = await requireAdminClient()
    .from("invoices")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapInvoice(data);
}
