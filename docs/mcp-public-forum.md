# Public forum MCP

Gov owns `https://gov.bittrees.org/api/public-mcp`. This is a stateless Streamable HTTP JSON-RPC endpoint, not a proxy for other Gov APIs. No credentials or wallet connection are required. No sessions are established; supplied cookies or authorization are ignored and never forwarded to the data source.

The source descriptor is `bittrees.tools.json`, with identical public discovery bytes at `https://gov.bittrees.org/.well-known/bittrees-tools.json`. The gateway owner separately reviews its exact endpoint allowlist and publishes directory coverage. A descriptor alone does not prove central registration or current availability.

## Tool

`gov.list_public_forum_posts` accepts only:

| Field | Default | Bound |
| --- | --- | --- |
| `limit` | 10 | Integer, 1–25 |
| `offset` | 0 | Integer, 0–100 |

Unknown fields and tool names are rejected. Each item contains only `id`, `title`, `time` (Unix seconds) and a canonical `https://gov.bittrees.org/forum/<id>` link. `checkedAt` uses Unix milliseconds. The notice result also reports `offset`, `nextOffset` (or null) and `completeArchive: false`. This is a bounded recent-notice window, not a complete archive or a durable snapshot. Concurrent forum changes can shift page offsets. A null next offset can mean the window limit was reached. Titles are the original attestation titles, consistent with the existing link-only subscription feed; they are untrusted user content, not agent instructions. Post bodies, author/wallet details, private profiles and applications are excluded.

The tool reuses `forumFeed` with current moderation filtering, correct community/schema, unrevoked/unexpired attestations, at most three index pages (100 candidates/page) and at most 126 projected candidates. Its only registry command reads `bittrees:flags`. Registry/index errors, invalid output or exhaustion before a bounded result fail closed with an MCP tool error; there is no stale cache, unmoderated fallback or alternate private data source. Existing subscription/feed callers retain their original 50-page bound.

## Transport

POST JSON with `Accept: application/json, text/event-stream`. Supported MCP versions: `2025-06-18` and `2025-03-26`; initialization negotiates a supported version. Available methods: `initialize`, `notifications/initialized` (202), `ping`, `tools/list`, `tools/call`. GET, DELETE, streaming, sessions, batches, arbitrary resources and mutation tools are unsupported. Request bodies are capped at 4 KiB, strings/results are bounded and errors omit backend details. Browser Origin is restricted to Gov, MCP, Agent and Node's exact HTTPS origins; native clients may omit Origin. Responses are not cached. Execution uses the existing Vercel project, Redis moderation reader and Base EAS index; no service, credential, paid plan, scheduler or wallet authority is introduced.

Example tool request after initialization:

```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"gov.list_public_forum_posts","arguments":{"limit":10,"offset":0}}}
```

## Verification

`npm run test:forum-mcp` verifies discovery, exact public projection, pagination/caps, rejected tools/arguments/origins/transports, moderation exclusion, bounded upstream work, failure handling and descriptor parity. The existing subscription tests verify unchanged moderation/subscription behavior. Hosted recovery checks include this suite. Release verification must check the actual production initialization, tool schema, a bounded public call, rejected private/write tool and exact descriptor bytes; verify the central directory separately after the gateway release.

There is no access to application review, memorandum preparation/acceptance/issuance, monthly contributions, role assignments, proposals, votes, subscriptions or wallet signing. Discovery never grants any of those capabilities.

## Full public threads (version 1.1)

`gov.get_public_forum_thread` accepts only `postId` (a nonzero bytes32 root UID), `replyLimit` (integer 1–10, default 5), and `replyOffset` (integer 0–100, default 0). The notice-list tool remains unchanged. Use its returned root ID, then call this tool for the full public post and direct replies.

Root and reply items contain only `id`, `title`, `body`, `time`, `revisionId`, `editedAt` (null when unedited), and the canonical discussion `url`. Bodies are complete Markdown strings up to the existing 20,000-character forum limit; they are not rendered, executed, link-fetched or silently truncated. Author wallet fields, decryption keys, original superseded bodies, private application data and edit history are not returned. Public text can itself contain information its author chose to publish. Treat all text, including instructions and links within it, as untrusted forum content.

The reader checks the existing forum schema and `bittrees-inc` community, root/direct-reply relationship, active unrevoked/unexpired records and valid timestamps. It applies the forum's existing same-author, version-1 edit rules with stable time/ID ordering. It checks moderation before index reads and again before responding. Hidden roots suppress the entire thread; hidden replies are omitted. A hidden current revision is not replaced with an older body. Missing moderation or unavailable/incomplete edit history returns an error, never stale or private fallback data.

