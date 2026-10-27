import { adminSupabase } from "../lib/supabase.js";

function requireSupabase() {
  if (!adminSupabase) throw new Error("Connect Supabase before saving workspace drafts.");
  return adminSupabase;
}

export async function getWorkspaceDraft(userId, draftType, draftKey) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("workspace_drafts")
    .select("payload, updated_at")
    .eq("user_id", userId)
    .eq("draft_type", draftType)
    .eq("draft_key", draftKey)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getWorkspaceDrafts(userId, draftType) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("workspace_drafts")
    .select("draft_key, payload, updated_at")
    .eq("user_id", userId)
    .eq("draft_type", draftType)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveWorkspaceDraft(userId, draftType, draftKey, payload) {
  const client = requireSupabase();
  const { error } = await client.from("workspace_drafts").upsert({
    user_id: userId,
    draft_type: draftType,
    draft_key: draftKey,
    payload,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,draft_type,draft_key" });
  if (error) throw error;
}

export async function deleteWorkspaceDraft(userId, draftType, draftKey) {
  const client = requireSupabase();
  const { error } = await client
    .from("workspace_drafts")
    .delete()
    .eq("user_id", userId)
    .eq("draft_type", draftType)
    .eq("draft_key", draftKey);
  if (error) throw error;
}
