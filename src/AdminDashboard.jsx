import { lazy, Suspense, useCallback, useState } from "react";
import { adminSupabase } from "./lib/supabase.js";
import { DEFAULT_ADMIN_BRAND, normalizeAdminBrand } from "./config/siteAppearance.js";
import useWorkspaceAccess from "./hooks/useWorkspaceAccess.js";
import { requestAccess } from "./services/access.js";
import WorkspaceAccessStatus from "./features/admin/auth/WorkspaceAccessStatus.jsx";

const AdminLogin = lazy(() => import("./features/admin/auth/AdminLogin.jsx"));
const ProductManager = lazy(() => import("./features/admin/AdminWorkspace.jsx"));

export default function AdminDashboard({
  adminBrand: initialAdminBrand,
  storefrontBrand,
  initialView,
}) {
  const {
    session,
    setSession,
    checkingSession,
    sessionError: setupError,
    access,
    accessLoading: checkingRole,
    accessError: roleError,
    refreshAccess,
    signOut,
  } = useWorkspaceAccess();
  const [brandState, setBrandState] = useState(() => ({
    source: initialAdminBrand,
    value: normalizeAdminBrand(initialAdminBrand ?? DEFAULT_ADMIN_BRAND),
  }));
  const adminBrand = brandState.source === initialAdminBrand
    ? brandState.value
    : normalizeAdminBrand(initialAdminBrand ?? DEFAULT_ADMIN_BRAND);
  const setAdminBrand = useCallback((brand) => setBrandState({
    source: initialAdminBrand,
    value: normalizeAdminBrand(brand),
  }), [initialAdminBrand]);
  const isAdmin = Boolean(access?.is_admin);

  if (!adminSupabase) {
    return <div className="admin-gate"><div><p className="admin-eyebrow">SUPABASE SETUP</p><h1>Connect your project first</h1><p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, then restart Vite.</p><a href="/">Back to storefront</a></div></div>;
  }

  if (checkingSession || (checkingRole && !isAdmin)) {
    return <div className="admin-gate"><p className="admin-muted">Checking admin access...</p></div>;
  }

  if (!session) {
    return (
      <Suspense fallback={<div className="admin-gate"><p className="admin-muted">Loading sign in...</p></div>}>
        <AdminLogin
          key={window.location.hash === "#admin-forgot-password" ? "forgot" : "signin"}
          adminBrand={adminBrand}
          onSignedIn={setSession}
          initialMode={window.location.hash === "#admin-forgot-password" ? "forgot" : "signin"}
        />
      </Suspense>
    );
  }

  if (!isAdmin) {
    return (
      <WorkspaceAccessStatus
        status={access?.status ?? "none"}
        error={setupError || roleError}
        onRequest={requestAccess}
        onRefresh={() => refreshAccess({ force: true })}
        onSignOut={signOut}
      />
    );
  }

  return (
    <Suspense fallback={<div className="admin-gate"><p className="admin-muted">Loading admin workspace...</p></div>}>
      <ProductManager
        session={session}
        adminBrand={adminBrand}
        storefrontBrand={storefrontBrand}
        onAdminBrandChange={setAdminBrand}
        initialView={initialView}
      />
    </Suspense>
  );
}
