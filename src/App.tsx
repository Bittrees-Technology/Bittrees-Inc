import { BrowserRouter, Routes, Route, NavLink, Link } from "react-router";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState, useEffect } from "react";
import { watchPushSession } from "./lib/pushRuntime";
import { useAccount } from "wagmi";
import { useAdminAccess } from "./lib/adminAccess";
import Overview from "./pages/Overview";
import Proposals from "./pages/Proposals";
import ProposalDetail from "./pages/ProposalDetail";
import NewProposal from "./pages/NewProposal";
import Admin from "./pages/Admin";
import Structure from "./pages/Structure";
import Mint from "./pages/Mint";
import Forum from "./pages/Forum";
import ForumThread from "./pages/ForumThread";
import Contribute from "./pages/Contribute";
import Messenger from "./pages/Messenger";
import Vision from "./pages/Vision";
import CodeOfConduct from "./pages/CodeOfConduct";
import Metaverse from "./pages/Metaverse";
import TokenFlow from "./pages/TokenFlow";
import Chirpy from "./pages/Chirpy";
import { ConfigBanner } from "./components/ConfigBanner";
import { FAMILY, GOV_LINKS, ROUTES } from "./lib/links";

const NAV = [
  { to: ROUTES.overview, label: "Home", end: true },
  { to: ROUTES.proposals, label: "Proposals", end: false },
  { to: ROUTES.forum, label: "Forum", end: false },
  { to: ROUTES.messenger, label: "Chat", end: false },
  { to: ROUTES.structure, label: "Structure", end: false },
  { to: ROUTES.mint, label: "BGOV", end: false },
];

