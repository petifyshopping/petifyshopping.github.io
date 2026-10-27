export const SITE_SETTINGS_VIEWS = [
  { id: "site-header", label: "Header", description: "Store name, tagline, visibility, and navigation.", section: "header" },
  { id: "site-about", label: "About", description: "Your story, mission, vision, and introduction.", section: "about" },
  { id: "site-footer", label: "Footer", description: "Contact details, footer text, and legal notes.", section: "footer" },
  { id: "site-storefront", label: "Store sections", description: "Catalog visibility, features, and coming-soon content.", section: "storefront" },
  { id: "site-brand-assets", label: "Brand assets", description: "Store logo and browser favicon.", section: "brand-assets" },
  { id: "site-appearance", label: "Branding & loading", description: "Admin dashboard identity and loading screen.", section: "appearance" },
];

const settingsViewIds = new Set(SITE_SETTINGS_VIEWS.map(({ id }) => id));

export function isSiteSettingsView(view) {
  return settingsViewIds.has(view) || view === "site-settings";
}

export function normalizeAdminView(view) {
  if (view === "site-team") return "profile";
  if (view === "site-settings") return "site-settings";
  return view === "products" || view === "customers" || view === "profile" || settingsViewIds.has(view) ? view : "products";
}

export function createAdminNavigationItems(activeView, onSelect) {
  return [
    {
      id: "products",
      label: "Products",
      icon: "products",
      active: activeView === "products",
      onClick: () => onSelect("products"),
    },
    {
      id: "customers",
      label: "Customers",
      icon: "customers",
      active: activeView === "customers",
      onClick: () => onSelect("customers"),
    },
    {
      id: "settings",
      label: "Site settings",
      icon: "settings",
      active: isSiteSettingsView(activeView),
      onClick: () => onSelect("site-settings"),
    },
    {
      id: "profile",
      label: "Profile",
      icon: "team",
      active: activeView === "profile",
      onClick: () => onSelect("profile"),
    },
  ];
}
