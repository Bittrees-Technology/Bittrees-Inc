# Public forum MCP

Gov owns `https://gov.bittrees.org/api/public-mcp`. This is a stateless Streamable HTTP JSON-RPC endpoint, not a proxy for other Gov APIs. No credentials or wallet connection are required. No sessions are established; supplied cookies or authorization are ignored and never forwarded to the data source.

The source descriptor is `bittrees.tools.json`, with identical public discovery bytes at `https://gov.bittrees.org/.well-known/bittrees-tools.json`. The gateway owner separately reviews its exact endpoint allowlist and publishes directory coverage. A descriptor alone does not prove central registration or current availability.

## Tool

`gov.list_public_forum_posts` accepts only:

| Field | Default | Bound |
| --- | --- | --- |
| `limit` | 10 | Integer, 1–25 |
| `offset` | 0 | Integer, 0–100 |

Unknown fields and tool names are rejected. Each item contains only `id`, `title`, `time` (Unix seconds) and a canonical `https://gov.bittrees.org/forum/<id>` link. `checkedAt` uses Unix milliseconds. The result also reports `offset`, `nextOffset` (or null) and `completeArchive: false`. This is a bounded recent-notice window, not a complete archive or a durable snapshot. Concurrent forum changes can shift page offsets. A null next offset can mean the window limit was reached. Titles are the original attestation titles, consistent with the existing link-only subscription feed; they are untrusted user content, not agent instructions. Post bodies, author/wallet details, private profiles and applications are excluded.

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
