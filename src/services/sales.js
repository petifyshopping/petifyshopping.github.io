import { adminSupabase } from "../lib/supabase.js";

function requireSupabase() {
  if (!adminSupabase) throw new Error("Connect Supabase before using the sales workspace.");
  return adminSupabase;
}

export async function getSalesSettings() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("site_settings")
    .select("sales_settings")
    .eq("id", "storefront")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Site settings are missing from Supabase.");

  return {
    enabled: data.sales_settings?.enabled !== false,
    invoicePrefix: data.sales_settings?.invoice_prefix || "INV",
    defaultPaymentMethod: data.sales_settings?.default_payment_method || "cash",
    deliveryPartners: Array.isArray(data.sales_settings?.delivery_partners)
      ? data.sales_settings.delivery_partners.filter((partner) =>
        partner
        && typeof partner.name === "string"
        && Number.isFinite(Number(partner.charge))
        && Number(partner.charge) >= 0)
        .map((partner) => ({ name: partner.name.trim(), charge: Number(partner.charge) }))
        .filter((partner) => partner.name)
      : [],
  };
}

export async function saveSalesSettings(settings) {
  const client = requireSupabase();
  const prefix = settings.invoicePrefix.trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,10}$/.test(prefix)) {
    throw new Error("Invoice prefix must be 1–10 letters, numbers, or hyphens.");
  }
  const validMethods = ["cash", "upi", "card", "bank_transfer", "other"];
  if (!validMethods.includes(settings.defaultPaymentMethod)) {
    throw new Error("Choose a valid default payment method.");
  }
  const deliveryPartners = (settings.deliveryPartners ?? []).map((partner) => {
    const name = partner.name.trim();
    const charge = Number(partner.charge);
    if (!name || !Number.isFinite(charge) || charge < 0) {
      throw new Error("Delivery partners need a name and a zero-or-greater delivery fee.");
    }
    return { name, charge };
  });

  const { error } = await client
    .from("site_settings")
    .update({
      sales_settings: {
        enabled: Boolean(settings.enabled),
        invoice_prefix: prefix,
        default_payment_method: settings.defaultPaymentMethod,
        delivery_partners: deliveryPartners,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", "storefront");
  if (error) throw error;
}

export async function getSales() {
  const client = requireSupabase();
  const { data, error } = await client
    .from("sales")
    .select("*, customer:business_customers(*), items:sale_items(*), payments:sale_payments(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getSalesDashboardMetrics() {
  const client = requireSupabase();
  const { data, error } = await client.rpc("get_sales_dashboard_metrics");
  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("Sales dashboard metrics returned an invalid response.");
  }
  return data;
}

export async function createManualSale(sale) {
  const client = requireSupabase();
  const items = sale.items.filter((item) => item.quantity !== 0);
  if (!items.length) {
    throw new Error("Add at least one product with a quantity greater than zero.");
  }
  if (items.some((item) => !Number.isSafeInteger(item.quantity) || item.quantity < 1)) {
    throw new Error("Product quantities must be whole numbers greater than zero.");
  }
  const { data, error } = await client.rpc("create_manual_sale", {
    p_customer_name: sale.customer.name,
    p_customer_email: sale.customer.email || null,
    p_customer_phone: sale.customer.phone || null,
    p_items: items.map((item) => ({
      product_id: item.productId,
      variant_id: item.variantId || null,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    })),
    p_discount: sale.discount,
    p_paid_amount: sale.paidAmount,
    p_payment_method: sale.paymentMethod,
    p_notes: sale.notes || null,
    p_source: sale.source,
    p_delivery_address: sale.deliveryAddress || null,
    p_delivery_partner: sale.deliveryPartner || null,
    p_tracking_reference: sale.trackingReference || null,
    p_delivery_charge: sale.deliveryCharge,
    p_delivery_status: sale.deliveryStatus,
  });
  if (error) throw error;
  return data;
}

export async function updateManualSale(sale) {
  const client = requireSupabase();
  const { error } = await client.rpc("update_manual_sale", {
    p_sale_id: sale.saleId,
    p_customer_name: sale.customer.name || null,
    p_customer_email: sale.customer.email || null,
    p_customer_phone: sale.customer.phone || null,
    p_items: sale.items.map((item) => ({
      product_id: item.productId,
      variant_id: item.variantId || null,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    })),
    p_source: sale.source,
    p_delivery_address: sale.deliveryAddress || null,
    p_delivery_partner: sale.deliveryPartner || null,
    p_tracking_reference: sale.trackingReference || null,
    p_delivery_charge: sale.deliveryCharge,
    p_delivery_status: sale.deliveryStatus,
    p_notes: sale.notes || null,
  });
  if (error) throw error;
}

export async function deleteManualSale(saleId) {
  const client = requireSupabase();
  const { error } = await client.rpc("delete_manual_sale", { p_sale_id: saleId });
  if (error) throw error;
}

export async function recordSalePayment(payment) {
  const client = requireSupabase();
  const { error } = await client.rpc("record_sale_payment", {
    p_sale_id: payment.saleId,
    p_amount: payment.amount,
    p_method: payment.method,
    p_reference: payment.reference || null,
    p_notes: payment.notes || null,
  });
  if (error) throw error;
}

export async function setManualSalePaymentStatus(saleId, isPaid) {
  const client = requireSupabase();
  const { error } = await client.rpc("set_manual_sale_payment_status", {
    p_sale_id: saleId,
    p_is_paid: isPaid,
  });
  if (error) throw error;
}

export async function updateSaleDelivery(delivery) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("sales")
    .update({
      delivery_partner: delivery.deliveryPartner || null,
      tracking_reference: delivery.trackingReference || null,
      delivery_status: delivery.deliveryStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", delivery.saleId)
    .eq("source", "online")
    .select("id")
    .single();
  if (error) throw error;
  if (!data) throw new Error("Online sale was not found.");
}
