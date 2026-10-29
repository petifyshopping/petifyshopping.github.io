import { useEffect, useRef, useState } from "react";
import StoreCartButton from "../storefront/components/StoreCartButton.jsx";

export default function ProjectHeader({
  variant,
  brand,
  storefrontBrand,
  pageTitle,
  children,
  brandTitle,
  tagline,
  logoUrl,
  heroPills,
  visibility,
  onLogoClick,
  onPillClick,
  cartItemCount,
  onCartClick,
  accountLabel,
  onAccountClick,
  isAboutRoute,
  searchValue,
  onSearchChange,
  showAdminSearch = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const isStorefront = variant === "storefront";
  const showBrand = visibility?.brand ?? true;
  const showTagline = visibility?.tagline ?? true;
  const showPills = visibility?.hero_pills ?? true;

  if (variant !== "storefront" && variant !== "admin") {
    throw new TypeError(`Unsupported project header variant: ${variant}`);
  }

  useEffect(() => {
    if (!menuOpen) return undefined;
    function handleOutsideClick(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    function handleEscape(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  if (!isStorefront) {
    return (
      <header className={`admin-topbar admin-project-header${showAdminSearch ? " has-search" : ""}`} id="site-header">
        <div className="store-header-inner">
          <div className="store-header-brand">
            <a className="store-brand-link admin-project-brand" href="/">
              {storefrontBrand?.logoUrl
                ? <img src={storefrontBrand.logoUrl} alt={`${storefrontBrand.brandTitle || brand.name} logo`} className="brand-logo" width="180" height="64" />
                : <span className="admin-project-brand-title">{storefrontBrand?.brandTitle || brand.name}</span>}
            </a>
            {storefrontBrand?.tagline && <p className="brand-tagline">{storefrontBrand.tagline}</p>}
            <h1 className="admin-project-context">{pageTitle}</h1>
          </div>
          {showAdminSearch && (
            <form className="store-search admin-header-search" role="search" aria-label={`${pageTitle} catalog search`} onSubmit={(event) => event.preventDefault()}>
              <label className="visually-hidden" htmlFor="admin-catalog-search">Search catalog products</label>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>
              <input
                id="admin-catalog-search"
                type="search"
                role="searchbox"
                placeholder="Search products by name or ID"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                autoComplete="off"
              />
              {searchValue && (
                <button type="button" className="store-search-clear" onClick={() => onSearchChange("")} aria-label="Clear catalog search">×</button>
              )}
            </form>
          )}
          <div className="store-header-actions">{children}</div>
        </div>
      </header>
    );
  }

  return (
    <header id="site-header">
      <div className="store-header-inner">
        <div className="store-header-brand">
          {showBrand && (
            <h1 className="brand-title">
              <a href="#top" className="store-brand-link" onClick={(event) => {
                event.preventDefault();
                onLogoClick();
              }}>
                {logoUrl
                  ? <img src={logoUrl} alt={`${brandTitle} logo`} className="brand-logo" width="180" height="64" />
                  : brandTitle}
              </a>
            </h1>
          )}
          {showTagline && tagline && <p className="brand-tagline">{tagline}</p>}
        </div>
        {!isAboutRoute && (
          <form className="store-search" role="search" onSubmit={(event) => event.preventDefault()}>
            <label className="visually-hidden" htmlFor="store-search-input">Search products</label>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>
            <input
              id="store-search-input"
              type="text"
              role="searchbox"
              inputMode="search"
              enterKeyHint="search"
              placeholder="Search products"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              autoComplete="off"
            />
            {searchValue && (
              <button type="button" className="store-search-clear" onClick={() => onSearchChange("")} aria-label="Clear search">×</button>
            )}
          </form>
        )}
        <div className="store-header-actions">
          <StoreCartButton className="store-header-cart" itemCount={cartItemCount} onClick={onCartClick} />
          <div className="store-header-menu" ref={menuRef}>
            <button
              className="store-menu-trigger"
              type="button"
              aria-expanded={menuOpen}
              aria-controls="store-header-menu-panel"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className={`store-menu-icon${menuOpen ? " is-open" : ""}`} aria-hidden="true"><span /><span /><span /></span>
              <span className="store-menu-label">Menu</span>
            </button>
            {menuOpen && (
              <nav className="store-menu-panel" id="store-header-menu-panel" aria-label="Store menu">
                <button className="store-menu-account" type="button" onClick={() => { setMenuOpen(false); onAccountClick(); }}>
                  {accountLabel}
                </button>
                <a href={isAboutRoute ? "#top" : "#about"} onClick={() => setMenuOpen(false)}>
                  {isAboutRoute ? "Visit store" : "About us"}
                </a>
              </nav>
            )}
          </div>
        </div>
      </div>
      {showPills && heroPills.length > 0 && (
        <nav className="hero-pills" aria-label="Store links">
          {heroPills.map((pill) => pill.target
            ? <a className="pill" href={pill.target} key={pill.id} onClick={(event) => onPillClick(event, pill.target)}>{pill.label}</a>
            : <span className="pill" key={pill.id}>{pill.label}</span>)}
        </nav>
      )}
    </header>
  );
}
