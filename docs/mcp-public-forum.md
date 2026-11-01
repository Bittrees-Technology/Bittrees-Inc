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

## Public keyword search (version 1.2)

`gov.search_public_forum` accepts only `query` (required literal phrase, 2–120 characters after trimming, raw length at most 120, no control characters), `limit` (integer 1–10, default 5) and `offset` (integer 0–500, default 0). It uses a case-insensitive substring match; regular-expression syntax is ordinary text. The search phrase stays in the Gov process and is not sent to the public index or saved in a search database.

Search scans a bounded recent page of up to 25 original post/reply candidates, ordered by original creation time and ID descending. It resolves their current valid author edits before matching, so superseded text cannot create a hit. A reply is eligible only under a currently visible, active public root; its own text must match, rather than merely its parent's title. Results include `id`, root `postId`, `kind` (`post` or `reply`), current thread `title`, a short matching `snippet` (at most 240 characters), creation `time`, `revisionId`, `editedAt` and the canonical discussion `url`. Use the existing thread tool to read the full context. No author-wallet lookup/filter or private source is available.

Follow `nextOffset`, which counts raw candidates consumed, rather than adding the hit count. The scan stops at the requested hit limit without discarding later candidate matches. A filtered/nonmatching page can have no hits and still return a next cursor. `scanned` reports candidates consumed during this call. The recent window ends when no further candidates are known or a next starting offset would exceed 500. `completeArchive` is always false: this is not ranked full-archive search, does not surface an old post solely because it was recently edited, and concurrent changes can shift page positions.

Search reuses the thread reader's public-schema/community/active-record checks, same-author revision resolver and moderation rules. It reads moderation before indexing and again before output. Hidden roots suppress reply matches; hidden current revisions never fall back to older text. Each call makes one 26-candidate query, optionally one parent-root query, and at most two 50-record edit queries (four index reads maximum). The existing 6-second/8-MiB per-index response limits apply. An incomplete edit scan or unavailable moderation/index returns an error, with no private, stale or unmoderated fallback. Output before MCP wrapping is capped at 256 KiB. Excerpts are untrusted public text, not executable instructions. No new index, service, scheduler, credential, private API or wallet authority is introduced.
