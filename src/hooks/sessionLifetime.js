import { useEffect } from "react";

export const DEFAULT_SESSION_HOURS = 10;
export const MIN_SESSION_HOURS = 0.25;
export const MAX_SESSION_HOURS = 720;
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1;

const memoryStarts = new Map();

function storageKey(session) {
  return `petify-session-start:${session.user.id}`;
}

export function getSessionLifetimeSettings(session) {
  const metadata = session?.user?.user_metadata ?? {};
  const enabled = metadata.auto_logout_enabled !== false;
  const parsedHours = Number(metadata.auto_logout_hours);
  const hours = Number.isFinite(parsedHours) && parsedHours >= MIN_SESSION_HOURS && parsedHours <= MAX_SESSION_HOURS
    ? parsedHours
    : DEFAULT_SESSION_HOURS;
  return { enabled, hours };
}

export function getSessionLifetimeMs(session) {
  const { enabled, hours } = getSessionLifetimeSettings(session);
  return enabled ? hours * 60 * 60 * 1000 : Infinity;
}

export function startSessionLifetime(session, signedIn = false) {
  if (!session?.user?.id) return Date.now();
  const key = storageKey(session);
  if (!signedIn) {
    try {
      const savedStart = Number(localStorage.getItem(key));
      if (Number.isFinite(savedStart) && savedStart > 0) {
        memoryStarts.set(key, savedStart);
        return savedStart;
      }
    } catch (error) {
      console.warn("The session start time could not be read from browser storage.", error);
    }
    const memoryStart = memoryStarts.get(key);
    if (memoryStart) return memoryStart;
  }

  const lastSignIn = Date.parse(session.user.last_sign_in_at ?? "");
  const startedAt = !signedIn && Number.isFinite(lastSignIn) && lastSignIn > 0
    ? lastSignIn
    : Date.now();
  memoryStarts.set(key, startedAt);
  try {
    localStorage.setItem(key, String(startedAt));
  } catch (error) {
    console.warn("The session start time could not be persisted in browser storage.", error);
  }
  return startedAt;
}

export function isSessionExpired(session, now = Date.now()) {
  const lifetimeMs = getSessionLifetimeMs(session);
  return Number.isFinite(lifetimeMs) && now - startSessionLifetime(session) >= lifetimeMs;
}

export function clearSessionLifetime(session) {
  if (!session?.user?.id) return;
  const key = storageKey(session);
  memoryStarts.delete(key);
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("The session start time could not be removed from browser storage.", error);
  }
}

export function useSessionLifetime(session, onExpire) {
  useEffect(() => {
    if (!session?.user?.id) return undefined;
    const lifetimeMs = getSessionLifetimeMs(session);
    if (!Number.isFinite(lifetimeMs)) return undefined;
    const expiresAt = startSessionLifetime(session) + lifetimeMs;
    let timer;

    function enforceExpiry() {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        onExpire(session);
      } else {
        timer = window.setTimeout(enforceExpiry, Math.min(remaining, MAX_TIMER_DELAY_MS));
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") enforceExpiry();
    }

    enforceExpiry();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session, onExpire]);
}
