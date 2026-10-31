import { useCallback, useEffect, useState } from "react";
import { getStorefrontContent, saveStorefrontContent } from "../../services/admin.js";
import { DEFAULT_ABOUT_CONTENT, DEFAULT_FOOTER_SOCIAL_URLS } from "../../config/siteContent.js";
import useWorkspaceDraft from "../../hooks/useWorkspaceDraft.js";
import WorkspaceDraftControls from "./WorkspaceDraftControls.jsx";
import AdminNotice from "./components/AdminNotice.jsx";
import AdminState from "./components/AdminState.jsx";

const headerVisibilityOptions = [
  ["brand", "Brand name or logo"],
  ["tagline", "Tagline"],
  ["hero_pills", "Header navigation"],
];

const storefrontVisibilityOptions = [
  ["catalog", "Product catalog"],
  ["features", "Store features"],
  ["coming_soon", "Coming soon banner"],
];

const footerVisibilityOptions = [
  ["footer", "Contact and footer"],
  ["footer_logo", "Footer brand logo"],
  ["footer_title", "Footer brand name", false],
  ["footer_location", "Footer location"],
  ["footer_contact", "Contact details"],
  ["footer_copyright", "Copyright note"],
  ["footer_disclaimer", "Store disclaimer"],
  ["footer_version", "Version number"],
];

function VisibilityControls({ title, description, options, visibility, onChange }) {
  return (
    <fieldset className="admin-visibility-list">
      <legend>{title}</legend>
      <p className="admin-content-section-description">{description}</p>
      {options.map(([field, label, defaultVisible = true]) => (
        <label className="admin-visibility-switch" key={field}>
          <input
            type="checkbox"
            role="switch"
            checked={visibility[field] ?? defaultVisible}
            onChange={(event) => onChange(field, event.target.checked)}
          />
          <span>{label}</span>
          <small>{visibility[field] ?? defaultVisible ? "Visible" : "Hidden"}</small>
        </label>
      ))}
    </fieldset>
  );
}

const sectionLabels = {
  header: "Header",
  about: "About",
  footer: "Footer",
  storefront: "Store sections",
};

