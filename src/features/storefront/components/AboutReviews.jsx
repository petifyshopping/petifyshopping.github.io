import { useEffect, useState } from "react";
import {
  getPublicCustomerReviews,
  getPublicCustomerReviewSummary,
  submitCustomerReview,
} from "../../../services/reviews.js";
import "./aboutReviews.css";

const REVIEW_LIMIT = 3;
const STAR_VALUES = [1, 2, 3, 4, 5];

function ReviewStars({ rating }) {
  return (
    <span className="about-review-stars" role="img" aria-label={`${rating} out of 5 stars`}>
      {STAR_VALUES.map((value) => (
        <span key={value} aria-hidden="true">{value <= rating ? "★" : "☆"}</span>
      ))}
    </span>
  );
}

function formatReviewDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
}

export default function AboutReviews({ session, profile, authLoading = false }) {
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [notice, setNotice] = useState("");
  const isSignedIn = Boolean(session?.user?.id);
  const signedInName = profile?.full_name
    || session?.user?.user_metadata?.full_name
    || session?.user?.email
    || "your account";

  useEffect(() => {
    let active = true;
    async function loadReviews() {
      try {
        const [nextSummary, nextReviews] = await Promise.all([
          getPublicCustomerReviewSummary(),
          getPublicCustomerReviews(REVIEW_LIMIT),
        ]);
        if (!active) return;
        setSummary(nextSummary);
        setReviews(nextReviews);
      } catch (reviewLoadError) {
        if (!active) return;
        console.error("Could not load customer reviews.", reviewLoadError);
        setLoadError("Customer reviews could not be loaded right now.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadReviews();
    return () => { active = false; };
  }, []);

  async function submitReview(event) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    setNotice("");
    try {
      await submitCustomerReview({
        rating,
        reviewText: reviewText.trim(),
        displayName: isSignedIn ? "" : displayName.trim(),
        contactEmail: isSignedIn ? "" : contactEmail.trim(),
      });
      setNotice("Thank you. Your review is now visible on the website.");
      setReviewText("");
      setDisplayName("");
      setContactEmail("");
      setRating(0);
      setFormOpen(false);
      try {
        const [nextSummary, nextReviews] = await Promise.all([
          getPublicCustomerReviewSummary(),
          getPublicCustomerReviews(REVIEW_LIMIT),
        ]);
        setSummary(nextSummary);
        setReviews(nextReviews);
      } catch (refreshError) {
        console.error("Could not refresh customer reviews after submission.", refreshError);
      }
    } catch (submissionError) {
      console.error("Could not submit the customer review.", submissionError);
      setSubmitError(submissionError.message || "Your review could not be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="about-reviews" aria-labelledby="about-reviews-title">
      <div className="about-reviews-heading">
        <div>
          <p className="about-page-eyebrow">Customer stories</p>
          <h3 id="about-reviews-title">Care, in their own words</h3>
          <p>Thoughts from people who trust Petify with their companions.</p>
        </div>
      </div>

      <div className="about-reviews-content">
        <div className="about-review-list" aria-live="polite">
          {loading ? (
            <p className="about-review-empty">Loading customer reviews…</p>
          ) : loadError ? (
            <p className="about-review-error" role="alert">{loadError}</p>
          ) : reviews.length ? (
            reviews.map((review) => (
              <article className="about-review" key={review.id}>
                <div className="about-review-author-line">
                  <strong>{review.display_name}</strong>
                  {review.is_verified && (
                    <span className="about-review-verified">
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <path d="m5 10 3.2 3.2L15.5 6" />
                      </svg>
                      Verified customer
                    </span>
                  )}
                </div>
                <blockquote>{review.review_text}</blockquote>
                <ReviewStars rating={review.rating} />
                <time className="about-review-posted" dateTime={review.created_at}>
                  Posted on {formatReviewDate(review.created_at)}
                </time>
              </article>
            ))
          ) : (
            <p className="about-review-empty">No reviews yet. Yours can be the first.</p>
          )}
          <button
            className="about-review-write-button"
            type="button"
            aria-expanded={formOpen}
            aria-controls={formOpen ? "about-review-form" : undefined}
            onClick={() => {
              setFormOpen((open) => !open);
              setSubmitError("");
              setNotice("");
            }}
          >
            {formOpen ? "Close form" : "Write a review"}
          </button>
        </div>

        <aside className="about-review-summary" aria-label="Customer review rating">
          {summary?.reviewCount > 0 ? (
            <>
              <strong>{summary.averageRating.toFixed(1)}</strong>
              <ReviewStars rating={Math.round(summary.averageRating)} />
              <span className="about-review-summary-count">
                {summary.reviewCount} {summary.reviewCount === 1 ? "review" : "reviews"}
              </span>
            </>
          ) : (
            <>
              <strong>Be first</strong>
              <span className="about-review-summary-count">Share your experience with the Petify community.</span>
            </>
          )}
        </aside>
      </div>

      {notice && <p className="about-review-notice" role="status">{notice}</p>}

      {formOpen && (
        <form className="about-review-form" id="about-review-form" onSubmit={submitReview}>
          <div className="about-review-form-heading">
            <h4 id="about-review-form-title">Share your experience</h4>
            <p>We'd love to hear from you.</p>
          </div>
          {authLoading ? (
            <p className="about-review-author" role="status">Checking your account…</p>
          ) : isSignedIn ? (
            <p className="about-review-author">
              Posting as <strong>{signedInName}</strong>
              <span className="about-review-verified">
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="m5 10 3.2 3.2L15.5 6" />
                </svg>
                Verified customer
              </span>
            </p>
          ) : (
            <>
              <label>
                <span className="about-review-field-label">Your name</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  minLength={1}
                  maxLength={80}
                  required
                />
              </label>
              <label>
                <span className="about-review-field-label">
                  Email address
                </span>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  autoComplete="email"
                  maxLength={254}
                  required
                />
                <small>Your email is only shared with the Petify team.</small>
              </label>
            </>
          )}

          <fieldset className="about-review-rating-fieldset">
            <legend>Your rating</legend>
            <div className="about-review-rating-options">
              {STAR_VALUES.map((value) => (
                <label className={value <= rating ? "is-selected" : ""} key={value}>
                  <input
                    type="radio"
                    name="review-rating"
                    value={value}
                    checked={rating === value}
                    required={value === 1}
                    onChange={() => setRating(value)}
                  />
                  <span aria-hidden="true">★</span>
                  <span className="visually-hidden">{value} {value === 1 ? "star" : "stars"}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="about-review-text-field">
            Your review
            <textarea
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              minLength={20}
              maxLength={1200}
              rows={5}
              required
            />
            <small>{reviewText.length}/1200 characters</small>
          </label>
          {submitError && <p className="about-review-error" role="alert">{submitError}</p>}
          <button className="about-review-submit" type="submit" disabled={submitting || authLoading}>
            {authLoading ? "Checking account…" : submitting ? "Posting review…" : "Post review"}
          </button>
        </form>
      )}
    </section>
  );
}
