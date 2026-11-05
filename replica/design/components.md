# Petify admin component notes

The admin uses the project's existing CSS token system; `tokens.css` aliases
those runtime variables so palette changes continue to flow from the existing
appearance settings. The project does not use Tailwind, so no Tailwind mapping
is needed.

## Global workspace shell

- **Header:** Petify brand mark, current section context, existing catalog
  search when relevant, and the current account control. Sticky, responsive,
  glass-styled with the configured Petify primary palette.
- **Navigation:** existing compact/expanded desktop sidebar and existing
  mobile bottom navigation. No routes or options are added.
- **Content:** existing feature views remain in place inside a responsive
  centered layout. Page entrance motion respects reduced-motion preferences.
- **Footer:** subtle workspace identity and year; no new destinations.

## Workspace navigation

- **Variants:** expanded and compact on desktop; existing bottom navigation on mobile.
- **States:** active, hover, keyboard focus, expanded group, collapsed group.
- **Behavior:** retain the current Products, Customers, Invoices, Dashboard,
  and Settings routes and children; no new destinations.
- **Accessibility:** semantic links/buttons, active route state, visible focus.
- **Touch:** controls preserve the existing 44px minimum target on mobile.

## Summary metric

- **Variants:** standard count and monetary total.
- **States:** loading, populated, and error handled by the existing dashboard.
- **Tokens:** surface, border, text, muted, and primary from Petify's live CSS variables.
- **Responsive:** adaptive grid with two columns on narrow screens.

## Status breakdown

- **Variants:** customer orders and invoices.
- **States:** zero records and populated counts.
- **Behavior:** show count, proportion, and a visual bar; values are calculated
  only from existing aggregates.
- **Accessibility:** progress bars expose the label and numeric range; color
  is supplementary. Motion is disabled for reduced-motion preferences.
