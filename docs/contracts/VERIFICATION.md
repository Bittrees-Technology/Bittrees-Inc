# Contributor credential verification — 20 October 2026

## Result

The current `ContributorCredential` source has **exact creation and runtime matches** on [Sourcify](https://sourcify.dev/server/v2/contract/1/0x45d27AaD24227B8D9b6089C1d2e0575E284f781b). The verification used the current Foundry standard JSON input, Solidity `0.8.30+commit.73712a01`, optimizer enabled with 200 runs, Osaka EVM target, and no via-IR. The source includes the artwork library and OpenZeppelin 5.6.1 dependencies.

| Evidence | Value |
| --- | --- |
| Network | Ethereum mainnet, chain ID 1 |
| Contract | `0x45d27AaD24227B8D9b6089C1d2e0575E284f781b` |
| Deployment transaction | `0xc02385e9f818d8be907537a8e7991489ac7fbd437a0871e25b122d0b0ea695fc` |
| Deployment block | `26205158` |
| Runtime bytes | `19179` |
| Runtime Keccak-256 | `0x21ce0d4f04d05040e81b047240a9ac3484cfa0e87ee31299aa287d76c38679a0` |
| Immutable root | `0x1B6c450FaDB7c77191f152473FC2f79dC515FA77` |
| Sourcify job | `6b0cb41e-5273-4013-9d45-b3da00638e8e` |
| Verification time (UTC) | `2026-10-19T23:06:46Z` — 20 October in Europe/Lisbon |
| Source baseline | Gov main `74213daecd3f486c883f46be49943afb1f44609b` |

The explorer runtime bytes independently hash to the deployment pin above. Exact source verification includes compiler metadata and constructor processing; it is stronger than comparing bytecode with immutable regions excluded. The deployment transaction sender and the contract's root authority are different concepts: the root is the pinned Safe, irrespective of who broadcast the Safe transaction.

Etherscan displayed an unverified contract at inspection. Sourcify's automatic Etherscan submission returned “Daily limit of 500 source code submissions reached.” **Do not label Etherscan Exact Match until its own source page confirms that.** No replacement deployment is needed for source publication.

## Checks performed

- `forge test --offline --root contributor-review/contracts`: **47 passed**, zero failures/skips across credential and artwork suites (some base credential tests are inherited by the artwork suite).
- `npm run test:contributors`: **54 passed**, zero failures/skips.
- The live [Gov token #1 artwork endpoint](https://gov.bittrees.org/api/contributor-artwork?contract=0x45d27AaD24227B8D9b6089C1d2e0575E284f781b&tokenId=1) returned HTTP 200 and the labels **raging.eth**, **0xE535…5B2f**, **Lead Contributor**, **Full Time**, **Active**, and **Non-transferable**. The endpoint reads current chain data, verifies the configured runtime hash, and confirms ENS forward resolution before displaying a name.
- The published [ABI](ContributorCredential.abi.json) was extracted from the verified local compilation artifact, not handwritten.

Coverage includes unauthorized issuance/status/recovery, exact consent, replay rejection, non-expiring single-use consent, actor-bound Roles permits, root signer rotation, non-transferability, amendments, permanent terminal standing, replacement, time validity, metadata and beneficiary eligibility.

## Important boundaries

- This is source/runtime verification and regression testing, **not an independent security audit** or proof that every external service is correctly configured.
- The credential contract is non-upgradeable. The application is a separate Base EAS attestation; no new Bittrees application contract was deployed or verified in this pass.
- Full production environment access returned HTTP 403. The live artwork endpoint confirms the configured contract works through its runtime check; this pass did not independently enumerate current role grants or read the mutable Roles signer directly from chain.
- A contributor consent with the maximum deadline remains usable until its nonce is consumed. There is no cancellation function for that consent. Editing a draft is not an on-chain revocation; outstanding signed operations must be reconciled first.
- Root-controlled direct issuer/status/recovery grants are separate from Roles permits. Off-chain BGOV/majority policy is not implemented inside this NFT contract; permit issuance and role grants must retain their own authorization checks.
- The contract permits individual weights; default levels and allocation policy are application rules. Beneficiary eligibility is not a payout or guarantee of an amount.
- The artwork is served by Gov. On-chain metadata remains available independently, but its image availability and marketplace refresh behavior depend on external services.
- No live memorandum, credential, role assignment, Safe transaction or token supply was changed. Pending role transactions were left untouched. BTREE/BGOV reissue remains deferred.

## Reproduce

With the repository's locked dependencies and compiler already available:

```bash
forge test --offline --root contributor-review/contracts
npm run test:contributors
forge verify-contract \
  0x45d27AaD24227B8D9b6089C1d2e0575E284f781b \
  src/ContributorCredential.sol:ContributorCredential \
  --root contributor-review/contracts --show-standard-json-input
```

The last command produces the verification input locally; it does not issue a transaction. The [Sourcify verification API](https://docs.sourcify.dev/docs/api/) exposes the stored result and source. Subsequent reviewers should compare current source and runtime again rather than infer ongoing correctness from this dated report.
