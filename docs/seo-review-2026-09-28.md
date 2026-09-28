# Gov SEO review — 28 September 2026

Scope: gov.bittrees.org / Bittrees-Inc. No Roles changes are part of this release.

## Findings and changes

- The web manifest identified the product as Bittrees Capital. It now identifies Bittrees Governance and includes correctly sized app icons.
- Favicons lacked a scalable version. Added a simplified green/orange tree SVG with PNG, ICO and Apple touch fallbacks, rendered from repository-native artwork.
- No initial-HTML social metadata existed. Added a 1200 × 630 PNG share card using the existing Bittrees emblem, Open Graph and Twitter large-image tags with dimensions and alternative text.
- Most routes shared a default title/description, while Chat updated metadata only after JavaScript loaded. One route catalog now drives client navigation and build-time HTML for eleven public pages, with distinct titles, descriptions and canonical URLs. Public HTML also includes a short visible page introduction and navigation before the app loads; live data remains client-rendered.
- No sitemap or robots file existed. Added a public-page sitemap and crawler access; APIs are excluded from crawling. Admin, proposal creation, chat and unprerendered detail pages use noindex metadata and response headers. They are not in the sitemap. This does not replace application authentication.
- The blanket SPA rewrite produced successful responses for nonexistent URLs and risked catching asset requests. Replaced it with registered page and detail routes; unknown routes use a branded 404.
- The rendered home page had no h1. Added a Governance heading and a short product introduction while preserving its vision statement.

Robots directives follow [Google's noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing): crawlers must be able to fetch a page to read its noindex directive. Private UI URLs are therefore not blocked in robots.txt; authentication continues to protect data.

## Validation and limits

Build checks verify initial HTML, canonical uniqueness, sitemap exclusions, dimensions and route coverage. Browser checks verify client navigation, metadata updates, private noindex and mobile width. Existing unit/release checks and the repository CI remain required before merge. Hosted checks verify actual MIME types, crawler-visible metadata and 404/private response behavior.

Proposal and forum detail pages remain noindex until meaningful per-record server-rendered metadata is available. Existing large wallet/messaging bundles remain a performance follow-up; this change does not claim a Core Web Vitals score or guaranteed ranking. Search Console submission and third-party social-cache refreshes require their respective services; deploying metadata does not guarantee immediate recrawling.

Artwork source: design/social-preview.html and public/favicon.svg. Render with node scripts/render-brand-assets.mjs (Playwright Chromium). The ICO is generated from the 512px icon. The homepage and all public metadata use the production canonical host even on preview deployments.
