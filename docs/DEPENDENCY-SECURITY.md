# Dependency security status

The 23 September 2026 messenger hardening passes update selected dependencies while retaining Push SDK 1.7.32, its reviewed room-key/provider patch, Wagmi/viem versions and storage/signature contracts.

| Dependency | Locked version after update |
|---|---|
| Push SDK's Axios | 0.33.0 |
| Wagmi connector's MetaMask SDK / communication layer | 0.33.1 / 0.33.1 |
| ws8.x copies | 8.21.0 |
| React Router | 7.18.4 |
| Vite6.x | 6.4.3 |
| Socket.IO parser4.x | 4.2.7 |
| PostCSS8.x | 8.5.23 |
| nanoid3.x | 3.3.18 |
| browserslist4.x / baseline-browser-mapping2.x | 4.28.7 / 2.11.0 |
| qs6.x / Joi17.x | 6.16.0 / 17.13.6 |

Transitive overrides are bounded to the affected major/range, except Axios which is scoped to the pinned Push package, MetaMask SDK which is scoped to the Wagmi connectors package, UUID which is scoped to its installed SDK callers, and decode-uri-component which is scoped to query-string. These restrictions prevent reinstalling known affected copies without forcing other major versions. The lockfile retains package integrity hashes. Remove or revise an override only after the upstream dependency resolves a suitable version and the compatibility checks pass.

