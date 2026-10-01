# Forum Markdown and revisions

The Governance forum renders Markdown in topics, replies, previews and version history. GitHub-style tables, task lists, fenced code, headings, quotes, lists and links are supported. Raw HTML is skipped; URLs are restricted to HTTP(S), mailto, local paths and anchors. Images render as explicit links, so reading a post does not automatically load a tracking image. The renderer uses react-markdown and remark-gfm without raw-HTML plugins.

Existing Base mainnet EAS post attestations retain their original schema, IDs, community and thread references. New edits use a separate schema:

`uint8 version,string community,string title,string body`

Version is 1; refUID is the original post or reply UID. The schema UID is deterministic, with the existing zero resolver and revocable=true. The first edit registers this schema through the user's wallet when absent, then submits an attestation. Registration is not performed by the deployment agent, and no deployer key or new contract is needed. Every edit requires a wallet transaction on Base and gas; the original data remains public on-chain.

## Author checks and history

Before a write, the client reads the original attestation directly from Base, checks its schema, UID, community, revocation/expiry and original attester, and compares the latest indexed revision against the version the editor opened. Title/body limits are validated before signing. A successful receipt is required; a reverted transaction is not reported as saved.

Read-side checks are mandatory because EAS permits others to attest against the same schema: the forum accepts only version-1 revisions with the same author, original UID and community, the expected revision schema, valid text, no revocation and no expired validity. Foreign revisions cannot alter displayed content. Revoked originals are omitted. Revisions never become replies, change authorship, move a thread or replace its stable moderation key. Hidden posts do not expose their bodies through the history controls.

The display selects the latest valid revision by timestamp, with UID ordering as a deterministic same-timestamp tie-breaker. The history preserves the original and every active accepted revision. Revoked revisions remain inspectable on-chain but are not rendered as active history. The pre-save check detects already-indexed intervening edits; it is not an atomic compare-and-swap across concurrent wallet transactions. Concurrent edits remain separate versions, and the deterministic ordering chooses the displayed one.

Queries page through revision history in bounded batches and report an error on outages or overflow rather than quietly reverting to unedited content. The application retains any previously cached view with an error indicator. After confirmation, edit controls display indexing status and refresh; a confirmed transaction may take time to appear in the indexer.

## Verification and rollout

Tests exercise forged authors/schemas/communities, revocation/expiry, stale edits, reply references, duplicate/reordered revisions, pagination failures, unsafe Markdown, wallet rejection, confirmed edits, reload/history, mobile layout and first-edit schema registration. Browser tests use the production app with a synthetic injected wallet and intercepted RPC/indexer requests; no real posts or edits are published by these tests. The live Base indexer's GraphQL query shape was checked read-only.

The release targets gov.bittrees.org and the existing Base mainnet EAS addresses. Mainnet user-wallet transaction validation remains a user action; deployment does not fabricate a signature or publish test content. The original schema and records are not migrated or overwritten. Older clients will show original text; use the current site for revisions.

The required dependency audit also identified existing Axios and Joi advisories. Compatible overrides update Axios 0.33.0 → 0.34.0 and Joi 17.13.6 → 17.13.7; the security threshold is unchanged and messaging compatibility checks remain required.
