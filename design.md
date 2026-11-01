# Petify design system

## Direction

Petify uses the Squeeze theme's rounded, friendly forms and Gabarito display type, remapped to the existing Petify blue, white, and warm accent. The storefront is a product-led catalogue: a real catalog item introduces the page, category controls filter the existing inventory, and each product keeps its current detail, cart, and WhatsApp actions.

## Tokens

- Primary blue: `#1d4ed8`; deep blue: `#1e3a8a`.
- Paper: warm-tinted white; supporting surfaces: pale blue.
- Accent: Petify's existing warm orange, used for a small number of actions and focus states.
- Display: Gabarito. Body and controls: Manrope.
- Rounded product media and controls; one soft shadow on each independent product surface.
- Responsive container capped at 1440px with 64px desktop gutters.

The shared scale and palette live in `src/styles/tokens.css`; base rules live in `src/styles/base.css`; page and workspace overrides live in `src/styles/70-hallmark.css`.

## Storefront behavior

- Keep the sticky header's brand, search, cart, menu/account, About link, configurable store links, and their existing handlers.
- Search results suppress the introductory hero so matching products remain the first content.
- The hero's product and image come from the live catalog. Do not replace them with stock photography, invented prices, claims, or testimonials.
- Keep category filtering, product details, variants, cart updates, direct ordering, load-more, About, and footer contact/social links wired to their current data and handlers.
- On narrow screens, the hero and product grid stack without horizontal scrolling.

## Supporting screens

- About presents the existing mission, vision, team, and Instagram information as a compact index, with its current contact and store links.
- Admin login and workspace screens keep their existing routes, forms, and controls; the redesign changes their presentation, not their workflows.