export default function App() {
  useEffect(watchPushSession, []);
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col" style={{ background: "var(--color-bg)" }}>
        <ConfigBanner />
        <Header />
        <main
          className="flex-1 w-full"
          style={{ maxWidth: "1140px", width: "100%", margin: "0 auto", padding: "2.5rem 1.5rem 4rem" }}
        >
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/proposals" element={<Proposals />} />
            <Route path={ROUTES.newProposal} element={<NewProposal />} />
            <Route path={ROUTES.admin} element={<Admin />} />
            <Route path="/proposals/:id" element={<ProposalDetail />} />
            <Route path="/structure" element={<Structure />} />
            <Route path={ROUTES.mint} element={<Mint />} />
            <Route path={ROUTES.forum} element={<Forum />} />
            <Route path={`${ROUTES.forum}/:id`} element={<ForumThread />} />
            <Route path={ROUTES.contribute} element={<Contribute />} />
            <Route path={ROUTES.messenger} element={<Messenger />} />
            <Route path={ROUTES.vision} element={<Vision />} />
            <Route path={ROUTES.codeOfConduct} element={<CodeOfConduct />} />
            <Route path={ROUTES.metaverse} element={<Metaverse />} />
            <Route path={ROUTES.chirpy} element={<Chirpy />} />
            <Route path="/69420" element={<TokenFlow />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

/* ============================================================
   Header
   ============================================================ */
function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { address } = useAccount();
  const adminLevel = useAdminAccess(address);
  // Admin tab — appended to the right of BGOV, shown to anyone with admin access
  // (full admins or moderators); the Admin page itself shows only their allowed tabs.
  const nav = adminLevel !== "none" ? [...NAV, { to: ROUTES.admin, label: "Admin", end: false }] : NAV;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "#ffffff",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div
        style={{
          maxWidth: "1140px",
          margin: "0 auto",
          padding: "0 1.5rem",
          height: "56px",
          display: "flex",
          alignItems: "center",
          gap: "2rem",
        }}
      >
        {/* Wordmark */}
        <NavLink
          to="/"
          style={{
            textDecoration: "none",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
          }}
        >
          <BittreesLogo />
          <span
            style={{
              fontFamily: "var(--font-logo)",
              fontWeight: 700,
              fontSize: "1.1rem",
              color: "var(--color-ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Bittrees, Inc.
          </span>
        </NavLink>

        {/* Desktop nav */}
        <nav className="nav-desktop" style={{ gap: "0.25rem", flex: 1 }}>
          {nav.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                textDecoration: "none",
                fontFamily: "var(--font-sans)",
                fontSize: "0.875rem",
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--color-ink)" : "var(--color-ink-muted)",
                padding: "0.25rem 0.75rem",
                borderBottom: isActive ? "2px solid var(--color-primary)" : "2px solid transparent",
                transition: "color 0.15s, border-color 0.15s",
                lineHeight: "56px",
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginLeft: "auto" }}>
          <ConnectButton chainStatus="icon" showBalance={false} accountStatus="avatar" />
          <button data-insights="toggle-navigation"
            className="nav-mobile-toggle"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            style={{
              color: "var(--color-ink-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.25rem",
              alignItems: "center",
            }}
          >
            {mobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div style={{ borderTop: "1px solid var(--color-border)", background: "#ffffff" }} onClick={() => setMobileOpen(false)}>
          <nav style={{ display: "flex", flexDirection: "column" }}>
            {nav.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                style={({ isActive }) => ({
                  display: "block",
                  padding: "0.75rem 1.5rem",
                  fontSize: "0.875rem",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--color-ink)" : "var(--color-ink-muted)",
                  textDecoration: "none",
                  borderLeft: `3px solid ${isActive ? "var(--color-primary)" : "transparent"}`,
                  background: isActive ? "var(--color-bg-subtle)" : "transparent",
                })}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

/* ============================================================
   Footer — disclaimer + family links
   ============================================================ */
type FooterLinkDef = { label: string; href: string; external?: boolean };

const FOOTER_COLS: { title: string; links: FooterLinkDef[] }[] = [
  {
    title: "Organization",
    links: [
      { label: "Structure", href: ROUTES.structure },
      { label: "Revenue & Token Flow", href: "/69420" },
      { label: "Vision statement", href: ROUTES.vision },
      { label: "Code of conduct", href: ROUTES.codeOfConduct },
      { label: "Metaverse HQ", href: ROUTES.metaverse },
    ],
  },
  {
    title: "Govern",
    links: [
      { label: "Proposals", href: ROUTES.proposals },
      { label: "Forum", href: ROUTES.forum },
      { label: "Mint BGOV", href: ROUTES.mint },
      { label: "Snapshot", href: GOV_LINKS.snapshot, external: true },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Become a contributor", href: ROUTES.contribute },
      { label: "Chat", href: ROUTES.messenger },
      { label: "Chirpy app", href: ROUTES.chirpy },
      { label: "X / Twitter", href: GOV_LINKS.twitter, external: true },
      { label: "Handbook (wiki)", href: GOV_LINKS.wiki, external: true },
    ],
  },
  {
    title: "Bittrees family",
    links: FAMILY.map((f) => ({ label: f.label, href: f.href, external: true })),
  },
];

function FooterLink({ link }: { link: FooterLinkDef }) {
  const style = { fontSize: "0.8rem", color: "var(--color-ink-muted)", textDecoration: "none", lineHeight: 1.9 } as const;
  return link.external ? (
    <a href={link.href} target="_blank" rel="noreferrer" style={style}>{link.label}</a>
  ) : (
    <Link to={link.href} style={style}>{link.label}</Link>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--color-border)", background: "#ffffff", fontFamily: "var(--font-sans)" }}>
      <div style={{ maxWidth: "1140px", margin: "0 auto", padding: "2.5rem 1.5rem 1.5rem" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "4rem",
            justifyContent: "center",
            paddingBottom: "1.75rem",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          {FOOTER_COLS.map((col) => (
            <div key={col.title} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <p style={{ fontSize: "0.68rem", color: "var(--color-ink-dim)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, marginBottom: "0.5rem" }}>
                {col.title}
              </p>
              {col.links.map((l) => <FooterLink key={l.href} link={l} />)}
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.35rem",
            paddingTop: "1.25rem",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "0.7rem", color: "var(--color-ink-dim)", margin: 0, maxWidth: "640px" }}>
            For information only. Nothing here is financial advice or an offer or solicitation to buy or sell any security.
          </p>
          <p style={{ fontSize: "0.72rem", color: "var(--color-ink-dim)", margin: 0 }}>
            &copy; {new Date().getFullYear()} Bittrees, Inc.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   Logo
   ============================================================ */
function BittreesLogo() {
  return (
    <img
      src="/bittrees_logo_tree.png"
      alt="Bittrees"
      width={30}
      height={30}
      style={{ display: "block", objectFit: "contain" }}
    />
  );
}
