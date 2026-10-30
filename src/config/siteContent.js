export const DEFAULT_ABOUT_CONTENT = {
  title: "Thoughtful care for extraordinary companions",
  introduction: "Petify brings together thoughtfully selected pet essentials, specialized nutrition, and habitat products to support the everyday wellbeing of the animals we love.",
  mission: "To make thoughtful pet care easier by bringing useful products and caring guidance together in one place.",
  vision: "A world where every companion, big or small, feathered or finned, has the care, nutrition, and environment it needs to thrive.",
  whoWeAre: "Petify is a pet-care store for people who want to make informed, caring choices for their companions. Our collection brings everyday essentials together with specialist products for a range of pets. Have a question about a product? Our team is here to help.",
};

export function normalizeAboutContent(aboutContent) {
  return Object.fromEntries(
    Object.entries(DEFAULT_ABOUT_CONTENT).map(([key, defaultValue]) => [
      key,
      typeof aboutContent?.[key] === "string" && aboutContent[key].trim()
        ? aboutContent[key]
        : defaultValue,
    ]),
  );
}