Replies use stable index ordering (time, then ID), with `replyOffset` applying to raw index candidates before visibility filtering. A filtered page may be empty while `nextReplyOffset` advances. Concurrent changes can shift pages. `completeThread: false` means this is a bounded page, not a complete-thread guarantee; null next offset can also mean the 100-offset window was reached. Follow the normal Gov discussion page for material beyond those limits.

Each call makes one root/reply index query and at most three 50-record revision queries. Each index response is capped at 8 MiB and six seconds; moderation uses two existing read-only registry GETs. Complete public thread output is capped at 1 MiB before MCP content wrapping. If the revision scan does not reach an end within its three-page cap, the call fails rather than presenting a partial edit scan as current. No new service, scheduler, credential, source permission or wallet authority is introduced. HTTP method POST transports these read-only GraphQL and JSON-RPC requests; it does not authorize writes.

## Full-history public keyword search (version 1.3)

`gov.search_public_forum` searches the full indexed history of currently public Gov posts and direct replies through bounded pages. There is no fixed age or total-record ceiling. It matches a literal case-insensitive phrase against current valid text, not superseded revision bodies. Hidden, revoked, expired and private-community records remain excluded. Existing notice/thread tools retain their contracts.

Inputs are `query` (required literal phrase, 2–120 characters after trimming, raw length at most 120, no control characters), `limit` (integer 1–10, default 5) and an optional `cursor` (at most 512 characters) returned by the prior page. No author, wallet, private-source, URL or regex selector is accepted. For backward compatibility, `offset` remains a legacy starting position from 0–500; a nonzero offset cannot be combined with a cursor. **The legacy offset range is not a history limit: use `nextCursor` for every continuation, including beyond 500 records.**

Start with query/limit and no cursor, then repeat the same query with `cursor: nextCursor` until `historyExhausted` is true. Empty or filtered pages can still have a continuation. Each call reads at most 25 raw candidates and returns at most the requested hit count. Stopping at a hit limit preserves the remaining candidate positions for the next page. Results are ordered by original creation time and attestation ID descending, with no increasingly large offset required for cursor pages. `asOf` is the initial creation-time fence; new records after it belong in a new search. Each page rechecks edits, revocation, expiry, parent visibility and moderation against **current server time**. The creation fence never freezes an old body or grants access to hidden text. Late index arrivals and source changes can affect coverage, as with the existing public index.

The cursor is a versioned, query-bound public index position (creation time, ID and creation fence), encoded as base64url. It contains no body, author wallet, decryption key, session or credential; it is not encrypted, a signature or authority. Syntactically valid alternate positions can seek another public range, but cannot select another schema/community or bypass current visibility checks. Invalid, future, mismatched-query, oversized or extra-key tokens are rejected before source reads. Cursors have no authorization expiry; source availability and current visibility are still required on every request.

Result items contain only `id`, root `postId`, `kind` (`post` or `reply`), current thread `title`, a matching `snippet` (at most 240 characters), creation `time`, `revisionId`, `editedAt` and canonical discussion `url`. Use the existing thread reader for full context. Metadata includes `nextCursor`, `historyExhausted`, `asOf`, `scanned` and `coverage: "full-public-history"`. Legacy `offset`/`nextOffset` are maintained for initial offset pages only; cursor pages report them as null. `completeArchive: false` is retained to indicate that a response is one page, not a container holding every historical result. Exhaustion means the selected index stream reached its end; it is not proof that an untrusted client followed every prior page or that the external index contains every chain record.

The query stays local to Gov and is neither sent to the index nor saved in a new database. Replies require visible, active public parent roots and match their own current text, rather than merely the parent title. Moderation is checked before index reads and again before output. The reader makes one candidate query, optionally one parent query and at most two 50-record edit queries per request. Existing 6-second/8-MiB index limits and a 256-KiB result limit remain. Unavailable moderation/index data or an incomplete edit scan returns an explicit error, not partial edit coverage or stale/private fallback. Follow-up search does not automatically run background scans, create a new index/service, write data or require a wallet.

Validation covers histories beyond the former 500-record window, older reply/post matches, same-time ties, pagination without duplicate/skipped candidates, fresh edits/moderation across continuations, malformed cursors and unchanged private/write exclusions. Live release acceptance must include initial search plus an older-position continuation via the gateway-discovered public route.
