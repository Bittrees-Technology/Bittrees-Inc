# Bittrees, Inc. — Governance

[gov.bittrees.org](https://gov.bittrees.org) is the Bittrees governance and contributor workspace. It combines Snapshot proposals, a wallet-signed forum, contributor applications, memorandum review and credential issuance. Gov retains its own wallet interface and design.

## What lives here

- **Proposals:** Snapshot proposals and voting for `gov.bittrees.eth`.
- **Forum:** Base EAS discussions, Markdown, author revisions, and email or Bittrees Chat subscriptions.
- **Contributors:** wallet-signed, encrypted Base applications; a reviewer worksheet; accepted contributor directory; memorandum negotiation and NFT issuance; monthly contribution records.
- **Roles:** Gov's role catalog and assignments read from the shared [Roles authority](https://roles.bittrees.org). Connecting a wallet does not grant a role.
- **Chat:** [chat.bittrees.org](https://chat.bittrees.org). The old `/messenger` and `/chirpy` paths redirect there.
- **Structure, BGOV and public information:** ENS organization profiles, the existing BGOV mint interface, vision, conduct and metaverse pages. The proposed BTREE/BGOV reissue remains deferred.

## Contracts and verification

Reviewed **20 October 2026 (Europe/Lisbon)** against the current source and public deployment evidence. Source verification proves that published code matches deployed bytecode; it is not an independent security audit.

| Component | Network / address | Source and inspection |
| --- | --- | --- |
| Contributor memorandum NFT (`BCC`) | Ethereum mainnet · [`0x45d27AaD24227B8D9b6089C1d2e0575E284f781b`](https://etherscan.io/address/0x45d27AaD24227B8D9b6089C1d2e0575E284f781b) | [Exact creation + runtime match on Sourcify](https://sourcify.dev/server/v2/contract/1/0x45d27AaD24227B8D9b6089C1d2e0575E284f781b) · [Solidity source](contributor-review/contracts/src/ContributorCredential.sol) · [ABI](docs/contracts/ContributorCredential.abi.json) |
| Application / forum attestations (EAS) | Base · [`0x4200000000000000000000000000000000000021`](https://basescan.org/address/0x4200000000000000000000000000000000000021#code) | Shared Base protocol, not a separately deployed Bittrees application NFT · [application verification](server/contributors/base-application.mjs) |
| EAS Schema Registry | Base · [`0x4200000000000000000000000000000000000020`](https://basescan.org/address/0x4200000000000000000000000000000000000020#code) | [Forum/schema integration](src/lib/forum.ts) |
| Credential root authority | Ethereum mainnet · [`0x1B6c450FaDB7c77191f152473FC2f79dC515FA77`](https://etherscan.io/address/0x1B6c450FaDB7c77191f152473FC2f79dC515FA77) | Deployment-pinned bittrees.eth Safe; root recovery and permit-signer control |

The contributor memorandum and contributor credential are **one non-transferable NFT contract**, not separate tokens. The application itself is a Base attestation. The credential contract is **not a proxy and is not upgradeable**. Earlier contributor deployments are historical and must not be substituted for the address above.

The current contract was deployed in [transaction `0xc023…695fc`](https://etherscan.io/tx/0xc02385e9f818d8be907537a8e7991489ac7fbd437a0871e25b122d0b0ea695fc), block **26,205,158**. Its 19,179-byte runtime has Keccak-256:

```text
0x21ce0d4f04d05040e81b047240a9ac3484cfa0e87ee31299aa287d76c38679a0
```

Gov checks the configured runtime hash before credential operations. Sourcify verification is complete. Etherscan source publication is **pending**: the automatic submission reached the explorer's daily submission limit. The EAS dependencies are linked for inspection; this review did not independently reverify their implementations.

See [verification evidence and limitations](docs/contracts/VERIFICATION.md) and the [current contributor flow and integration guide](docs/contributor-guided-flow.md).

## Contributor flow

1. **Apply with a wallet.** The original application records encrypted content on Base. New submissions automatically stage private intake using a per-document key held inside encrypted server storage for at most 24 hours. The wallet-derived decryption key is never saved. Finalized source checks promote the intake when the applicant or reviewer workspace is opened/refreshed; no new scheduler is added. Expired or failed intake can be recovered from the same Base submission with one unlock signature. Import verifies its finalized attestation, schema, project, signer and revocation/expiry state. An email address is not a substitute for wallet proof.
2. **Review together.** Authorized reviewers unlock applications for their wallet and save them in the protected review workspace. Rejected applications sort last; accepted contributors move to the directory. Encryption setup for future applications belongs in admin settings. A reviewer cannot decrypt an old submission unless its encryption recipients permit it.
Applicants follow one **My contribution** page from submission through issuance. Reviewers retain the worksheet with selected details beside it, and accepted applications open memorandum preparation. The memorandum queue can filter actions and waiting records.

3. **Agree the memorandum.** Partners decide acceptance and status; Junior Partners and Associates can recommend changes. Applicants can view/edit their application and propose memorandum changes. The reviewer approves the agreed version, and the applicant signs the exact terms for the verified receiving wallet.
4. **Issue the credential.** The issuer prepares “Issue Memorandum of Contribution,” signs the transaction, and records its receipt. The service verifies finalized contract events and matching terms before recording issuance. The first issuance requires the root Safe; later authorized Partner actions use Roles permits.
5. **Maintain the contributor record.** Directory and memorandum issuance are separate tabs. Accepted profile data and signed responsibilities feed Roles; Workflows receives suggestions requiring Partner approval, not automatic execution authority.
6. **Confirm monthly contributions.** Only approved contributors with an issued matching memorandum credential enter the monthly view. Partners, Junior Partners and Associates can confirm work; self-confirmation requires recorded evidence. Current on-chain eligibility is checked separately from historical confirmations.

Application acceptance, wallet acknowledgment, transaction submission and finalized NFT issuance are distinct states. None should be inferred from a pending transaction or a connected wallet.

## Credential behavior and authority

- **Terms:** subject identifier, memorandum hash, policy hash, contribution level, recognition rank, valid-from / valid-until timestamps, and individual allocation weight. `validUntil = 0` means an ongoing term.
- **Levels:** Advisor, Part Time, Half Time and Full Time. New memorandum defaults are respectively `1/10`, `1/6`, `1/2` and `1`; individual exceptions require Partner approval and exact contributor acknowledgment. These are application policy defaults, not fixed contract payout rates.
- **Standing:** Active, Suspended, Ended or Revoked. Ended/Revoked cannot be reactivated; replacement requires privileged recovery and new recipient consent. Transfers and token approvals are blocked.
- **Acceptance:** new contributor issuance consent uses the maximum unsigned integer deadline, with exact terms and a single-use nonce. It has no practical expiry. It cannot simply be revoked by editing a draft: reconcile an outstanding signed issuance before revising it.
- **Issuance authorization:** Roles permits are separate, actor/action/nonce/epoch-bound and accepted by the contract only within a maximum 120-second window. A stale permit can be refreshed without changing a still-valid contributor acknowledgment. The root can disable or rotate the permit signer and invalidate outstanding permits.
- **Root authority:** the Safe address is immutable, not a changing ENS lookup. Its default administrator cannot be replaced or renounced. Root-controlled direct issuer, status and recovery grants also exist in the contract; they are distinct from application-issued Roles permits.
- **Partner authority:** the NFT does not appoint a Partner. Roles enforces membership, BGOV and approval policy; a BGOV balance alone is not an appointment. Partner / Junior Partner / Associate thresholds remain 420 / 210 / 69 BGOV. Ongoing contributor-NFT validity is required for all Gov role permissions and project/ecosystem Superadmin access. The NFT remains a prerequisite rather than a role grant; bittrees.eth retains override and recovery authority. Project Admin permissions remain project-scoped, with bittrees.eth override/recovery preserved.
- **Research authority:** Research membership and Executive credentials remain separate native requirements. A contributor NFT is not a Research Executive credential.

A current, Active, in-term NFT establishes monthly BTREE beneficiary eligibility through `isMonthlyBtreeBeneficiary(tokenId)`. It does **not** calculate or pay an allocation, mint BTREE/BGOV, or activate token-reissue claims. Amounts still require an approved funded policy and confirmed contributions.

## NFT metadata and artwork

The contract returns on-chain JSON with standing, display status, level, rank, allocation weight, owner wallet, revision and beneficiary eligibility. Its image points to Gov's [artwork handler](server/contributors/artwork.mjs), which renders the original tree logo and current chain-derived traits. A reverse ENS name is displayed only when forward resolution matches the holder; the wallet remains the identity. Application details, emails and private review notes are not exposed.

The certificate face omits beneficiary wording; eligibility remains in the contract/metadata. Artwork depends on Gov being available, and marketplaces may cache it. [Artwork source](contributor-review/contracts/src/ContributorArtwork.sol) · [shared card renderer](shared/contributor-card.mjs).

## Develop and validate

Vite 6, React 19, TypeScript, Tailwind 4, wagmi/viem, RainbowKit and TanStack Query. Existing lockfiles and dependency patches are part of the build. Use Node 24 to match CI.

```bash
npm ci
npm run dev
npm run build
npm run test:contributors
npm run test:contributors-browser
forge test --offline --root contributor-review/contracts
```

Foundry uses Solidity 0.8.30, optimizer 200 runs, and the OpenZeppelin installation under `contributor-review/node_modules`. Install that workspace's locked dependencies when absent; do not assume the root dependency tree supplies them. Offline contract tests require the compiler to be installed already. CI's complete checks are in [.github/workflows/recovery.yml](.github/workflows/recovery.yml).

## Configuration and release

| Setting | Purpose |
| --- | --- |
| `VITE_MAINNET_RPC_URL`, `VITE_WALLETCONNECT_PROJECT_ID` | Browser chain access and wallet connection; apply the production domain allowlists. |
| `CONTRIBUTORS_ENABLED` | Contributor administration feature switch. |
| `CONTRIBUTOR_CONTRACT_ADDRESS`, `CONTRIBUTOR_CONTRACT_CODE_HASH` | Reviewed Ethereum credential deployment and mandatory runtime pin. |
| `ETHEREUM_RPC_URL`, `BASE_RPC_URL` | Server reads for Ethereum credentials / wallet proof and Base applications. |
| `CONTRIBUTOR_IDENTITY_SECRET`, `CONTRIBUTOR_STORAGE_SECRET` | Server-only identity binding and encrypted private storage. |

Roles authority/feed configuration and protected storage are also required; inspect the current [handler](server/contributors/handler.mjs), [authority integration](server/contributors/authority.mjs), [chain checks](server/contributors/chain.mjs) and [ecosystem client](server/ecosystem-client.mjs). Never expose signing keys or storage secrets through `VITE_` variables. The older [service notes](server/contributors/README.md) and [deployment guide](DEPLOY.md) include historical email-first/Push setup; the wallet-only contributor flow and Chat routing above describe the current product.

The existing Vercel project is `bittrees-gov-ui`, serving `gov.bittrees.org`. Retain required checks, verify the exact deployed source, and preserve wallet/Safe approvals. A web release neither executes pending role transactions nor changes deployed contracts. New contracts or a token reissue require a separate reviewed rollout.
