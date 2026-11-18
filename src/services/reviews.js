import { adminSupabase, supabase } from "../lib/supabase.js";

function requireSupabase() {
  if (!supabase) throw new Error("Customer reviews are unavailable because Supabase is not configured.");
  return supabase;
}

export async function getPublicCustomerReviews(limit = 3) {
  const { data, error } = await requireSupabase()
    .from("customer_reviews")
    .select("id, display_name, rating, review_text, is_verified, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getPublicCustomerReviewSummary() {
  const { data, error } = await requireSupabase().rpc("get_customer_review_summary");
  if (error) throw error;
  if (!Array.isArray(data) || data.length !== 1) {
    throw new Error("Customer review summary returned an invalid response.");
  }
  const averageRating = Number(data[0].average_rating);
  const reviewCount = Number(data[0].review_count);
  if (!Number.isFinite(averageRating) || !Number.isInteger(reviewCount) || reviewCount < 0) {
    throw new Error("Customer review summary returned invalid values.");
  }
  return { averageRating, reviewCount };
}

export async function submitCustomerReview({ rating, reviewText, displayName, contactEmail }) {
  const { data, error } = await requireSupabase().rpc("submit_customer_review", {
    p_rating: rating,
    p_review_text: reviewText,
    p_display_name: displayName || null,
    p_contact_email: contactEmail || null,
  });
  if (error) throw error;
  if (typeof data !== "string" || !data) {
    throw new Error("The review could not be submitted.");
  }
  return data;
}

export async function getAdminCustomerReviewPage(from, pageSize) {
  if (!adminSupabase) throw new Error("Customer review management is unavailable because Supabase is not configured.");
  const { data, error } = await adminSupabase.rpc("get_admin_customer_review_page", {
    p_from: from,
    p_page_size: pageSize,
  });
  if (error) throw error;
  if (
    !data
    || !Array.isArray(data.rows)
    || !Number.isInteger(data.total)
    || data.total < 0
    || data.rows.length > pageSize
  ) {
    throw new Error("Customer review management returned an invalid response.");
  }
  return { rows: data.rows, total: data.total };
}

export async function moderateCustomerReview(reviewId, decision) {
  if (!adminSupabase) throw new Error("Customer review management is unavailable because Supabase is not configured.");
  const { error } = await adminSupabase.rpc("moderate_customer_review", {
    p_review_id: reviewId,
    p_decision: decision,
  });
  if (error) throw error;
}
