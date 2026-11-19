import { Link } from "react-router";
import { ROUTES } from "../lib/links";

// These are the existing public introductions, shared with the build-time renderer.
// Wallet, session, form, proposal and discussion data stay in their client pages.

export function ProposalsIntroduction() {
  return (
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <p className="text-label">Governance</p>
            <h1 className="text-display">Proposals</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginTop: "0.4rem", flexWrap: "wrap" }}>
            <Link to={ROUTES.newProposal} className="btn-primary" style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
              New proposal
            </Link>
          </div>
        </div>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.9375rem",
            color: "var(--color-ink-muted)",
            maxWidth: "640px",
            lineHeight: 1.6,
            marginTop: "0.5rem",
          }}
        >
          Bittrees Improvement Proposals (BIPs), voted by BGOV common-stock holders.
        </p>
      </header>
  );
}

export function ForumIntroduction() {
  return (
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.5rem" }}>
        <p className="text-label">Bittrees, Inc.</p>
        <h1 className="text-display">Forum</h1>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.9375rem",
            color: "var(--color-ink-muted)",
            maxWidth: "640px",
            lineHeight: 1.6,
            marginTop: "0.5rem",
          }}
        >
          A decentralized governance forum. Every post is signed by your wallet and recorded
          on-chain as an EAS attestation on Base — anyone can read it, no account required.
          Starting a discussion requires 69 BGOV; any connected wallet can reply. Authors can edit their posts with a new signed version; earlier versions remain on-chain.
        </p>
      </header>
  );
}

export function ContributionIntroduction() {
  return (
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.5rem" }}>
        <p><Link to="/admin/contributors">My contribution</Link></p>
        <p className="text-label">Bittrees, Inc.</p>
        <h1 className="text-display">Become a contributor</h1>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.9375rem", color: "var(--color-ink-muted)", lineHeight: 1.6, marginTop: "0.5rem" }}>
          Tell us what you would like to contribute. Submit with your wallet on Base, then follow review, your memorandum and credential from My contribution.
        </p>
      </header>
  );
}

export function MintIntroduction() {
  return (
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.5rem" }}>
        <p className="text-label">Bittrees, Inc.</p>
        <h1 className="text-display">Mint BGOV</h1>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.9375rem",
            color: "var(--color-ink-muted)",
            lineHeight: 1.6,
            marginTop: "0.5rem",
          }}
        >
          BGOV is the common stock of Bittrees, Inc. — minting it acquires an equity interest that
          carries the governance (voting) rights used across this site.
        </p>
      </header>
  );
}
