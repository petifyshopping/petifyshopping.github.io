import { adminSupabase, supabase } from "../lib/supabase.js";

const PROFILE_FIELDS = "user_id, email, full_name, phone, whatsapp_phone, whatsapp_same_as_phone, share_email_in_orders, share_phone_in_orders, share_whatsapp_in_orders, address, created_at, updated_at";
const ADDRESS_FIELDS = "id, user_id, label, address, created_at, updated_at";

function requireSupabase() {
  if (!supabase) throw new Error("Customer accounts are unavailable because Supabase is not configured.");
  return supabase;
}

export async function getCustomerAccount(userId) {
  const client = requireSupabase();
  const [profileResult, cartResult, addressResult] = await Promise.all([
    client.from("customer_profiles").select(PROFILE_FIELDS).eq("user_id", userId).maybeSingle(),
    client.from("customer_carts").select("items").eq("user_id", userId).maybeSingle(),
    client.from("customer_addresses").select(ADDRESS_FIELDS).eq("user_id", userId).order("created_at", { ascending: true }),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (cartResult.error) throw cartResult.error;
  if (addressResult.error) throw addressResult.error;
  if (!profileResult.data) throw new Error("Your customer profile could not be found. Please contact the store.");
  return {
    profile: { ...profileResult.data, addresses: addressResult.data },
    cart: cartResult.data?.items ?? [],
  };
}

export async function saveCustomerCart(userId, items) {
  const client = requireSupabase();
  const savedItems = items.map((item) => ({
    key: item.key,
    productId: String(item.productId),
    variantId: String(item.variantId ?? ""),
    title: String(item.title ?? ""),
    image: String(item.image ?? ""),
    variantLabel: String(item.variantLabel ?? ""),
    price: Number(item.price),
    quantity: item.quantity,
  }));
  const { error } = await client.from("customer_carts").upsert({
    user_id: userId,
    items: savedItems,
  });
  if (error) throw error;
}

export async function updateCustomerProfile(userId, profile) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("customer_profiles")
    .update({
      full_name: profile.full_name.trim(),
      phone: profile.phone.trim(),
      whatsapp_phone: profile.whatsapp_same_as_phone ? "" : profile.whatsapp_phone.trim(),
      whatsapp_same_as_phone: profile.whatsapp_same_as_phone,
      share_email_in_orders: profile.share_email_in_orders,
      share_phone_in_orders: profile.share_phone_in_orders,
      share_whatsapp_in_orders: profile.share_whatsapp_in_orders,
    })
    .eq("user_id", userId)
    .select(PROFILE_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function createCustomerAddress(userId, { label, address }) {
  const { data, error } = await requireSupabase()
    .from("customer_addresses")
    .insert({ user_id: userId, label: label.trim(), address: address.trim() })
    .select(ADDRESS_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomerAddress(userId, addressId, { label, address }) {
  const { data, error } = await requireSupabase()
    .from("customer_addresses")
    .update({ label: label.trim(), address: address.trim() })
    .eq("user_id", userId)
    .eq("id", addressId)
    .select(ADDRESS_FIELDS)
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCustomerAddress(userId, addressId) {
  const { error } = await requireSupabase()
    .from("customer_addresses")
    .delete()
    .eq("user_id", userId)
    .eq("id", addressId);
  if (error) throw error;
}

export async function createCustomerOrder({ items, addressId, note }) {
  const client = requireSupabase();
  const orderItems = items.map((item) => ({
    product_id: String(item.productId),
    variant_id: String(item.variantId ?? ""),
    quantity: item.quantity,
    allow_unpriced: item.allowUnpriced === true,
    expected_unit_price: Number.isFinite(item.expectedPrice ?? item.price) ? (item.expectedPrice ?? item.price) : null,
    expected_title: item.title ?? "",
    expected_variant_label: item.variantLabel ?? "",
  }));
  const { data, error } = await client.rpc("create_customer_order_for_address", {
    p_items: orderItems,
    p_address_id: addressId,
    p_order_note: note,
  });
  if (error) throw error;
  return data;
}

export async function getCustomerOrders(userId) {
  const { data, error } = await requireSupabase()
    .from("customer_orders")
    .select("id, items, total, status, delivery_address, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data;
}

export async function getAdminCustomerPage(from, pageSize) {
  if (!adminSupabase) throw new Error("Customer management is unavailable because Supabase is not configured.");
  const { data, count, error } = await adminSupabase
    .from("customer_profiles")
    .select("user_id, email, full_name, phone, address, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: data, total: count ?? data.length };
}

export async function getAdminOrderPage(from, pageSize) {
  if (!adminSupabase) throw new Error("Customer management is unavailable because Supabase is not configured.");
  const { data, count, error } = await adminSupabase
    .from("customer_orders")
    .select("id, user_id, customer_name, customer_email, customer_phone, delivery_address, order_note, items, total, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: data, total: count ?? data.length };
}

export async function getAdminCustomerOrderStats() {
  if (!adminSupabase) throw new Error("Customer order stats are unavailable because Supabase is not configured.");
  const { data, error } = await adminSupabase.rpc("get_customer_order_stats");
  if (error) throw error;
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error("Customer order stats returned an invalid response.");
  }
  return data[0];
}

export async function updateAdminCustomerOrderStatus(orderId, status) {
  if (!adminSupabase) throw new Error("Customer order management is unavailable because Supabase is not configured.");
  const { error } = await adminSupabase.rpc("update_customer_order_status", {
    p_order_id: orderId,
    p_status: status,
  });
  if (error) throw error;
}

const DEFAULT_ORDER_CONTACT_FIELDS = { email: false, phone: true, whatsapp: false };

export async function getAdminCustomerOrderContactFields() {
  if (!adminSupabase) throw new Error("Order message settings are unavailable because Supabase is not configured.");
  const { data, error } = await adminSupabase
    .from("site_settings")
    .select("customer_order_contact_fields")
    .eq("id", "storefront")
    .single();
  if (error) throw error;
  return {
    email: data.customer_order_contact_fields?.email === true,
    phone: data.customer_order_contact_fields?.phone !== false,
    whatsapp: data.customer_order_contact_fields?.whatsapp === true,
  };
}

export async function updateAdminCustomerOrderContactFields(fields) {
  if (!adminSupabase) throw new Error("Order message settings are unavailable because Supabase is not configured.");
  const normalized = {
    email: Boolean(fields.email),
    phone: Boolean(fields.phone),
    whatsapp: Boolean(fields.whatsapp),
  };
  const { error } = await adminSupabase
    .from("site_settings")
    .update({
      customer_order_contact_fields: normalized,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "storefront");
  if (error) throw error;
  return normalized;
}

export { DEFAULT_ORDER_CONTACT_FIELDS };
