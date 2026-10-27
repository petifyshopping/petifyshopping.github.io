import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import AboutPage from "./features/storefront/components/AboutPage.jsx";
import CatalogLoading from "./features/storefront/components/CatalogLoading.jsx";
import CatalogSections from "./features/storefront/components/CatalogSections.jsx";
import FeatureList from "./features/storefront/components/FeatureList.jsx";
import ScrollToTop from "./features/storefront/components/ScrollToTop.jsx";
import StoreFooter from "./features/storefront/components/StoreFooter.jsx";
import StoreHeader from "./features/storefront/components/StoreHeader.jsx";
import { getCatalogProductsByIds } from "./services/catalog.js";
import useStorefrontCatalog from "./features/storefront/useStorefrontCatalog.js";
import { parseProductPrice, productOptions } from "./lib/productPricing.js";
import { getCustomerOrderContactDetails } from "./lib/customerOrderDetails.js";
import { WorkspaceAccessProvider } from "./hooks/WorkspaceAccessProvider.jsx";
import { supabase } from "./lib/supabase.js";
import {
  createCustomerOrder,
  getCustomerAccount,
  saveCustomerCart,
} from "./services/customers.js";
import { signOutCustomer } from "./services/customerAuth.js";
import {
  DEFAULT_LOADING_SCREEN,
  applyColorPalette,
  normalizeColorPalette,
  normalizeLoadingScreen,
} from "./config/siteAppearance.js";

const AdminDashboard = lazy(() => import("./AdminDashboard.jsx"));
const SalesPortal = lazy(() => import("./features/sales/SalesPortal.jsx"));
const PasswordReset = lazy(() => import("./features/admin/auth/PasswordReset.jsx"));
const CustomerAccount = lazy(() => import("./features/storefront/components/CustomerAccount.jsx"));
const StoreCart = lazy(() => import("./features/storefront/components/StoreCart.jsx"));
const ProductDetailsDialog = lazy(() => import("./features/storefront/components/ProductDetailsDialog.jsx"));
const CART_STORAGE_KEY = "petify-store-cart";
const DEFAULT_DOCUMENT_TITLE = "Pëtify | Pure love, premium care";

function isPasswordResetLocation(search, hash) {
  const queryParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
  return queryParams.get("password-reset") === "1"
    || queryParams.get("view") === "reset-password"
    || queryParams.get("type") === "recovery"
    || queryParams.get("error_code") === "otp_expired"
    || hash === "#reset-password"
    || hashParams.get("type") === "recovery"
    || hashParams.get("error_code") === "otp_expired";
}

function readStoredCart() {
  try {
    const rawCart = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!rawCart) return { items: [], notice: "" };
    const items = JSON.parse(rawCart);
    if (!Array.isArray(items)) throw new TypeError("Stored cart is not a list.");
    const validItems = items.filter((item) => (
      item
      && typeof item.productId === "string"
      && Number.isSafeInteger(item.quantity)
      && item.quantity > 0
      && item.quantity <= 99
      && Number.isFinite(item.price)
      && item.price >= 0
    ));
    return {
      items: validItems,
      notice: validItems.length === items.length ? "" : "Some invalid items were removed from your saved cart.",
    };
  } catch (storageError) {
    console.error("Could not restore the saved cart.", storageError);
    return { items: [], notice: "Your saved cart could not be restored on this device." };
  }
}

function mergeCartItems(savedItems, guestItems) {
  const items = new Map();
  for (const item of [...savedItems, ...guestItems]) {
    if (
      !item
      || typeof item.productId !== "string"
      || !Number.isSafeInteger(item.quantity)
      || item.quantity < 1
      || !Number.isFinite(item.price)
      || item.price < 0
    ) continue;
    const key = item.key ?? `${item.productId}:${item.variantId ?? ""}`;
    const existing = items.get(key);
    items.set(key, {
      ...item,
      key,
      productId: String(item.productId),
      variantId: String(item.variantId ?? ""),
      quantity: Math.min(99, (existing?.quantity ?? 0) + item.quantity),
    });
  }
  return [...items.values()];
}

function addCustomerDetailsToOrderLink(link, profile, address, enabledFields) {
  const url = new URL(link);
  const existingMessage = url.searchParams.get("text") ?? "";
  const customerDetails = [
    profile.full_name ? `Name: ${profile.full_name}` : "",
    ...getCustomerOrderContactDetails(profile, address, enabledFields),
  ].filter(Boolean);
  url.searchParams.set("text", [existingMessage, ...customerDetails].join("\n\n"));
  return url.toString();
}

