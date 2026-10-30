export const DEFAULT_COLOR_PALETTE = {
  preset: "petify",
  colors: {
    primary: "#1d4ed8",
    primaryDark: "#1e3a8a",
    accent: "#f59e0b",
    background: "#f8fafc",
    text: "#0f172a",
    muted: "#475569",
    card: "#ffffff",
  },
};

export const DEFAULT_LOADING_SCREEN = {
  kicker: "STORE CATALOG",
  title: "Getting the shop ready",
  message: "Fetching the latest products for you.",
  imageUrl: "/images/bird.png",
};

export const DEFAULT_ADMIN_BRAND = {
  name: "Petify",
  label: "Catalog",
};

const cssColorVariables = {
  primary: "--primary",
  primaryDark: "--primary-dark",
  accent: "--accent",
  background: "--bg-light",
  text: "--text-dark",
  muted: "--text-muted",
  card: "--card-bg",
};

export function normalizeColorPalette() {
  return {
    preset: DEFAULT_COLOR_PALETTE.preset,
    colors: { ...DEFAULT_COLOR_PALETTE.colors },
  };
}

export function normalizeLoadingScreen(loadingScreen) {
  return {
    ...DEFAULT_LOADING_SCREEN,
    ...loadingScreen,
    kicker: typeof loadingScreen?.kicker === "string" ? loadingScreen.kicker : DEFAULT_LOADING_SCREEN.kicker,
    title: typeof loadingScreen?.title === "string" ? loadingScreen.title : DEFAULT_LOADING_SCREEN.title,
    message: typeof loadingScreen?.message === "string" ? loadingScreen.message : DEFAULT_LOADING_SCREEN.message,
    imageUrl: typeof loadingScreen?.imageUrl === "string" && loadingScreen.imageUrl
      ? loadingScreen.imageUrl
      : DEFAULT_LOADING_SCREEN.imageUrl,
  };
}

export function normalizeAdminBrand(adminBrand) {
  return {
    name: typeof adminBrand?.name === "string" && adminBrand.name.trim()
      ? adminBrand.name.trim()
      : DEFAULT_ADMIN_BRAND.name,
    label: typeof adminBrand?.label === "string" && adminBrand.label.trim()
      ? adminBrand.label.trim()
      : DEFAULT_ADMIN_BRAND.label,
  };
}

export function applyColorPalette(palette) {
  const { colors } = normalizeColorPalette(palette);
  for (const [key, variable] of Object.entries(cssColorVariables)) {
    document.documentElement.style.setProperty(variable, colors[key]);
  }
}
