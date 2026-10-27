import { adminSupabase } from "../lib/supabase.js";

function requireSupabase() {
  if (!adminSupabase) throw new Error("Connect Supabase before managing workspace access.");
  return adminSupabase;
}

export async function getPendingAccessRequests() {
  const { data, error } = await requireSupabase()
    .from("access_requests")
    .select("id, email, status, requested_at")
    .eq("status", "pending")
    .order("requested_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getAccessTeam() {
  const { data, error } = await requireSupabase().rpc("get_access_team");
  if (error) throw error;
  if (!data || !Array.isArray(data.admins) || !Array.isArray(data.sales)) {
    throw new Error("Workspace access returned an invalid team list.");
  }
  return data;
}

export async function requestAccess() {
  const { error } = await requireSupabase().rpc("request_access");
  if (error) throw error;
}

export async function approveAccessRequest(requestId) {
  const { error } = await requireSupabase().rpc("approve_access_request", {
    p_request_id: requestId,
    p_role: "admin",
  });
  if (error) throw error;
}

export async function approveAccessByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Enter an email address.");
  const { error } = await requireSupabase().rpc("approve_access_by_email", {
    p_email: normalizedEmail,
    p_role: "admin",
  });
  if (error) throw error;
}

export async function rejectAccessRequest(requestId) {
  const { error } = await requireSupabase().rpc("reject_access_request", {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function revokeAdmin(userId) {
  const { error } = await requireSupabase().rpc("revoke_admin", { p_user_id: userId });
  if (error) throw error;
}

export async function revokeSalesAccess(userId) {
  const { error } = await requireSupabase().rpc("revoke_sales_access", { p_user_id: userId });
  if (error) throw error;
}
