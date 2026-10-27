import { useEffect, useState } from "react";
import { DEFAULT_ADMIN_BRAND, normalizeAdminBrand } from "../../config/siteAppearance.js";
import { supabase } from "../../lib/supabase.js";
import useWorkspaceAccess from "../../hooks/useWorkspaceAccess.js";
import AdminLogin from "../admin/auth/AdminLogin.jsx";
import WorkspaceSidebar from "../admin/WorkspaceSidebar.jsx";
import { createSalesNavigationItem } from "../admin/workspaceNavigation.js";
import AccountMenu from "../admin/AccountMenu.jsx";
import SalesDashboard from "./SalesDashboard.jsx";
import AdminButton from "../admin/components/AdminButton.jsx";
import AdminNotice from "../admin/components/AdminNotice.jsx";
import AdminTopbar from "../admin/components/AdminTopbar.jsx";
import AdminBottomNav from "../admin/components/AdminBottomNav.jsx";
import WorkspaceAccessStatus from "../admin/auth/WorkspaceAccessStatus.jsx";
import { requestAccess } from "../../services/access.js";

export default function SalesPortal({
  products,
  adminBrand: initialAdminBrand,
  storefrontBrand,
}) {
  const {
    session,
    setSession,
    checkingSession,
    sessionError: error,
    access,
    accessLoading: checkingAccess,
    accessError,
    refreshAccess,
    signOut,
  } = useWorkspaceAccess();
  const [signOutError, setSignOutError] = useState("");
  const adminBrand = normalizeAdminBrand(initialAdminBrand ?? DEFAULT_ADMIN_BRAND);
  const isAdmin = Boolean(access?.is_admin);
  const hasSalesAccess = Boolean(access?.has_sales_access);

  async function handleSignOut() {
    setSignOutError("");
    try {
      await signOut();
    } catch (signOutFailure) {
      setSignOutError(signOutFailure.message || "Sign out could not be completed.");
    }
  }

  useEffect(() => {
    if (!hasSalesAccess) return undefined;
    let frame;
    function scrollToSalesSection() {
      if (!window.location.hash.startsWith("#petify-dashboard/")) return;
      const sectionId = window.location.hash.slice("#petify-dashboard/".length);
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (sectionId === "sales-dashboard") {
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    scrollToSalesSection();
    window.addEventListener("hashchange", scrollToSalesSection);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", scrollToSalesSection);
    };
  }, [hasSalesAccess]);

  if (!supabase) {
    return <div className="admin-gate"><div><p className="admin-eyebrow">SUPABASE SETUP</p><h1>Connect your project first</h1><p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, then restart Vite.</p><a href="/">Back to storefront</a></div></div>;
  }

  if (checkingSession || checkingAccess) {
    return <div className="admin-gate"><p className="admin-muted">Checking Sales portal access...</p></div>;
  }

  if (!session) {
    return (
      <div className="admin-gate">
        {error && <AdminNotice kind="error">{error}</AdminNotice>}
        <AdminLogin
          adminBrand={adminBrand}
          onSignedIn={setSession}
          title="Sales portal sign in"
          description="Sign in with your account. Admins automatically have Sales access; approved Sales users can also continue."
          backHref="/"
        />
      </div>
    );
  }

  if (error || accessError) {
    return (
      <div className="admin-gate">
        <div>
          <p className="admin-eyebrow">ACCESS CHECK FAILED</p>
          <h1>Sales access could not be verified</h1>
          <AdminNotice kind="error">{error || accessError}</AdminNotice>
          <p className="admin-gate-actions">
            <AdminButton onClick={() => refreshAccess({ force: true })}>Try again</AdminButton>
            <AdminButton onClick={handleSignOut}>Sign out</AdminButton>
          </p>
          {signOutError && <AdminNotice kind="error">{signOutError}</AdminNotice>}
        </div>
      </div>
    );
  }

  if (!hasSalesAccess) {
    return (
      <WorkspaceAccessStatus
        status={access?.status ?? "none"}
        error={error || accessError}
        onRequest={requestAccess}
        onRefresh={() => refreshAccess({ force: true })}
        onSignOut={signOut}
      />
    );
  }

  return (
    <div className="admin-shell sales-portal-shell">
      {signOutError && <AdminNotice kind="error">{signOutError}</AdminNotice>}
      <AdminTopbar
        brand={{ ...adminBrand, label: "Sales" }}
        storefrontBrand={storefrontBrand}
        pageTitle="Sales dashboard"
      >
        <AccountMenu email={session.user.email} onSignOut={handleSignOut} />
      </AdminTopbar>
      <main className="admin-content">
        <WorkspaceSidebar heading="SALES" items={[
          ...(isAdmin ? [{ id: "products", label: "Products", icon: "products", href: "/#admin-products" }] : []),
          ...(isAdmin ? [{ id: "settings", label: "Site settings", icon: "settings", href: "/#admin-settings" }] : []),
          createSalesNavigationItem({ active: true, expanded: true }),
        ]} />
        <div className="admin-page-panel">
          <SalesDashboard products={products} userId={session.user.id} isAdmin={isAdmin} />
        </div>
      </main>
      <AdminBottomNav items={[
        ...(isAdmin ? [
          { id: "products", label: "Products", icon: "▦", href: "/#admin-products" },
          { id: "dashboard", label: "Dashboard", icon: "◷", href: "/#petify-dashboard", active: true },
          { id: "settings", label: "Settings", icon: "⚙", href: "/#admin-settings" },
        ] : [
          { id: "dashboard", label: "Dashboard", icon: "◷", href: "/#petify-dashboard", active: true },
        ]),
      ]} />
    </div>
  );
}
