import { INSTAGRAM_PROFILE_URL } from "../../../config/siteContent.js";

export default function AboutPage({ content }) {
  return (
    <article className="about-page">
      <header className="about-page-heading">
        <h1>{content.title}</h1>
        <p className="about-page-introduction">{content.introduction}</p>
      </header>
      <section className="about-page-values" aria-label="About Petify">
        <div className="about-value-card about-mission">
          <h3>Our mission</h3>
          <p>{content.mission}</p>
        </div>
        <div className="about-value-card about-vision">
          <h3>Our vision</h3>
          <p>{content.vision}</p>
        </div>
        <div className="about-who-card">
          <h3>Who we are</h3>
          <p>{content.whoWeAre}</p>
          <a href="#site-footer" className="about-contact-link">Talk with our team</a>
        </div>
        <div className="about-instagram-card" role="group" aria-labelledby="about-instagram-title">
          <div className="about-instagram-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" />
            </svg>
          </div>
          <div className="about-instagram-copy">
            <h3 id="about-instagram-title">Find Petify on Instagram</h3>
            <p>Visit our profile for the latest from Petify and our pet-loving community.</p>
          </div>
          <a
            className="about-instagram-link"
            href={INSTAGRAM_PROFILE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            petify.shopping
          </a>
        </div>
      </section>
      <a className="about-back-link" href="#top">Explore the store</a>
    </article>
  );
}
