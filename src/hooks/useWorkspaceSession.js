import { useCallback, useEffect, useState } from "react";
import { adminSupabase } from "../lib/supabase.js";
import {
  clearSessionLifetime,
  isSessionExpired,
  startSessionLifetime,
  useSessionLifetime,
} from "./sessionLifetime.js";

export default function useWorkspaceSession({ clearErrorOnAuthChange = true } = {}) {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(() => Boolean(adminSupabase));
  const [error, setError] = useState("");

  const expireSession = useCallback(async (expiredSession) => {
    clearSessionLifetime(expiredSession);
    setSession(null);
    try {
      const { error: signOutError } = await adminSupabase.auth.signOut({ scope: "local" });
      if (signOutError) {
        setError(`Your 10-hour session expired, but sign-out could not be completed: ${signOutError.message}`);
      }
    } catch (signOutError) {
      setError(`Your 10-hour session expired, but sign-out could not be completed: ${signOutError.message}`);
    }
  }, []);

  useSessionLifetime(session, expireSession);

  useEffect(() => {
    if (!adminSupabase) {
      return undefined;
    }

    let active = true;
    adminSupabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (data.session && isSessionExpired(data.session)) {
        void expireSession(data.session);
      } else {
        setSession(data.session);
      }
      setError(sessionError?.message ?? "");
      setCheckingSession(false);
    }).catch((sessionError) => {
      if (!active) return;
      setError(sessionError.message || "The current session could not be restored.");
      setCheckingSession(false);
    });

    const { data: authListener } = adminSupabase.auth.onAuthStateChange((event, nextSession) => {
      if (nextSession && event === "SIGNED_IN") startSessionLifetime(nextSession, true);
      if (nextSession && isSessionExpired(nextSession)) {
        void expireSession(nextSession);
        return;
      }
      setSession(nextSession);
      if (clearErrorOnAuthChange) setError("");
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [clearErrorOnAuthChange, expireSession]);

  return { session, setSession, checkingSession, error, setError };
}
