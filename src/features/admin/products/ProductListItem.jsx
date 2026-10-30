import { useState } from "react";
import AdminButton from "../components/AdminButton.jsx";

export default function ProductListItem({
  product,
  sectionTitle,
  saving,
  deleting = false,
  onToggle,
  onEdit,
  onDelete,
  onSavePrice,
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [price, setPrice] = useState(product.price ?? "");
  const productLabel = product.title?.trim() || "Untitled product";

  async function submitPrice(event) {
    event.preventDefault();
    if (await onSavePrice(product, price)) setEditingPrice(false);
  }

  return (
    <article className="admin-product-card">
      <div className="admin-product-card-main">
        {product.images[0]
          ? <img src={product.images[0]} alt="" loading="lazy" decoding="async" />
          : <span className="admin-product-placeholder" aria-hidden="true" />}
        <div className="admin-product-card-copy">
          <strong>{productLabel}</strong>
          <span>{sectionTitle || "Unassigned"}</span>
          <span className="admin-product-card-price">{product.priceLabel}</span>
        </div>
      </div>
      <div className="admin-product-card-controls">
        <label className="admin-inline-switch">
          <input
            type="checkbox"
            role="switch"
            checked={product.isActive}
            disabled={Boolean(saving)}
            aria-label={`${product.isActive ? "Hide" : "Show"} ${productLabel}`}
            onChange={onToggle}
          />
          <span>{product.isActive ? "Visible" : "Hidden"}</span>
        </label>
        <AdminButton variant="primary" onClick={onEdit}>Edit</AdminButton>
        <AdminButton className="admin-product-delete-direct" variant="danger" disabled={deleting} onClick={onDelete}>Delete</AdminButton>
        <details className="admin-product-overflow">
          <summary aria-label={`More actions for ${productLabel}`}>More</summary>
          <div>
            {!product.variants?.length && (
              <AdminButton onClick={() => {
                setPrice(product.price ?? "");
                setEditingPrice((current) => !current);
              }}>
                {editingPrice ? "Cancel price edit" : "Quick edit price"}
              </AdminButton>
            )}
            <AdminButton variant="danger" disabled={deleting} onClick={onDelete}>Delete product</AdminButton>
          </div>
        </details>
      </div>
      {editingPrice && (
        <form className="admin-product-quick-price" onSubmit={submitPrice}>
          <label>
            Price (₹)
            <input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              aria-label={`Price for ${productLabel}`}
              required
            />
          </label>
          <AdminButton variant="primary" type="submit" disabled={Boolean(saving)}>Save price</AdminButton>
        </form>
      )}
    </article>
  );
}
