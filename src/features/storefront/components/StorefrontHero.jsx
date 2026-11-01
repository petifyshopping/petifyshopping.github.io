import { productOptions } from "../../../lib/productPricing.js";
import ProductOrderLink from "./ProductOrderLink.jsx";

export default function StorefrontHero({
  featuredProduct,
  whatsappNumber,
  onOpenDetails,
  onDirectOrder,
}) {
  const featuredVariant = featuredProduct?.variants?.length
    ? productOptions(featuredProduct)[0]
    : null;

  return (
    <section className="storefront-hero" aria-labelledby="storefront-hero-title">
      <div className="storefront-hero-copy">
        <h1 id="storefront-hero-title">Pet essentials for every kind of companion</h1>
        <p className="lead">
          Thoughtfully selected pet essentials, specialized nutrition, and habitat products.
        </p>
        <div className="storefront-hero-actions">
          <a className="catalog-browse-action" href="#store-catalog">Shop the catalog</a>
          {featuredProduct && (
            <ProductOrderLink
              product={featuredProduct}
              whatsappNumber={whatsappNumber}
              combo={featuredProduct.type === "combo"}
              variant={featuredVariant}
              onOrder={onDirectOrder}
            />
          )}
        </div>
      </div>
      {featuredProduct?.images?.[0] && (
        <figure className="storefront-hero-visual" data-kind="product">
          <button
            className="storefront-hero-image-button"
            type="button"
            onClick={() => onOpenDetails(featuredProduct, featuredVariant?.id)}
            aria-haspopup="dialog"
            aria-label={`View details for ${featuredProduct.title}`}
          >
            <img
              src={featuredProduct.images[0]}
              alt={featuredProduct.title}
              width="800"
              height="800"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </button>
          <figcaption>{featuredProduct.title}</figcaption>
        </figure>
      )}
    </section>
  );
}
