import PageMeta from "./components/PageMeta";
import Footer from "./components/Footer";
import { BrowserRouter, Routes, Route, NavLink } from "react-router";
import GovAccount from "./components/GovAccount";
import { useState, useEffect } from "react";
import { watchPushSession } from "./lib/pushRuntime";
import { useAccount } from "wagmi";
import { useAdminNavigation } from "./lib/adminAccess";
import Overview from "./pages/Overview";
import Proposals from "./pages/Proposals";
import ProposalDetail from "./pages/ProposalDetail";
import NewProposal from "./pages/NewProposal";
import Contributors from "./pages/Contributors";
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
import { CHAT_URL, ROUTES } from "./lib/links";

const NAV = [
  { to: ROUTES.overview, label: "Home", end: true },
  { to: ROUTES.proposals, label: "Proposals", end: false },
  { to: ROUTES.forum, label: "Forum", end: false },
  { to: CHAT_URL, label: "Chat", end: false },
  { to: ROUTES.structure, label: "Structure", end: false },
  { to: ROUTES.mint, label: "BGOV", end: false },
];

export default function App() {
  useEffect(watchPushSession, []);
  return (
    <BrowserRouter>
      <PageMeta />
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
            <Route path="/admin/contributors" element={<Contributors />} />
            <Route path="/contributors/apply" element={<Contributors apply />} />
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
  const showAdmin = useAdminNavigation(address);
  // Admin tab — appended to the right of BGOV, shown to anyone with admin access
  // (full admins or moderators); the Admin page itself shows only their allowed tabs.
  const nav = showAdmin ? [...NAV, { to: ROUTES.admin, label: "Admin", end: false }] : NAV;

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
      <div className="gov-header-inner"
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
          <GovAccount />
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
