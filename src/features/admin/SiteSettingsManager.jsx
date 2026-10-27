import { useCallback, useEffect, useState } from "react";
import StorefrontContentEditor from "./StorefrontContentEditor.jsx";
import AppearanceSettingsEditor from "./AppearanceSettingsEditor.jsx";
import {
  getStoreFavicon,
  getHeroPills,
  getStoreLogo,
  saveHeroPills,
  saveStoreFaviconUrl,
  saveStoreLogoUrl,
  updateStoreFavicon,
  updateStoreLogo,
  uploadProductImages,
} from "../../services/admin.js";
import useWorkspaceDraft from "../../hooks/useWorkspaceDraft.js";
import WorkspaceDraftControls from "./WorkspaceDraftControls.jsx";
import ImageUploadField from "./components/ImageUploadField.jsx";
import AdminButton from "./components/AdminButton.jsx";
import AdminNotice from "./components/AdminNotice.jsx";
import AdminState from "./components/AdminState.jsx";
import useObjectUrl from "../../hooks/useObjectUrl.js";

export default function SiteSettingsManager({ section, adminBrand, onAdminBrandChange, userId, mainSections, sections, products }) {
  const [storeLogo, setStoreLogo] = useState("");
  const [storeFavicon, setStoreFavicon] = useState("");
  const [heroPills, setHeroPills] = useState([]);
  const [logoFile, setLogoFile] = useState(null);
  const [logoCrop, setLogoCrop] = useState({ aspect: "fit", x: 50, y: 50 });
  const [faviconFile, setFaviconFile] = useState(null);
  const logoPreview = useObjectUrl(logoFile);
  const faviconPreview = useObjectUrl(faviconFile);
  const logoImageOptions = {
    ...(logoCrop.aspect === "wide" ? { cropAspectRatio: 3 } : {}),
    ...(logoCrop.aspect === "square" ? { cropAspectRatio: 1 } : {}),
    cropFocusX: logoCrop.x,
    cropFocusY: logoCrop.y,
  };
  const logoPreviewClass = logoFile && logoCrop.aspect !== "fit"
    ? `admin-logo-crop-preview admin-logo-crop-preview-${logoCrop.aspect}`
    : "admin-logo-crop-preview";
  const [savingLogo, setSavingLogo] = useState(false);
  const [savingFavicon, setSavingFavicon] = useState(false);
  const [savingHeroPills, setSavingHeroPills] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const restoreLogoDraft = useCallback((draft) => setStoreLogo(draft.url ?? ""), []);
  const restoreFaviconDraft = useCallback((draft) => setStoreFavicon(draft.url ?? ""), []);
  const restoreHeroPillsDraft = useCallback((draft) => setHeroPills(draft), []);
  const logoDraft = useWorkspaceDraft({
    userId,
    draftType: "site-assets",
    draftKey: "store-logo",
    value: { url: storeLogo },
    onRestore: restoreLogoDraft,
    ready: !loading,
  });
  const faviconDraft = useWorkspaceDraft({
    userId,
    draftType: "site-assets",
    draftKey: "favicon",
    value: { url: storeFavicon },
    onRestore: restoreFaviconDraft,
    ready: !loading,
  });
  const heroPillsDraft = useWorkspaceDraft({
    userId,
    draftType: "site-assets",
    draftKey: "hero-navigation",
    value: heroPills,
    onRestore: restoreHeroPillsDraft,
    ready: !loading,
  });

  useEffect(() => {
    let active = true;
    Promise.all([getStoreLogo(), getStoreFavicon(), getHeroPills()]).then(([logo, favicon, pills]) => {
      if (!active) return;
      setStoreLogo(logo);
      setStoreFavicon(favicon);
      setHeroPills(pills);
    }).catch((loadError) => {
      if (active) setError(loadError.message || "Site settings could not be loaded.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function submitLogo(event) {
    event.preventDefault();
    if (!logoFile) return;
    const form = event.currentTarget;
    setSavingLogo(true);
    setError("");
    setNotice("");
    try {
      setStoreLogo(await updateStoreLogo(logoFile, logoImageOptions));
      setLogoFile(null);
      setLogoCrop({ aspect: "fit", x: 50, y: 50 });
      form.reset();
      try {
        await logoDraft.clear();
      } catch (clearError) {
        setError(`Logo was saved, but its draft could not be removed: ${clearError.message}`);
        return;
      }
      setNotice("Logo saved.");
    } catch (saveError) {
      setError(saveError.message || "Logo could not be saved.");
    } finally {
      setSavingLogo(false);
    }
  }

  async function submitFavicon(event) {
    event.preventDefault();
    if (!faviconFile) return;
    const form = event.currentTarget;
    setSavingFavicon(true);
    setError("");
    setNotice("");
    try {
      setStoreFavicon(await updateStoreFavicon(faviconFile));
      setFaviconFile(null);
      form.reset();
      try {
        await faviconDraft.clear();
      } catch (clearError) {
        setError(`Favicon was saved, but its draft could not be removed: ${clearError.message}`);
        return;
      }
      setNotice("Favicon saved.");
    } catch (saveError) {
      setError(saveError.message || "Favicon could not be saved.");
    } finally {
      setSavingFavicon(false);
    }
  }

  function updatePill(index, field, value) {
    setHeroPills((current) => current.map((pill, pillIndex) => pillIndex === index ? { ...pill, [field]: value } : pill));
    setNotice("");
  }

  async function submitPills(event) {
    event.preventDefault();
    const nextPills = heroPills.map((pill) => ({ ...pill, label: pill.label.trim() }));
    if (nextPills.some((pill) => !pill.label)) {
      setError("Each navigation item needs a label.");
      return;
    }
    setSavingHeroPills(true);
    setError("");
    setNotice("");
    try {
      await saveHeroPills(nextPills);
      setHeroPills(nextPills);
      try {
        await heroPillsDraft.clear();
      } catch (clearError) {
        setError(`Hero navigation was saved, but its draft could not be removed: ${clearError.message}`);
        return;
      }
      setNotice("Hero navigation saved.");
    } catch (saveError) {
      setError(saveError.message || "Hero navigation could not be saved.");
    } finally {
      setSavingHeroPills(false);
    }
  }

  async function saveAssetDraft(file, setUrl, draft, imageOptions = {}) {
    if (!file) throw new Error("Select an image before saving this asset draft.");
    const [url] = await uploadProductImages("drafts", [file], undefined, {
      compress: true,
      maxSizeBytes: 5 * 1024 * 1024,
      maxDimension: 1400,
      ...imageOptions,
    });
    setUrl(url);
    await draft.saveNow({ url });
  }

  async function applyLogoDraft() {
    try {
      await saveStoreLogoUrl(storeLogo);
      try {
        await logoDraft.clear();
      } catch (clearError) {
        setError(`Store logo draft was applied, but could not be removed: ${clearError.message}`);
        return;
      }
      setNotice("Store logo draft applied.");
    } catch (applyError) {
      setError(applyError.message || "Store logo draft could not be applied.");
    }
  }

  async function applyFaviconDraft() {
    try {
      await saveStoreFaviconUrl(storeFavicon);
      try {
        await faviconDraft.clear();
      } catch (clearError) {
        setError(`Favicon draft was applied, but could not be removed: ${clearError.message}`);
        return;
      }
      setNotice("Favicon draft applied.");
    } catch (applyError) {
      setError(applyError.message || "Favicon draft could not be applied.");
    }
  }

  if (loading) return <AdminState kind="loading" description="Loading site settings..." />;

  return (
    <div className="admin-site-settings">
      {error && <AdminNotice kind="error">{error}</AdminNotice>}
      {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
      {["header", "about", "footer", "storefront"].includes(section) && (
        <StorefrontContentEditor key={section} section={section} userId={userId} />
      )}
      {section === "brand-assets" && (
        <div className="admin-settings-group-content">
      <section className="admin-settings-block" aria-labelledby="admin-logo-settings-title">
        <div className="admin-settings-heading"><div><p className="admin-eyebrow">BRAND ASSET</p><h2 id="admin-logo-settings-title">Store logo</h2></div></div>
        <form className="admin-store-logo" onSubmit={submitLogo}>
          {logoPreview || storeLogo ? (
            <span className={logoPreviewClass}>
              <img
                src={logoPreview || storeLogo}
                alt={logoPreview ? "Selected store logo preview" : "Current store logo"}
                style={logoPreview && logoCrop.aspect !== "fit" ? { objectPosition: `${logoCrop.x}% ${logoCrop.y}%` } : undefined}
              />
            </span>
          ) : <span className="admin-store-logo-empty">No logo uploaded</span>}
          <ImageUploadField label="Upload logo" accept="image/jpeg,image/png,image/webp" maxSizeBytes={5 * 1024 * 1024} hint="JPEG, PNG, or WebP. Resized and compressed before upload; 5 MB maximum." onChange={(files) => setLogoFile(files[0] ?? null)} />
          {logoFile && (
            <div className="admin-logo-crop-controls">
              <label>Image framing
                <select value={logoCrop.aspect} onChange={(event) => setLogoCrop((current) => ({ ...current, aspect: event.target.value }))}>
                  <option value="fit">Keep full image</option>
                  <option value="wide">Crop wide (3:1)</option>
                  <option value="square">Crop square (1:1)</option>
                </select>
              </label>
              {logoCrop.aspect !== "fit" && (
                <>
                  <label>Horizontal crop position
                    <input type="range" min="0" max="100" value={logoCrop.x} onChange={(event) => setLogoCrop((current) => ({ ...current, x: Number(event.target.value) }))} />
                  </label>
                  <label>Vertical crop position
                    <input type="range" min="0" max="100" value={logoCrop.y} onChange={(event) => setLogoCrop((current) => ({ ...current, y: Number(event.target.value) }))} />
                  </label>
                </>
              )}
            </div>
          )}
          <div className="admin-form-actions">
            <WorkspaceDraftControls draft={logoDraft} label="store logo" canSave={Boolean(logoFile)} onSave={() => saveAssetDraft(logoFile, setStoreLogo, logoDraft, logoImageOptions)} />
            {logoDraft.restored && <AdminButton variant="primary" onClick={applyLogoDraft}>Apply saved logo</AdminButton>}
            <AdminButton variant="primary" type="submit" disabled={savingLogo || !logoFile}>{savingLogo ? "Uploading..." : "Apply logo"}</AdminButton>
          </div>
        </form>
      </section>
      <section className="admin-settings-block" aria-labelledby="admin-favicon-settings-title">
        <div className="admin-settings-heading"><div><p className="admin-eyebrow">BRAND ASSET</p><h2 id="admin-favicon-settings-title">Browser favicon</h2></div></div>
        <form className="admin-store-favicon" onSubmit={submitFavicon}>
          <span className="admin-favicon-preview">
            {faviconPreview || storeFavicon
              ? <img src={faviconPreview || storeFavicon} alt={faviconPreview ? "Selected favicon preview" : "Current browser favicon"} />
              : <span className="admin-store-logo-empty">Default icon</span>}
          </span>
          <ImageUploadField label="Upload favicon" accept="image/*,.ico" maxSizeBytes={2 * 1024 * 1024} onChange={(files) => setFaviconFile(files[0] ?? null)} />
          <div className="admin-form-actions">
            <WorkspaceDraftControls draft={faviconDraft} label="favicon" canSave={Boolean(faviconFile)} onSave={() => saveAssetDraft(faviconFile, setStoreFavicon, faviconDraft)} />
            {faviconDraft.restored && <AdminButton variant="primary" onClick={applyFaviconDraft}>Apply saved favicon</AdminButton>}
            <AdminButton variant="primary" type="submit" disabled={savingFavicon || !faviconFile}>{savingFavicon ? "Uploading..." : "Apply favicon"}</AdminButton>
          </div>
        </form>
      </section>
          </div>
      )}
      {section === "header" && (
      <section className="admin-settings-block" aria-labelledby="admin-navigation-settings-title">
        <div className="admin-settings-heading">
          <div><p className="admin-eyebrow">STOREFRONT NAVIGATION</p><h2 id="admin-navigation-settings-title">Hero navigation</h2></div>
          <button className="admin-secondary-button" type="button" onClick={() => setHeroPills((current) => [...current, { id: crypto.randomUUID(), label: "New link", target: "" }])}>Add link</button>
        </div>
        <form className="admin-hero-pills" onSubmit={submitPills}>
          {heroPills.map((pill, index) => (
            <div className="admin-hero-pill-row" key={pill.id}>
              <label>Label<input value={pill.label} onChange={(event) => updatePill(index, "label", event.target.value)} required /></label>
              <label>Destination
                <select value={pill.target || ""} onChange={(event) => updatePill(index, "target", event.target.value)}>
                  <option value="">No destination</option>
                  <option value="#site-header">Header</option>
                  {mainSections.filter((mainSection) => sections.some((section) => section.is_active && section.main_section_id === mainSection.id && products.some((product) => product.sectionId === section.id && product.isActive))).map((mainSection) => (
                    <option key={mainSection.id} value={`#catalog-main-section-${mainSection.id}`}>{mainSection.title}</option>
                  ))}
                  {sections.filter((section) => section.is_active && products.some((product) => product.sectionId === section.id && product.isActive)).map((section) => (
                    <option key={section.id} value={`#catalog-section-${section.id}`}>{section.main_section_id ? `↳ ${section.title}` : section.title}</option>
                  ))}
                  <option value="#site-footer">Footer</option>
                </select>
              </label>
              <button className="admin-delete-button" type="button" aria-label={`Remove ${pill.label || "navigation link"}`} onClick={() => setHeroPills((current) => current.filter((_, pillIndex) => pillIndex !== index))}>Remove</button>
            </div>
          ))}
          <div className="admin-form-actions">
            <WorkspaceDraftControls draft={heroPillsDraft} label="hero navigation" />
            <button className="admin-primary-button" type="submit" disabled={savingHeroPills}>{savingHeroPills ? "Saving..." : "Apply navigation"}</button>
          </div>
        </form>
      </section>
      )}
      {section === "appearance" && (
        <AppearanceSettingsEditor adminBrand={adminBrand} onAdminBrandChange={onAdminBrandChange} userId={userId} />
      )}
    </div>
  );
}