The fresh npm audit changed from40 affected packages (10high,23moderate,7low) to26 (0high/critical,20moderate,6low). These counts include inherited dependency findings; they are not counts of separately demonstrated exploitable application paths. Relevant upstream patch references include [Vite filesystem protection](https://github.com/advisories/GHSA-fx2h-pf6j-xcff), [React Router](https://github.com/advisories/GHSA-qwww-vcr4-c8h2), [ws resource limits](https://github.com/advisories/GHSA-96hv-2xvq-fx4p), [qs round-trip parsing](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), and [Joi prototype handling](https://github.com/advisories/GHSA-6w3j-5fw6-r9vr). Some reports concern optional/server/development paths; an audit count alone does not establish exposure of this static deployment.

## Wallet dependency follow-up

The MetaMask SDK and communication layer now resolve to 0.33.1 through a scoped connector override, addressing [GHSA-qj3p-xc97-xw74](https://github.com/advisories/GHSA-qj3p-xc97-xw74). The earlier locked graph did not contain the malicious debug4.4.2 package; this update adopts the upstream SDK mitigation without claiming that earlier production was compromised. SDK0.33.1 pins its debug dependency to4.3.4. Wagmi2.15.4, connectors5.8.3, RainbowKit2.2.3 and viem2.28.1 remain unchanged.

The current npm audit reports27 affected packages (0high/critical,21moderate,6low). The MetaMask advisory is absent, but inherited UUID/query-decoding reports still affect these packages. Counts reflect affected dependency nodes and do not directly count distinct application vulnerabilities; this follow-up does not claim an overall count reduction.

`tests/app-recovery/connector-session.spec.ts` exercises the built application with its actual RainbowKit/Wagmi connector. Synthetic injected-provider account, chain and disconnect events cancel a delayed export signature; a fresh review exports only the current wallet's notes. Each scenario preserves both wallets' source records and denies all network writes. Only the provider boundary and test wallets are synthetic. This verifies injected browser connections, not mobile MetaMask SDK or WalletConnect relay/deep-link acceptance.

## UUID compatibility hardening

The 24 September update scopes UUID11.1.1 to Push, MetaMask SDK, its communication layer and every installed MetaMask utils copy. This is the patched release retaining CommonJS and ESM entry points. The existing nested Wagmi→MetaMask SDK override owns that SDK's UUID override too; a separate top-level rule did not override the nested SDK rule in npm. A fresh clean installation and every-caller resolution tests verify the actual installed graph. Only UUID lockfile entries change; SDK/connector versions, the Push patch and signature/storage contracts remain unchanged.

The original Push UUID9 v3/v5 calls silently changed short caller-provided buffers. New tests verify rejection before mutation, deterministic/random v4 identifiers, parse/stringify, actual Push payload IDs and MetaMask CommonJS/ESM filesystem sandbox names. The built-browser fixture also constructs actual Push payload/stream IDs without initializing sockets, signing or sending. Existing encrypted-room/provider-isolation and actual app connector/export checks remain required. These tests establish offline SDK compatibility, not live mobile pairing or private-room acceptance.

The fresh audit now reports21 affected packages (15moderate,6low), representing two distinct advisory IDs: URI decoding and elliptic. The UUID advisory is absent. Package counts include inherited findings; this does not demonstrate production exploitability. Reference: [UUID buffer-boundary advisory and patched release lines](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq).

## URI decoding compatibility hardening

The next 24 September update scopes decode-uri-component0.5.0 to query-string7.1.3. Only the decoder lockfile entries change. The ESM decoder is consumed by a small CommonJS caller patch selecting its default export and preserving legacy plus-as-space fragment semantics. This patch relies on the existing Node24 CI/build baseline; it is also tested through the application's Vite browser configuration. `pretest:uri-compatibility`, `prebuild`, `postinstall` and the SDK-browser test apply both required patches and fail on patch errors.

A query corpus captured from Governance's original install preserves Unicode, raw/encoded plus, double encoding, malformed bytes, duplicate/empty/bare keys, prototype-like keys and fragments. Tests inspect every installed decoder/caller and actual WalletConnect URI helpers. Malformed-input checks run inside a child process or a dedicated browser worker with a five-second deadline and termination. The original6,006byte input exceeded a one-second deadline; the patched180,006byte case passes. Offline browser checks block external requests and retain the existing encrypted-room/provider isolation coverage.

The stronger audit gate now rejects moderate findings. Current npm audit reports6low affected packages, all from one distinct elliptic advisory (GHSA-848j-6mx2-7j84), with no known patched release. No moderate/high/critical reports remain. These counts do not certify live wallet, private-room or launch readiness. Reference: [URI decoder malformed-input advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).

## Production installation

Vercel explicitly runs `npm ci --ignore-scripts`, matching CI and honoring the committed npm lockfile and scoped overrides. The build applies and verifies the reviewed Push and query-string patches through `prebuild`. A prior project-level `yarn install` setting ignored those overrides and resolved a different dependency graph; a successful deployment alone did not prove the dependency fixes shipped. Verify the production build log uses the declared clean npm install and verify the resulting application before accepting a dependency rollout.

## Required checks

`npm run test:dependency-audit` runs `npm audit --audit-level=moderate` after the clean CI install. Moderate/high/critical findings or audit failures stop the job. Low reports remain visible; there is no advisory suppression or exception list. Passing this threshold is not a declaration that the remaining findings are accepted for launch.

The dependency update also requires the build, unit/release/registry tests, whole-app local export, recovery security scenarios, wallet-session Push tests and real SDK browser regression. The SDK regression performs its HTTP encrypted-secret requests through the installed Axios version, encrypts/decrypts real synthetic content, rejects the wrong wallet key, and verifies legacy recovery remains bound to the selected provider. No live room or member wallet is used by those isolated checks.

## Remaining work

- Review the wallet/connector/signing graph together before future upgrades. Current scoped UUID/decoder patches retain existing SDK behavior; newer Wagmi versions require compatible viem actions. Actual WalletConnect/mobile returns remain an independent acceptance requirement.
- MetaMask SDK0.33.1 is itself deprecated upstream. Its advisory patch is an interim compatibility measure; migration to maintained connectors and real mobile/device acceptance remain open.
- Browser crypto polyfills retain the low-severity elliptic finding and inherited package reports. The audit's suggested old polyfill-plugin downgrade is not an established compatible fix. Review actual bundled paths and an upstream replacement/removal strategy.
- Re-run the audit when dependencies change and at release time. Separate source-room/member/device, deployment, identity, policy and operational acceptance remain required for the Chat migration.
