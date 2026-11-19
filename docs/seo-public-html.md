# Public governance HTML

This extends the initial-HTML work documented in the September 2026 SEO review.
`scripts/build-seo.mjs` compiles the public-only `src/prerender.tsx` entry and renders
the same presentation components used by the client. Generated server code lives
in ignored `dist-ssr/`; only the existing `dist/` output is served by Vercel.

## Published content boundary

| Existing route | Initial public body source |
| --- | --- |
| `/` | Existing overview, full Vision Statement and contributor link |
| `/vision` | Existing Vision Statement, adoption date and source link |
| `/code-of-conduct` | Existing ten principles and handbook source link |
| `/structure` | Existing structure diagram, committed entity records and curated fallback descriptions |
| `/hq` | Existing HQ location, Voxels link and descriptions |
| `/69420` | Existing Revenue & Token Flow diagram and its text alternative |
| `/proposals`, `/forum`, `/contribute`, `/mint` | Existing public introductions; their live data and actions remain client-side |

The public renderer does not import wallet providers, contributor sessions, API
readers, proposal records or forum records. It performs no data fetches. Structure
still reads live ENS records in the client; those values are not copied into the
build. No governance wording, contract policy or allocation commitment is added.
The footer is shared with the client: Bittrees and Ecosystem are separate from
the DAO links to Governance, Research and Capital.

The existing metadata catalog, sitemap cohort, explicit Vercel routes, private
noindex headers and branded 404 remain unchanged. Unknown request paths retain
the native 404 behavior; `/69420` retains its URL. The public renderer fails the
build if a new sitemap route has no explicitly selected public component.

## Proposal detail pages remain conditional

The repository reads live proposals from the public `gov.bittrees.eth` Snapshot
space in `src/lib/snapshot.ts`. It does not contain a reviewed, approved static
proposal publication dataset. This is not evidence that the space has no public
proposals. No records, dates, statuses, outcomes or new detail URLs are invented
by this change. Existing `/proposals/:id` and `/forum/:id` pages keep their noindex
policy and remain outside the sitemap.

GOV-PROPOSALS-01 requires a verified public record cohort and its publication
status before creating durable, indexable detail documents. Current client
proposal reading, voting and creation behavior is unchanged.

## Verification and release

Run `npm run build`, `npm run test:seo`, the existing route metadata/unit checks
and release-gate fixtures. The SEO checks cover substantive initial content,
all public navigation targets, the three DAO links and workspace exclusions.
Do not use the Vite preview server as proof of Vercel HTTP routing.

The release gate follows the current Chat route contract: `/messenger` and
`/chirpy` must return 308 with `Location: https://chat.bittrees.org`, without
following that external destination. A separate unknown-path check requires
HTTP 404. Anonymous GETs with redirects disabled confirmed both aliases and
the native 404 behavior on 19 November 2026; `/chat` is not a registered route
and also returned 404. Existing API and private-route checks are unchanged.
Passing fixtures and those bounded public requests do not establish that the
complete live release gate passed. Do not restore a blanket SPA fallback.

An approved preview still needs browser checks of client replacement/navigation,
mobile/desktop layout, and deployed 404/private-route behavior. Keep the existing
repository release gates. Publication follows the approved root-homepage-first
sequence and the established Mac → NAS → GitHub → Vercel workflow.
