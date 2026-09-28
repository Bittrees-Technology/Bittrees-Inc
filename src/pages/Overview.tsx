import { Link } from "react-router";
import { ROUTES } from "../lib/links";
import { publicPages } from "../lib/seo";
import { VISION_PARAGRAPHS } from "./Vision";

export default function Overview() {
  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "2.75rem", paddingTop: "1.5rem" }}>
      <header style={{ textAlign: "center" }}>
        <h1 className="text-display">Bittrees Governance</h1>
        <p style={{ fontFamily: "var(--font-sans)", color: "var(--color-ink-muted)", lineHeight: 1.6, marginTop: "1rem" }}>{publicPages["/"].description}</p>
      </header>
      {/* Vision statement — in full */}
      <section style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <p className="text-label">Bittrees, Inc. · Vision Statement</p>
        {VISION_PARAGRAPHS.map((p, i) => (
          <p
            key={i}
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.125rem",
              lineHeight: 1.65,
              color: "var(--color-ink)",
              margin: 0,
            }}
          >
            {p}
          </p>
        ))}
      </section>

      {/* Become a contributor */}
      <section
        style={{
          textAlign: "center",
          borderTop: "1px solid var(--color-border)",
          paddingTop: "2.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <p className="nowrap-desktop" style={{ fontFamily: "var(--font-sans)", fontSize: "0.95rem", color: "var(--color-ink-muted)", lineHeight: 1.6, margin: 0 }}>
          Bittrees, Inc. is built by its community. If this mission resonates, come build with us.
        </p>
        <Link to={ROUTES.contribute} className="btn-primary" style={{ textDecoration: "none" }}>
          Become a contributor →
        </Link>
      </section>
    </div>
  );
}
