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
| `/proposals` | Existing public introduction and the reviewed two-record historical archive |
| `/proposals/<reviewed Snapshot ID>` | BIP0 and BIP1 original public text, source links, absolute dates and recorded final results |
| `/forum`, `/contribute`, `/mint` | Existing public introductions; their live data and actions remain client-side |

The public renderer does not import wallet providers, contributor sessions, API
readers, live proposal records or forum records. The sole record dataset is the
explicit historical cohort in `src/data/public-proposals.json`. Rendering performs
no data fetches. Structure
still reads live ENS records in the client; those values are not copied into the
build. No governance wording, contract policy or allocation commitment is added.
The footer is shared with the client: Bittrees and Ecosystem are separate from
the DAO links to Governance, Research and Capital.

The sitemap includes the ten existing public pages and these two historical
details. Exact Vercel rewrites and a narrowly scoped proposal-header exception
apply only to the two reviewed IDs. Other proposals, creation, forum details,
administration and APIs retain their existing exclusions. The branded 404 and
unknown request paths retain
the native 404 behavior; `/69420` retains its URL. The public renderer fails the
build if a new sitemap route has no explicitly selected public component.

## Reviewed historical proposal cohort

Anonymous reads of the same public Snapshot hub used by `src/lib/snapshot.ts`
confirmed two substantive records in `gov.bittrees.eth` on 19 November 2026:

| Record | Stable existing proposal ID | Voting closed (UTC) |
| --- | --- | --- |
| BIP0: Confirming Initial Snapshot Parameters | `0x2efe1b50a350ee4833682437612b985b3147a0d0266376ca60b2a0ef23f6dab2` | 15 January 2024, 00:00:31 |
| BIP1: Financial Flow and Organization Summary update | `0x1df39dbe12b37bbcd22e8dc4667522a1d66b25daa7219296d2f9033b68d9dfac` | 14 April 2024, 14:33:26 |

Both records were unflagged, closed, and had final public scores. Their original
Shutter voting privacy does not imply that these completed public results are
private. No voter list, member discussion, draft, contributor record or private
API response is included. Original source text and links are preserved, including
historical token and organization references; they are not statements of current
policy or implementation. The presentation deliberately reports recorded choices,
weights and quorum rather than inferring adoption, execution or current legal or
financial arrangements.

The archive retains the existing `/proposals/<ID>` URLs. The index and details use
the same pure components in initial HTML and the client. Active and unreviewed
records continue through the existing client list and noindex detail shell.
Voting, creation and signed moderation functions retain their existing gates;
archived detail actions render only after a live source record is available.

### Source review and withdrawal

`npm run check:proposal-archive` makes two anonymous public GraphQL reads. It checks
the exact IDs and space, unflagged visibility, closed/final lifecycle, source dates,
body, choices, aggregate scores, quorum and source content identifier. Missing,
flagged, unfinished or changed records fail the check. CI runs it before building;
source unavailability also prevents that release from claiming verified history.
The command never discovers or automatically adds more records.

To renew the visible review date after unchanged source records are verified:

```bash
npm run check:proposal-archive -- --refresh
```

This updates dates only after all published source fields match. It checks one
captured file snapshot and refuses to write if that file changes during the
network check. Changed content needs an explicit reviewed source edit. A new
record also needs a substantive public-content review and matching route policy;
an arbitrary Snapshot result is not automatically eligible.

This is a dated static publication, not a continuously synchronized archive.
There is no new background schedule. A later source flag or deletion can hide the
detail in the client after its fetch, but already deployed initial HTML and the
archive index remain until a reviewed release. To withdraw a record, remove its
data entry and exact rewrite, remove its ID from the public-header exception, and
run the normal full build and release checks. Its existing generic detail route
then returns the excluded workspace shell, and the record leaves the sitemap.
Do not delete or change an immutable proposal ID or broaden the public exception.

## Verification and release

Run `npm run check:proposal-archive`, `npm run build`, `npm run test:seo`, the existing
route metadata/unit checks and release-gate fixtures. The checks cover source
eligibility and drift, substantive initial content, exact canonicals and sitemap,
the three DAO links, archive discovery and unchanged workspace exclusions.
Do not use the Vite preview server as proof of Vercel HTTP routing.

The release gate follows the current Chat route contract: `/messenger` and
`/chirpy` must return 308 with `Location: https://chat.bittrees.org`, without
following that external destination. A separate unknown-path check requires
HTTP 404. Anonymous GETs with redirects disabled confirmed both aliases and
the native 404 behavior on 19 November 2026; `/chat` is not a registered route
and also returned 404. Existing API and private-route checks are unchanged.
Passing fixtures and those bounded public requests do not establish that the
complete live release gate passed. Do not restore a blanket SPA fallback.

The release gate also checks both historical bodies and their canonicals, the
exact public sitemap, and excluded creation/unreviewed-proposal routes. Public
HTML must not contain noindex. Production must also be free of noindex response
headers; Vercel's automatic preview-only noindex header is allowed on previews.

An approved preview still needs browser checks of client replacement/navigation,
mobile/desktop layout, and deployed 404/private-route behavior. Keep the existing
repository release gates. Publication follows the approved root-homepage-first
sequence and the established Mac → NAS → GitHub → Vercel workflow.
