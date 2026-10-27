import { useState } from "react";
import { adminSupabase } from "../../../lib/supabase.js";
import AdminNotice from "../components/AdminNotice.jsx";
import AdminButton from "../components/AdminButton.jsx";

const REQUEST_SENT_MESSAGE = "Request sent. An admin must approve it before you can sign in to the workspace.";
const GENERIC_AUTH_ERROR = "We could not complete that request. Check your details and try again.";

function getSignUpErrorMessage(authError) {
  const code = authError?.code?.toLowerCase() ?? "";
  const message = authError?.message?.toLowerCase() ?? "";

  if (code === "email_exists" || code === "user_already_exists" || message.includes("already registered")) {
    return "An account may already use this email. Try signing in or use Forgot password to recover it.";
  }
  if (code === "weak_password" || message.includes("password") && message.includes("characters")) {
    return "That password does not meet the security requirements. Choose a stronger password and try again.";
  }
  if (code.includes("rate_limit") || message.includes("rate limit") || message.includes("too many")) {
    return "Too many account or email requests were made recently. Wait a few minutes, then try again.";
  }
  if (code.includes("redirect") || message.includes("redirect") || message.includes("redirect_to")) {
    return "Supabase rejected the confirmation redirect. Add https://petifyshopping.github.io/** under Authentication → URL Configuration → Redirect URLs.";
  }
  if (code.includes("email") && (message.includes("invalid") || message.includes("not valid"))) {
    return "Check the email address and try again.";
  }
  if (code.includes("provider") || message.includes("email signups are disabled")) {
    return "Email account creation is disabled in Supabase. Enable the Email provider under Authentication → Sign In / Providers.";
  }

  return authError?.message || "Account creation failed. Check the Supabase Auth logs for the exact cause.";
}

export default function AdminLogin({
  adminBrand,
  onSignedIn,
  title = "Admin sign in",
  description = "Sign in or request access to the workspace.",
  backHref = "/",
  initialMode = "signin",
}) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (mode === "request" && password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const { data, error: signInError } = await adminSupabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(GENERIC_AUTH_ERROR);
          return;
        }
        onSignedIn(data.session);
        return;
      }

      if (mode === "request") {
        const { data, error: signUpError } = await adminSupabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpError) {
          setError(getSignUpErrorMessage(signUpError));
          return;
        }
        setNotice(REQUEST_SENT_MESSAGE);
        if (data.session) onSignedIn(data.session);
        return;
      }

      const { error: resetError } = await adminSupabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/?password-reset=1`,
      });
      if (resetError) {
        setError(GENERIC_AUTH_ERROR);
        return;
      }
      setNotice("If an account exists for that address, password reset instructions will be sent.");
    } catch (authFailure) {
      setError(mode === "request" ? getSignUpErrorMessage(authFailure) : GENERIC_AUTH_ERROR);
    } finally {
      setBusy(false);
    }
  }

  const isRequest = mode === "request";
  const isForgot = mode === "forgot";

  return (
    <main className="admin-login-page">
      <section className="admin-login-story" aria-label="Admin workspace">
        <div className="admin-login-story-brand">
          <img src="/images/logo.png" alt="" />
          <span>{adminBrand.name}<small>{adminBrand.label} workspace</small></span>
        </div>
        <div className="admin-login-story-copy">
          <p className="admin-login-story-kicker">ADMIN WORKSPACE</p>
          <h2>A simpler way to care for your shop.</h2>
          <p>Manage products, update your storefront, and keep your team access organized from one secure place.</p>
        </div>
        <p className="admin-login-story-note">A secure workspace for your store.</p>
      </section>
      <section className="admin-login-panel">
        <form className="admin-login" aria-label={isForgot ? "Reset password" : "Admin sign in"} onSubmit={submit}>
          <div className="admin-login-brand">
            <img src="/images/logo.png" alt="" />
            <span>{adminBrand.name} <small>{adminBrand.label}</small></span>
          </div>
          {!isForgot && (
            <div className="admin-login-tabs" role="tablist" aria-label="Workspace account">
              <button
                type="button"
                role="tab"
                aria-selected={!isRequest}
                className={!isRequest ? "active" : ""}
                onClick={() => { setMode("signin"); setError(""); setNotice(""); }}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isRequest}
                className={isRequest ? "active" : ""}
                onClick={() => { setMode("request"); setError(""); setNotice(""); }}
              >
                Request access
              </button>
            </div>
          )}

          <div className="admin-login-heading">
            <h1>{isForgot ? "Reset your password" : isRequest ? "Request access" : title}</h1>
            <p>{isForgot
              ? "Enter your account email and we’ll send a secure reset link."
              : isRequest
                ? "Create an account. An admin will review your request."
                : description}</p>
          </div>

          <div className="admin-login-fields">
            <label>
              Email address
              <input
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            {!isForgot && (
              <>
                <label>
                  Password
                  <span className="admin-password-input">
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete={isRequest ? "new-password" : "current-password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((shown) => !shown)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </span>
                </label>
                {isRequest && (
                  <>
                    <label>
                      Confirm password
                      <input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Enter your password again"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                      />
                    </label>
                  </>
                )}
              </>
            )}
          </div>

          {mode === "signin" && (
            <a className="admin-login-forgot" href="/#admin-forgot-password">Forgot password?</a>
          )}
          {error && <AdminNotice kind="error">{error}</AdminNotice>}
          {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
          <AdminButton variant="primary" type="submit" className="admin-login-submit" disabled={busy}>
            {busy
              ? isForgot ? "Sending link..." : isRequest ? "Sending request..." : "Signing in..."
              : isForgot ? "Send reset link" : isRequest ? "Create account" : "Sign in"}
          </AdminButton>

          {isForgot && (
            <a className="admin-login-back" href="/#admin">
              Back to sign in
            </a>
          )}
          <a className="admin-login-store-link" href={backHref}>← Back to storefront</a>
        </form>
      </section>
    </main>
  );
}
