import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { uploadProductImages, saveProduct, setProductStock } from "../../../services/admin.js";
import { formatProductPrice } from "../../../lib/productPricing.js";
import useWorkspaceDraft from "../../../hooks/useWorkspaceDraft.js";
import { parseVariantPrice, slugify } from "./productUtils.js";
import useConfirmDialog from "../../../hooks/useConfirmDialog.js";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import ImageUploadField from "../components/ImageUploadField.jsx";
import AdminButton from "../components/AdminButton.jsx";
import AdminNotice from "../components/AdminNotice.jsx";

const defaultOrderMessagePrefix = "Hi Petify, I want to order ";

function isDefaultOrderMessage(message, title) {
  if (!message) return true;
  if (message === `${defaultOrderMessagePrefix}${title}`) return true;
  if (!message.startsWith(defaultOrderMessagePrefix)) return false;
  return title.startsWith(message.slice(defaultOrderMessagePrefix.length));
}

export default function ProductEditor({ product, draft, products, mainSections, sections, userId, onCancel, onDraftChange, onDraftSaved, onSave }) {
  const [isEditing, setIsEditing] = useState(() => draft?.isEditing ?? Boolean(product.id));
  const [initialProductState] = useState(() => ({
    form: {
      ...product,
      variants: product.variants ?? [],
      variantsEnabled: Boolean(product.variants?.length),
    },
    images: product.images ?? [],
  }));
  const { form: initialForm, images: initialImages } = initialProductState;
  const [resetForm, setResetForm] = useState(initialForm);
  const [resetImages, setResetImages] = useState(initialImages);
  const [startingForm, setStartingForm] = useState(() => ({ ...initialForm, ...(draft?.form ?? {}) }));
  const [startingImages, setStartingImages] = useState(draft?.images ?? initialImages);
  const savedDraftAtOpenRef = useRef(Boolean(draft?.isSavedDraft));
  const [form, setForm] = useState(() => ({
    ...initialForm,
    ...(draft?.form ?? {}),
  }));
  const [productIdCustomized, setProductIdCustomized] = useState(() => (
    !product.id && Boolean(draft?.form?.id) && draft.form.id !== slugify(draft.form.title)
  ));
  const [imageItems, setImageItems] = useState(() => (draft?.images ?? product.images ?? []).map((url, index) => ({ id: `existing-${index}`, url })));
  const [recoveredPhotoCount, setRecoveredPhotoCount] = useState(() => draft?.pendingPhotoCount ?? 0);
  const previewUrls = useRef(new Set());
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const addImageFiles = useCallback((files) => {
    const selected = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      return { id: crypto.randomUUID(), file, previewUrl };
    });
    setImageItems((current) => [...current, ...selected]);
  }, []);
  const { confirm, dialogProps } = useConfirmDialog();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const cancelHandlerRef = useRef(null);
  const currentImageUrls = imageItems.filter((item) => item.url).map((item) => item.url);
  const isDirty = JSON.stringify(form) !== JSON.stringify(startingForm)
    || JSON.stringify(currentImageUrls) !== JSON.stringify(startingImages)
    || imageItems.some((item) => item.file)
    || recoveredPhotoCount > 0;
  const hasData = JSON.stringify(form) !== JSON.stringify(resetForm)
    || JSON.stringify(currentImageUrls) !== JSON.stringify(resetImages)
    || imageItems.some((item) => item.file)
    || recoveredPhotoCount > 0;
  const cloudDraftKey = draft?.key ?? product.id ?? "new-product";
  const cloudDraftValue = useMemo(() => ({
    form,
    images: imageItems.filter((item) => item.url).map((item) => item.url),
  }), [form, imageItems]);
  const restoreProductDraft = useCallback((savedDraft) => {
    savedDraftAtOpenRef.current = true;
    if (savedDraft?.form) {
      const restoredForm = { ...initialForm, ...savedDraft.form };
      setStartingForm(restoredForm);
      setForm((current) => ({ ...current, ...savedDraft.form }));
    }
    if (Array.isArray(savedDraft?.images)) {
      setStartingImages(savedDraft.images);
      setImageItems(savedDraft.images.map((url, index) => ({ id: `cloud-${index}`, url })));
    }
  }, [initialForm]);
  const shouldSaveProductDraft = useCallback((value) => (
    isEditing
      ? JSON.stringify(value.form) !== JSON.stringify(resetForm)
        || JSON.stringify(value.images) !== JSON.stringify(resetImages)
      : Boolean(
      value.form.title?.trim()
      || value.form.description?.trim()
      || value.form.badge?.trim()
      || value.form.specsText?.trim()
      || value.form.defaultWhatsappMsg?.trim()
      || value.form.price
      || value.form.oldPrice
      || value.form.saveTag?.trim()
      || value.form.type !== "single"
      || value.form.variantsEnabled
      || value.form.variants?.some((variant) => variant.label?.trim() || variant.price || variant.oldPrice)
      || value.images.length
      || !value.form.isActive
      )
  ), [isEditing, resetForm, resetImages]);
  const productDraft = useWorkspaceDraft({
    userId,
    draftType: "product",
    draftKey: cloudDraftKey,
    value: cloudDraftValue,
    onRestore: restoreProductDraft,
    shouldSave: shouldSaveProductDraft,
  });

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        if (dialogRef.current?.querySelector('[role="alertdialog"]')) return;
        event.preventDefault();
        void cancelHandlerRef.current?.();
      }
      if (event.key !== "Tab") return;
      const focusable = [...(dialogRef.current?.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
      ) ?? [])].filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    onDraftChange({
      product: { ...form, images: imageItems.filter((item) => item.url).map((item) => item.url) },
      isEditing,
      isSavedDraft: savedDraftAtOpenRef.current,
      form,
      images: imageItems.filter((item) => item.url).map((item) => item.url),
      pendingPhotoCount: recoveredPhotoCount + imageItems.filter((item) => item.file).length,
    });
  }, [form, imageItems, recoveredPhotoCount, onDraftChange, isEditing]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function addVariant() {
    setForm((current) => ({
      ...current,
      variants: [...(current.variants ?? []), {
        id: crypto.randomUUID(),
        label: "",
        price: "",
        oldPrice: "",
      }],
    }));
  }

  function updateVariant(variantId, field, value) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant) => (
        variant.id === variantId ? { ...variant, [field]: value } : variant
      )),
    }));
  }

  function removeVariant(variantId) {
    setForm((current) => ({
      ...current,
      variants: current.variants.filter((variant) => variant.id !== variantId),
    }));
  }

  function toggleVariants(enabled) {
    setForm((current) => {
      if (enabled) return { ...current, variantsEnabled: true };
      const firstVariant = current.variants?.[0];
      if (!firstVariant) return { ...current, variantsEnabled: false, variants: [] };
      const price = parseVariantPrice(firstVariant.price);
      const oldPrice = firstVariant.oldPrice ? parseVariantPrice(firstVariant.oldPrice) : Number.NaN;
      return {
        ...current,
        variantsEnabled: false,
        variants: [],
        price: Number.isFinite(price) ? formatProductPrice(price) : current.price,
        oldPrice: Number.isFinite(oldPrice) ? formatProductPrice(oldPrice) : "",
      };
    });
  }

  function updateTitle(title) {
    setForm((current) => ({
      ...current,
      title,
      id: isEditing || productIdCustomized ? current.id : slugify(title),
      defaultWhatsappMsg: isDefaultOrderMessage(current.defaultWhatsappMsg, current.title)
        ? `${defaultOrderMessagePrefix}${title}`
        : current.defaultWhatsappMsg,
    }));
  }

  function moveImage(index, direction) {
    setImageItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setUploadProgress({ message: "Preparing product save...", percent: 3 });

    try {
    const enteredId = form.id.trim();
    const suggestedId = enteredId || slugify(form.title);
    const id = isEditing
      ? enteredId
      : suggestedId && (!products.some((existingProduct) => existingProduct.id === suggestedId) || productIdCustomized)
        ? suggestedId
        : `product-${crypto.randomUUID()}`;
      const stockText = String(form.stockQuantity ?? 0);
      const stockQuantity = Number(stockText);
      if (!/^\d+$/.test(stockText) || !Number.isSafeInteger(stockQuantity) || stockQuantity < 0 || stockQuantity > 2147483647) {
        throw new Error("Stock must be a whole number of zero or more.");
      }
      if (!isEditing && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
        throw new Error("Product IDs must use lowercase letters, numbers, and single hyphens between words.");
      }
      if (!isEditing && products.some((existingProduct) => existingProduct.id === id)) {
        throw new Error(`The product ID "${id}" is already in use. Choose a different ID.`);
      }
      const variants = form.variantsEnabled
        ? form.variants.map((variant) => ({
          ...variant,
          label: variant.label.trim(),
          price: String(variant.price ?? "").trim() ? parseVariantPrice(variant.price) : null,
          oldPrice: variant.oldPrice === null || variant.oldPrice === undefined || String(variant.oldPrice).trim() === ""
            ? null
            : parseVariantPrice(variant.oldPrice),
        }))
        : [];
      if (variants.some((variant) => (
        (variant.price !== null && (!Number.isFinite(variant.price) || variant.price < 0))
        || (variant.oldPrice !== null && (!Number.isFinite(variant.oldPrice) || variant.oldPrice < 0))
      ))) {
        throw new Error("Variety prices and previous prices must be valid amounts when entered.");
      }
      const filledVariantLabels = variants.map((variant) => variant.label.toLowerCase()).filter(Boolean);
      if (new Set(filledVariantLabels).size !== filledVariantLabels.length) {
        throw new Error("Each variety needs a unique label.");
      }
      const queuedFiles = imageItems.filter((item) => item.file);
      const uploaded = queuedFiles.length
        ? await uploadProductImages(id, queuedFiles.map((item) => item.file), ({ completed, total, fileName }) => {
          const percent = Math.round(5 + (completed / total) * 80);
          setUploadProgress({
            message: fileName ? `Uploading photo ${completed + 1} of ${total}` : `Uploaded ${completed} of ${total} photos`,
            currentFile: fileName,
            percent,
          });
        }, { compress: true, maxSizeBytes: 10 * 1024 * 1024, maxDimension: 1800 })
        : [];
      let uploadedIndex = 0;
      const images = imageItems.map((item) => item.file ? uploaded[uploadedIndex++] : item.url);
      setUploadProgress({ message: "Saving product details...", percent: 92 });
      await saveProduct({
        ...form,
        id,
        isNew: !isEditing,
        specs: form.specsText.split("\n").map((item) => item.trim()).filter(Boolean),
        images,
        variants,
        displayOrder: Number(form.displayOrder) || 0,
      });
      try {
        await setProductStock(id, stockQuantity);
      } catch (stockError) {
        const persistedForm = {
          ...form,
          id,
          stockQuantity: isEditing ? Number(product.stockQuantity ?? 0) : 0,
        };
        setIsEditing(true);
        setResetForm(persistedForm);
        setResetImages(images);
        setStartingForm(persistedForm);
        setStartingImages(images);
        savedDraftAtOpenRef.current = false;
        await onSave({ closeEditor: false });
        setUploadProgress(null);
        setError(`Product details were saved, but stock could not be updated: ${stockError.message}`);
        return;
      }
      let draftRemovalError = null;
      try {
        await productDraft.clear();
      } catch (clearError) {
        draftRemovalError = clearError;
      }
      setUploadProgress({ message: "Product saved", percent: 100 });
      await onDraftSaved?.();
      await onSave();
      if (draftRemovalError) {
        setError(`Product was published, but its saved draft could not be removed: ${draftRemovalError.message}`);
      }
    } catch (saveError) {
      setUploadProgress(null);
      setError(saveError.message || "The product could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProductDraft() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const queuedFiles = imageItems.filter((item) => item.file);
      const uploadedImages = queuedFiles.length
        ? await uploadProductImages("drafts", queuedFiles.map((item) => item.file), undefined, {
          compress: true,
          maxSizeBytes: 10 * 1024 * 1024,
          maxDimension: 1800,
        })
        : [];
      let uploadedIndex = 0;
      const images = imageItems.map((item) => item.file ? uploadedImages[uploadedIndex++] : item.url).filter(Boolean);
      const savedDraft = { form, images };
      await productDraft.saveNow(savedDraft);
      setImageItems(images.map((url, index) => ({ id: `draft-${index}`, url })));
      await onDraftSaved?.();
      setNotice("Product draft saved to your account. It is not published to the storefront.");
      return true;
    } catch (draftError) {
      setError(draftError.message || "Product draft could not be saved.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function requestCancel() {
    if (!productDraft.loaded || busy) return;
    if (isDirty && !await confirm({
      title: "Discard unsaved product changes?",
      description: "Your changes will be discarded. Choose Save as draft to keep them for later.",
      confirmLabel: "Discard changes",
    })) return;

    if (isDirty) {
      try {
        await productDraft.clear();
        if (savedDraftAtOpenRef.current) {
          await productDraft.saveNow({
            form: startingForm,
            images: startingImages,
          });
        }
        await onDraftSaved?.();
      } catch (draftError) {
        setError(draftError.message || "Unsaved product changes could not be discarded.");
        return;
      }
    }
    onCancel();
  }
  useEffect(() => {
    cancelHandlerRef.current = requestCancel;
  });

  async function clearAllData() {
    if (hasData && !await confirm({
      title: "Clear all unsaved product data?",
      description: "The form will return to its starting values.",
      confirmLabel: "Clear data",
    })) return;
    try {
      await productDraft.clear();
      imageItems.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      previewUrls.current.clear();
      setForm(resetForm);
      setImageItems(resetImages.map((url, index) => ({ id: `existing-${index}`, url })));
      setStartingForm(resetForm);
      setStartingImages(resetImages);
      savedDraftAtOpenRef.current = false;
      setRecoveredPhotoCount(0);
      setProductIdCustomized(false);
      setError("");
      setNotice(hasData ? "Unsaved product data cleared." : "");
      await onDraftSaved?.();
    } catch (clearError) {
      setError(clearError.message || "Product data could not be cleared.");
    }
  }

  return createPortal(
    <div className="admin-editor-backdrop">
      <section className="admin-editor-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="admin-product-editor-title">
        <form className="admin-editor" onSubmit={submit}>
          <ConfirmDialog {...dialogProps} />
          <div className="admin-editor-heading">
            <div>
              <p className="admin-eyebrow">{isEditing ? "EDIT PRODUCT" : "NEW PRODUCT"}</p>
              <h2 id="admin-product-editor-title">{isEditing ? form.title || "Untitled product" : "Add a product"}</h2>
            </div>
            <AdminButton ref={closeButtonRef} aria-label="Close product editor" onClick={requestCancel} disabled={!productDraft.loaded || busy}>×</AdminButton>
          </div>
          {recoveredPhotoCount > 0 && (
            <p className="admin-muted" role="status">
              Your product draft was restored, but {recoveredPhotoCount} newly selected {recoveredPhotoCount === 1 ? "photo was" : "photos were"} not retained by the browser. Please select {recoveredPhotoCount === 1 ? "it" : "them"} again before saving.
            </p>
          )}
          {productDraft.error && <AdminNotice kind="error">{productDraft.error}</AdminNotice>}
          {productDraft.restored && <AdminNotice kind="success">Saved product draft restored. Storefront changes remain unpublished until you publish this product.</AdminNotice>}
          <fieldset className="admin-form-grid admin-editor-fields" disabled={!productDraft.loaded || busy}>
            <label>Subsection
              <select value={form.sectionId} onChange={(event) => update("sectionId", event.target.value)}>
                <option value="">No subsection (not shown in catalog)</option>
                {sections.map((section) => {
                  const mainSection = mainSections.find((item) => item.id === section.main_section_id);
                  return <option key={section.id} value={section.id}>{mainSection ? `${mainSection.title} / ` : ""}{section.title}</option>;
                })}
              </select>
            </label>
            <label>Product type
              <select value={form.type} onChange={(event) => update("type", event.target.value)}>
                <option value="single">Standard product</option>
                <option value="combo">Combo offer</option>
              </select>
            </label>
            <label>Badge<input value={form.badge} onChange={(event) => update("badge", event.target.value)} /></label>
            <label className="admin-span-two">Product name<input value={form.title} onChange={(event) => updateTitle(event.target.value)} /></label>
            {isEditing ? (
              <label>Product ID<input value={form.id} readOnly /><span className="admin-field-hint">This ID is fixed after creation because it identifies the saved product and its image folder.</span></label>
            ) : (
              <label className="admin-span-two">Product ID<input value={form.id} onChange={(event) => {
                setProductIdCustomized(true);
                update("id", event.target.value);
              }} aria-describedby="product-id-hint" />
                <span className="admin-field-hint" id="product-id-hint">
                  Suggested from the product name: <strong>{slugify(form.title) || "Generated when saved"}</strong>. This unique ID identifies the product and its image folder. You can change it before saving; use lowercase letters, numbers, and hyphens.
                </span>
              </label>
            )}
            <label>Display order<input type="number" min="0" step="1" value={form.displayOrder} onChange={(event) => update("displayOrder", event.target.value)} /></label>
                  <label>Stock quantity<input type="number" inputMode="numeric" min="0" step="1" value={form.stockQuantity ?? 0} onChange={(event) => update("stockQuantity", event.target.value)} /></label>
            <label className="admin-span-two">Description<textarea rows="3" value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
            {form.type === "single" && <label className="admin-span-two">Product details, one per line<textarea rows="4" value={form.specsText} onChange={(event) => update("specsText", event.target.value)} placeholder={"Material: Cotton\nSize: Medium"} /></label>}
            {form.type === "combo" && <label>Offer tag<input value={form.saveTag} onChange={(event) => update("saveTag", event.target.value)} placeholder="SAVE ₹65" /></label>}
            <label className="admin-checkbox admin-span-two"><input type="checkbox" checked={Boolean(form.variantsEnabled)} onChange={(event) => toggleVariants(event.target.checked)} /> This product has purchasable varieties with different prices</label>
            {form.variantsEnabled ? (
              <fieldset className="product-variants-editor admin-span-two">
                <legend>Varieties and prices</legend>
                <p className="admin-field-hint">Add one option per size, pack quantity, or type. Keep the three gallery photos in Product photos; those are the product gallery, not separate varieties.</p>
                {(form.variants ?? []).map((variant, index) => (
                  <div className="product-variant-row" key={variant.id}>
                    <label>Option label<input value={variant.label} onChange={(event) => updateVariant(variant.id, "label", event.target.value)} placeholder="e.g. 250 g, 500 g, Pack of 4" /></label>
                    <label>Price (₹)<input type="text" inputMode="decimal" value={variant.price} onChange={(event) => updateVariant(variant.id, "price", event.target.value)} placeholder="1,299" /></label>
                    <label>Previous price (₹)<input type="text" inputMode="decimal" value={variant.oldPrice ?? ""} onChange={(event) => updateVariant(variant.id, "oldPrice", event.target.value)} placeholder="Optional" /></label>
                    <button className="admin-delete-button" type="button" aria-label={`Remove variety ${index + 1}`} onClick={() => removeVariant(variant.id)}>Remove</button>
                  </div>
                ))}
                <button className="admin-secondary-button" type="button" onClick={addVariant}>Add variety</button>
              </fieldset>
            ) : (
              <>
                <label>Price<input type="text" inputMode="decimal" value={form.price} onChange={(event) => update("price", event.target.value)} placeholder="₹1,299" /></label>
                <label>Previous price<input type="text" inputMode="decimal" value={form.oldPrice} onChange={(event) => update("oldPrice", event.target.value)} placeholder="₹1,499" /></label>
              </>
            )}
            <label className="admin-span-two">WhatsApp order message<input value={form.defaultWhatsappMsg} onChange={(event) => update("defaultWhatsappMsg", event.target.value)} /></label>
            <div className="admin-image-picker-actions admin-span-two">
              <ImageUploadField
                label="Choose photos"
                multiple
                maxSizeBytes={10 * 1024 * 1024}
                hint="Select multiple photos from your library. Images are resized and compressed before upload."
                onChange={addImageFiles}
              />
              <ImageUploadField
                label="Take a photo"
                capture="environment"
                maxSizeBytes={10 * 1024 * 1024}
                onChange={addImageFiles}
              />
            </div>
            {imageItems.length > 0 && (
              <div className="admin-image-list admin-span-two" aria-label="Product photo order">
                {imageItems.map((item, index) => (
                  <div className="admin-image-item" key={item.id}>
                    <img src={item.previewUrl || item.url} alt={`${form.title} photo ${index + 1}`} />
                    <span className="admin-image-order">Photo {index + 1}{item.file ? " · New" : ""}</span>
                    <div className="admin-image-actions">
                      <button className="admin-secondary-button" type="button" title="Move earlier" aria-label={`Move photo ${index + 1} earlier`} disabled={index === 0} onClick={() => moveImage(index, -1)}>↑</button>
                      <button className="admin-secondary-button" type="button" title="Move later" aria-label={`Move photo ${index + 1} later`} disabled={index === imageItems.length - 1} onClick={() => moveImage(index, 1)}>↓</button>
                      <button className="admin-remove-image-button" type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => {
                        setImageItems((current) => current.filter((_, imageIndex) => imageIndex !== index));
                        if (item.previewUrl) {
                          URL.revokeObjectURL(item.previewUrl);
                          previewUrls.current.delete(item.previewUrl);
                        }
                      }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <label className="admin-checkbox admin-span-two"><input type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} /> Visible in the storefront</label>
          </fieldset>
          {error && <AdminNotice kind="error">{error}</AdminNotice>}
          {notice && <AdminNotice kind="success">{notice}</AdminNotice>}
          {uploadProgress && (
            <div className="admin-upload-progress" role="status" aria-live="polite">
              <div className="admin-upload-progress-label"><span>{uploadProgress.message}</span><span>{uploadProgress.percent}%</span></div>
              <div className="admin-upload-progress-track" role="progressbar" aria-label="Product save progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={uploadProgress.percent}>
                <div className="admin-upload-progress-fill" style={{ width: `${uploadProgress.percent}%` }} />
              </div>
              {uploadProgress.currentFile && <p className="admin-field-hint">{uploadProgress.currentFile}</p>}
            </div>
          )}
          <div className="admin-form-actions">
            <AdminButton type="button" onClick={requestCancel} disabled={!productDraft.loaded || busy}>Cancel</AdminButton>
            <AdminButton type="button" onClick={clearAllData} disabled={busy || !productDraft.loaded}>{isEditing ? "Reset changes" : "Clear all"}</AdminButton>
            {!isEditing && <AdminButton type="button" onClick={async () => { if (await saveProductDraft()) onCancel(); }} disabled={!productDraft.loaded || busy}>{productDraft.saving || busy ? "Saving draft..." : "Save as draft"}</AdminButton>}
            <AdminButton variant="primary" type="submit" disabled={busy || !productDraft.loaded}>{busy ? "Saving product..." : isEditing ? "Save changes" : "Save product"}</AdminButton>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