export default function App() {
  const {
    products,
    totalProducts,
    sections,
    mainSections,
    settings,
    loading,
    loadingMore,
    loadMoreError,
    error,
    retry,
    loadMore,
  } = useStorefrontCatalog();
  const [routeHash, setRouteHash] = useState(window.location.hash);
  const [routePath, setRoutePath] = useState(window.location.pathname.replace(/\/+$/, "") || "/");
  const [customerSession, setCustomerSession] = useState(null);
  const [customerAuthReady, setCustomerAuthReady] = useState(!supabase);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [selectedCustomerAddressId, setSelectedCustomerAddressId] = useState("");
  const [customerCartUserId, setCustomerCartUserId] = useState("");
  const [customerAccountError, setCustomerAccountError] = useState("");
  const [customerAccountErrorUserId, setCustomerAccountErrorUserId] = useState("");
  const [customerAccountMessage, setCustomerAccountMessage] = useState("");
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const isAdminRoute = routeHash === "#admin"
    || routeHash === "#admin-settings"
    || routeHash === "#admin-products"
    || routeHash === "#admin-forgot-password";
  const isAboutRoute = routeHash === "#about";
  const isSalesPortalRoute = routePath === "/petify-dashboard"
    || (routePath === "/" && (routeHash === "#sales-dashb" || routeHash.startsWith("#petify-dashboard")));
  const isPasswordResetRoute = isPasswordResetLocation(window.location.search, routeHash);
  const [showScrollTop, setShowScrollTop] = useState(window.scrollY > 320);
  const [storedCart] = useState(readStoredCart);
  const [cart, setCart] = useState(storedCart.items);
  const cartRef = useRef(storedCart.items);
  const [cartNotice, setCartNotice] = useState(storedCart.notice);
  const [cartValidationError, setCartValidationError] = useState(false);
  const [cartValidationAttempt, setCartValidationAttempt] = useState(0);
  const [validatedProductIds, setValidatedProductIds] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailProductId, setDetailProductId] = useState(() => new URLSearchParams(window.location.search).get("product"));
  const [detailVariantId, setDetailVariantId] = useState(() => new URLSearchParams(window.location.search).get("variant"));
  const [sharedProduct, setSharedProduct] = useState(null);
  const [productFetchError, setProductFetchError] = useState(null);
  const [productFetchAttempt, setProductFetchAttempt] = useState(0);
  const pendingHeroTarget = useRef(null);
  const validatedProducts = useRef(new Map());
  const previousAuthUserId = useRef(null);
  const activeCustomerId = useRef(null);
  cartRef.current = cart;

  useEffect(() => {
    if (!supabase) return undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUserId = session?.user?.id ?? null;
      if (activeCustomerId.current && activeCustomerId.current !== nextUserId) {
        setCustomerProfile(null);
        setSelectedCustomerAddressId("");
        setCustomerCartUserId("");
        setCart([]);
        activeCustomerId.current = null;
      }
      if (previousAuthUserId.current !== nextUserId) {
        setCustomerAccountError("");
        setCustomerAccountErrorUserId("");
      }
      previousAuthUserId.current = nextUserId;
      setCustomerSession(session);
      setCustomerAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const customerUserId = customerSession?.user?.id ?? "";
  const customerProfileLoading = Boolean(
    customerUserId
    && customerCartUserId !== customerUserId
    && customerAccountErrorUserId !== customerUserId,
  );

  useEffect(() => {
    if (!customerUserId) return undefined;

    let active = true;
    getCustomerAccount(customerUserId)
      .then(async ({ profile, cart: savedCart }) => {
        if (!active) return;
        const guestCart = cartRef.current;
        const mergedCart = mergeCartItems(savedCart, guestCart);
        if (guestCart.length) await saveCustomerCart(customerUserId, mergedCart);
        if (!active) return;
        activeCustomerId.current = customerUserId;
        setCustomerProfile(profile);
        setSelectedCustomerAddressId((current) => (
          profile.addresses.some((address) => address.id === current)
            ? current
            : profile.addresses[0]?.id ?? ""
        ));
        setCart(mergedCart);
        setCustomerCartUserId(customerUserId);
      })
      .catch((accountError) => {
        if (!active) return;
        console.error("Could not load the customer account.", accountError);
        setCustomerAccountError(accountError.message || "Your customer account could not be loaded.");
        setCustomerAccountErrorUserId(customerUserId);
        setCustomerCartUserId("");
      })
    return () => { active = false; };
  }, [customerUserId]);

  useEffect(() => {
    function handleCartStorageError() {
      setCartNotice("Cart changes could not be saved on this device.");
    }
    window.addEventListener("petify-cart-storage-error", handleCartStorageError);
    return () => window.removeEventListener("petify-cart-storage-error", handleCartStorageError);
  }, []);

  useEffect(() => {
    const updateRoute = () => {
      setRouteHash(window.location.hash);
      setRoutePath(window.location.pathname.replace(/\/+$/, "") || "/");
      const url = new URLSearchParams(window.location.search);
      setDetailProductId(url.get("product"));
      setDetailVariantId(url.get("variant"));
      setProductFetchError(null);
    };
    window.addEventListener("hashchange", updateRoute);
    window.addEventListener("popstate", updateRoute);
    return () => {
      window.removeEventListener("hashchange", updateRoute);
      window.removeEventListener("popstate", updateRoute);
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setSearchQuery(searchInput), 250);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    try {
      if (!customerAuthReady) return;
      if (customerSession && customerProfile && customerCartUserId === customerUserId) {
        window.localStorage.removeItem(CART_STORAGE_KEY);
        return;
      }
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (storageError) {
      console.error("Could not save the cart on this device.", storageError);
      window.dispatchEvent(new Event("petify-cart-storage-error"));
    }
  }, [cart, customerAuthReady, customerCartUserId, customerProfile, customerSession, customerUserId]);

  useEffect(() => {
    if (!customerUserId || !customerProfile || customerProfileLoading || customerCartUserId !== customerUserId) return undefined;
    const timeoutId = window.setTimeout(() => {
      saveCustomerCart(customerUserId, cart).catch((saveError) => {
        console.error("Could not save the cart to the customer account.", saveError);
        setCartNotice("Your cart could not be saved to your account. Please check your connection and try again.");
      });
    }, 350);
    return () => window.clearTimeout(timeoutId);
  }, [cart, customerCartUserId, customerProfile, customerProfileLoading, customerUserId]);

  useEffect(() => {
    if (loading || error || cart.length === 0) return undefined;
    let active = true;
    let removedCount = 0;
    let updatedCount = 0;

    async function refreshSavedCart() {
      const productCache = validatedProducts.current;
      products.forEach((product) => productCache.set(String(product.id), product));
      const missingIds = [...new Set(cart
        .map((item) => String(item.productId))
        .filter((productId) => !productCache.has(productId)))];
      if (missingIds.length) {
        try {
          const fetchedProducts = await getCatalogProductsByIds(missingIds);
          if (!active) return;
          fetchedProducts.forEach((product) => productCache.set(String(product.id), product));
          setValidatedProductIds((currentIds) => [...new Set([
            ...currentIds,
            ...fetchedProducts.map((product) => String(product.id)),
          ])]);
        } catch (validationError) {
          if (!active) return;
          console.error("Could not validate saved cart items against the current catalog.", validationError);
          setCartValidationError(true);
          setCartNotice("Cart prices and availability could not be verified. Refresh the catalog before checking out.");
          return;
        }
      }
      if (!active) return;
      const refreshedCart = cart.flatMap((item) => {
        const product = productCache.get(String(item.productId));
        const variant = product && productOptions(product).find((option) => String(option.id) === String(item.variantId ?? ""));
        if (!product || !variant) {
          removedCount += 1;
          return [];
        }
        const refreshedItem = {
          ...item,
          key: `${product.id}:${variant.id}`,
          productId: String(product.id),
          variantId: String(variant.id ?? ""),
          title: product.title,
          image: product.images?.[0] ?? "",
          variantLabel: variant.label ?? "",
          price: variant.price,
        };
        if (
          item.price !== refreshedItem.price
          || item.title !== refreshedItem.title
          || item.image !== refreshedItem.image
          || item.variantLabel !== refreshedItem.variantLabel
        ) updatedCount += 1;
        return [refreshedItem];
      });
      if (removedCount || updatedCount) {
        setCart(refreshedCart);
        setCartNotice(removedCount
          ? `${removedCount} unavailable ${removedCount === 1 ? "item was" : "items were"} removed from your saved cart.`
          : "Your saved cart was updated with current product prices.");
      }
    }

    refreshSavedCart();
    return () => { active = false; };
  }, [cart, cartValidationAttempt, error, loading, products]);

  useEffect(() => {
    if (!detailProductId || loading || error || isAdminRoute || isSalesPortalRoute || isAboutRoute) return undefined;
    if (products.some((product) => String(product.id) === detailProductId)) return undefined;
    let active = true;
    async function loadSharedProduct() {
      try {
        const [product] = await getCatalogProductsByIds([detailProductId]);
        if (!active) return;
        if (product) {
          setSharedProduct(product);
          setProductFetchError(null);
        } else {
          setProductFetchError({ id: detailProductId, attempt: productFetchAttempt, message: "This product is no longer available." });
        }
      } catch (loadError) {
        if (!active) return;
        console.error("Could not load the shared product.", loadError);
        setProductFetchError({ id: detailProductId, attempt: productFetchAttempt, message: "Product details could not be loaded." });
      }
    }
    loadSharedProduct();
    return () => { active = false; };
  }, [detailProductId, error, isAboutRoute, isAdminRoute, isSalesPortalRoute, loading, productFetchAttempt, products]);

  useEffect(() => {
    let previousY = window.scrollY;
    let animationFrame = 0;

    function updateScrollPosition() {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const movement = currentY - previousY;
        if (currentY <= 320 || movement < -5) {
          setShowScrollTop(false);
        } else if (movement > 5) {
          setShowScrollTop(true);
        }
        previousY = currentY;
        animationFrame = 0;
      });
    }

    window.addEventListener("scroll", updateScrollPosition, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateScrollPosition);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  useEffect(() => {
    const target = pendingHeroTarget.current;
    if (!target || isAboutRoute) return undefined;

    const frame = window.requestAnimationFrame(() => {
      scrollToTarget(target);
      pendingHeroTarget.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isAboutRoute, routeHash, products, sections]);

  useEffect(() => {
    const storeTitle = settings?.brandTitle?.trim() || DEFAULT_DOCUMENT_TITLE;
    document.title = isAboutRoute ? `About us | ${storeTitle}` : storeTitle;
  }, [isAboutRoute, settings?.brandTitle]);

  useEffect(() => {
    if (!settings?.colorPalette) return;
    applyColorPalette(settings.colorPalette);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = normalizeColorPalette(settings.colorPalette).colors.background;
  }, [settings?.colorPalette]);

  useEffect(() => {
    const favicon = document.querySelector("#favicon");
    if (favicon) favicon.href = settings?.faviconUrl || "/images/favicon.png";
  }, [settings?.faviconUrl]);

  const loadingScreen = settings?.loadingScreen
    ? normalizeLoadingScreen(settings.loadingScreen)
    : DEFAULT_LOADING_SCREEN;

  function scrollToTarget(target) {
    const element = document.getElementById(target.slice(1));
    if (!element) return;

    const headerHeight = document.getElementById("site-header")?.getBoundingClientRect().height ?? 0;
    const targetTop = window.scrollY + element.getBoundingClientRect().top - headerHeight - 16;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    window.scrollTo({ top: Math.max(0, targetTop), behavior });
  }

  function scrollToHeroTarget(event, target) {
    event.preventDefault();
    if (isAboutRoute) {
      pendingHeroTarget.current = target;
      window.location.hash = target;
      return;
    }
    scrollToTarget(target);
  }

  function scrollToFirstSection() {
    scrollToTarget("#top");
  }

  function scrollToTop() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, 0);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const addToCart = useCallback((product, variant) => {
    if (!variant || !Number.isFinite(variant.price) || variant.price <= 0) return;
    const key = `${product.id}:${variant.id ?? ""}`;
    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.key === key);
      if (existingItem) {
        return currentCart.map((item) => item.key === key
          ? { ...item, quantity: item.quantity + 1 }
          : item);
      }

      return [...currentCart, {
        key,
        productId: product.id,
        variantId: variant.id ?? "",
        title: product.title,
        image: product.images?.[0] ?? "",
        variantLabel: variant.label ?? "",
        price: variant.price,
        quantity: 1,
      }];
    });
    setCartNotice("");
    setCartValidationError(false);
  }, []);

  const updateCartQuantity = useCallback((key, delta) => {
    setCart((currentCart) => currentCart
      .map((item) => item.key === key ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  }, []);

  const removeCartItem = useCallback((key) => {
    setCart((currentCart) => currentCart.filter((item) => item.key !== key));
  }, []);

  const removeAllCartItems = useCallback(() => setCart([]), []);

  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const openCart = useCallback(() => setIsCartOpen(true), []);
  const openAccount = useCallback((message = "") => {
    setIsCartOpen(false);
    if (new URL(window.location.href).searchParams.has("product")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("product");
      url.searchParams.delete("variant");
      window.history.replaceState({}, "", url);
      setDetailProductId(null);
      setDetailVariantId(null);
      setProductFetchError(null);
    }
    setCustomerAccountMessage(message);
    setIsAccountOpen(true);
  }, []);
  const closeAccount = useCallback(() => {
    setIsAccountOpen(false);
    setCustomerAccountMessage("");
  }, []);
  const handleProfileChange = useCallback((profile) => {
    setCustomerProfile(profile);
    setSelectedCustomerAddressId((current) => (
      profile.addresses?.some((address) => address.id === current)
        ? current
        : profile.addresses?.[0]?.id ?? ""
    ));
  }, []);
  const handleCustomerAuth = useCallback((session) => {
    setCustomerAccountError("");
    setCustomerAccountErrorUserId("");
    setCustomerSession(session);
  }, []);
  const handleCustomerSignOut = useCallback(async () => {
    if (customerSession && customerProfile && customerCartUserId === customerSession.user.id) {
      await saveCustomerCart(customerSession.user.id, cartRef.current);
    }
    await signOutCustomer();
  }, [customerCartUserId, customerProfile, customerSession]);
  const handleCartOrder = useCallback(async ({ items, addressId, note }) => {
    if (!customerSession) {
      openAccount("Sign in or create an account before placing an order.");
      throw new Error("Sign in to continue to WhatsApp.");
    }
    if (!customerProfile) throw new Error("Your customer profile is still loading. Please try again.");
    await createCustomerOrder({ items, addressId, note });
  }, [customerProfile, customerSession, openAccount]);
  const handleCartOrderHandoff = useCallback(async () => {
    const userId = customerSession?.user.id;
    setCart([]);
    setIsCartOpen(false);
    if (!userId || customerCartUserId !== userId) return;

    try {
      await saveCustomerCart(userId, []);
    } catch (saveError) {
      console.error("The order was sent to WhatsApp, but the saved cart could not be cleared.", saveError);
      setCartNotice("Your order was sent to WhatsApp, but your saved cart could not be cleared. Please check your cart before ordering again.");
    }
  }, [customerCartUserId, customerSession]);
  const handleDirectOrder = useCallback(async ({ product, variant, link }) => {
    if (!customerSession) {
      openAccount("Sign in or create an account before placing an order.");
      return;
    }
    if (!customerProfile) {
      openAccount(customerProfileLoading
        ? "Your account is still loading. Please try again in a moment."
        : "Your customer profile could not be loaded. Please try again.");
      return;
    }
    const deliveryAddress = customerProfile.addresses.find((address) => address.id === selectedCustomerAddressId);
    if (!deliveryAddress) {
      openAccount("Add a delivery address to your account before placing an order.");
      return;
    }
    const whatsappWindow = window.open("about:blank", "_blank");
    if (!whatsappWindow) {
      setCartNotice("Allow pop-ups to continue to WhatsApp after your order is saved.");
      return;
    }
    whatsappWindow.opener = null;
    try {
      const options = productOptions(product);
      await createCustomerOrder({
        items: [{
          productId: String(product.id),
          variantId: String(variant?.id ?? ""),
          quantity: 1,
          allowUnpriced: options.length === 0,
          expectedPrice: variant?.price ?? parseProductPrice(product.price),
          title: product.title,
          variantLabel: variant?.label ?? "",
        }],
        addressId: deliveryAddress.id,
        note: product.defaultWhatsappMsg ?? "",
      });
      whatsappWindow.location.href = addCustomerDetailsToOrderLink(
        link,
        customerProfile,
        deliveryAddress.address,
        settings?.customerOrderContactFields,
      );
    } catch (orderError) {
      whatsappWindow.close();
      console.error("Could not save the direct customer order.", orderError);
      setCartNotice(orderError.message || "Your order could not be saved. Please try again.");
    }
  }, [
    customerProfile,
    customerProfileLoading,
    customerSession,
    openAccount,
    selectedCustomerAddressId,
    settings?.customerOrderContactFields,
  ]);
  const retryCatalog = useCallback(() => {
    validatedProducts.current.clear();
    setValidatedProductIds([]);
    setCartValidationError(false);
    retry();
  }, [retry]);
  const openProductDetails = useCallback((product, variantId) => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("product") !== String(product.id)) {
      url.searchParams.set("product", String(product.id));
    }
    if (variantId) url.searchParams.set("variant", String(variantId));
    else url.searchParams.delete("variant");
    window.history.pushState({}, "", url);
    setDetailProductId(String(product.id));
    setDetailVariantId(variantId ? String(variantId) : null);
    setProductFetchError(null);
  }, []);
  const closeProductDetails = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("product");
    url.searchParams.delete("variant");
    window.history.replaceState({}, "", url);
    setDetailProductId(null);
    setDetailVariantId(null);
    setProductFetchError(null);
  }, []);

  const cartItemCount = cart.reduce((count, item) => count + item.quantity, 0);
  const currentProductIds = new Set(products.map((product) => String(product.id)));
  const cartValidationPending = !cartValidationError && !loading && !error && cart.some((item) => (
    !currentProductIds.has(String(item.productId))
    && !validatedProductIds.includes(String(item.productId))
  ));
  const detailProduct = products.find((product) => String(product.id) === detailProductId)
    ?? (String(sharedProduct?.id) === detailProductId ? sharedProduct : null);
  const detailProductError = productFetchError?.id === detailProductId
    && productFetchError?.attempt === productFetchAttempt
    ? productFetchError.message
    : "";

  if (isPasswordResetRoute) return (
    <Suspense fallback={<div className="admin-gate"><p className="admin-muted">Loading password reset...</p></div>}>
      <PasswordReset
        adminBrand={settings?.adminBrand}
        customerReset={new URLSearchParams(window.location.search).get("view") === "reset-password"}
      />
    </Suspense>
  );

  if (isSalesPortalRoute) return (
    <WorkspaceAccessProvider>
      <Suspense fallback={<div className="admin-gate"><p className="admin-muted">Loading Sales portal...</p></div>}>
      <SalesPortal products={products} adminBrand={settings?.adminBrand} storefrontBrand={{
        brandTitle: settings?.brandTitle,
        tagline: settings?.tagline,
        logoUrl: settings?.logoUrl,
      }} />
      </Suspense>
    </WorkspaceAccessProvider>
  );

  if (isAdminRoute) return (
    <WorkspaceAccessProvider>
      <Suspense fallback={<div className="admin-gate"><p className="admin-muted">Loading admin...</p></div>}>
        <AdminDashboard
          adminBrand={settings?.adminBrand}
          storefrontBrand={{
            brandTitle: settings?.brandTitle,
            tagline: settings?.tagline,
            logoUrl: settings?.logoUrl,
          }}
          initialView={
            routeHash === "#admin-settings"
              ? "site-settings"
              : routeHash === "#admin-products" ? "products" : undefined
          }
        />
      </Suspense>
    </WorkspaceAccessProvider>
  );

  return (
    <>
      {!loading && !error && settings && (
        <StoreHeader
          brandTitle={settings.brandTitle}
          tagline={settings.tagline}
          logoUrl={settings.logoUrl}
          heroPills={settings.heroPills}
          visibility={settings.visibility}
          onLogoClick={scrollToFirstSection}
          onPillClick={scrollToHeroTarget}
          cartItemCount={cartItemCount}
          onCartClick={openCart}
          accountLabel={customerSession ? "My account" : "Sign in"}
          onAccountClick={() => openAccount()}
          isAboutRoute={isAboutRoute}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
        />
      )}
      <main className="container" id="top">
        {loading ? <CatalogLoading content={loadingScreen} /> : error ? (
          <div className="catalog-notice" role="alert">
            <p>Catalog service is unavailable. Products could not be loaded from Supabase.</p>
            <button type="button" onClick={retryCatalog}>Retry</button>
          </div>
        ) : (
          isAboutRoute ? (
            <AboutPage content={settings.aboutContent} />
          ) : <>
            {cartNotice && <p className="store-cart-notice" role="status">{cartNotice}</p>}
            {(settings.visibility.catalog ?? true) && (
              <CatalogSections
                mainSections={mainSections}
                sections={sections}
                products={products}
                whatsappNumber={settings.contact.whatsappNumber}
                cartItems={cart}
                searchQuery={searchQuery}
                hasMoreProducts={products.length < totalProducts}
                loadingMore={loadingMore}
                loadMoreError={loadMoreError}
                onLoadMore={loadMore}
                onAddToCart={addToCart}
                onUpdateQuantity={updateCartQuantity}
                onOpenDetails={openProductDetails}
                onDirectOrder={handleDirectOrder}
              />
            )}
            {!loading && detailProductId && !detailProduct && (
              <div className="catalog-notice" role={detailProductError ? "alert" : "status"}>
                <p>{detailProductError || "Loading product details…"}</p>
                {detailProductError && (
                  <>
                    <button type="button" onClick={() => setProductFetchAttempt((attempt) => attempt + 1)}>Retry</button>
                    <button type="button" onClick={closeProductDetails}>Back to the catalog</button>
                  </>
                )}
              </div>
            )}
            {(settings.visibility.coming_soon ?? true) && (
              <h2 className="section-title glow-text" aria-label={settings.comingSoonTitle}>
                <span className="status-dot" aria-hidden="true" />
                <span>{settings.comingSoonTitle}</span>
              </h2>
            )}
            {(settings.visibility.features ?? true) && <FeatureList features={settings.features} />}
          </>
        )}
      </main>
      {!loading && !error && settings && (settings.visibility.footer ?? true) && (
        <StoreFooter footerTitle={settings.footerTitle} footerCopyright={settings.footerCopyright} footerDisclaimer={settings.footerDisclaimer} footerVersion={settings.footerVersion} contact={settings.contact} visibility={settings.visibility} />
      )}
      {!loading && !error && settings && isCartOpen && (
        <Suspense fallback={<div className="store-cart-overlay" role="status"><p className="store-cart-drawer">Loading your cart…</p></div>}>
          <StoreCart
            items={cart}
            whatsappNumber={settings.contact.whatsappNumber}
            brandTitle={settings.brandTitle}
            canCheckout={!cartValidationPending && !cartValidationError}
            validationMessage={cartValidationPending ? "Checking prices and availability…" : cartValidationError ? "Checkout is paused until current cart prices and availability can be verified." : ""}
            onRetryValidation={() => setCartValidationAttempt((attempt) => attempt + 1)}
            onClose={closeCart}
            onUpdateQuantity={updateCartQuantity}
            onRemoveItem={removeCartItem}
            onRemoveAllItems={removeAllCartItems}
            profile={customerProfile}
            selectedAddressId={selectedCustomerAddressId}
            onAddressSelect={setSelectedCustomerAddressId}
            authenticated={Boolean(customerSession)}
            authLoading={!customerAuthReady || customerProfileLoading}
            onOpenAccount={openAccount}
            onCheckout={handleCartOrder}
            onOrderHandoff={handleCartOrderHandoff}
            customerOrderContactFields={settings.customerOrderContactFields}
          />
        </Suspense>
      )}
      {!loading && !error && settings && detailProduct && (
        <Suspense fallback={null}>
          <ProductDetailsDialog
            product={detailProduct}
            whatsappNumber={settings.contact.whatsappNumber}
            onAddToCart={addToCart}
            onDirectOrder={handleDirectOrder}
            onClose={closeProductDetails}
            initialVariantId={detailVariantId}
          />
        </Suspense>
      )}
      {showScrollTop && <ScrollToTop onClick={scrollToTop} />}
      {isAccountOpen && (
        <Suspense fallback={<div className="admin-gate"><p className="admin-muted">Loading customer account...</p></div>}>
          <CustomerAccount
            session={customerSession}
            profile={customerProfile}
            profileLoading={customerProfileLoading}
            customerOrderContactFields={settings?.customerOrderContactFields}
            message={customerAccountMessage}
            authError={customerAccountError}
            onClearMessage={() => setCustomerAccountMessage("")}
            onClose={closeAccount}
            onProfileChange={handleProfileChange}
            onAuthChange={handleCustomerAuth}
            onSignOut={handleCustomerSignOut}
          />
        </Suspense>
      )}
    </>
  );
}