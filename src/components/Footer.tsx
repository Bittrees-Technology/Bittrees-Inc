import { Link } from "react-router";
import { BITTREES_LINKS, DAO_LINKS, CHAT_URL, GOV_LINKS, ROUTES } from "../lib/links";

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
      { label: "Chat", href: CHAT_URL, external: true },
      { label: "X / Twitter", href: GOV_LINKS.twitter, external: true },
      { label: "Handbook (wiki)", href: GOV_LINKS.wiki, external: true },
    ],
  },
  {
    title: "Bittrees",
    links: BITTREES_LINKS.map((f) => ({ label: f.label, href: f.href, external: true })),
  },
  {
    title: "DAO",
    links: DAO_LINKS.map((f) => ({ label: f.label, href: f.href, external: true })),
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

export default function Footer() {
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
            <nav key={col.title} aria-label={col.title} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <p style={{ fontSize: "0.68rem", color: "var(--color-ink-dim)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, marginBottom: "0.5rem" }}>
                {col.title}
              </p>
              {col.links.map((l) => <FooterLink key={l.href} link={l} />)}
            </nav>
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