export default function StorefrontContentEditor({ section, userId }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const restoreContentDraft = useCallback((draft) => setContent(draft), []);
  const contentDraft = useWorkspaceDraft({
    userId,
    draftType: "site-content",
    draftKey: "storefront",
    value: content,
    onRestore: restoreContentDraft,
    ready: !loading && content !== null,
  });

  useEffect(() => {
    let active = true;
    getStorefrontContent().then((value) => {
      if (active) setContent(value);
    }).catch((loadError) => {
      if (active) setError(loadError.message || "Storefront settings could not be loaded.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  function update(field, value) {
    setContent((current) => ({ ...current, [field]: value }));
    setNotice("");
  }

  function updateFeature(index, field, value) {
    setContent((current) => ({
      ...current,
      features: current.features.map((feature, featureIndex) => featureIndex === index
        ? { ...feature, [field]: value }
        : feature),
    }));
    setNotice("");
  }

  function updateVisibility(field, isVisible) {
    setContent((current) => ({
      ...current,
      visibility: {
        ...current.visibility,
        [field]: isVisible,
        ...(isVisible && field === "footer_logo" ? { footer_title: false } : {}),
        ...(isVisible && field === "footer_title" ? { footer_logo: false } : {}),
      },
    }));
    setNotice("");
  }

  function updateAbout(field, value) {
    setContent((current) => ({
      ...current,
      aboutContent: { ...current.aboutContent, [field]: value },
    }));
    setNotice("");
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await saveStorefrontContent(content);
      try {
        await contentDraft.clear();
      } catch (clearError) {
        setError(`Storefront content was saved, but its draft could not be removed: ${clearError.message}`);
        return;
      }
      setNotice("Storefront content saved.");
    } catch (saveError) {
      setError(saveError.message || "Storefront content could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-storefront-content" aria-labelledby="admin-storefront-content-title">
      <div className="admin-hero-pills-heading">
        <div><p className="admin-eyebrow">CLOUD STOREFRONT</p><h2 id="admin-storefront-content-title">{sectionLabels[section]}</h2></div>
      </div>
      {loading ? <AdminState kind="loading" description="Loading storefront settings..." /> : content && (
        <form className="admin-form-grid" onSubmit={submit}>
          {section === "header" && (
          <section className="admin-content-section admin-span-two">
            <div className="admin-content-section-heading">
              <h3>Header</h3>
              <p>Set the store name and tagline shown at the top of your storefront.</p>
            </div>
            <div className="admin-content-section-grid">
              <label>Brand name<input value={content.brandTitle} onChange={(event) => update("brandTitle", event.target.value)} required /></label>
              <label>Tagline<input value={content.tagline} onChange={(event) => update("tagline", event.target.value)} required /></label>
            </div>
            <VisibilityControls
              title="Header visibility"
              description="Choose which header elements customers can see."
              options={headerVisibilityOptions}
              visibility={content.visibility}
              onChange={updateVisibility}
            />
          </section>
          )}
          {section === "about" && (
          <section className="admin-about-content-editor admin-span-two">
            <div className="admin-content-section-heading">
              <h3>About</h3>
              <p>Edit the story customers see from the About us page.</p>
            </div>
            {!content.aboutContentAvailable && (
              <AdminNotice kind="info">
                About copy is using starter text until the database update is applied. Run <code>supabase/03-catalog-sections.sql</code> to enable editing.
              </AdminNotice>
            )}
            {Object.entries({
              title: "About page heading",
              introduction: "Introduction",
              mission: "Our mission",
              vision: "Our vision",
              whoWeAre: "Who we are",
            }).map(([field, label]) => (
              <label key={field}>{label}
                <textarea
                  rows={field === "title" ? 2 : 4}
                  value={content.aboutContent?.[field] ?? DEFAULT_ABOUT_CONTENT[field]}
                  onChange={(event) => updateAbout(field, event.target.value)}
                  disabled={!content.aboutContentAvailable}
                  required
                />
              </label>
            ))}
          </section>
          )}
          {section === "footer" && (
          <section className="admin-content-section admin-span-two">
            <div className="admin-content-section-heading">
              <h3>Footer</h3>
              <p>Manage your contact information and the details shown at the bottom of the storefront.</p>
            </div>
            <div className="admin-content-section-grid">
              <label>WhatsApp number<input value={content.whatsappNumber} onChange={(event) => update("whatsappNumber", event.target.value)} required /></label>
              <label>Phone display<input value={content.phoneDisplay} onChange={(event) => update("phoneDisplay", event.target.value)} required /></label>
              <label>Email<input type="email" value={content.email} onChange={(event) => update("email", event.target.value)} required /></label>
              <label>Location<input value={content.location} onChange={(event) => update("location", event.target.value)} required /></label>
              <label>Footer title<input value={content.footerTitle} onChange={(event) => update("footerTitle", event.target.value)} required /></label>
              <label>Copyright note<input value={content.footerCopyright} onChange={(event) => update("footerCopyright", event.target.value)} required /></label>
              <label>Store disclaimer<input value={content.footerDisclaimer} onChange={(event) => update("footerDisclaimer", event.target.value)} required /></label>
              <label>Version number<input value={content.footerVersion} onChange={(event) => update("footerVersion", event.target.value)} required /></label>
            </div>
            <VisibilityControls
              title="Footer visibility"
              description="Choose which footer content appears. Show either the logo or brand name, not both; the location stays aligned beneath it."
              options={footerVisibilityOptions}
              visibility={content.visibility}
              onChange={updateVisibility}
            />
              <div className="admin-footer-social-settings">
                <div className="admin-content-section-heading">
                  <h3>Social links</h3>
                  <p>Choose which social icons appear and update each destination.</p>
                </div>
                {[
                  ["instagram", "Instagram"],
                  ["facebook", "Facebook"],
                  ["whatsapp", "WhatsApp"],
                  ["youtube", "YouTube"],
                ].map(([name, label]) => {
                  const visibilityKey = `footer_${name}`;
                  const urlKey = `footer_${name}_url`;
                  const defaultVisible = name === "instagram"
                    || (name === "whatsapp" && Boolean(content.whatsappNumber));
                  return (
                    <div className="admin-footer-social-row" key={name}>
                      <label className="admin-visibility-switch">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={content.visibility[visibilityKey] ?? defaultVisible}
                          onChange={(event) => updateVisibility(visibilityKey, event.target.checked)}
                        />
                        <span>{label}</span>
                        <small>{(content.visibility[visibilityKey] ?? defaultVisible) ? "Visible" : "Hidden"}</small>
                      </label>
                      <label>
                        {label} link
                        <input
                          type="url"
                          value={content.visibility[urlKey] ?? DEFAULT_FOOTER_SOCIAL_URLS[name]}
                          onChange={(event) => updateVisibility(urlKey, event.target.value)}
                          placeholder={name === "whatsapp" ? "Uses the store WhatsApp number by default" : "https://"}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          {section === "storefront" && (
          <section className="admin-content-section admin-span-two">
            <div className="admin-content-section-heading">
              <h3>Store sections</h3>
              <p>Manage the product area, feature highlights, and coming-soon message.</p>
            </div>
            <div className="admin-content-section-grid">
              <label>Coming soon title<input value={content.comingSoonTitle} onChange={(event) => update("comingSoonTitle", event.target.value)} required /></label>
            </div>
            <VisibilityControls
              title="Store section visibility"
              description="Choose which sections are displayed on the storefront."
              options={storefrontVisibilityOptions}
              visibility={content.visibility}
              onChange={updateVisibility}
            />
            <div className="admin-feature-editor">
              <div className="admin-content-section-heading">
                <h3>Store features</h3>
                <p>Highlight the benefits and services your store offers.</p>
              </div>
              {content.features.map((feature, index) => (
                <div className="admin-feature-editor-row" key={index}>
                  <label>Title<input value={feature.title} onChange={(event) => updateFeature(index, "title", event.target.value)} required /></label>
                  <label>Description<input value={feature.description} onChange={(event) => updateFeature(index, "description", event.target.value)} required /></label>
                  <button className="admin-delete-button" type="button" aria-label={`Remove ${feature.title || "feature"}`} onClick={() => update("features", content.features.filter((_, featureIndex) => featureIndex !== index))}>Remove</button>
                </div>
              ))}
              <button className="admin-secondary-button" type="button" onClick={() => update("features", [...content.features, { title: "", description: "" }])}>Add feature</button>
            </div>
          </section>
          )}
          {error && <AdminNotice kind="error" className="admin-span-two">{error}</AdminNotice>}
          {notice && <AdminNotice kind="success" className="admin-span-two">{notice}</AdminNotice>}
          <div className="admin-form-actions admin-span-two">
            <WorkspaceDraftControls draft={contentDraft} label={sectionLabels[section].toLowerCase()} />
            <button className="admin-primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : `Save ${sectionLabels[section].toLowerCase()}`}</button>
          </div>
        </form>
      )}
      {!loading && !content && error && <AdminNotice kind="error">{error}</AdminNotice>}
    </section>
  );
}