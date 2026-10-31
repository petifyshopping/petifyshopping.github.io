import { supabase } from "../lib/supabase.js";

function requireSupabase() {
  if (!supabase) throw new Error("Customer accounts are unavailable because Supabase is not configured.");
  return supabase;
}

export async function signUpCustomer({
  fullName,
  email,
  password,
  phone,
  address = "",
}) {
  const emailRedirectUrl = new URL(window.location.href);
  emailRedirectUrl.searchParams.set("email-confirmed", "1");
  emailRedirectUrl.hash = "";
  const { data, error } = await requireSupabase().auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        account_type: "customer",
        full_name: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
      },
      emailRedirectTo: emailRedirectUrl.toString(),
    },
  });
  if (error) throw error;
  return data;
}

export async function signInCustomer(email, password) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  if (!data.session) throw new Error("Confirm your email address before signing in.");
  return data;
}

export async function resetCustomerPassword(email) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/?view=reset-password`,
  });
  if (error) throw error;
}

export async function signOutCustomer() {
  const { error } = await requireSupabase().auth.signOut({ scope: "local" });
  if (error) throw error;
}
