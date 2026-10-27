# Petify Official

Petify's product catalog is a React + Vite web app. Products, sections, and all editable storefront content are loaded from Supabase. If Supabase is unavailable, the storefront shows an error instead of displaying stale local data. The browser does not use local storage as a data source.

## Run locally

1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Run `npm run dev` and open the URL Vite prints.

## Connect Supabase and enable workspace access

1. Create a Supabase project.
2. Run the numbered SQL modules in `supabase/` in order:
   1. `01-core-schema.sql` creates the base product table and public catalog policy.
   2. `02-admin-access.sql` creates admin access, product write policies, and the public image bucket.
   3. `03-catalog-sections.sql` adds configurable main sections and subsections, section management permissions, and public store settings for brand, contact information, content, logo, hero navigation, the editable About page, storefront visibility, and the editable footer version number. It creates the default `singles` and `combos` sections before assigning products. Subsections can be assigned to a main section or left standalone.
   4. `04-sales.sql` enables the cloud-backed Sales ledger, Sales-only user access, customer and payment history, sales settings, and secure workspace drafts. It depends on the admin and catalog modules.
   5. `05-admin-sales-editing.sql` applies the Sales editing permissions and manual-sale functions. It depends on the Sales module.
   6. `06-inventory-dashboard.sql` adds admin-managed stock, atomic stock deductions/restocks, and aggregated Sales dashboard metrics. Existing products start with stock set to `0`; set accurate quantities in the admin UI before recording sales.
   7. `07-admin-access-requests.sql` unifies Sales authorization, creates the access-request workflow, and adds admin approval/revocation RPCs. Apply it after `06-inventory-dashboard.sql`.
   8. `08-product-seed.sql` inserts or updates the current product details. Seeded products start without photos; upload their photos from the admin page.

   Run each complete file in the Supabase SQL Editor, top to bottom. The schema modules are safe to rerun in this dependency order and preserve existing `admin_users` and `sales_users` rows.
   For an existing project, apply `09-admin-only-access.sql` to update `get_my_access()` so admin verification uses `admin_users` and access requests only; it no longer reads `sales_users`.
3. In Supabase Authentication, enable email/password sign-in and email confirmation. Enable sign-ups so staff can request accounts; unapproved accounts cannot access the workspace, and RLS remains the security boundary.
4. Create the first admin once, using the account's email, in the Supabase SQL Editor. This is a privileged bootstrap operation and must not be exposed as a client RPC:

   ```sql
   insert into public.admin_users (user_id)
   select id
   from auth.users
   where lower(email) = lower('owner@example.com')
   on conflict (user_id) do nothing;
   ```

   Run this once for the initial owner only. There is no public/admin-client bootstrap RPC. Add later admins through **Site settings → Team & Access**.
5. Configure Supabase Auth settings before launch:
   - Require email confirmation and choose the password minimum in Supabase Auth to match your preference. The app does not impose an additional password length rule.
   - Keep **Confirm email** enabled. Add the production site URL and `http://localhost:5173` to **Authentication → URL Configuration → Redirect URLs**, including the reset destination `https://your-production-host/?view=reset-password` and `http://localhost:5173/?view=reset-password`. Keep the site URL set to the canonical production origin. In the **Reset Password** email template, use Supabase's `{{ .ConfirmationURL }}` link so verification follows the requested redirect; do not link directly to `{{ .SiteURL }}`, which opens the storefront instead of the password form.
   - Keep built-in email/password rate limits enabled, configure CAPTCHA for sign-up and password-reset endpoints, and set appropriate email delivery limits for the project.
   - Set the Auth session time-box to 10 hours. The app also enforces a 10-hour limit in open and reopened workspace tabs.
6. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the project's API settings. Restart Vite.
7. Visit `/#admin`, sign in with the bootstrap owner account, and manage products. Create, rename, reorder, or delete main sections and subsections from the Products page, and optionally group subsections under a main section. Manage hero pill text and destinations, and upload or replace the store logo there too. New photos and the logo upload to the `product-images` Storage bucket.
8. Open `/#petify-dashboard` to use Sales (or `/petify-dashboard` on hosts configured with SPA path fallback). Admins automatically have Sales access; Sales-only access is approved by email under **Site settings → Team & Access**.
9. To add multi-size or multi-quantity products, edit a product, enable **This product has purchasable varieties with different prices**, then add an option label and its price for each size/pack (for example, `250 g`, `500 g`, and `1 kg`). Prices can be entered with or without thousands separators (for example, `1,299`); they are stored as numbers and displayed with Indian currency formatting.

Only the public anon key belongs in this frontend. Never put a service-role key in a `VITE_` variable. Visitors can read active products; catalog writes and access management require admin checks in RLS/RPCs. Sales access uses the unified admin-or-Sales predicate. A new account's sign-up only creates a pending request; an admin must approve it before workspace data becomes available.

The storefront has a client-side cart for combining priced products and variants into one WhatsApp order request; each product can still be ordered directly from its card. Cart contents last only for the current page session and are not saved as a data source. There is no checkout/order database or storefront inventory/stock tracking; availability, shipping, and payment are confirmed by the team over WhatsApp. Edit the About page's introduction, mission, vision, and team description in **Admin → Site settings → Store content → About page**.

## Future mobile app

The React UI is kept separate from catalog access: `src/services/catalog.js` owns the web data source and the database is the shared contract. A future Expo/React Native app can use the same Supabase project, table, policies, and product fields with its own native UI. Move shared data mapping/types into a small shared package if both clients need identical client-side logic.

## Frontend structure

- `src/features/storefront/` contains storefront components and the catalog hook.
- `src/features/admin/auth/` contains admin sign-in.
- `src/features/admin/products/` contains product editing and product form utilities.
- `src/features/admin/` contains product management, site settings, and the collapsible admin workspace sidebar. Admin menu option definitions live in `adminNavigation.js`, separate from the reusable `WorkspaceSidebar.jsx` renderer.
- `src/features/sales/` contains the Sales portal, dashboard, settings, and feature styles.
- `src/services/` contains Supabase access grouped by catalog, admin, and sales.
- `src/lib/` contains shared Supabase and product-pricing utilities.

Admin, sign-in, sales, site settings, and product editing are lazy-loaded as separate chunks; storefront users do not need to download the admin workspace.

## Admin shared components

Shared admin UI lives in `src/features/admin/components/`; session and confirmation hooks live in `src/hooks/`. Examples:

```jsx
import AdminButton from "./components/AdminButton.jsx";
import AdminNotice from "./components/AdminNotice.jsx";
import AdminState from "./components/AdminState.jsx";

<AdminButton variant="primary" type="submit" disabled={saving}>
  {saving ? "Saving..." : "Save"}
</AdminButton>
{error && <AdminNotice kind="error">{error}</AdminNotice>}
{loading && <AdminState kind="loading" description="Loading products..." />}
```

For a destructive action, call `useConfirmDialog()` and render its dialog once in the component:

```jsx
import useConfirmDialog from "../../hooks/useConfirmDialog.js";
import ConfirmDialog from "./components/ConfirmDialog.jsx";

const { confirm, dialogProps } = useConfirmDialog();

async function removeItem() {
  if (!await confirm({ title: "Delete this item?", confirmLabel: "Delete" })) return;
  await deleteItem();
}

<ConfirmDialog {...dialogProps} />
```

`ImageUploadField` forwards selected files to `onChange(files)` and can optionally limit file size:

```jsx
<ImageUploadField
  label="Product photos"
  multiple
  maxSizeBytes={5 * 1024 * 1024}
  onChange={(files) => setSelectedFiles(files)}
/>
```

`WorkspaceAccessProvider` shares one Supabase session and the cached `get_my_access()` result across Admin and Sales entry points; protected data remains enforced by RLS.

## Build

Run `npm run build` for the production bundle and `npm run preview` to inspect it locally.
