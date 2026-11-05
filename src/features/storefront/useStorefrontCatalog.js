import { useCallback, useEffect, useRef, useState } from "react";
import { getCatalog, getMoreCatalogProducts } from "../../services/catalog.js";

export default function useStorefrontCatalog() {
  const [requestId, setRequestId] = useState(0);
  const loadingMoreRef = useRef(false);
  const [catalog, setCatalog] = useState({
    products: [],
    totalProducts: 0,
    sections: [],
    mainSections: [],
    settings: null,
    loading: true,
    loadingMore: false,
    loadMoreError: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    getCatalog((settings) => {
      if (active) setCatalog((current) => ({ ...current, settings }));
    }).then((result) => {
      if (!active) return;
      setCatalog({ ...result, loading: false, loadingMore: false, loadMoreError: null });
    }).catch((error) => {
      if (!active) return;
      setCatalog({
        products: [],
        totalProducts: 0,
        sections: [],
        mainSections: [],
        settings: null,
        loading: false,
        loadingMore: false,
        loadMoreError: null,
        error,
      });
    });
    return () => { active = false; };
  }, [requestId]);

  const retry = useCallback(() => {
    setCatalog((current) => ({ ...current, loading: true, error: null }));
    setRequestId((current) => current + 1);
  }, []);
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || catalog.loadingMore || catalog.products.length >= catalog.totalProducts) return;
    loadingMoreRef.current = true;
    setCatalog((current) => ({ ...current, loadingMore: true, loadMoreError: null }));
    try {
      const result = await getMoreCatalogProducts(catalog.products.length);
      setCatalog((current) => ({
        ...current,
        products: [...current.products, ...result.products],
        totalProducts: result.totalProducts,
        loadingMore: false,
      }));
    } catch (loadError) {
      setCatalog((current) => ({ ...current, loadingMore: false, loadMoreError: loadError }));
    } finally {
      loadingMoreRef.current = false;
    }
  }, [catalog.loadingMore, catalog.products.length, catalog.totalProducts]);

  return { ...catalog, retry, loadMore };
}
