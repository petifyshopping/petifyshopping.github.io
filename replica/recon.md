# Petify admin UX — reference workflow

## Scope

Use the public Cirrel web dashboard as a UX reference for improving Petify's
existing admin workspace. Keep Petify's brand palette and current sections;
do not add Cirrel-only capabilities or copy its assets, source, or wording.

Audience: Petify store admins managing the catalog, customers and orders,
invoices, profile, team access, and storefront settings.

## Sources

| Source | URL | Notes |
| --- | --- | --- |
| Public demo dashboard | https://demo.codeandchill.store/cirrel/#/dashboard | Read the visible dashboard, sidebar, summary cards, chart, and operational panels. |
| Public demo orders | https://demo.codeandchill.store/cirrel/#/orders | Read the order tabs, search and filter controls, status chips, table, and pagination. |

Only the public demo UI was observed. No login, private APIs, source bundles,
or original media were used. Some visible controls were not activated, so
their outcomes are not assumed. The browser reported a missing GSAP target
warning while the observed screens remained rendered; this is a possible
animation issue, not evidence that the workflow itself failed.

## Core workflow

An admin lands on a compact dashboard, scans high-priority totals and
workflow status, then follows navigation or a contextual link into an
existing work area. In Petify, this maps to Dashboard → Products, Customers,
Invoices, or Settings using the existing workspace navigation.

## Reference screens

| ID | Screen | Route | Purpose | Key components | Observed state |
| --- | --- | --- | --- | --- | --- |
| S01 | Dashboard | `#/dashboard` | Review store performance and follow up on operational work. | Compact side rail, greeting/context, summary metrics, sales chart, goal and live-store cards, packing queue, stock alerts, channel breakdown, latest orders, best sellers. | Populated demo data; navigation and links visible. |
| S02 | Orders | `#/orders` | Find and review orders by status and channel. | Order tabs, search, channel/date filters, status chips, sortable table, pagination. | Populated list with Delivered selected; filter controls and page controls visible. |

## Flows

```text
F01 Review store activity
    S01 dashboard -> follow a visible order, stock, or catalog link
    happy path: dashboard scan followed by one contextual navigation
    edge: empty work queue, no stock alerts, loading or unavailable data
    note: linked destinations were visible but not all opened.

F02 Find an order
    S02 orders -> choose an order view -> search/filter -> review the table
    happy path: order navigation, filter selection, then row review
    edge: no matching rows, long customer/product names, narrow viewport,
          large result set requiring pagination
    note: controls and the selected state were observed; filter results and
          order detail behavior were not exercised.
```

## UX patterns to apply in Petify

- Keep the dashboard and existing work areas easy to reach from a compact,
  persistent desktop rail and the existing mobile navigation.
- Put current, truthful totals first; show status distribution as a quick
  visual scan and keep labels/counts readable without relying on color.
- Use consistent card hierarchy, generous grouping, subtle transitions,
  and responsive layouts across Products, Customers, Invoices, Dashboard,
  Profile, Team & Access, and Site settings.
- Respect reduced-motion preferences and keep keyboard focus visible.
- Use Petify's live CSS color variables (`--primary`, `--primary-dark`,
  `--accent`, `--bg-light`, and related text/surface tokens).

## Petify scope boundaries

The current dashboard provides customer/order totals and invoice totals, not
historical revenue series, live traffic, stock/reorder thresholds, sales
channels, or a latest-orders feed. Those reference panels are deliberately
not represented with fabricated data. The implementation improves the
existing summary and status workflows only.

## Inferred reference entities

```text
Order      identifier, customer, items, placed time, channel, total, status
           evidence: S02 table headings; confidence: high
Product    name, sales amount, units sold
           evidence: S01 best-seller rows; confidence: medium
Customer   name and location
           evidence: S01 latest orders and S02 customer column; confidence: medium
```

## Size and next step

Two reference screens and two observed workflows. UX-only adaptation: small
scope; the hard boundary is that Petify must not imply data it does not
collect. The existing Petify services remain the source of truth.
