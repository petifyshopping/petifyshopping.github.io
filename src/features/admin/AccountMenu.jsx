import { useEffect, useRef, useState } from "react";
import { adminSupabase } from "../../lib/supabase.js";
import AdminButton from "./components/AdminButton.jsx";
import AdminNotice from "./components/AdminNotice.jsx";

export default function AccountMenu({ displayName, onOpenProfile, email, onSignOut }) {
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signOutError, setSignOutError] = useState("");
  const [notice, setNotice] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    if (onOpenProfile) return undefined;
    function closeMenu(event) {
      if (event.type === "keydown" && event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.type === "pointerdown" && !menuRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, [onOpenProfile]);

  async function signOut() {
    setSignOutError("");
    try {
      await onSignOut();
    } catch (signOutFailure) {
      setSignOutError(signOutFailure.message || "Sign out could not be completed.");
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error: verificationError } = await adminSupabase.auth.signInWithPassword({ email, password: currentPassword });
      if (verificationError) {
        setError("The current password could not be verified.");
        return;
      }
      const { error: updateError } = await adminSupabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError("The password could not be changed. Try again.");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Password changed successfully.");
    } catch {
      setError("The password could not be changed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (onOpenProfile) {
  return (
    <div className="admin-account-menu">
      <button
        className="admin-account-trigger"
        type="button"
        aria-label={`Open admin profile for ${displayName || "admin"}`}
        onClick={onOpenProfile}
      >
        <span>{displayName || "Admin"}</span>
      </button>
    </div>
  );
  }

  return (
    <div className="admin-account-menu" ref={menuRef} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="admin-account-trigger" type="button" aria-label={`Account menu for ${email}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <span>{email}</span>
        <span className="admin-account-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="admin-account-dropdown" role="menu">
          {signOutError && <AdminNotice kind="error">{signOutError}</AdminNotice>}
          <button className="admin-account-signout" type="button" role="menuitem" onClick={() => { setPasswordOpen((value) => !value); setError(""); setNotice(""); }}>
            {passwordOpen ? "Close password change" : "Change password"}
          </button>
          {passwordOpen && (
            <form className="admin-password-change" onSubmit={changePassword}>
              <label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
              <label>New password<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
              <label>Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
              {error && <AdminNotice kind="error">{error}</AdminNotice>}
              {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
              <AdminButton variant="primary" type="submit" disabled={busy}>{busy ? "Changing..." : "Save new password"}</AdminButton>
            </form>
          )}
          <button className="admin-account-signout" type="button" role="menuitem" onClick={signOut}>Sign out</button>
        </div>
      )}
    </div>
  );
}
