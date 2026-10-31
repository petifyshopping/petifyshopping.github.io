import { INSTAGRAM_PROFILE_URL } from "../../../config/siteContent.js";

export default function AboutPage({ content }) {
  return (
    <article className="about-page">
      <div className="about-page-heading">
        <p className="about-page-eyebrow">A LITTLE ABOUT US</p>
        <h2>{content.title}</h2>
        <p className="about-page-introduction">{content.introduction}</p>
      </div>
      <div className="about-page-values">
        <section className="about-value-card about-mission">
          <span className="about-value-number" aria-hidden="true">01</span>
          <h3>Our mission</h3>
          <p>{content.mission}</p>
        </section>
        <section className="about-value-card about-vision">
          <span className="about-value-number" aria-hidden="true">02</span>
          <h3>Our vision</h3>
          <p>{content.vision}</p>
        </section>
      </div>
      <section className="about-who-card">
        <div>
          <p className="about-page-eyebrow">THE PEOPLE BEHIND THE CARE</p>
          <h3>Who we are</h3>
        </div>
        <p>{content.whoWeAre}</p>
        <a href="#site-footer" className="about-contact-link">Talk with our team <span aria-hidden="true">→</span></a>
      </section>
      <section className="about-instagram-card" aria-labelledby="about-instagram-title">
        <div className="about-instagram-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" />
          </svg>
        </div>
        <div className="about-instagram-copy">
          <p className="about-page-eyebrow">FOLLOW ALONG</p>
          <h3 id="about-instagram-title">Find Petify on Instagram</h3>
          <p>Visit our profile for the latest from Petify and our pet-loving community.</p>
        </div>
        <a
          className="about-instagram-link"
          href={INSTAGRAM_PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          petify.shopping <span aria-hidden="true">↗</span>
        </a>
      </section>
      <a className="about-back-link" href="#top">Explore the store</a>
    </article>
  );
}
