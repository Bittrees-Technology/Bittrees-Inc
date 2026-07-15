# Deploying `gov.bittrees.org`

The governance app is a Vite SPA + a few serverless functions (`api/`). Hosted on
Vercel. This is the end-to-end setup.

---

## 1 · Import the repo

Vercel → **Add New… → Project** → import `Bittrees-Technology/bittrees-gov-ui`.

Framework auto-detects as **Vite** (settings also pinned in `vercel.json`):

| Setting | Value |
| --- | --- |
| Build command | `npm run build` (`tsc -b && vite build`) |
| Output directory | `dist` |
| Rewrites | all non-`/api` routes → `/` (SPA); `/api/*` → the functions |

---

## 2 · Environment variables

Project → **Settings → Environment Variables**. Apply to **Production** (and **Preview**;
add **Development** only if you run `vercel dev` locally).

### Frontend (`VITE_`-prefixed — compiled into the browser bundle at build time)

| Var | Required? | Purpose | Where to get it |
| --- | --- | --- | --- |
| `VITE_MAINNET_RPC_URL` | Recommended | Mainnet RPC for BGOV voting power, ENS, mint. Falls back to a rate-limited public node if unset. | [Alchemy](https://dashboard.alchemy.com) / Infura → Ethereum Mainnet → HTTPS URL |
| `VITE_WALLETCONNECT_PROJECT_ID` | Recommended | Enables WalletConnect (mobile/QR) wallets. Unset → a config banner shows and only injected wallets (MetaMask) connect. | [cloud.reown.com](https://cloud.reown.com) (ex-WalletConnect) → Project ID |
| `VITE_GATE_URL` | Optional | Base URL of the chat-gating function. Defaults to this deployment's `/api/gate`. Leave unset for a single project. | — |
| `VITE_PUSH_ROOM_*` | Optional | Fallback Push room chat-ids when **not** using KV. With KV connected (step 3) the ids live in the registry — skip these. | created per room in-app |

> ⚠️ **`VITE_` vars are baked into the bundle at build time** — they are readable by anyone
> who opens the deployed site's JS. Marking them "Sensitive" only hides them in the Vercel
> dashboard, not in the app. The real protection is the **domain allowlist**:
> - add `gov.bittrees.org` to the **Alchemy** app's allowed domains (RPC key), and
> - add `gov.bittrees.org` to the **Reown** project's allowed origins (WC id).

### Serverless (read at runtime by the `api/` functions)

| Var | Required? | Purpose |
| --- | --- | --- |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | **Required** for persistence | Rooms registry, role catalog, moderation flags, contributor enc-keys. Injected by the storage integration (step 3). Code also accepts `UPSTASH_REDIS_REST_URL` / `_TOKEN`. |
| `MAINNET_RPC_URL` | Optional | RPC for the token-gate function. Falls back to `VITE_MAINNET_RPC_URL`, then a public node. |

---

## 3 · Storage (Upstash Redis)

Persistence for the chat rooms, the role catalog, moderation, and encryption keys.
(Vercel KV is no longer a standalone product — it's a Marketplace Redis store now.)

1. Vercel → **Storage** → **Create Database** / Browse Marketplace → **Upstash for Redis**
   (free tier is fine).
2. **Connect it to the `bittrees-gov-ui` project** (Production at minimum).
3. It auto-injects credentials. The functions use the REST pair
   **`KV_REST_API_URL` + `KV_REST_API_TOKEN`** (first branch of the lookup). The extra vars
   Upstash adds — `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `REDIS_URL` — are unused and
   harmless; leave them.
4. **Redeploy** so the functions pick up the new vars.

Without KV, public reads still work but every admin write returns
`registry not configured` (503).

---

## 4 · Redeploy & domain

- **Redeploy after any env-var change** — Deployments → ⋯ → **Redeploy**. Both the frontend
  (`VITE_` baked in) and the functions (KV/RPC read at runtime) only update on a new build.
- **Domain:** Settings → Domains → add `gov.bittrees.org` (replaces the legacy CRA deploy).

## 4A · Read-only release gate

Use the release gate before promotion, and again after any rollback. It never writes to
production; it only captures a baseline snapshot, validates a canary URL, and compares the
current surface back to the saved baseline.

```bash
npm run release:gate -- --mode baseline
npm run release:gate -- --mode canary --base-url https://<preview-host> --baseline output/release-gates/<baseline-run>/run.json
npm run release:gate -- --mode rollback-check --baseline output/release-gates/<baseline-run>/run.json
```

What it checks:

- SPA routes stay reachable (`/`, `/proposals`, `/forum`, `/chat`, `/contribute`, `/admin`)
- `/api/community`, `/api/rooms`, `/api/usersync`, and the malformed-input `/api/gate`
  contract stay healthy
- Rollback verification compares status and structural response signatures to the saved
  baseline instead of trying to mutate live state

Each run writes `run.json` and `report.md` under `output/release-gates/`.

---

## 5 · Post-deploy admin steps

Done once, by a `gov.bittrees.eth` space admin, from the in-app **Admin** console:

- **Push rooms** — create each gated group (Admin → Community rooms). The returned chat-ids
  publish straight to the KV registry — no redeploy, no env edit. (`ROOM_ADMINS` in
  `src/lib/push.ts` is added as a group admin on creation.)
- **Contributor decryption** — every reviewer holding the `operations` role must open
  Admin → contributor applications → **Enable decryption** (publishes their X25519 public
  key) **before** applications arrive. Applications encrypt to whoever has a published key at
  submit time; the immutable on-chain ciphertext can't be opened by reviewers added later.
- **Roles** — create roles (Admin → Roles & tags → Create a role), then assign them from the
  dropdown. `operations` + `moderator` are built-in and carry powers.
- **Snapshot privacy** — new proposals are created as plain so in-app voting works; the
  space-level shutter (encrypted voting) can be toggled in Admin → space settings.

No manual step is needed for the **forum / contributor EAS schema** — the first post
auto-registers it on Base.

---

## Verify it's live

- Site loads at the domain with no yellow "Configuration notice" banner (WC id is set).
- As a space admin, **assign a role** or **create a room** — if it persists on reload, KV is
  wired.
- A proposal detail shows live Snapshot scores; the forum lists EAS posts.

---

## Chain architecture (so the wallet prompts make sense)

| Layer | Chain | Why |
| --- | --- | --- |
| Governance — BGOV, Snapshot voting power, Safes, ENS, mint, all gating reads | **Ethereum mainnet** | the governance spine |
| Forum posts + contributor applications (EAS attestations) | **Base** | cheap on-chain writes; the wallet switches to Base **only at submit time** |
| DMs (XMTP) + community rooms (Push) | **chain-agnostic** | just signatures |

---

## Dependencies

`npm audit` shows ~30 findings, almost all transitive `@reown/appkit` / `@walletconnect`
packages pulled in by RainbowKit/wagmi. **Do not** run `npm audit fix --force` — wagmi /
viem / RainbowKit versions are pinned for build stability and forcing upgrades will break
them. Address high-severity items individually if needed.
