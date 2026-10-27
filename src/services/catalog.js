import { supabase } from "../lib/supabase.js";
import { DEFAULT_ABOUT_CONTENT, normalizeAboutContent } from "../config/siteContent.js";

function mapProduct(row) {
  return {
    id: row.id,
    type: row.type,
    sectionId: row.section_id,
    badge: row.badge,
    title: row.title,
    description: row.description,
    specs: row.specs ?? [],
    images: row.images ?? [],
    variants: row.variants ?? [],
    saveTag: row.save_tag,
    price: row.price,
    oldPrice: row.old_price,
    defaultWhatsappMsg: row.default_whatsapp_msg,
    isActive: row.is_active,
  };
}

function mapSettings(row, aboutContent, aboutContentAvailable) {
  return {
    brandTitle: row.brand_title,
    tagline: row.tagline,
    logoUrl: row.logo_url ?? "",
    faviconUrl: row.favicon_url ?? "",
    colorPalette: row.color_palette ?? null,
    loadingScreen: row.loading_screen ?? null,
    adminBrand: row.admin_brand ?? null,
    customerOrderContactFields: {
      email: row.customer_order_contact_fields?.email === true,
      phone: row.customer_order_contact_fields?.phone !== false,
      whatsapp: row.customer_order_contact_fields?.whatsapp === true,
    },
    heroPills: row.hero_pills ?? [],
    contact: {
      whatsappNumber: row.whatsapp_number,
      phoneDisplay: row.phone_display,
      email: row.email,
      location: row.location,
    },
    features: row.features ?? [],
    aboutContent,
    aboutContentAvailable,
    footerTitle: row.footer_title,
    footerCopyright: row.footer_copyright,
    footerDisclaimer: row.footer_disclaimer,
    footerVersion: row.footer_version,
    comingSoonTitle: row.coming_soon_title,
    visibility: row.visibility ?? {},
  };
}

async function getAboutContentSettings() {
  const { data, error } = await supabase
    .from("site_settings")
    .select("about_content")
    .eq("id", "storefront")
    .maybeSingle();
  if (error?.code === "42703") {
    return { content: DEFAULT_ABOUT_CONTENT, available: false };
  }
  if (error) throw error;

  return { content: normalizeAboutContent(data?.about_content), available: true };
}

export async function getCatalog(onSettingsLoaded) {
  if (!supabase) {
    return {
      products: [],
      sections: [],
      mainSections: [],
      settings: null,
      error: new Error("Supabase is not configured."),
    };
  }

  const settingsRequest = supabase
    .from("site_settings")
    .select("logo_url, favicon_url, color_palette, loading_screen, admin_brand, customer_order_contact_fields, hero_pills, brand_title, tagline, whatsapp_number, phone_display, email, location, features, footer_title, footer_copyright, footer_disclaimer, footer_version, coming_soon_title, visibility")
    .eq("id", "storefront")
    .maybeSingle();
  const settingsPromise = Promise.all([settingsRequest, getAboutContentSettings()]).then(([result, about]) => {
    if (!result.error && result.data) {
      onSettingsLoaded?.(mapSettings(result.data, about.content, about.available));
    }
    return { result, about };
  });
  const [productsResult, sectionsResult, mainSectionsResult, settingsBundle] = await Promise.all([
    supabase
      .from("products")
      .select("*", { count: "exact" })
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .range(0, 23),
    supabase
      .from("catalog_sections")
      .select("id, title, display_order, main_section_id")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("catalog_main_sections")
      .select("id, title, display_order")
      .order("display_order", { ascending: true }),
    settingsPromise,
  ]);
  const { result: settingsResult, about } = settingsBundle;

  if (productsResult.error || sectionsResult.error || mainSectionsResult.error || settingsResult.error) {
    return {
      products: [],
      sections: [],
      mainSections: [],
      settings: null,
      error: productsResult.error || sectionsResult.error || mainSectionsResult.error || settingsResult.error,
    };
  }

  const row = settingsResult.data;
  if (!row) {
    return {
      products: productsResult.data.map(mapProduct),
      totalProducts: productsResult.count ?? productsResult.data.length,
      sections: sectionsResult.data,
      mainSections: mainSectionsResult.data,
      settings: null,
      error: new Error("Storefront settings are missing from Supabase."),
    };
  }

  return {
    products: productsResult.data.map(mapProduct),
    totalProducts: productsResult.count ?? productsResult.data.length,
    sections: sectionsResult.data,
    mainSections: mainSectionsResult.data,
    settings: mapSettings(row, about.content, about.available),
    error: null,
  };
}

export async function getMoreCatalogProducts(offset, pageSize = 24) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, count, error } = await supabase
    .from("products")
    .select("*", { count: "exact" })
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .range(offset, offset + pageSize - 1);
  if (error) throw error;
  return { products: data.map(mapProduct), totalProducts: count ?? offset + data.length };
}

export async function getCatalogProductsByIds(ids) {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .in("id", ids);
  if (error) throw error;
  return data.map(mapProduct);
}