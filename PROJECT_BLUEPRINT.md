# Petify Storefront — Faithful Rebuild Blueprint

> **Rebuild contract.** Recreate the existing Petify storefront and admin experience; do not redesign, reinterpret, or substitute a generic e-commerce layout. Match the current component structure, copy, asset treatment, proportions, spacing, breakpoints, URL behavior, loading/error states, and interactions described below. Intentional deviations are: (1) use a fixed blue-and-white theme and remove color-changing controls from Admin → Site settings; (2) remove the Sales dashboard and every Sales-only screen, route, setting, and backend feature; and (3) add an admin-only invoice creator with catalog products, persisted invoices, and print-to-PDF support. Do not add checkout/payment/order-management features that are not described here.

## Table of contents

1. [Overview and non-negotiable scope](#1-overview-and-non-negotiable-scope)
2. [Stack, dependencies, and setup](#2-stack-dependencies-and-setup)
3. [Project structure](#3-project-structure)
4. [Routes and page rendering](#4-routes-and-page-rendering)
5. [Component and interaction catalog](#5-component-and-interaction-catalog)
6. [Visual specification and fixed theme](#6-visual-specification-and-fixed-theme)
7. [State, persistence, and data flow](#7-state-persistence-and-data-flow)
8. [Supabase schema and security](#8-supabase-schema-and-security)
9. [Feature behavior](#9-feature-behavior)
10. [Utilities and exact business rules](#10-utilities-and-exact-business-rules)
11. [Known defects and targeted quality fixes](#11-known-defects-and-targeted-quality-fixes)
12. [Implementation order and parity checklist](#12-implementation-order-and-parity-checklist)
13. [Environment and deployment](#13-environment-and-deployment)
14. [Known gaps and uncertainty](#14-known-gaps-and-uncertainty)

---

## 1. Overview and non-negotiable scope

Petify is a product catalog for pet-care goods. Customers browse categories, search, inspect product photos/pricing, add priced items to a saved cart, and send a request to the store by WhatsApp. The storefront does **not** take online payments or create customer orders in Supabase. Admins authenticate to manage the public catalog, stock values, brand/content, navigation, assets, and admin access.

### Preserve

- Public storefront, product browsing/filter/search, product details, cart, WhatsApp links, About page, footer, loading/error/retry behavior.
- Admin sign-in/access approval, Products workspace, and all non-color Site settings.
- Existing copy, logos, icons, card/action hierarchy, layout dimensions, breakpoints, interactions, persistence, and route conventions.
- Supabase-backed catalog and settings, admin-only changes, public product-image reads.

### Remove or lock

- **Remove Sales dashboard entirely:** no Sales route/page/menu item, no sales-only login behavior, sales customer/payment/delivery UI, sales settings, metrics, draft types, sales service calls, tables, RPCs, triggers, or sales migrations in the rebuilt app. Admin invoices are a separate feature and must remain admin-only.
- A legacy visit to `/petify-dashboard` must not reveal Sales. Route it to the normal storefront (or the host's normal not-found page); do not build a replacement screen.
- **Fixed blue + white theme:** remove palette presets, color pickers, hex inputs, palette drafts, palette save calls, and any setting that lets an admin alter site colors. Apply constants in CSS/code; do not load or apply a persisted color palette.
- Keep other appearance settings (loading-screen copy/image and dashboard brand) if present in the current settings UI; they are not color customization.
- Do not add payment gateways, sales/order tables, customer registration, stock reservation, an invented hero/banner, or a new frontend framework.

## 2. Stack, dependencies, and setup

### Current project baseline

| Package | Manifest range | Locked version | Use |
|---|---:|---:|---|
| `react` | `^19.1.1` | `19.3.0` | Component UI and hooks. |
| `react-dom` | `^19.1.1` | `19.3.0` | Browser mount and portals. |
| `@supabase/supabase-js` | `^2.57.0` | `2.117.2` | Auth, PostgREST, Storage. |
| `vite` | `^8.3.1` | `8.3.1` | Dev server/build. |
| `@vitejs/plugin-react` | `^6.1.1` | `6.1.1` | JSX/React Vite support. |
| `gh-pages` | `^6.3.0` | `6.3.0` | GitHub Pages deployment. |

No router, icon package, CSS framework, query cache, or component library is used. Icons are inline SVG/text. Keep those characteristics unless implementation requires a change that does not alter the output.

`package.json`: ESM project named `petify-official`; scripts `dev`, `build`, `lint`, `preview`, `predeploy`, `deploy`. Vite uses the React plugin and `base: "/"`. Root `index.html` mounts `/src/main.jsx`; `src/main.jsx` imports root `styles.css`. Sales CSS is not part of this rebuild.

### Browser metadata

- Initial title: `Pëtify | Pure love, premium care`
- Initial description: `Pëtify — pure love, premium care for your pets.`
- Initial theme-color: `#102a43`
- Initial favicon: `/images/favicon.png` (`#favicon`)
- Apple icon: `images/logo.png`
- Runtime document title changes to configured brand; About route prefixes `About us | `; favicon follows configured favicon URL, falling back to `/images/favicon.png`.

### Frontend environment variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The anon key is public browser configuration protected by database RLS. Never use or publish a Supabase service-role key in a `VITE_` variable. The local `.env` was not read or copied.

## 3. Project structure

Target structure for the faithful rebuild; do not copy/remove source files from the original blindly. `public/` is served from `/`.

```text
.
├── index.html                         # SEO/meta/favicon and #root
├── package.json / package-lock.json   # Vite scripts and locked dependencies
├── vite.config.js                     # React plugin, base "/"
├── eslint.config.js                   # ESLint browser/React Hooks configuration
├── styles.css                         # Single source of the storefront/admin CSS cascade
├── public/
│   └── images/
│       ├── logo.png                   # Admin sign-in logo
│       ├── bird.png                   # Default catalog loading illustration
│       └── favicon.png                # Default browser icon
└── src/
    ├── main.jsx                       # StrictMode root and styles.css import
    ├── App.jsx                        # Public UI, URL state, cart, query routing
    ├── AdminDashboard.jsx             # Admin session/access gates and workspace
    ├── config/
    │   ├── siteAppearance.js          # Fixed palette constants/loading defaults/admin label
    │   └── siteContent.js             # About page fallback text/normalizer
    ├── hooks/
    │   ├── WorkspaceAccessProvider.jsx
    │   ├── workspaceAccessContext.js
    │   ├── useWorkspaceAccess.js
    │   ├── useWorkspaceSession.js
    │   ├── sessionLifetime.js
    │   ├── useConfirmDialog.js
    │   ├── useObjectUrl.js
    │   ├── useScrollAwareVisibility.js
    │   └── useWorkspaceDraft.js
    ├── lib/
    │   ├── supabase.js                # Optional configured Supabase client
    │   ├── productPricing.js           # INR formatting/options/parser
    │   ├── formatters.js              # en-IN date/time formatting
    │   └── imageProcessing.js          # Client-side image compression/cropping
    ├── services/
    │   ├── catalog.js                 # Public catalog/settings reads
    │   ├── admin.js                   # Admin catalog/settings/storage writes
    │   ├── access.js                  # Admin access request/role RPCs
    │   └── workspaceDrafts.js         # Per-user non-Sales draft CRUD
    └── features/
        ├── storefront/
        │   ├── useStorefrontCatalog.js
        │   └── components/
        │       ├── StoreHeader.jsx
        │       ├── StoreCartButton.jsx
        │       ├── CatalogLoading.jsx
        │       ├── CatalogSections.jsx
        │       ├── CategoryNav.jsx
        │       ├── ProductCard.jsx
        │       ├── ProductOrderLink.jsx
        │       ├── ProductDetailsDialog.jsx
        │       ├── ProductGallery.jsx
        │       ├── StoreCart.jsx
        │       ├── QuantityStepper.jsx
        │       ├── FeatureList.jsx
        │       ├── AboutPage.jsx
        │       ├── StoreFooter.jsx
        │       └── ScrollToTop.jsx
        └── admin/
            ├── AdminWorkspace.jsx
            ├── SiteSettingsManager.jsx
            ├── StorefrontContentEditor.jsx
            ├── AppearanceSettingsEditor.jsx # Loading/admin branding only; NO color controls
            ├── TeamAccessPanel.jsx
            ├── AccountMenu.jsx
            ├── WorkspaceSidebar.jsx
            ├── WorkspaceDraftControls.jsx
            ├── adminNavigation.js
            ├── products/
            │   ├── ProductEditor.jsx
            │   ├── ProductListItem.jsx
            │   └── productUtils.js
            ├── auth/
            │   ├── AdminLogin.jsx
            │   ├── PasswordReset.jsx
            │   └── WorkspaceAccessStatus.jsx
            └── components/
                ├── AdminBottomNav.jsx
                ├── AdminButton.jsx
                ├── AdminNotice.jsx
                ├── AdminState.jsx
                ├── AdminTopbar.jsx
                ├── ConfirmDialog.jsx
                ├── FilterSheet.jsx
                └── ImageUploadField.jsx
```

### Original-workspace files not to copy into the app

- `p_tify_high_end_exotic_pet_care_platform.tsx` is fully commented legacy/mock content, not the app entry.
- `src/App.css`, `src/index.css`, `src/assets/hero.png`, React/Vite starter SVGs, `public/favicon.svg`, and `public/icons.svg` are not imported by the live UI.
- Do not include `src/features/sales/`, sales services, sales CSS, or sales SQL in the rebuilt app.
- The app's runtime image URLs refer to `public/images/`. Root `images/` has duplicate raster assets; do not import both copies.

## 4. Routes and page rendering

The current app uses `location.hash`, `location.pathname`, search parameters, `hashchange`, and `popstate`; it does not use a routing package. Preserve URLs and browser history. Sales routes below are intentionally **not** included.

| URL/state | Screen | Access | Exact behavior |
|---|---|---|---|
| `/` | Storefront | Public | Header, catalog, “coming soon” heading, feature cards, footer; cart/product dialogs as state. |
| `/#about` | About page | Public | Same header shell without search; About content; footer. Title `About us | <brand title>`. |
| `/#admin` | Admin | Admin login/access gate | Default workspace view is Products. |
| `/#admin-products` | Admin Products | Admin | Opens Products view. |
| `/#admin-settings` | Admin Site settings | Admin | Opens Site settings view. |
| `/?view=reset-password` | Password reset | Supabase recovery session | New-password form. |
| `/#reset-password` or Supabase recovery hash (`type=recovery`) | Password reset | Supabase recovery session | Same reset view. |
| `/?product=<id>[&variant=<id>]` | Product details overlay on storefront | Public | Opens product detail; optional variant preselected. Direct link fetches a product not in the first catalog page. |
| `/petify-dashboard` or Sales dashboard hashes | Storefront fallback/not found | Public | **Do not build Sales UI.** Remove Sales navigation/access paths. A legacy path must not expose a Sales screen. |

Admin gate order: if Supabase is unconfigured, show setup prompt; while session/access is checked, show loading; without session, show sign-in/request-access; signed-in non-admin sees access status/request and sign-out actions; approved admin sees workspace. The browser gate is UX only; RLS and RPC checks enforce access.

## 5. Component and interaction catalog

Props below are the JavaScript shapes in the current implementation; types are not declared in source. Keep callbacks and URL/state effects consistent.

### Storefront

| Component/file | Inputs/state | Rendered pieces and interactions |
|---|---|---|
| `App` — `src/App.jsx` | No props. Uses `useStorefrontCatalog`; owns route hash/path, cart, cart notices/validation, search input/query, selected product/variant, scroll state, store-menu visibility. | Renders `StoreHeader`, loading/error/catalog/About, coming-soon heading, `FeatureList`, `StoreFooter`, floating cart, `StoreCart`, `ProductDetailsDialog`, `ScrollToTop`. Search is debounced 250ms. URL query controls product dialog. |
| `useStorefrontCatalog` | No props. State: product pages/count, section lists, settings, initial/loading-more/error states. | `getCatalog()` then pagination via `getMoreCatalogProducts()`; retry restarts initial request. Initial result has 24 products; server pages are 24. |
| `StoreHeader` | Brand/tagline/logo strings; hero pill list; visibility map; cart count and callbacks; About flag; controlled search string/onChange. | Centered branding, search, upper-right cart/menu, optional hero pills. Menu closes on outside pointer/Escape; menu About link switches between `About us`/`Visit store`. |
| `StoreCartButton` | `itemCount:number`, click callback, CSS class. | Inline bag SVG, `Cart` label, animated count and accessible live count. Header and floating version share component. |
| `CatalogSections` | Main/subsection/product arrays, WhatsApp number, cart items, query, server pagination state/callbacks and product callbacks. | Category filtering/search, breadcrumbs/count, grouped sections, 12-at-a-time local reveal then server Load more, empty/error states, product cards. Search fields: title/description/badge/saveTag/section/main-section. |
| `CategoryNav` | Main/subsection arrays, selected IDs, select-all/main/section callbacks. | “All products”, main-category chips, standalone-section chips; selected main shows its subcategory row. |
| `ProductCard` | Product object, WhatsApp number, cart items, add/change/details callbacks. | Product image, title, badge/save tag, Details, size selection, current/old price, discount, Add-to-cart or quantity stepper, WhatsApp order. Combo adds `combo-card`. |
| `ProductOrderLink` | Product, WhatsApp number, combo flag, optional selected variant, compact flag. | Opens `wa.me` in new tab; labels `WhatsApp order`, `Order directly via WhatsApp`, `Order Combo via WhatsApp`, or `WhatsApp unavailable`. |
| `ProductDetailsDialog` | Product, WhatsApp, add/close callbacks, optional variant ID. | Overlay with header `Product details`, Share/close, gallery, product description/specs, size/price radio list, Add to cart, WhatsApp, share status. Escape/backdrop close, focus trap/restore, body scroll lock. |
| `ProductGallery` | Product image array. | Main image, thumbnails, previous/next, touch swipe, zoom overlay; Escape and focus management. |
| `StoreCart` | Items, WhatsApp, brand title, checkout validation/message/retry and item callbacks. | Right drawer; quantity/remove/remove-all, optional name/address/note, total, WhatsApp checkout; focus trap/restore and body scroll lock. |
| `QuantityStepper` | Value, accessible label, decrease/increase callbacks. | Minus/plus control shared by product card and cart. |
| `CatalogLoading` | `{kicker,title,message,imageUrl}`. | Loading illustration and copy, progress bar, six skeleton cards. |
| `FeatureList` | `{title,description}[]`. | `.features-grid` with `.feature-item` cards. |
| `AboutPage` | `{title,introduction,mission,vision,whoWeAre}`. | “A LITTLE ABOUT US”, title/introduction, mission/vision, who-we-are, “Talk with our team →”, “Explore the store”. |
| `StoreFooter` | Footer strings, `{whatsappNumber,phoneDisplay,email,location}`, visibility map. | Location, `tel:` and `mailto:` contacts; independently visible copyright/disclaimer/version. WhatsApp footer link is commented out in source; don't add it. |
| `ScrollToTop` | Click callback and `hasFloatingCart:boolean`. | Back-to-top after scroll exceeds 320px; offset changes when floating cart exists. |

### Admin

| Component/file | Inputs/state | Rendered pieces and interactions |
|---|---|---|
| `AdminDashboard` | Optional admin brand and initial view; consumes workspace access. | Supabase setup/loading/login/request/access status or lazy `AdminWorkspace`. |
| `AdminLogin` | Admin brand, signed-in callback, optional title/description/back link. | Tabs `Sign in` / `Request access`; email/password/show-password, confirm password in request mode; forgot/reset handler, success/error notice, back to store. Current forgot button has no visible label: fix it to display `Forgot password?`. |
| `PasswordReset` | No props. | Supabase recovery session validation and new/confirm password update. |
| `WorkspaceAccessProvider` / `useWorkspaceAccess` | Provider wraps admin route; context exposes session, role, loading/errors, refresh/sign-out. | Auth subscription, cached access and periodic/focus recheck. Hook must remain inside provider. |
| `WorkspaceAccessStatus` | Status, error, request/refresh/sign-out callbacks. | Pending/rejected/no-access message and actions. |
| `ProductManager` (`AdminWorkspace.jsx`) | Session, admin-brand callbacks, optional initial view. | Products/settings views, product/section filters, sorting/search, section CRUD/order/grouping/visibility, product editor, draft recovery, delete undo, mobile filter/nav, confirmations. |
| `SiteSettingsManager` | Admin brand/callback, user ID, main/subsections/products. | Accordion groups for branding/storefront, colors/appearance, and remaining settings. Keep all existing non-color forms and remove palette editing only. |
| `StorefrontContentEditor` | User ID. | Editable store copy, contacts, About copy, features, visibility and footer settings with draft controls. |
| `AppearanceSettingsEditor` | Admin brand, update callback, user ID. | Keep dashboard brand and loading-screen copy/image editing. Replace palette controls with a non-editable fixed theme display or omit color subsection; never save/apply a custom palette. |
| `ProductEditor` | Product/draft, products/section arrays, user ID, cancel/draft/save callbacks. | Product ID/title/type/category/order/stock/description/specs/variants/prices/WhatsApp message/photo/active fields; image upload, crop/order/remove, validation, publish/draft. |
| `ProductListItem` | Product/category title/status and edit/delete/toggle/price/stock callbacks. | Compact product card and quick price/stock/visibility changes. |
| `TeamAccessPanel` | No props. | Admin access request review and role changes. Remove all Sales-role options; preserve only admin access operations if retained in the rebuilt backend. |
| Shared admin controls | Existing prop-driven controls. | `AdminButton`, `AdminNotice`, `AdminState`, `AdminTopbar`, `AdminBottomNav`, `WorkspaceSidebar`, `ConfirmDialog`, `FilterSheet`, `ImageUploadField`, `WorkspaceDraftControls`, `AccountMenu`. Preserve focus/keyboard/error semantics. |

## 6. Visual specification and fixed theme

### Fixed brand colors

**This table overrides the current admin-selectable palette.** Hard-code the values in the rebuilt theme and remove all color customization UI/data flow.

| Purpose | Fixed value |
|---|---|
| Main brand blue | `#1d4ed8` |
| Dark brand blue | `#1e3a8a` |
| White/cards | `#ffffff` |
| Page background | `#ffffff` |
| Main text | `#0f172a` |
| Muted text | `#475569` |
| Borders | `#dbe3ea` |
| Pale blue backgrounds | use blue tint mixed with white, e.g. existing `color-mix(in srgb, var(--primary) 5–8%, white)` rules |

Use blue and white as the visual identity. Do not retain the current amber `#f59e0b` as a configurable accent, or expose `ocean`, `forest`, `sunset`, or `custom`. Where existing CSS uses `--accent` for highlight/focus/discount, use the fixed brand blue or a blue-tinted neutral; do not introduce an orange/yellow accent. Keep neutral red only for destructive/error states.

Theme tokens in CSS:

```css
:root {
  --primary: #1d4ed8;
  --primary-dark: #1e3a8a;
  --accent: #1d4ed8;
  --bg-light: #ffffff;
  --text-dark: #0f172a;
  --text-muted: #475569;
  --card-bg: #ffffff;
  --admin-space-1: 0.25rem;
  --admin-space-2: 0.5rem;
  --admin-space-3: 0.75rem;
  --admin-space-4: 1rem;
  --admin-space-6: 1.5rem;
  --admin-radius-sm: 4px;
  --admin-radius-md: 8px;
  --admin-radius-lg: 12px;
  --admin-control-height: 40px;
  --admin-border: #dbe3ea;
  --store-radius-sm: 12px;
  --store-radius-md: 20px;
  --store-radius-lg: 28px;
  --store-shadow-card: 0 18px 46px -28px rgba(15, 23, 42, 0.36);
}
```

The seven CSS variables remain useful as implementation tokens, but are constants, not admin-editable settings. Do not call `applyColorPalette()` or read/write `site_settings.color_palette` in the rebuilt app.

### Typography, geometry and exact storefront composition

- Global reset sets `box-sizing:border-box`, zero margin/padding and `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif`. When `#site-header` is present, the storefront and descendants use `Arial, Helvetica, sans-serif`.
- The top hero is the actual `#site-header`: full-width, centered blue gradient/radial light decoration, brand/logo/tagline, centered search, right-aligned cart/menu actions, and optional pill row below. **Do not replace it with a conventional horizontal navbar or separate hero banner.**
- Header padding: `max(clamp(5rem, 8vw, 6rem), calc(env(safe-area-inset-top) + 4rem)) 1rem clamp(3.5rem, 7vw, 5rem)`. Header logo max width `min(300px, 68vw)`, max height `112px`; title `clamp(2rem, 5vw, 3.5rem)`; tagline `clamp(1rem, 2vw, 1.2rem)`.
- Search: centered `min(100%,560px)`, 48px high, 16px radius, translucent white, 12px backdrop blur, inline magnifier and placeholder `Search products`.
- Cart/menu actions are upper-right at `top:max(1.25rem, env(safe-area-inset-top))`, `right:clamp(1rem,4vw,2.5rem)`. Both use at least 46px controls, white translucent fill and 14px radius.
- Hero pill row max width `1100px`, centered, wrap enabled, `0.75rem` gap. Pills are white/translucent, 44px minimum height, fully rounded (`50px`).
- Main `.container`: width `min(100%,1480px)`, centered, horizontal padding `clamp(0.75rem,3vw,2rem)`, bottom padding `3rem`.
- Category navigation is a full-bleed-within-container pale blue/white panel with bottom corner radius `22px`, blue border tint, horizontal scrolling chip rows, 48px minimum chip height, rounded chips. It is followed by breadcrumb `Home` and result count.
- Product groups render main heading, nested subsection headings and a product grid. The actual classes are `.catalog-main-group`, `.catalog-product-group`, `.section-title`, `.catalog-subsection-title`, `.grid`.
- Product card uses `.card.product-list-card`; combo adds `.combo-card`. Card contains square 600×600 intrinsic lazy image, contain fit, title/badges/Details, optional variant selector, price/old price/discount and actions. In the narrow/mobile active rules, actions stack in one column; do not force a desktop two-button row on phone.
- `.product-tile-actions .btn` minimum height 44px, radius 9px. Add is primary blue with white text; WhatsApp action is pale blue/white with dark blue text. Cart stepper is white, tinted-blue border, 44px buttons.
- Main `.container` includes the storefront catalog, then configured coming-soon title with `.glow-text` and `.status-dot`, followed by feature cards (`.features-grid`, `.feature-item`). Footer `#site-footer` follows outside main.
- About page max width `960px`, top margin `clamp(1.5rem,5vw,3.5rem)`. Heading card uses `clamp(1.5rem,5vw,3.25rem)` padding, 28px radius, subtle blue/white gradient and card shadow; values appear as two cards; who-we-are is a separate panel; preserve link placement/order.
- Cart drawer width `min(100%,520px)`, `100dvh`, right-side fixed overlay; safe-area top. Items scroll; footer has `max-height:min(50dvh,430px)` and its own scroll. Customer fields use two columns; final note spans full width.
- Product detail overlay has a fixed backdrop and a bounded scrollable dialog. Keep its header (`Product details`, Share, close), gallery/copy/price/action order, and sticky bottom actions on scroll.

### Responsive behavior to match

| Width | Required appearance |
|---|---|
| `<640px` | Store product grid has two columns. Header logo max-height 88px in mobile override; category chips horizontally scroll; product actions stack; fixed cart/back-to-top respect bottom safe-area. |
| `>=640px` | Three product columns. Product actions use the stylesheet's wider-card treatment; ensure no clipping/overflow. |
| `>=1100px` | Four product columns. |
| `>=1440px` | Five product columns. |
| `<=760px` admin | Admin layout changes to mobile: sticky 58px topbar, mobile cards/filter sheet and bottom navigation; desktop sidebar/table treatment changes. |
| `<=420px` admin | Admin content width `calc(100% - 1rem)`; product card padding `0.8rem`. |

Use CSS safe-area insets. Inputs in mobile forms must avoid iOS focus zoom (existing form rules use 16px where needed). Do not set generic breakpoints that alter these listed column counts.

### Motion, states, icons

- `storefront-enter`: `0.65s cubic-bezier(0.2,0.65,0.3,1) both`.
- Catalog loading: floating illustration `catalog-float 2.4s ease-in-out infinite`; progress `catalog-progress 1.5s ease-in-out infinite`; skeleton shimmer `catalog-shimmer 1.6s linear infinite`; exactly six skeleton cards.
- Cart backdrop: `store-cart-backdrop-in 0.2s ease both`; drawer: `store-cart-drawer-in 0.28s cubic-bezier(0.2,0.65,0.3,1) both`; count pop `cart-count-pop 0.24s ease-out both`.
- Common hover/focus transition durations are approximately `0.18–0.3s`; pill active `scale(0.98)`. Use `prefers-reduced-motion: reduce` and avoid smooth scrolling under reduced motion.
- Inline SVGs are used for bag, search, WhatsApp, close, gallery and plus/minus. Preserve stroke/fill style and accessible labels; do not replace with emoji/icon-font.
- Errors use visible retry/action and `role="alert"`; success/info notices use `role="status"`. Dialogs close on Escape/backdrop, trap focus and restore prior focus where currently implemented.

### Actual class hooks for key areas

```text
Header: #site-header, .store-header-inner, .store-header-brand, .brand-title,
.brand-logo, .brand-tagline, .store-search, .store-header-actions,
.store-header-cart, .store-header-menu, .store-menu-trigger, .hero-pills, .pill

Catalog: .container, .store-catalog, .category-nav, .category-chip-row,
.category-chip, .catalog-context, .catalog-breadcrumbs, .catalog-result-count,
.catalog-main-group, .catalog-product-group, .section-title, .catalog-subsection-title,
.grid, .card.product-list-card, .product-tile, .product-tile-image-button,
.product-tile-image, .product-tile-content, .product-tile-heading,
.product-tile-price, .product-discount, .product-tile-actions,
.btn.btn-add-to-cart, .btn.btn-direct-order, .product-tile-whatsapp

Dialogs/cart: .product-details-overlay, .product-details-dialog,
.product-details-header, .product-details-content, .product-details-gallery,
.product-details-copy, .price-box, .card-actions, .store-cart-overlay,
.store-cart-backdrop, .store-cart-drawer, .store-cart-items,
.store-cart-item, .store-cart-footer, .store-cart-checkout

Lower page: .glow-text, .status-dot, .features-grid, .feature-item,
.about-page, .about-page-heading, .about-page-values, .about-value-card,
.about-who-card, .about-contact-link, #site-footer

Admin: .admin-shell, .admin-topbar, .admin-content, .workspace-nav,
.admin-page-panel, .admin-product-card, .admin-primary-button,
.admin-secondary-button, .admin-delete-button, .admin-bottom-nav
```

The source stylesheet has repeated generations of selectors. For pixel matching, reproduce the **effective final cascade**, not an early declaration copied in isolation. Do not rely on this summary in place of the CSS classes above and captured reference screenshots.

## 7. State, persistence, and data flow

- Initial catalog/settings/categories load in parallel from Supabase. `getCatalog()` loads active products ordered by `display_order`, exact count, range `0–23`; active subsections and main sections ordered by display order; singleton settings `id='storefront'`. Catalog errors render `Catalog service is unavailable. Products could not be loaded from Supabase.` with `Retry`; do not substitute fake/demo products.
- Additional catalog pages load in batches of 24. `CatalogSections` reveals 12 of the loaded matching products initially; each local Load more reveals another 12 before fetching another server page.
- Search input is debounced 250ms, trimmed and case-insensitive; filters loaded products by title/description/badge/saveTag/category/parent names.
- Cart key in `localStorage`: `petify-store-cart`. Restore checks productId string, positive safe-integer quantity, finite nonnegative price. Invalid records are removed and announced. On catalog availability, cart products/variants are revalidated; missing/disabled products/variants are removed; current title/image/price refreshed. Validation network failure blocks checkout and offers retry. Do not replace localStorage with sessionStorage.
- Cart item identity is `${product.id}:${variant.id ?? ""}`. Adding an existing item increments quantity; decrement to zero removes it. No inventory is reserved or checked on storefront.
- Product detail query is `?product=<id>&variant=<id>`. Opening uses `history.pushState`; closing removes both query keys with `replaceState`. Preserve rest of URL/search params. Deep-link product is fetched from active catalog if not already in loaded pages.
- Theme is **not dynamic in the rebuild**. Remove palette fetch/application/setting and hard-code fixed tokens in Section 6. Store settings still provide text/assets/visibility, not colors.
- Admin workspace recovery uses `sessionStorage["petify-admin-workspace:<userId>"]`; uploadable browser `File` objects cannot be restored. Cloud drafts use per-user/type/key rows and a 900ms debounce/serialized save; preserve restore/save/discard/error UI for supported editors. No palette draft.
- Auth session uses Supabase; role check is server-side; cached access status is short-lived (five minutes), rechecked on focus/visibility/interval; session lifetime target 10 hours.
- No realtime subscriptions or query-cache library are present. Do not add speculative stale/demo fallback behavior.

## 8. Supabase schema and security

### Only tables needed for this rebuild

Remove Sales-only tables and APIs. Storefront/admin data uses:

| Table | Fields and constraints |
|---|---|
| `products` | `id text PK`, `type text CHECK ('single','combo')`, `section_id text FK catalog_sections.id ON UPDATE CASCADE ON DELETE RESTRICT`, `badge/title/description text`, `specs/images/variants jsonb` default `[]`, variants JSON array check, `save_tag/price/old_price/default_whatsapp_msg text`, `is_active boolean default true`, `display_order integer default 0`, created/updated timestamps. Admin writes; public selects active products. |
| `catalog_main_sections` | `id text PK`, `title text NOT NULL`, `display_order integer default 0`, timestamps. Public read; admin CRUD. |
| `catalog_sections` | `id text PK`, `title text NOT NULL`, `display_order integer default 0`, `is_active boolean default true`, nullable `main_section_id` FK to main section (`ON UPDATE CASCADE ON DELETE SET NULL`), timestamps. Public read active; admin CRUD. |
| `site_settings` | Singleton `id text PK CHECK(id='storefront')`; logo/favicon URLs, brand title/tagline, WhatsApp/phone/email/location, features/About/hero pills/visibility JSON, loading-screen/admin-brand JSON, footer and coming-soon text, updated timestamp. **Do not use color_palette** in the rebuild. |
| `admin_users` | `user_id uuid PK FK auth.users ON DELETE CASCADE`, created timestamp. Bootstrap and role changes are privileged/admin-only. |
| `access_requests` (if retaining self-service admin request) | `id uuid PK`, `user_id uuid FK auth.users ON DELETE CASCADE`, email, status pending/approved/rejected, requested/reviewed times, reviewer FK; one pending request per user. Keep only admin access workflow; no Sales role. |
| `workspace_drafts` (if retaining current draft UX) | `(user_id,draft_type,draft_key)` composite PK, JSON payload, created/updated; draft types only `product`, `site-content`, `site-appearance` (non-color admin brand/loading), `site-assets`. No `sale` draft type. |
| `product_inventory` (if preserving admin stock editor) | `product_id text PK FK products ON DELETE CASCADE`, integer `quantity >= 0`, default 0. No Sales stock-deduction triggers or customer-facing stock check. |
| `invoices` | Admin-only invoice records with a unique invoice number, configurable business header visibility, customer details, catalog/custom line items, dates, notes, subtotal/tax/total, creator, and timestamps. RLS permits authenticated Petify admins only. |

Current settings defaults include `brand_title='Pëtify'`, `tagline='Pure love, premium care'`, `whatsapp_number='919745001101'`, `phone_display='+91 97450 01101'`, `email='petify.shopping@gmail.com'`, `location='Kerala, India'`, footer `Petify Group`, copyright `© Petify Group. All rights reserved.`, disclaimer `*Not for human consumption. Store in a cool, dry place.`, version `1.0.0`, coming-soon `Something big is coming soon`. Defaults and copy are configurable in the admin; they must not be substituted with invented text.

Default features:

1. `Exotic Pets & Birds` — `Healthy, hand-reared birds, small pets, and expert care guidance.`
2. `Fish & Specialty Foods` — `High-protein nutritional feeds for Channa, Arowana, Discus & more.`
3. `Cages & Housing` — `Durable, comfortable enclosures tailored for birds and small pets.`
4. `Pet Care Accessories` — `Essential toys, grooming supplies, and everyday care essentials.`

### Security and storage

- Public/anon can select only `products.is_active=true`, active catalog sections, all main sections, and storefront settings. `admin_users` cannot be written by browser role. Only admins can modify products/sections/settings/inventory.
- `is_petify_admin()` is a stable role predicate; admin-only RLS policies protect write operations. Client-side gate does not replace RLS.
- Storage bucket `product-images` is public-read; admin-only insert/update/delete. Product, logo, favicon, loading assets share the bucket.
- Supabase Auth email/password. First admin is added through privileged SQL Editor/service-side procedure; never allow public signup to self-assign admin.
- Avoid bringing over Sales tables/functions/triggers, Sales role policies, Sales payment/customer data, or `get_sales_dashboard_metrics`. The separate `invoices` table is admin-only and stores no payment transaction.

### Query inventory

| Source | Query and use |
|---|---|
| `services/catalog.js:getCatalog` | Parallel active `products` first range (0–23, ordered), active `catalog_sections`, all `catalog_main_sections`, and `site_settings` singleton; About content compatibility read. |
| `getMoreCatalogProducts(offset,pageSize=24)` | Next range of active products, same order and exact count. |
| `getCatalogProductsByIds(ids)` | Active product lookup for saved-cart revalidation/shared deep link. |
| `services/admin.js:getAdminProducts` | All products ordered by display order plus `product_inventory` quantities. |
| `getAdminSections/getAdminMainSections` | Full section rows for admin, ordered by display order. |
| Site settings getters | Read storefront logo/favicon, hero pills, content, appearance loading/admin brand. Do not read color_palette in rebuilt frontend. |
| Admin service mutations | Insert/update/delete product/section/main-section; update product visibility/price/stock/order/group; update singleton settings; upload/delete objects in `product-images`. |
| `services/access.js` | Request current user access and admin review/team operations using guarded access RPCs/tables. |
| `services/workspaceDrafts.js` | Read/upsert/delete user-owned permitted non-Sales drafts. |

### Admin access RPCs retained (admin-only role model)

The original `07-admin-access-requests.sql` combines Sales authorization with admin access approval. Preserve approval UX but narrow valid workspace roles to `admin` only:

| RPC/trigger | Required behavior |
|---|---|
| `is_petify_admin()` | Stable SECURITY DEFINER predicate for the current authenticated user in `admin_users`; restricted search path; authenticated execution only. |
| `get_my_access()` | Return current user's `is_admin` and request status (`approved`, `pending`, `rejected`, or `none`). |
| `request_access()` | Require authenticated email; idempotently create or return the current user's pending admin-access request. |
| `get_access_team()` | Admin-only pending requests and current admins, with IDs/emails/timestamps. No Sales list. |
| `approve_access_request(uuid,text)` | Admin-only; accept only role `admin`; approve the pending request and add `admin_users` record transactionally. Reject other role strings. |
| `approve_access_by_email(text,text)` | Admin-only wrapper around request approval; admin role only. |
| `reject_access_request(uuid)` | Admin-only pending request rejection. |
| `revoke_admin(uuid)` | Admin-only; prevent self-revocation and removal of the last admin. |
| `create_access_request_for_auth_user()` | Auth signup trigger creates a pending request; never grants admin automatically. |

Do not copy Sales predicates (`has_sales_access`, `is_petify_sales_user`), Sales-user tables, role branches, or policies. Build and test fresh-project SQL for only the tables/policies and RPC contracts in this section.

## 9. Feature behavior

### Catalog, categories, search and products

- “All products” clears both category selections. Main category selection clears subsection. Selecting a subsection of a different/unparented group clears main selection as needed. Standalone sections appear with main chips.
- Breadcrumb begins `Home`; selected main/subsection titles append with `/`. Result count uses `products`/`products+` and singular `product` only when exactly one and no more server products.
- Cards use first product image, `loading="lazy"` and `decoding="async"`; image failure swaps to inline 400×300 SVG with `#e2e8f0` fill and “No Image” in `#94a3b8`.
- Card shows title, optional badge, combo `saveTag`, Details action, optional Size `<select>`, current formatted price or `Price on request`, struck-through higher old price and rounded discount percentage. `Add to cart` disabled if no selected variant with price >0.
- Details uses first and remaining images in gallery, description, standard-product specs, variants radio group `Available sizes & prices`, prices, Add to cart and direct WhatsApp order. Share copies current URL with product/selected variant; copy failure is announced.
- `Load more products` reveals 12 already-loaded matches at a time, then fetches another 24. Loading state is `Loading products…`; more-page error offers Retry.
- Admin product filters: search title/ID; visibility All/Active/Hidden; subsection; sort display/name/price low/high.
- Product fields: category/subcategory, type `single`/`combo`, badge, title/slug ID, display order, stock, description, standard specs (one per line), combo save tag, simple or variant pricing, default WhatsApp message, photos, active/hidden. Variant labels unique ignoring case; prices must parse as valid nonnegative amounts; stock integer 0–2147483647.
- Product IDs use lowercase ASCII slug with hyphens; reject duplicate custom IDs. Existing ID read-only. Photo upload max 10 MiB per file; resize max dimension 1800; WebP quality `.82`; progress/error surfaced. Save product and stock with partial-save error shown if stock update fails. Product delete has five-second undo.

### Cart and WhatsApp

- Cart is a drawer, not a checkout page. Header says `Your {brandTitle} Cart`, eyebrow `YOUR SELECTION`; empty text `Your cart is empty`, action `Continue browsing`, explanatory copy `Explore the catalog and add your favorites. You can still order any item directly via WhatsApp.`
- Filled cart shows image, title, optional variant, unit price, stepper, line total and Remove; Remove all at top; Grand total at bottom.
- Fields `Name (optional)`, `Address (optional)`, `Note (optional)`. Notice: `Shipping and availability are confirmed by our team on WhatsApp.` Checkout button `Order via WhatsApp`; final note `Your order request opens directly in WhatsApp. No online payment is taken here.`
- Checkout waits until saved cart product/variant prices and availability are verified. Missing configured number shows `WhatsApp checkout is unavailable because a contact number has not been configured.`
- Cart message template (line breaks and punctuation matter):

  ```text
  Hello! I'd like to place an order:

  • {title} ({variantLabel})
    Qty: {quantity} × {formatted unit price} = {formatted line total}

  Grand total: {formatted total}

  Name: {name}
  Address: {address}
  Note: {note}

  Please confirm availability and delivery details.
  ```

  Variant parentheses and empty customer lines are omitted. Phone is stripped to digits and URL encoded as `https://wa.me/{phone}?text={encodeURIComponent(message)}`.
- Direct item message:

  ```text
  Hello, I'm interested in {product.title}.
  Option: {variant.label}
  Price: {formatted INR price}

  {product.defaultWhatsappMsg}
  ```

  Omit empty option/price/default message portions; join default message after a blank line. Direct link labels are exactly as in `ProductOrderLink`.

### About, footer and loading

- About defaults from `src/config/siteContent.js`:

  ```text
  Title: Thoughtful care for extraordinary companions
  Introduction: Pëtify brings together thoughtfully selected pet essentials, specialized nutrition, and habitat products to support the everyday wellbeing of the animals we love.
  Mission: To make thoughtful pet care easier by bringing useful products and caring guidance together in one place.
  Vision: A world where every companion, big or small, feathered or finned, has the care, nutrition, and environment it needs to thrive.
  Who we are: Pëtify is a pet-care store for people who want to make informed, caring choices for their companions. Our collection brings everyday essentials together with specialist products for a range of pets. Have a question about a product? Our team is here to help.
  ```
- About headings/links: `A LITTLE ABOUT US`, `Our mission`, `Our vision`, `THE PEOPLE BEHIND THE CARE`, `Who we are`, `Talk with our team →`, `Explore the store`.
- Footer shows location, phone/email links and optional legal/version lines; visibility keys `footer`, `footer_copyright`, `footer_disclaimer`, `footer_version`.
- Loading defaults: kicker `STORE CATALOG`; title `Getting the shop ready`; message `Fetching the latest products for you.`; image `/images/bird.png`.
- Failure state copy: `Catalog service is unavailable. Products could not be loaded from Supabase.` with `Retry`. Do not render header/catalog with fabricated fallback content after a catalog failure.

### Admin: Site settings and access

- Keep existing accordion groups, labels and all non-color settings. Branding/storefront includes brand title/tagline/contact details/footer/coming-soon/About copy, features/visibility, logo/favicon, hero navigation.
- Hero navigation: `Add link` creates `New link`; label required after trim; targets No destination, Header, populated main category, populated subsection, Footer. Applying saves and clears cloud draft; failures state whether server save succeeded but draft cleanup failed.
- Logo: JPEG/PNG/WebP ≤5 MiB; preview; framing `Keep full image`, `Crop wide (3:1)`, `Crop square (1:1)`; X/Y crop sliders; `Apply logo`. Favicon ≤2 MiB; `Apply favicon`. Browser assets use Storage public URLs.
- Keep loading-screen image/kicker/title/message editor and admin dashboard name/label. Remove palette controls entirely and use fixed colors from Section 6; appearance screen must not show selectable palette cards, color inputs or editable hex values.
- Team access: pending requests, approve/reject/revoke under admin-only permission. Remove Sales role choice/access and list. If account signup remains, approval grants admin access only.
- Admin access login: `Admin sign in`; tabs `Sign in` and `Request access`; signup copy `Create an account. An admin will review your request.` and success `Request sent. An admin must approve it before you can sign in to the workspace.`; mismatch `The passwords do not match.`; generic failure `We could not complete that request. Check your details and try again.`.

## 10. Utilities and exact business rules

| Rule/helper | Behavior |
|---|---|
| `parseProductPrice(value)` | Stringify, remove all except digits/dot/minus, `parseFloat`; non-finite becomes 0. |
| `formatProductPrice(value)` | `Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:0,maximumFractionDigits:2})`. |
| `productOptions(product)` | Use non-empty `variants`; else if `price` is truthy return one default option with empty ID/label and parsed current/old prices; else return `[]`. |
| Discount | Only when old price > current price > 0; `Math.round((1-current/old)*100)`. |
| `slugify(title)` | Lowercase; Unicode NFKD; remove combining marks U+0300–036F; non-ASCII alphanumeric runs → `-`; trim edge hyphens. |
| Product direct phone | `String(whatsappNumber ?? "").replace(/\D/g,"")`; if no digits, disable link and label `WhatsApp unavailable`. |
| Cart key | `${product.id}:${variant.id ?? ""}`; add increments same key, quantity decrement to 0 removes line. |
| Session expiration | Ten hours; check on timer and page visibility. |
| Image compression | Browser bitmap/canvas; resize only above max dimension; optional focal crop; WebP quality `.82`; preserve original if no transform and WebP is not smaller; revoke object URLs on change/unmount. |
| Product placeholder | Inline 400×300 SVG; rect `#e2e8f0`, text `#94a3b8`, label `No Image`. |

## 11. Known defects and targeted quality fixes

Only fix issues that are necessary for parity, security or the allowed scope; do not turn this rebuild into a redesign.

| Priority | Existing issue | Rebuild action |
|---|---|---|
| High | `AdminLogin.jsx` forgot-password button has its text commented out; it is visually blank though handler works. | Render visible accessible text `Forgot password?`; preserve reset flow. |
| Resolved | Fresh section setup now inserts `singles` and `combos` before assigning existing products in `03-catalog-sections.sql`. | Keep the seed before the product update; validate on a fresh Supabase database. |
| High | The current app permits admin color changes, contrary to this rebuild request. | Replace dynamic palette with fixed Section 6 constants; remove admin color editor, palette API, DB field usage and draft. |
| High | Current app includes Sales routes/screens/SQL, contrary to this rebuild request. | Exclude Sales from UI, route, services, CSS, settings, schema, RPCs, storage of drafts and navigation. |
| Medium | Store search filters products currently loaded; later server pages may contain matches. | Preserve presentation; improve search only if complete results and original loading/empty behavior can be retained. |
| Medium | Existing active stylesheet is very large with duplicate/overridden selectors. | For first pass keep class names and effective cascade. Cleanup only after screenshot comparisons demonstrate identical output. |
| Medium | Sales history is unpaginated in original. | Not applicable: Sales is excluded entirely. |
| Medium | Section reorder and main-section/hero-link cleanup use separate requests, so partial failure can leave inconsistent order/navigation. | Prefer transactional mutation if preserving same success/error UX; otherwise report partial success explicitly. |
| Medium | Product DB save and stock write are separate; stock failure can follow successful product save. | Preserve explicit partial-save message and editor state. |
| Low | Root commented mockup and Vite starter styles/assets are not production UI. | Do not copy or use them as design references. |
| Low | Some dialogs duplicate focus/scroll-lock code; mobile filter sheet has less focus management. | May consolidate only if Escape, focus, scroll, backdrop and animation behavior match. |
| Security | Browser anon key is public; frontend gate alone is not authorization. | Enforce admin restrictions in RLS/RPC and keep service-role key server-only. |

## 12. Implementation order and parity checklist

### Build order

1. Capture original screenshots from the existing implementation before coding: `/`, `/#about`, `/#admin`, Products, Site settings, loading, product dialog, empty/filled cart. Capture widths 390px, 640px, 1100px and 1440px.
2. Build shell/metadata and fixed blue-white tokens. Use the current header/catalog DOM and class hooks; do not create a new navigation/hero design.
3. Add storefront settings/catalog Supabase queries and initial loading/retry. Confirm exact order and 24-row server page.
4. Implement category chips, grouping, breadcrumbs, 12-item local reveal, load-more, search and product cards.
5. Implement product details/query URL/gallery/share and exact WhatsApp direct link.
6. Implement persisted cart, current-price revalidation, checkout validation and exact WhatsApp message.
7. Implement About/feature/footer content and all visibility controls.
8. Implement admin auth/access and Products workspace, then non-color Site settings. No Sales route/code/data; no color editor.
9. Apply RLS/storage policies, seed catalog sections before products, validate admin access and image uploads on a fresh Supabase project.
10. Compare reference screenshots/flows at each breakpoint; only then refactor CSS or shared components.

### Parity checklist

- [ ] Main header is the centered blue-gradient hero with logo/title/tagline, search, upper-right cart/menu and pill row; no replacement navbar/extra hero.
- [ ] Existing text, defaults, assets, category labels, badges, button order and footer copy match.
- [ ] Theme is fixed blue/white; no color picker/preset/hex form/site palette mutation.
- [ ] Main categories, subcategories, standalone sections, breadcrumbs, search, count, empty state and 12/24 pagination behave correctly.
- [ ] Product card image/fallback/variant/price/old-price/discount and Details/Add/WhatsApp behavior match.
- [ ] Product URL query and variant deep link; Share copies link; gallery thumbnails/arrows/swipe/zoom and dialog keyboard behavior.
- [ ] Cart persists in `localStorage`, groups variant keys, updates quantities and verifies current catalog prices before checkout.
- [ ] Direct/cart WhatsApp message punctuation, blank lines, optional fields, phone normalization and encoding match.
- [ ] About content, feature cards, footer contacts and visibility toggles match.
- [ ] Admin login/request/approval/reset/session expiration and admin-only authorization match; forgot label is visible.
- [ ] Products CRUD, sections, stock, images/crops, drafts, filters, mobile admin nav and five-second deletion undo match.
- [ ] Admin invoices are available at `/#admin-invoice`; live preview is user-toggleable beside the editor, full-page view is optional, header/logo controls open in an Invoice settings popup and persist with Save invoice, customer name/phone/address/delivery-partner details are optional, catalog/custom lines can be added below current lines, and records save/reopen, print to PDF, and share as an image.
- [ ] Site settings retain brand/content/assets/navigation/loading/admin branding/team access except Sales and palette editing.
- [ ] No Sales dashboard route, screen, menu, settings, table, RPC, service, stylesheet or Sales-specific access role.
- [ ] Breakpoints: product grid two columns <640, three >=640, four >=1100, five >=1440; admin mobile switch <=760; 420px admin width rule.
- [ ] Loading skeletons count six; animation durations/easing and reduced-motion behavior match.
- [ ] Cart/product dialogs preserve focus, Escape/backdrop close, scroll lock, and focus restoration.
- [ ] Errors remain visible and actionable; no mock product fallback when Supabase is unavailable.

## 13. Environment and deployment

1. Use Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`; set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; restart Vite after changing env.
4. Commands: `npm run dev`, `npm run lint`, `npm run build`, `npm run preview`. `npm run deploy` publishes `dist/` to GitHub Pages.
5. Create Supabase project; enable email/password auth and configure allowed production/localhost redirect URLs including `/?view=reset-password`; keep service-role secret server-side.
6. Apply only storefront/admin tables, policies, admin access functions and `product-images` Storage policy. Do not apply Sales migrations. Seed `catalog_sections` rows for `singles` and `combos` before product rows reference them.
7. Bootstrap the owner using privileged SQL Editor, not client-side signup:

   ```sql
   insert into public.admin_users(user_id)
   select id from auth.users
   where lower(email)=lower('owner@example.com')
   on conflict(user_id) do nothing;
   ```

8. Test anon storefront read, admin login/request, denied non-admin mutation, admin CRUD, image public read and unauthorized Storage write.

## 14. Known gaps and uncertainty

- `styles.css` is the actual imported stylesheet and has multiple generations of repeated selectors; screenshots/computed styles are required to guarantee visual parity. This blueprint gives effective storefront layout and class hooks but cannot replace runtime screenshot comparison.
- The raster assets were checked for dimensions, not visually decoded in this task. Use the actual `/public/images/` files when matching logo/loading/favicon appearance.
- Existing `.env` values were intentionally not read or included; only variable names are specified.
- `package-lock.json` contains transitive package metadata that is not needed to reproduce UI; direct dependency versions are recorded in Section 2.
- Original SQL files include Sales-specific schema and policy changes. They must not be applied wholesale for this reduced scope. Build/test a clean storefront/admin schema containing only the tables and policies in Section 8.
- The user-requested fixed blue-white treatment intentionally differs from the original admin-editable palette and supersedes it. If “blue and white” is intended to use a different exact blue than current `#1d4ed8`, the codebase provides no additional canonical blue; this blueprint uses the existing primary brand blue and white.
