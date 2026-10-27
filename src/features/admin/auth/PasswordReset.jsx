import { useEffect, useState } from "react";
import { adminSupabase, supabase } from "../../../lib/supabase.js";
import { DEFAULT_ADMIN_BRAND, normalizeAdminBrand } from "../../../config/siteAppearance.js";
import AdminButton from "../components/AdminButton.jsx";
import AdminNotice from "../components/AdminNotice.jsx";

export default function PasswordReset({ adminBrand: initialAdminBrand, customerReset = false }) {
  const authClient = customerReset ? supabase : adminSupabase;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const adminBrand = normalizeAdminBrand(initialAdminBrand ?? DEFAULT_ADMIN_BRAND);

  useEffect(() => {
    if (!authClient) return undefined;
    let active = true;
    authClient.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError || !data.session) {
          setError("This reset link is invalid or has expired. Request a new password reset link.");
        }
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setError("This reset link is invalid or has expired. Request a new password reset link.");
          setReady(true);
        }
      });
    return () => { active = false; };
  }, [authClient]);

  if (!authClient) {
    return <div className="admin-gate"><div><p className="admin-eyebrow">SUPABASE SETUP</p><h1>Password reset unavailable</h1><p>Connect Supabase before resetting a workspace password.</p></div></div>;
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await authClient.auth.updateUser({ password });
      if (updateError) {
        setError("The password could not be updated. The reset link may have expired.");
        return;
      }
      setNotice("Password updated. You can now sign in with your new password.");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("The password could not be updated. The reset link may have expired.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-story" aria-label="Admin workspace">
        <div className="admin-login-story-brand">
          <img src="/images/logo.png" alt="" />
          <span>{adminBrand.name}<small>{adminBrand.label} workspace</small></span>
        </div>
        <div className="admin-login-story-copy">
          <p className="admin-login-story-kicker">ACCOUNT SECURITY</p>
          <h2>Choose a new password.</h2>
          <p>Set a new password to securely return to your store workspace.</p>
        </div>
        <p className="admin-login-story-note">A secure workspace for your store.</p>
      </section>
      <section className="admin-login-panel">
        <form className="admin-login" aria-label="Choose a new password" onSubmit={submit}>
          <div className="admin-login-brand">
            <img src="/images/logo.png" alt="" />
            <span>{adminBrand.name} <small>{adminBrand.label}</small></span>
          </div>
          <div className="admin-login-heading">
            <h1>Choose a new password</h1>
            <p>Enter and confirm your new password to finish resetting your account.</p>
          </div>
          <div className="admin-login-fields">
            <label>
              New password
              <span className="admin-password-input">
                <input type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide new password" : "Show new password"}
                  onClick={() => setShowPassword((shown) => !shown)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>
            <label>
              Confirm new password
              <span className="admin-password-input">
                <input type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
                  onClick={() => setShowConfirmPassword((shown) => !shown)}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>
          </div>
          {error && <AdminNotice kind="error">{error}</AdminNotice>}
          {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
          <AdminButton className="admin-login-submit" variant="primary" type="submit" disabled={!ready || busy || Boolean(error)}>
            {busy ? "Updating..." : "Update password"}
          </AdminButton>
          <a className="admin-login-store-link" href="/#admin">Back to sign in</a>
        </form>
      </section>
    </main>
  );
}
