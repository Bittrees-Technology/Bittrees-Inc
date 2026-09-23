/**
 * Chat product preview. Keep the existing /chirpy route and application/repository
 * links usable until launch acceptance and the infrastructure rename are complete.
 */

import { Link } from "react-router";
import { ROUTES } from "../lib/links";
import { useRouteMeta } from "../lib/routeMeta";

const CHIRPY_WEB = "https://chirpy.bittrees.org";
const CHIRPY_REPO = "https://github.com/Bittrees-Technology/chirpy";
const PAGE_TITLE = "Chat — Messaging and connected email preview | Bittrees";
const PAGE_DESCRIPTION =
  "Explore Chat: wallet messaging and connected Bittrees Mail. Public launch, email forwarding and device recovery verification are still in progress.";

const FEATURES: { title: string; body: string }[] = [
  {
    title: "Your wallet, your public profile",
    body: "Connect your wallet for messaging. You choose which profile details to publish; connecting a mailbox does not make your email address public.",
  },
  {
    title: "Connected Bittrees Mail",
    body: "Read, send and reply using a mailbox you authorize. Wallet-to-email and email-to-wallet forwarding are not available yet.",
  },
  {
    title: "Community conversations",
    body: "Explore direct messages and community rooms. Room access depends on membership and community rules. Existing Governance conversations remain available in Messenger while migration is verified.",
  },
  {
    title: "Keep your local data",
    body: "Review and transfer contacts, local notes and selected preferences with an encrypted recovery file. Message history and recovery on another device need separate verification; keep access to your original app.",
  },
];

const PLATFORMS: { name: string; status: string; cta: string; href: string; primary?: boolean }[] = [
  { name: "Web preview", status: "Available for testing — launch verification is in progress", cta: "Open Chat preview", href: CHIRPY_WEB, primary: true },
  { name: "macOS desktop", status: "In development — signed public release pending", cta: "View progress", href: CHIRPY_REPO },
  { name: "iOS", status: "In development — release and device verification pending", cta: "View progress", href: CHIRPY_REPO },
];

function ChirpMark() {
  // Existing chat-bubble mark in Bittrees orange.
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "44px",
        height: "44px",
        borderRadius: "10px",
        background: "var(--color-primary)",
        flexShrink: 0,
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-4 3.5V16H5.5A1.5 1.5 0 0 1 4 14.5v-9Z"
          fill="#1A1A1A"
        />
        <circle cx="9" cy="10" r="1.1" fill="var(--color-primary)" />
        <circle cx="12.5" cy="10" r="1.1" fill="var(--color-primary)" />
        <circle cx="16" cy="10" r="1.1" fill="var(--color-primary)" />
      </svg>
    </span>
  );
}

export default function Chirpy() {
  useRouteMeta({
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    canonical: "https://gov.bittrees.org/chirpy",
    ogImage: "https://gov.bittrees.org/bittrees_logo_tree.png",
    twitterCard: "summary_large_image",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem", maxWidth: "820px", margin: "0 auto", width: "100%" }}>
      {/* Hero */}
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", marginBottom: "1rem" }}>
          <ChirpMark />
          <div>
            <p className="text-label" style={{ margin: 0 }}>Bittrees · Chat</p>
            <h1 className="text-display" style={{ margin: 0 }}>
              Chat — messaging and connected email
            </h1>
          </div>
        </div>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "1.25rem",
            lineHeight: 1.6,
            color: "var(--color-ink)",
            margin: "0 0 1.5rem",
            maxWidth: "640px",
          }}
        >
          Wallet messaging and connected Bittrees Mail in one app. Chat is available as
          a web preview while email forwarding, conversation continuity and device
          verification are completed before public launch.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <a className="btn-primary" href={CHIRPY_WEB} target="_blank" rel="noreferrer">
            Open Chat preview ↗
          </a>
          <a className="btn-ghost" href={CHIRPY_REPO} target="_blank" rel="noreferrer">
            Chat on GitHub ↗
          </a>
        </div>
      </header>

      {/* Platforms */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 className="text-title">Try Chat</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
          {PLATFORMS.map((p) => (
            <div key={p.name} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "1rem", color: "var(--color-ink)", margin: 0 }}>
                {p.name}
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.82rem", color: "var(--color-ink-muted)", margin: 0, flex: 1 }}>
                {p.status}
              </p>
              <a
                className={p.primary ? "btn-primary" : "btn-ghost"}
                href={p.href}
                target="_blank"
                rel="noreferrer"
                style={{ marginTop: "0.5rem", alignSelf: "flex-start" }}
              >
                {p.cta} ↗
              </a>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.76rem", color: "var(--color-ink-dim)", margin: 0 }}>
          Public native releases will follow signing, update and device verification. Track
          progress on{" "}
          <a href={CHIRPY_REPO} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary-hover)" }}>
            GitHub ↗
          </a>
          .
        </p>
      </section>

      {/* What you can explore */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 className="text-title">What you can explore</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="card-subtle" style={{ padding: "1.25rem" }}>
              <p style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.92rem", color: "var(--color-ink)", margin: "0 0 0.35rem" }}>
                {f.title}
              </p>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", lineHeight: 1.55, color: "var(--color-ink-muted)", margin: 0 }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Contributor tie-in */}
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: "0.6rem", padding: "1.5rem" }}>
        <h2 className="text-title" style={{ margin: 0 }}>Your existing conversations stay available</h2>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", lineHeight: 1.6, color: "var(--color-ink-muted)", margin: 0, maxWidth: "560px" }}>
          Keep using the Governance messenger for existing conversations. Chat is being
          verified with community rooms before it becomes the shared messaging app.
        </p>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.82rem", color: "var(--color-ink-dim)", margin: 0 }}>
          Preview access does not grant room membership or transfer message history.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.4rem" }}>
          <a className="btn-primary" href={CHIRPY_WEB} target="_blank" rel="noreferrer">
            Open Chat preview ↗
          </a>
          <Link className="btn-ghost" to={ROUTES.messenger}>
            Open Governance messenger
          </Link>
        </div>
      </section>

      {/* Footer note */}
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.78rem",
          color: "var(--color-ink-dim)",
          borderTop: "1px solid var(--color-border)",
          paddingTop: "1.25rem",
          lineHeight: 1.6,
        }}
      >
        Chat is built by Bittrees Technology and is open source. Browse the code, file issues,
        or follow release progress on{" "}
        <a href={CHIRPY_REPO} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary-hover)" }}>
          GitHub ↗
        </a>
        .
      </p>
    </div>
  );
}
