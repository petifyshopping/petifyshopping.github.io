import { adminSupabase } from "../lib/supabase.js";
import { compressImageFile } from "../lib/imageProcessing.js";
import { DEFAULT_ABOUT_CONTENT, normalizeAboutContent } from "../config/siteContent.js";

const imageBucket = "product-images";

export async function getAdminProducts() {
  const [productsResult, inventoryResult] = await Promise.all([
    adminSupabase.from("products").select("*").order("display_order", { ascending: true }),
    adminSupabase.from("product_inventory").select("product_id, quantity"),
  ]);
  if (productsResult.error) throw productsResult.error;
  if (inventoryResult.error) throw inventoryResult.error;

  const stockByProduct = new Map(inventoryResult.data.map((row) => [row.product_id, Number(row.quantity)]));
  return productsResult.data.map((row) => ({
    id: row.id,
    type: row.type,
    sectionId: row.section_id,
    badge: row.badge,
    title: row.title,
    description: row.description,
    specs: row.specs ?? [],
    images: row.images ?? [],
    variants: row.variants ?? [],
    saveTag: row.save_tag ?? "",
    price: row.price ?? "",
    oldPrice: row.old_price ?? "",
    defaultWhatsappMsg: row.default_whatsapp_msg,
    isActive: row.is_active,
    displayOrder: row.display_order,
    stockQuantity: stockByProduct.get(row.id) ?? 0,
  }));
}

export async function getAdminSections() {
  const { data, error } = await adminSupabase
    .from("catalog_sections")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw error;

  return data;
}

export async function getAdminMainSections() {
  const { data, error } = await adminSupabase
    .from("catalog_main_sections")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw error;

  return data;
}

export async function getStoreLogo() {
  const { data, error } = await adminSupabase
    .from("site_settings")
    .select("logo_url")
    .eq("id", "storefront")
    .maybeSingle();
  if (error) throw error;

  return data?.logo_url ?? "";
}

export async function getStoreFavicon() {
  const { data, error } = await adminSupabase
    .from("site_settings")
    .select("favicon_url")
    .eq("id", "storefront")
    .maybeSingle();
  if (error) throw error;

  return data?.favicon_url ?? "";
}

export async function getAppearanceSettings() {
  const { data, error } = await adminSupabase
    .from("site_settings")
    .select("loading_screen, admin_brand")
    .eq("id", "storefront")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Storefront settings are missing from Supabase.");

  return {
    loadingScreen: data.loading_screen ?? null,
    adminBrand: data.admin_brand ?? null,
  };
}

export async function saveAdminBrand(adminBrand) {
  const { error } = await adminSupabase
    .from("site_settings")
    .update({ admin_brand: adminBrand, updated_at: new Date().toISOString() })
    .eq("id", "storefront");
  if (error) throw error;
}

export async function saveLoadingScreen(loadingScreen) {
  const { error } = await adminSupabase
    .from("site_settings")
    .update({ loading_screen: loadingScreen, updated_at: new Date().toISOString() })
    .eq("id", "storefront");
  if (error) throw error;
}

export async function getHeroPills() {
  const { data, error } = await adminSupabase
    .from("site_settings")
    .select("hero_pills")
    .eq("id", "storefront")
    .maybeSingle();
  if (error) throw error;

  return data?.hero_pills ?? [];
}

export async function getStorefrontContent() {
  const { data, error } = await adminSupabase
    .from("site_settings")
    .select("brand_title, tagline, whatsapp_number, phone_display, email, location, features, footer_title, footer_copyright, footer_disclaimer, footer_version, coming_soon_title, visibility")
    .eq("id", "storefront")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Storefront settings are missing from Supabase.");

  const aboutResult = await adminSupabase
    .from("site_settings")
    .select("about_content")
    .eq("id", "storefront")
    .maybeSingle();
  const aboutContentAvailable = aboutResult.error?.code !== "42703";
  if (aboutResult.error && aboutContentAvailable) throw aboutResult.error;

  return {
    brandTitle: data.brand_title,
    tagline: data.tagline,
    whatsappNumber: data.whatsapp_number,
    phoneDisplay: data.phone_display,
    email: data.email,
    location: data.location,
    features: data.features ?? [],
    aboutContent: aboutContentAvailable
      ? normalizeAboutContent(aboutResult.data?.about_content)
      : DEFAULT_ABOUT_CONTENT,
    aboutContentAvailable,
    footerTitle: data.footer_title,
    footerCopyright: data.footer_copyright,
    footerDisclaimer: data.footer_disclaimer,
    footerVersion: data.footer_version,
    comingSoonTitle: data.coming_soon_title,
    visibility: data.visibility ?? {},
  };
}

