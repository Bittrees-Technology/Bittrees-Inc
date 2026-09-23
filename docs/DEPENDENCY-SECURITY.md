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

Transitive overrides are bounded to the affected major/range, except Axios which is scoped to the pinned Push package and MetaMask SDK which is scoped to the Wagmi connectors package. These restrictions prevent reinstalling known affected copies without forcing other major versions. The lockfile retains package integrity hashes. Remove or revise an override only after the upstream dependency resolves a suitable version and the compatibility checks pass.

The fresh npm audit changed from40 affected packages (10high,23moderate,7low) to26 (0high/critical,20moderate,6low). These counts include inherited dependency findings; they are not counts of separately demonstrated exploitable application paths. Relevant upstream patch references include [Vite filesystem protection](https://github.com/advisories/GHSA-fx2h-pf6j-xcff), [React Router](https://github.com/advisories/GHSA-qwww-vcr4-c8h2), [ws resource limits](https://github.com/advisories/GHSA-96hv-2xvq-fx4p), [qs round-trip parsing](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), and [Joi prototype handling](https://github.com/advisories/GHSA-6w3j-5fw6-r9vr). Some reports concern optional/server/development paths; an audit count alone does not establish exposure of this static deployment.

## Wallet dependency follow-up

The MetaMask SDK and communication layer now resolve to 0.33.1 through a scoped connector override, addressing [GHSA-qj3p-xc97-xw74](https://github.com/advisories/GHSA-qj3p-xc97-xw74). The earlier locked graph did not contain the malicious debug4.4.2 package; this update adopts the upstream SDK mitigation without claiming that earlier production was compromised. SDK0.33.1 pins its debug dependency to4.3.4. Wagmi2.15.4, connectors5.8.3, RainbowKit2.2.3 and viem2.28.1 remain unchanged.

The current npm audit reports27 affected packages (0high/critical,21moderate,6low). The MetaMask advisory is absent, but inherited UUID/query-decoding reports still affect these packages. Counts reflect affected dependency nodes and do not directly count distinct application vulnerabilities; this follow-up does not claim an overall count reduction.

`tests/app-recovery/connector-session.spec.ts` exercises the built application with its actual RainbowKit/Wagmi connector. Synthetic injected-provider account, chain and disconnect events cancel a delayed export signature; a fresh review exports only the current wallet's notes. Each scenario preserves both wallets' source records and denies all network writes. Only the provider boundary and test wallets are synthetic. This verifies injected browser connections, not mobile MetaMask SDK or WalletConnect relay/deep-link acceptance.

## Production installation

Vercel explicitly runs `npm ci --ignore-scripts`, matching CI and honoring the committed npm lockfile and scoped overrides. The build applies the reviewed Push patch through `prebuild`. A prior project-level `yarn install` setting ignored those overrides and resolved a different dependency graph; a successful deployment alone did not prove the dependency fixes shipped. Verify the production build log uses the declared clean npm install and verify the resulting application before accepting a dependency rollout.

## Required checks

`npm run test:dependency-audit` runs `npm audit --audit-level=high` after the clean CI install. High/critical findings or audit failures stop the job. Moderate/low reports remain visible; there is no advisory suppression or exception list. Passing this threshold is not a declaration that the remaining findings are accepted for launch.

The dependency update also requires the build, unit/release/registry tests, whole-app local export, recovery security scenarios, wallet-session Push tests and real SDK browser regression. The SDK regression performs its HTTP encrypted-secret requests through the installed Axios version, encrypts/decrypts real synthetic content, rejects the wrong wallet key, and verifies legacy recovery remains bound to the selected provider. No live room or member wallet is used by those isolated checks.

## Remaining work

- Review and update the wallet/connector/signing graph together: Wagmi, WalletConnect/Reown and MetaMask packages retain inherited UUID and query-decoding findings. Newer Wagmi calls signing-library actions absent from the current viem version, so upgrading it alone is not compatible. The patched decode-uri-component0.5 is ESM while the installed query-string consumer requires a CommonJS callable; a direct version override breaks decoding. Coordinate these migrations and verify provider changes, recovery, malformed query handling and real WalletConnect/native returns before acceptance.
- MetaMask SDK0.33.1 is itself deprecated upstream. Its advisory patch is an interim compatibility measure; migration to maintained connectors and real mobile/device acceptance remain open.
- Push still includes an older UUID dependency. Any targeted replacement needs the SDK's generated-ID paths and browser compatibility checked; this pass changes its HTTP client only.
- Browser crypto polyfills retain the low-severity elliptic finding and inherited package reports. The audit's suggested old polyfill-plugin downgrade is not an established compatible fix. Review actual bundled paths and an upstream replacement/removal strategy.
- Re-run the audit when dependencies change and at release time. Separate source-room/member/device, deployment, identity, policy and operational acceptance remain required for the Chat migration.
