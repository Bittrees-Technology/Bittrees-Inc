/**
 * Chirpy — info / landing page for the Bittrees chat app, served at
 * gov.bittrees.org/chirpy. Links out to the live web app and the desktop
 * downloads (published as GitHub Releases on the chirpy repo). Org-agnostic
 * product, so the copy stays product-first with a light Bittrees framing.
 */

const CHIRPY_WEB = "https://chirpy.bittrees.org";
const CHIRPY_REPO = "https://github.com/Bittrees-Technology/chirpy";

const FEATURES: { title: string; body: string }[] = [
  {
    title: "Wallet-native, no account",
    body: "Your wallet is your identity. Connect and you're in — no email, no password, no sign-up.",
  },
  {
    title: "1:1 DMs + token-gated rooms",
    body: "Private direct messages plus community rooms gated by tokens, NFTs, Safe membership, ENS, or roles.",
  },
  {
    title: "Org-agnostic",
    body: "Ships with no organization baked in. Start personal, then import an org (Bittrees Inc, Research) or create your own.",
  },
  {
    title: "Your chats follow you",
    body: "DMs are tied to your wallet and travel with you across every org and device; rooms stay scoped to their community.",
  },
];

const PLATFORMS: { name: string; status: string; cta: string; href: string; primary?: boolean }[] = [
  { name: "Web", status: "Live now — runs in any browser", cta: "Open Chirpy", href: CHIRPY_WEB, primary: true },
  { name: "macOS desktop", status: "In development — no build published yet", cta: "View progress", href: CHIRPY_REPO },
  { name: "iOS", status: "Coming to the App Store", cta: "On the roadmap", href: CHIRPY_REPO },
];

function ChirpMark() {
  // A simple chat-bubble glyph in Bittrees orange — chat + "chirp".
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem", maxWidth: "820px", margin: "0 auto", width: "100%" }}>
      {/* Hero */}
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", marginBottom: "1rem" }}>
          <ChirpMark />
          <div>
            <p className="text-label" style={{ margin: 0 }}>Bittrees · Chat</p>
            <h1 className="text-display" style={{ margin: 0 }}>Chirpy</h1>
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
          Wallet-native chat for any community — private DMs and token-gated rooms, in one
          app that runs on the web, macOS, and iOS.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <a className="btn-primary" href={CHIRPY_WEB} target="_blank" rel="noreferrer">
            Open the web app ↗
          </a>
          <a className="btn-ghost" href={CHIRPY_REPO} target="_blank" rel="noreferrer">
            Chirpy on GitHub ↗
          </a>
        </div>
      </header>

      {/* Platforms */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 className="text-title">Get Chirpy</h2>
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
          Signed, auto-updating desktop builds are on the roadmap and not published yet — track
          progress on{" "}
          <a href={CHIRPY_REPO} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary-hover)" }}>
            GitHub ↗
          </a>
          .
        </p>
      </section>

      {/* What you get */}
      <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 className="text-title">What you get</h2>
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
        Chirpy is built by Bittrees Technology and is open source. Browse the code, file issues,
        or grab a release on{" "}
        <a href={CHIRPY_REPO} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary-hover)" }}>
          GitHub ↗
        </a>
        .
      </p>
    </div>
  );
}
