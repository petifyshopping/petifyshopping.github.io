import { adminSupabase } from "../lib/supabase.js";

function requireAdminClient() {
  if (!adminSupabase) throw new Error("Supabase is not configured.");
  return adminSupabase;
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
    notes: row.notes ?? "",
    subtotal: Number(row.subtotal),
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
      variantIndex: Number(item.variantIndex ?? 0),
      description: item.description.trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    })),
    issue_date: invoice.issueDate,
    due_date: invoice.dueDate || null,
    notes: invoice.notes.trim(),
    subtotal: invoice.subtotal,
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
