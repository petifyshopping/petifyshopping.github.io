import { useEffect, useState } from "react";
import { formatDateTime } from "../../lib/formatters.js";
import {
  getAdminCustomerReviewPage,
  moderateCustomerReview,
} from "../../services/reviews.js";
import "./customerReviewsQueue.css";

const PAGE_SIZE = 30;

function ReviewRating({ rating }) {
  return (
    <span className="customer-review-queue-rating" role="img" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

export default function CustomerReviewsQueue() {
  const [reviews, setReviews] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingReviewId, setSavingReviewId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    getAdminCustomerReviewPage(0, PAGE_SIZE)
      .then((page) => {
        if (!active) return;
        setReviews(page.rows);
        setTotal(page.total);
      })
      .catch((loadError) => {
        if (!active) return;
        console.error("Could not load customer reviews for moderation.", loadError);
        setError(loadError.message || "Customer reviews could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    setError("");
    try {
      const page = await getAdminCustomerReviewPage(reviews.length, PAGE_SIZE);
      setReviews((current) => [...current, ...page.rows]);
      setTotal(page.total);
    } catch (loadError) {
      console.error("Could not load more customer reviews.", loadError);
      setError(loadError.message || "More customer reviews could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function moderate(review, decision) {
    setSavingReviewId(review.id);
    setError("");
    setNotice("");
    try {
      await moderateCustomerReview(review.id, decision);
      setReviews((current) => current.map((item) => (
        item.id === review.id ? { ...item, status: decision } : item
      )));
      setNotice(decision === "approved" ? "Review is now shown on the website." : "Review is hidden from the website.");
    } catch (moderationError) {
      console.error("Could not moderate customer review.", moderationError);
      setError(moderationError.message || "The review could not be updated.");
    } finally {
      setSavingReviewId("");
    }
  }

  return (
    <section className="customer-management-section customer-review-queue" aria-labelledby="customer-review-queue-title">
      <div className="customer-management-section-heading">
        <div>
          <p className="admin-eyebrow">CUSTOMER FEEDBACK</p>
          <h2 id="customer-review-queue-title">Manage customer reviews</h2>
        </div>
        <span className="customer-management-count">{total} reviews</span>
      </div>
      {error && <p className="customer-management-error" role="alert">{error}</p>}
      {notice && <p className="customer-review-queue-notice" role="status">{notice}</p>}
      {loading ? (
        <p className="customer-management-empty">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="customer-management-empty">No customer reviews yet.</p>
      ) : (
        <div className="customer-review-queue-list">
          {reviews.map((review) => (
            <article className="customer-review-queue-item" key={review.id}>
              <div className="customer-review-queue-item-heading">
                <div>
                  <strong>{review.display_name}</strong>
                  <span>
                    {review.is_verified ? "Verified customer" : "Guest review"}
                    {" · "}
                    {review.status === "approved" ? "Shown on website" : "Hidden from website"}
                  </span>
                </div>
                <div>
                  <ReviewRating rating={review.rating} />
                  <time dateTime={review.created_at}>{formatDateTime(review.created_at)}</time>
                </div>
              </div>
              {review.contact_email && (
                <a className="customer-review-queue-email" href={`mailto:${review.contact_email}`}>
                  {review.contact_email}
                </a>
              )}
              <p>{review.review_text}</p>
              <div className="customer-review-queue-actions">
                <button
                  type="button"
                  className={review.status === "approved"
                    ? "customer-review-queue-reject"
                    : "customer-review-queue-approve"}
                  disabled={Boolean(savingReviewId)}
                  onClick={() => moderate(review, review.status === "approved" ? "rejected" : "approved")}
                >
                  {savingReviewId === review.id
                    ? "Saving…"
                    : review.status === "approved" ? "Hide from website" : "Show on website"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && reviews.length < total && (
        <button
          className="customer-management-load-more"
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading…" : "Load more reviews"}
        </button>
      )}
    </section>
  );
}
