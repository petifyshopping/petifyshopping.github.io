import { lazy, Suspense, useState } from "react";
import { adminSupabase } from "../../lib/supabase.js";
import AdminButton from "./components/AdminButton.jsx";
import AdminNotice from "./components/AdminNotice.jsx";
import AdminState from "./components/AdminState.jsx";
import {
  DEFAULT_SESSION_HOURS,
  MAX_SESSION_HOURS,
  MIN_SESSION_HOURS,
  getSessionLifetimeSettings,
} from "../../hooks/sessionLifetime.js";

const TeamAccessPanel = lazy(() => import("./TeamAccessPanel.jsx"));

function displayNameFor(user) {
  return user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "";
}

export default function AdminProfile({ user, onSignOut, onDisplayNameChange, onUserChange }) {
  const [displayName, setDisplayName] = useState(() => displayNameFor(user));
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [signOutError, setSignOutError] = useState("");
  const initialSessionSettings = getSessionLifetimeSettings({ user });
  const [autoLogoutEnabled, setAutoLogoutEnabled] = useState(initialSessionSettings.enabled);
  const [autoLogoutHours, setAutoLogoutHours] = useState(String(initialSessionSettings.hours));
  const [savingSessionSettings, setSavingSessionSettings] = useState(false);
  const [sessionSettingsError, setSessionSettingsError] = useState("");
  const [sessionSettingsNotice, setSessionSettingsNotice] = useState("");

  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    const nextDisplayName = displayName.trim();
    if (!nextDisplayName) {
      setError("Enter a display name before saving.");
      return;
    }

    setSavingProfile(true);
    try {
      const { error: updateError } = await adminSupabase.auth.updateUser({
        data: { full_name: nextDisplayName },
      });
      if (updateError) throw updateError;
      setDisplayName(nextDisplayName);
      onDisplayNameChange(nextDisplayName);
      setNotice("Profile updated successfully.");
    } catch (updateFailure) {
      setError(updateFailure.message || "Your profile could not be updated. Try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordError("");
    setPasswordNotice("");
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      const { error: verificationError } = await adminSupabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verificationError) {
        setPasswordError("The current password could not be verified.");
        return;
      }
      const { error: updateError } = await adminSupabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setPasswordError("The password could not be changed. Try again.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice("Password changed successfully.");
    } catch {
      setPasswordError("The password could not be changed. Check your connection and try again.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function signOut() {
    setSignOutError("");
    setSigningOut(true);
    try {
      await onSignOut();
    } catch (signOutFailure) {
      setSignOutError(signOutFailure.message || "Sign out could not be completed.");
    } finally {
      setSigningOut(false);
    }
  }

  async function saveSessionSettings(event) {
    event.preventDefault();
    setSessionSettingsError("");
    setSessionSettingsNotice("");
    const hours = Number(autoLogoutHours);
    if (autoLogoutEnabled && (!Number.isFinite(hours) || hours < MIN_SESSION_HOURS || hours > MAX_SESSION_HOURS)) {
      setSessionSettingsError(`Enter a duration between ${MIN_SESSION_HOURS} and ${MAX_SESSION_HOURS} hours.`);
      return;
    }

    setSavingSessionSettings(true);
    try {
      const { data, error: updateError } = await adminSupabase.auth.updateUser({
        data: {
          auto_logout_enabled: autoLogoutEnabled,
          auto_logout_hours: autoLogoutEnabled ? hours : DEFAULT_SESSION_HOURS,
        },
      });
      if (updateError) throw updateError;
      if (data.user) onUserChange(data.user);
      setAutoLogoutHours(String(autoLogoutEnabled ? hours : DEFAULT_SESSION_HOURS));
      setSessionSettingsNotice(autoLogoutEnabled
        ? `Automatic logout is enabled after ${hours} hours.`
        : "Automatic logout is disabled.");
    } catch (updateFailure) {
      setSessionSettingsError(updateFailure.message || "Session security settings could not be saved. Try again.");
    } finally {
      setSavingSessionSettings(false);
    }
  }

  return (
    <section className="admin-profile" aria-label="Admin profile">
      <div className="admin-profile-card">
        <div className="admin-settings-heading">
          <div>
            <h2>Profile details</h2>
          </div>
        </div>
        <form className="admin-form-grid admin-profile-form" onSubmit={saveProfile}>
          <label>
            Display name
            <input
              type="text"
              autoComplete="name"
              maxLength={80}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </label>
          <label>
            Email address
            <input type="email" value={user.email ?? ""} readOnly />
          </label>
          {error && <AdminNotice kind="error">{error}</AdminNotice>}
          {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
          <div className="admin-profile-actions">
            <AdminButton variant="primary" type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving..." : "Save profile"}
            </AdminButton>
          </div>
        </form>
      </div>
      <div className="admin-profile-card">
        <div className="admin-settings-heading">
          <div>
            <h2>Automatic logout</h2>
            {/* <p className="admin-muted">Choose whether this admin account should be signed out automatically after a set period in this browser session.</p> */}
          </div>
        </div>
        <form className="admin-form-grid admin-profile-form" onSubmit={saveSessionSettings}>
          <label className="admin-checkbox-label">
            <input
              type="checkbox"
              checked={autoLogoutEnabled}
              onChange={(event) => setAutoLogoutEnabled(event.target.checked)}
            />
            Enable automatic logout
          </label>
          {autoLogoutEnabled && (
            <label>
              Logout after (hours)
              <input
                type="number"
                min={MIN_SESSION_HOURS}
                max={MAX_SESSION_HOURS}
                step="0.25"
                value={autoLogoutHours}
                onChange={(event) => setAutoLogoutHours(event.target.value)}
                required
              />
            </label>
          )}
          {sessionSettingsError && <AdminNotice kind="error">{sessionSettingsError}</AdminNotice>}
          {sessionSettingsNotice && <AdminNotice kind="success">{sessionSettingsNotice}</AdminNotice>}
          <div className="admin-profile-actions">
            <AdminButton variant="primary" type="submit" disabled={savingSessionSettings}>
              {savingSessionSettings ? "Saving..." : "Save logout settings"}
            </AdminButton>
          </div>
        </form>
      </div>
      <div className="admin-profile-card">
        <div className="admin-settings-heading">
          <div>
            <h2>Account security</h2>
            <p className="admin-muted">Update your password or sign out of this admin account.</p>
          </div>
        </div>
        <div className="admin-profile-security-actions">
          <AdminButton onClick={() => { setPasswordOpen((open) => !open); setPasswordError(""); setPasswordNotice(""); }}>
            {passwordOpen ? "Close password change" : "Change password"}
          </AdminButton>
          <AdminButton variant="danger" onClick={signOut} disabled={signingOut}>
            {signingOut ? "Signing out..." : "Sign out"}
          </AdminButton>
        </div>
        {passwordOpen && (
          <form className="admin-form-grid admin-profile-form admin-password-change" onSubmit={changePassword}>
            <label>
              Current password
              <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
            </label>
            <label>
              New password
              <input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
            </label>
            <label>
              Confirm new password
              <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </label>
            {passwordError && <AdminNotice kind="error">{passwordError}</AdminNotice>}
            {passwordNotice && <AdminNotice kind="success">{passwordNotice}</AdminNotice>}
            <AdminButton variant="primary" type="submit" disabled={savingPassword}>
              {savingPassword ? "Changing..." : "Save new password"}
            </AdminButton>
          </form>
        )}
        {signOutError && <AdminNotice kind="error">{signOutError}</AdminNotice>}
      </div>
      <div className="admin-profile-card admin-profile-team">
        <Suspense fallback={<AdminState kind="loading" description="Loading team access..." />}>
          <TeamAccessPanel />
        </Suspense>
      </div>
    </section>
  );
}
