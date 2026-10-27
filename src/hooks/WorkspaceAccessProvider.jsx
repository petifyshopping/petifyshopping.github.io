import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { clearSessionLifetime } from "./sessionLifetime.js";
import useWorkspaceSession from "./useWorkspaceSession.js";
import WorkspaceAccessContext from "./workspaceAccessContext.js";
const ACCESS_CACHE_TTL_MS = 5 * 60 * 1000;
const ACCESS_CACHE_PREFIX = "petify-access:";

function cacheKey(userId) {
  return `${ACCESS_CACHE_PREFIX}${userId}`;
}

function readCachedAccess(userId) {
  try {
    const stored = JSON.parse(sessionStorage.getItem(cacheKey(userId)) ?? "null");
    if (
      stored
      && stored.expiresAt > Date.now()
      && typeof stored.access?.is_admin === "boolean"
      && typeof stored.access?.status === "string"
    ) return stored.access;
  } catch (error) {
    console.warn("Cached workspace access could not be read.", error);
  }
  return null;
}

function writeCachedAccess(userId, access) {
  try {
    sessionStorage.setItem(cacheKey(userId), JSON.stringify({
      access,
      expiresAt: Date.now() + ACCESS_CACHE_TTL_MS,
    }));
  } catch (error) {
    console.warn("Workspace access could not be cached for this session.", error);
  }
}

function clearCachedAccess(userId) {
  if (!userId) return;
  try {
    sessionStorage.removeItem(cacheKey(userId));
    sessionStorage.removeItem(`petify-roles:${userId}`);
  } catch (error) {
    console.warn("Cached workspace access could not be cleared.", error);
  }
}

export function WorkspaceAccessProvider({ children }) {
  const {
    session,
    setSession,
    checkingSession,
    error: sessionError,
  } = useWorkspaceSession({ clearErrorOnAuthChange: false });
  const userId = session?.user?.id ?? "";
  const lastUserId = useRef("");
  const requestInFlight = useRef(null);
  const [accessState, setAccessState] = useState({ userId: "", access: null, loading: false, error: "" });
  const access = accessState.userId === userId ? accessState.access : null;
  const accessLoading = Boolean(userId && (accessState.userId !== userId || accessState.loading));
  const accessError = accessState.userId === userId ? accessState.error : "";

  const refreshAccess = useCallback(async ({ force = false } = {}) => {
    if (!userId) {
      setAccessState({ userId: "", access: null, loading: false, error: "" });
      return;
    }
    if (!supabase) {
      setAccessState({ userId, access: null, loading: false, error: "Connect Supabase before checking workspace access." });
      return;
    }
    const cached = !force ? readCachedAccess(userId) : null;
    if (cached) {
      setAccessState({ userId, access: cached, loading: false, error: "" });
      return;
    }
    if (requestInFlight.current?.userId === userId) return requestInFlight.current.promise;

    const request = (async () => {
      setAccessState((current) => ({
        userId,
        access: current.userId === userId ? current.access : null,
        loading: true,
        error: "",
      }));
      try {
        const { data, error } = await supabase.rpc("get_my_access");
        if (error) throw error;
        if (
          !data
          || typeof data.is_admin !== "boolean"
          || typeof data.status !== "string"
        ) throw new Error("Workspace access returned an invalid response.");
        writeCachedAccess(userId, data);
        setAccessState({ userId, access: data, loading: false, error: "" });
      } catch (accessError) {
        setAccessState((current) => ({
          userId,
          access: current.userId === userId ? current.access : null,
          loading: false,
          error: accessError.message || "Workspace access could not be verified.",
        }));
      }
    })();
    requestInFlight.current = { userId, promise: request };
    try {
      await request;
    } finally {
      if (requestInFlight.current?.promise === request) requestInFlight.current = null;
    }
  }, [userId]);

  useEffect(() => {
    if (lastUserId.current && lastUserId.current !== userId) clearCachedAccess(lastUserId.current);
    lastUserId.current = userId;
    if (userId) void refreshAccess();
  }, [userId, refreshAccess]);

  useEffect(() => {
    if (!userId) return undefined;
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") void refreshAccess({ force: true });
    };
    const intervalId = window.setInterval(refreshOnFocus, ACCESS_CACHE_TTL_MS);
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [userId, refreshAccess]);

  const signOut = useCallback(async () => {
    clearSessionLifetime(session);
    clearCachedAccess(userId);
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, [session, userId]);

  const value = {
    session,
    setSession,
    checkingSession,
    sessionError,
    access,
    accessLoading,
    accessError,
    refreshAccess,
    signOut,
  };
  return <WorkspaceAccessContext.Provider value={value}>{children}</WorkspaceAccessContext.Provider>;
}
