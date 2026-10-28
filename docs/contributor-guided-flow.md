# Contributor flow and project integration

## Applicant and reviewer handoff

Applicants use **My contribution** for the original application, information requests, memorandum negotiation, signature, issued credential and confirmed contribution history. Application edits preserve the original Base source and do not rewrite signed terms or grant roles.

Reviewers retain the application worksheet; selecting a contributor opens the review alongside it. Rejected records remain last. Final acceptance requires Partner authority and opens memorandum preparation with the applicant's contribution interests as responsibilities. The accepted profile remains in Directory. Junior Partners and Associates recommend decisions; existing server checks remain authoritative.

The memorandum queue defaults to **Needs my action**, with **Waiting for contributor** and **All memoranda** filters. Issued records are available through Directory or All memoranda. Unfinished drafts, proposed edits, contributor acknowledgment, transaction submission and finalized issuance are distinct stages.

## Automatic private intake

New submissions verify the wallet session and submit the original encrypted Base EAS application. The receipt supplies its attestation UID directly, avoiding an indexing-delay dependency. The browser submits only that UID and its per-document content key to authenticated `stage_base` intake.

The server independently checks the source against the submitting wallet at the latest Base block before staging. The content key is separately encrypted with the existing private-storage codec and stored under a Redis key with an enforced **24-hour TTL**. The state contains only provenance and a pending intake reference; responses and profile feeds never include the key. Wallet-derived decryption keys and encryption signatures are not stored.

Opening/refetching the applicant or authorized reviewer queue processes at most three due intake records, at most once per record per minute. A visible workspace refreshes once per minute while an intake is pending. Promotion repeats the original **finalized** attestation, project, wallet, revocation, data-hash and decryption checks. It creates a submitted application, not an approval, credential or role. Successful promotion removes the temporary key after the private-state commit. A failed cleanup still has the enforced TTL as a backstop.

This is event-driven intake, not a new background scheduler. If nobody opens the workspace before the key expires, the next visit asks for one unlock signature on the existing Base application. Existing submissions also use that single unlock-to-import action. Do not submit another transaction merely because intake is pending.

## Signed memoranda

The deployed non-upgradeable contract accepts non-expiring, single-use contributor consent. It cannot cancel that consent. A signed but unissued version therefore offers issuance and receipt verification; the interface does not offer an amendment that would pretend to invalidate its signature. Complete and reconcile issuance before preparing an amendment for fresh contributor consent. Historical expiring signatures retain their finalized-expiry recovery checks.

Roles action permits remain separate, short-lived, actor/action-bound approvals. Refreshing an issuance permit does not silently change memorandum terms or mint a second credential. New terms always require the contributor's exact acknowledgment.

## Integration contract

| Source | Published meaning | Permission boundary |
| --- | --- | --- |
| Gov application | Name, expertise, interests, specialty, languages, requested roles | Requested roles are requests, never grants. |
| Accepted profile | Partner-approved title | Does not create a role assignment. |
| Signed memorandum | Responsibilities and memorandum version | Workflows suggests work; a Partner approves planning. |
| Contributor NFT | Current holder, standing, term and beneficiary eligibility | Active validity is a prerequisite, not a role grant or payout. |
| Roles signed decision | Actual current project actions | Exact request/audience/signature and maximum five-second freshness are checked by Gov. |
| Project-native credentials | Research membership/Executive and other source requirements | Each project retains its own additional checks. |

Gov continues using the existing signed version-1 profile, Workflow and authority protocols. No new source trust, shared login interface, contract, database resource, automatic workflow execution or role appointment is introduced.

The user reaffirmed on 28 October 2026 that ongoing NFT validity remains required for **all Gov roles and project/ecosystem Superadmins**. Preserve authenticated bittrees.eth override/recovery and project-scoped Admin limits. Native Research and Capital requirements remain intact. Pending Safe operations, policy activation and BTREE/BGOV reissue are separate work.

## Validation

Regression coverage includes staging ownership/CSRF, encrypted key TTL, finality delays, bounded retries, source conflicts, cross-wallet privacy, consumed key cleanup, applicant edits, exact memorandum consent, issuer review, role-proof authentication, desktop/mobile layouts and loss of authorization. Automated browser tests use test records and wallets; a release does not claim a new live credential was issued.
