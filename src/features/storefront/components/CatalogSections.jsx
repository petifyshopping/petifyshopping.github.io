import { useEffect, useMemo, useRef, useState } from "react";
import ProductCard from "./ProductCard.jsx";
import CategoryNav from "./CategoryNav.jsx";

function searchText(product, section, mainSection) {
  return [
    product.title,
    product.description,
    product.badge,
    product.saveTag,
    section?.title,
    mainSection?.title,
  ].filter(Boolean).join(" ").toLocaleLowerCase();
}

export default function CatalogSections({
  mainSections,
  sections,
  products,
  whatsappNumber,
  cartItems,
  searchQuery,
  hasMoreProducts,
  loadingMore,
  loadMoreError,
  onLoadMore,
  onAddToCart,
  onUpdateQuantity,
  onOpenDetails,
  onDirectOrder,
}) {
  const [selectedMainId, setSelectedMainId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const loadMoreSentinel = useRef(null);
  const sectionById = useMemo(() => new Map(sections.map((section) => [section.id, section])), [sections]);
  const mainById = useMemo(() => new Map(mainSections.map((section) => [section.id, section])), [mainSections]);
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();

  const matchingProducts = useMemo(() => products.filter((product) => {
    const section = sectionById.get(product.sectionId);
    if (selectedSectionId && product.sectionId !== selectedSectionId) return false;
    if (selectedMainId && section?.main_section_id !== selectedMainId) return false;
    return !normalizedQuery || searchText(product, section, mainById.get(section?.main_section_id)).includes(normalizedQuery);
  }), [mainById, normalizedQuery, products, sectionById, selectedMainId, selectedSectionId]);

  const visibleBySection = useMemo(() => {
    const grouped = new Map();
    for (const product of matchingProducts) {
      const group = grouped.get(product.sectionId) ?? [];
      group.push(product);
      grouped.set(product.sectionId, group);
    }
    return grouped;
  }, [matchingProducts]);
  const selectedMain = mainById.get(selectedMainId);
  const selectedSection = sectionById.get(selectedSectionId);
  const crumbParts = ["Home", selectedMain?.title, selectedSection?.title].filter(Boolean);
  const standaloneIds = new Set(sections.filter((section) => !section.main_section_id).map((section) => section.id));

  useEffect(() => {
    const sentinel = loadMoreSentinel.current;
    if (!sentinel || !hasMoreProducts || loadingMore || loadMoreError) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) onLoadMore();
    }, { rootMargin: "300px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreProducts, loadMoreError, loadingMore, onLoadMore]);

  const loadMoreStatus = hasMoreProducts && (
    <div className="catalog-scroll-status" ref={loadMoreSentinel} aria-live="polite">
      {loadingMore && <><span className="catalog-button-spinner" aria-hidden="true" />Loading more products…</>}
      {loadMoreError && (
        <p className="catalog-load-error" role="alert">
          More products could not be loaded. <button type="button" onClick={onLoadMore} disabled={loadingMore}>Retry</button>
        </p>
      )}
    </div>
  );

  const renderSection = (section, nested = false) => {
    const sectionProducts = visibleBySection.get(section.id) ?? [];
    if (!sectionProducts.length) return null;
    return (
      <section
        className={`catalog-product-group${nested ? " is-subcategory" : ""}`}
        key={section.id}
        aria-labelledby={`catalog-section-${section.id}`}
      >
        {nested
          ? <h3 className="catalog-subsection-title" id={`catalog-section-${section.id}`}>{section.title}</h3>
          : <h2 className="section-title" id={`catalog-section-${section.id}`}>{section.title}</h2>}
        <div className="grid">
          {sectionProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              whatsappNumber={whatsappNumber}
              cartItems={cartItems}
              onAddToCart={onAddToCart}
              onUpdateQuantity={onUpdateQuantity}
              onOpenDetails={onOpenDetails}
              onDirectOrder={onDirectOrder}
            />
          ))}
        </div>
      </section>
    );
  };

  const showAll = !selectedMainId && !selectedSectionId;
  const groupsToRender = showAll
    ? mainSections.map((mainSection) => ({
      mainSection,
      childSections: sections.filter((section) => section.main_section_id === mainSection.id),
    }))
    : selectedMain
      ? [{ mainSection: selectedMain, childSections: sections.filter((section) => section.main_section_id === selectedMain.id) }]
      : [];
  const visibleStandaloneSections = sections.filter((section) => (
    standaloneIds.has(section.id)
    && (!selectedSectionId || section.id === selectedSectionId)
    && visibleBySection.has(section.id)
  ));

  return (
    <div className="store-catalog">
      <CategoryNav
        mainSections={mainSections}
        sections={sections}
        selectedMainId={selectedMainId}
        selectedSectionId={selectedSectionId}
        onSelectAll={() => { setSelectedMainId(""); setSelectedSectionId(""); }}
        onSelectMain={(id) => { setSelectedMainId(id); setSelectedSectionId(""); }}
        onSelectSection={(id) => {
          if (id === selectedSectionId) {
            setSelectedSectionId("");
            return;
          }
          if (!sectionById.get(id)?.main_section_id) setSelectedMainId("");
          setSelectedSectionId(id);
        }}
      />
      <div className="catalog-context">
        <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
          {crumbParts.map((part, index) => (
            <span key={`${part}-${index}`}>
              {index > 0 && <span className="breadcrumb-separator" aria-hidden="true">/</span>}
              {part}
            </span>
          ))}
        </nav>
        <p className="catalog-result-count" aria-live="polite">
          {matchingProducts.length}{hasMoreProducts ? "+" : ""} {matchingProducts.length === 1 && !hasMoreProducts ? "product" : "products"}
        </p>
      </div>
      {matchingProducts.length === 0 ? (
        <div className="catalog-empty-state" role="status">
          <h2>{normalizedQuery ? "No matching products" : "No products in this category yet"}</h2>
          <p>{normalizedQuery ? "Try another search or browse all products." : "Please check back soon, or choose another category."}</p>
          {(normalizedQuery || selectedMainId || selectedSectionId) && (
            <button type="button" className="catalog-reset-button" onClick={() => {
              setSelectedMainId("");
              setSelectedSectionId("");
            }}>
              Browse all products
            </button>
          )}
          {loadMoreStatus}
        </div>
      ) : (
        <>
          {groupsToRender.map(({ mainSection, childSections }) => {
            const childrenWithProducts = childSections.filter((section) => visibleBySection.has(section.id));
            if (!childrenWithProducts.length) return null;
            return (
              <section
                className="catalog-main-group"
                key={mainSection.id}
                aria-labelledby={`catalog-main-section-${mainSection.id}`}
              >
                <h2 className="section-title" id={`catalog-main-section-${mainSection.id}`}>{mainSection.title}</h2>
                {childrenWithProducts.map((section) => renderSection(section, true))}
              </section>
            );
          })}
          {visibleStandaloneSections.map((section) => renderSection(section))}
          {loadMoreStatus}
        </>
      )}
    </div>
  );
}
