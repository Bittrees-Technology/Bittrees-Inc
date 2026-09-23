# Dependency security status

The23September2026 messenger hardening pass updates the existing dependency lines while retaining Push SDK1.7.32, its reviewed room-key/provider patch, wallet connector versions and storage/signature contracts.

| Dependency | Locked version after update |
|---|---|
| Push SDK's Axios | 0.33.0 |
| ws8.x copies | 8.21.0 |
| React Router | 7.18.4 |
| Vite6.x | 6.4.3 |
| Socket.IO parser4.x | 4.2.7 |
| PostCSS8.x | 8.5.23 |
| nanoid3.x | 3.3.18 |
| browserslist4.x / baseline-browser-mapping2.x | 4.28.7 / 2.11.0 |
| qs6.x / Joi17.x | 6.16.0 / 17.13.6 |

Transitive overrides are bounded to the affected major/range, except Axios which is scoped to the pinned Push package. These restrictions prevent reinstalling known affected copies without forcing other major versions. The lockfile retains package integrity hashes. Remove or revise an override only after the upstream dependency resolves a suitable version and the compatibility checks pass.

The fresh npm audit changed from40 affected packages (10high,23moderate,7low) to26 (0high/critical,20moderate,6low). These counts include inherited dependency findings; they are not counts of separately demonstrated exploitable application paths. Relevant upstream patch references include [Vite filesystem protection](https://github.com/advisories/GHSA-fx2h-pf6j-xcff), [React Router](https://github.com/advisories/GHSA-qwww-vcr4-c8h2), [ws resource limits](https://github.com/advisories/GHSA-96hv-2xvq-fx4p), [qs round-trip parsing](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), and [Joi prototype handling](https://github.com/advisories/GHSA-6w3j-5fw6-r9vr). Some reports concern optional/server/development paths; an audit count alone does not establish exposure of this static deployment.

## Production installation

Vercel explicitly runs `npm ci --ignore-scripts`, matching CI and honoring the committed npm lockfile and scoped overrides. The build applies the reviewed Push patch through `prebuild`. A prior project-level `yarn install` setting ignored those overrides and resolved a different dependency graph; a successful deployment alone did not prove the dependency fixes shipped. Verify the production build log uses the declared clean npm install and verify the resulting application before accepting a dependency rollout.

## Required checks

`npm run test:dependency-audit` runs `npm audit --audit-level=high` after the clean CI install. High/critical findings or audit failures stop the job. Moderate/low reports remain visible; there is no advisory suppression or exception list. Passing this threshold is not a declaration that the remaining findings are accepted for launch.

The dependency update also requires the build, unit/release/registry tests, whole-app local export, recovery security scenarios, wallet-session Push tests and real SDK browser regression. The SDK regression performs its HTTP encrypted-secret requests through the installed Axios version, encrypts/decrypts real synthetic content, rejects the wrong wallet key, and verifies legacy recovery remains bound to the selected provider. No live room or member wallet is used by those isolated checks.

## Remaining work

- Review and update the wallet/connector graph together: Wagmi, WalletConnect/Reown and MetaMask packages retain inherited moderate findings, including old UUID and query-decoding dependencies. Verify provider changes, reconnection, recovery and real WalletConnect/native returns before treating that work as complete.
- Push still includes an older UUID dependency. Any targeted replacement needs the SDK's generated-ID paths and browser compatibility checked; this pass changes its HTTP client only.
- Browser crypto polyfills retain the low-severity elliptic finding and inherited package reports. The audit's suggested old polyfill-plugin downgrade is not an established compatible fix. Review actual bundled paths and an upstream replacement/removal strategy.
- Re-run the audit when dependencies change and at release time. Separate source-room/member/device, deployment, identity, policy and operational acceptance remain required for the Chat migration.