export async function saveStorefrontContent(content) {
  const { error } = await adminSupabase
    .from("site_settings")
    .update({
      brand_title: content.brandTitle,
      tagline: content.tagline,
      whatsapp_number: content.whatsappNumber,
      phone_display: content.phoneDisplay,
      email: content.email,
      location: content.location,
      features: content.features,
      ...(content.aboutContentAvailable ? { about_content: content.aboutContent } : {}),
      footer_title: content.footerTitle,
      footer_copyright: content.footerCopyright,
      footer_disclaimer: content.footerDisclaimer,
      footer_version: content.footerVersion,
      coming_soon_title: content.comingSoonTitle,
      visibility: content.visibility,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "storefront");
  if (error) throw error;
}

export async function saveHeroPills(heroPills) {
  const { error } = await adminSupabase
    .from("site_settings")
    .update({ hero_pills: heroPills, updated_at: new Date().toISOString() })
    .eq("id", "storefront");
  if (error) throw error;
}

export async function createCatalogSection(section) {
  const { error } = await adminSupabase.from("catalog_sections").insert({
    id: section.id,
    title: section.title,
    display_order: section.displayOrder,
    main_section_id: section.mainSectionId || null,
  });
  if (error) throw error;
}

export async function createCatalogMainSection(section) {
  const { error } = await adminSupabase.from("catalog_main_sections").insert({
    id: section.id,
    title: section.title,
    display_order: section.displayOrder,
  });
  if (error) throw error;
}

export async function renameCatalogSection(sectionId, title) {
  const { error } = await adminSupabase
    .from("catalog_sections")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", sectionId);
  if (error) throw error;
}

export async function renameCatalogMainSection(sectionId, title) {
  const { error } = await adminSupabase
    .from("catalog_main_sections")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", sectionId);
  if (error) throw error;
}

export async function deleteCatalogSection(sectionId) {
  const { error } = await adminSupabase.from("catalog_sections").delete().eq("id", sectionId);
  if (error) throw error;
}

export async function deleteCatalogMainSection(sectionId) {
  const { error: deleteError } = await adminSupabase.from("catalog_main_sections").delete().eq("id", sectionId);
  if (deleteError) throw deleteError;

  const { data, error: settingsError } = await adminSupabase
    .from("site_settings")
    .select("hero_pills")
    .eq("id", "storefront")
    .maybeSingle();
  if (settingsError) {
    throw new Error(`Main section deleted, but hero navigation could not be checked: ${settingsError.message}`);
  }
  if (!data || !Array.isArray(data.hero_pills)) {
    throw new Error("Main section deleted, but the storefront hero navigation is missing or invalid.");
  }

  const target = `#catalog-main-section-${sectionId}`;
  const heroPills = data.hero_pills;
  const nextHeroPills = heroPills.map((pill) => pill?.target === target ? { ...pill, target: "" } : pill);
  if (heroPills.some((pill) => pill?.target === target)) {
    const { error: updateError } = await adminSupabase
      .from("site_settings")
      .update({ hero_pills: nextHeroPills, updated_at: new Date().toISOString() })
      .eq("id", "storefront");
    if (updateError) {
      throw new Error(`Main section deleted, but its hero navigation link could not be cleared: ${updateError.message}`);
    }
  }
}

export async function saveCatalogSectionOrder(sections) {
  const results = await Promise.all(sections.map((section, index) =>
    adminSupabase
      .from("catalog_sections")
      .update({ display_order: index + 1 })
      .eq("id", section.id)
  ));
  const failedUpdate = results.find((result) => result.error);
  if (failedUpdate) throw failedUpdate.error;
}

export async function saveCatalogMainSectionOrder(sections) {
  const results = await Promise.all(sections.map((section, index) =>
    adminSupabase
      .from("catalog_main_sections")
      .update({ display_order: index + 1 })
      .eq("id", section.id)
  ));
  const failedUpdate = results.find((result) => result.error);
  if (failedUpdate) throw failedUpdate.error;
}

export async function setCatalogSectionMainSection(sectionId, mainSectionId) {
  const { error } = await adminSupabase
    .from("catalog_sections")
    .update({
      main_section_id: mainSectionId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sectionId);
  if (error) throw error;
}

export async function updateStoreLogo(file, imageOptions = {}) {
  const [logoUrl] = await uploadProductImages("store-settings", [file], undefined, {
    compress: true,
    maxSizeBytes: 5 * 1024 * 1024,
    maxDimension: 1400,
    ...imageOptions,
  });
  await saveStoreLogoUrl(logoUrl);
  return logoUrl;
}

export async function saveStoreLogoUrl(logoUrl) {
  const { error } = await adminSupabase
    .from("site_settings")
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq("id", "storefront");
  if (error) throw error;
}

export async function updateStoreFavicon(file) {
  const [faviconUrl] = await uploadProductImages("store-settings", [file], undefined, {
    maxSizeBytes: 2 * 1024 * 1024,
  });
  await saveStoreFaviconUrl(faviconUrl);
  return faviconUrl;
}

export async function saveStoreFaviconUrl(faviconUrl) {
  const { error } = await adminSupabase
    .from("site_settings")
    .update({ favicon_url: faviconUrl, updated_at: new Date().toISOString() })
    .eq("id", "storefront");
  if (error) throw error;
}

export async function uploadProductImages(productId, files, onProgress, options = {}) {
  const uploadedUrls = [];
  const uploadFiles = options.compress
    ? await Promise.all(files.map((file) => compressImageFile(file, options)))
    : files;

  for (const [index, file] of uploadFiles.entries()) {
    onProgress?.({ completed: index, total: uploadFiles.length, fileName: file.name });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `${productId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await adminSupabase.storage.from(imageBucket).upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error?.message === "Bucket not found") {
      throw new Error(`The Supabase Storage bucket "${imageBucket}" is missing. Run supabase/02-admin-access.sql in the Supabase SQL Editor, then try again.`);
    }
    if (error) throw error;

    uploadedUrls.push(adminSupabase.storage.from(imageBucket).getPublicUrl(filePath).data.publicUrl);
    onProgress?.({ completed: index + 1, total: uploadFiles.length, fileName: "" });
  }

  return uploadedUrls;
}

export async function saveProduct(product) {
  const row = {
    id: product.id,
    type: product.type,
    section_id: product.sectionId || null,
    badge: product.badge || null,
    title: product.title || null,
    description: product.description || null,
    specs: product.specs,
    images: product.images,
    variants: product.variants ?? [],
    save_tag: product.type === "combo" ? product.saveTag : null,
    price: product.price || null,
    old_price: product.oldPrice || null,
    default_whatsapp_msg: product.defaultWhatsappMsg || null,
    is_active: product.isActive,
    display_order: product.displayOrder,
    updated_at: new Date().toISOString(),
  };

  const query = product.isNew
    ? adminSupabase.from("products").insert(row)
    : adminSupabase.from("products").update(row).eq("id", row.id);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteProduct(product) {
  const { error } = await adminSupabase.from("products").delete().eq("id", product.id);
  if (error?.code === "23503") {
    throw new Error("This product is linked to sales history and cannot be deleted. Hide it instead.");
  }
  if (error) throw error;

  const storagePrefix = `/storage/v1/object/public/${imageBucket}/`;
  const paths = product.images
    .filter((url) => url.includes(storagePrefix))
    .map((url) => url.split(storagePrefix)[1]);

  if (paths.length) {
    const { error: storageError } = await adminSupabase.storage.from(imageBucket).remove(paths);
    if (storageError) {
      throw new Error(`Product deleted, but one or more product photos could not be removed: ${storageError.message}`);
    }
  }
}

export async function setCatalogSectionActive(sectionId, isActive) {
  const { error } = await adminSupabase
    .from("catalog_sections")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", sectionId);
  if (error) throw error;
}

export async function setProductActive(productId, isActive) {
  const { error } = await adminSupabase
    .from("products")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) throw error;
}

export async function setProductPrice(productId, price) {
  const { error } = await adminSupabase
    .from("products")
    .update({ price, updated_at: new Date().toISOString() })
    .eq("id", productId);
  if (error) throw error;
}

export async function setProductStock(productId, quantity) {
  const normalizedQuantity = Number(quantity);
  if (!Number.isSafeInteger(normalizedQuantity) || normalizedQuantity < 0 || normalizedQuantity > 2147483647) {
    throw new Error("Stock must be a whole number of zero or more.");
  }

  const { data, error } = await adminSupabase
    .from("product_inventory")
    .update({ quantity: normalizedQuantity })
    .eq("product_id", productId)
    .select("product_id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Stock was not found. Run the inventory SQL and reload products.");
}