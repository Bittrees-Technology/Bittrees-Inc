import { ENTITIES, ENTITY_BLURBS, type BittreesEntity } from "../lib/entities";
import { etherscanAddress, shortAddress, GOV_LINKS } from "../lib/links";
import { useEnsTexts, type EnsText } from "../lib/ens";

export default function Structure() {
  const safes = ENTITIES.filter((e) => e.kind === "treasury");
  const central = safes.find((e) => e.ens === "gov.bittrees.eth");
  const subdaos = safes.filter((e) => e !== central && e.ens?.endsWith(".gov.bittrees.eth"));
  const units = safes.filter((e) => e !== central && !e.ens?.endsWith(".gov.bittrees.eth"));

  const names = safes.map((e) => e.ens).filter((x): x is string => !!x);
  const { data: texts } = useEnsTexts(names);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.25rem" }}>
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.5rem" }}>
        <p className="text-label">Governance</p>
        <h1 className="text-display">Structure</h1>
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
The <strong>bittrees.eth</strong> family comprises Bittrees, Inc., Bittrees Research, and Bittrees
          Capital — each governed independently. <strong>BGOV</strong> common stock governs{" "}
          <strong>Bittrees, Inc.</strong>, organized as the <strong>B.T.C. Group</strong>: the Business,
          Technology, and Community subDAOs, each holding one-third of voting power, with a two-thirds
          consensus for major matters.
        </p>
      </header>

      <StructureDiagram />

      {central && (
        <section style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <p className="text-label">Governed by BGOV</p>
          <EntityCard e={central} text={texts?.[central.ens!]} primary />
        </section>
      )}

      {subdaos.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <p className="text-label">The B.T.C. Group — subDAOs</p>
          <p style={sectionNote}>
            Each subDAO holds one-third of voting power; major matters need a two-thirds consensus.
          </p>
          <Grid>{subdaos.map((e) => <EntityCard key={e.address} e={e} text={texts?.[e.ens!]} />)}</Grid>
        </section>
      )}

      {units.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <p className="text-label">Independent organizations</p>
          <p style={sectionNote}>
            Part of the Bittrees family, but governed independently of Bittrees, Inc. — not
            controlled by BGOV.
          </p>
          <Grid>{units.map((e) => <EntityCard key={e.address} e={e} text={texts?.[e.ens!]} />)}</Grid>
        </section>
      )}

      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.78rem",
          color: "var(--color-ink-dim)",
          lineHeight: 1.6,
        }}
      >
        Proposals are decided on Snapshot (
        <a href={GOV_LINKS.snapshot} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary-hover)" }}>
          gov.bittrees.eth
        </a>
        ). Treasury holdings for each entity are tracked on{" "}
        <a data-insights="navigate-capitalbittreesorg/" href="https://capital.bittrees.org" target="_blank" rel="noreferrer" style={{ color: "var(--color-primary-hover)" }}>
          Bittrees Capital
        </a>
        .
      </p>
    </div>
  );
}

const sectionNote = {
  fontFamily: "var(--font-sans)",
  fontSize: "0.8rem",
  color: "var(--color-ink-dim)",
  lineHeight: 1.55,
  maxWidth: "640px",
  margin: 0,
} as const;

/**
 * Radial org map: bittrees.eth (the family root) → Bittrees, Inc. + Research +
 * Capital (each independently governed); Bittrees, Inc. → the Business, Technology,
 * and Community subDAOs (the B.T.C. Group).
 */
function StructureDiagram() {
  const titleLg = { fontFamily: "Tinos, Georgia, serif", fontWeight: 700, fontSize: "14px", fill: "var(--color-ink)" } as const;
  const titleMd = { fontFamily: "Tinos, Georgia, serif", fontWeight: 700, fontSize: "13px", fill: "var(--color-ink)" } as const;
  const sub = { fontFamily: "system-ui, sans-serif", fontSize: "10px", fill: "var(--color-ink-muted)" } as const;
  const line = "var(--color-border)";

  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <svg
        viewBox="0 0 760 500"
        width="100%"
        role="img"
        aria-label="bittrees.eth is the family root, with Bittrees, Inc., Bittrees Research, and Bittrees Capital radiating from it — each governed independently. Bittrees, Inc. governs the Business, Technology, and Community subDAOs (the B.T.C. Group)."
        style={{ display: "block", maxWidth: "740px", margin: "0 auto" }}
      >
        {/* Connectors (drawn first, behind the nodes) */}
        <path d="M380 70 Q 250 102 130 166 M380 70 Q 510 102 630 166 M380 70 L380 235" stroke={line} strokeWidth="1.5" fill="none" />
        <path d="M380 235 Q 248 338 175 430 M380 235 L380 430 M380 235 Q 512 338 585 430" stroke={line} strokeWidth="1.5" fill="none" />

        {/* Root: bittrees.eth */}
        <rect x="305" y="44" width="150" height="52" rx="10" fill="var(--color-bg-subtle)" stroke="var(--color-primary)" strokeWidth="2" />
        <text x="380" y="67" textAnchor="middle" style={titleLg}>bittrees.eth</text>
        <text x="380" y="84" textAnchor="middle" style={sub}>the Bittrees family</text>

        {/* Bittrees, Inc. (BGOV) */}
        <rect x="298" y="209" width="164" height="52" rx="8" fill="#ffffff" stroke="var(--color-primary)" strokeWidth="2" />
        <text x="380" y="231" textAnchor="middle" style={titleLg}>Bittrees, Inc.</text>
        <text x="380" y="248" textAnchor="middle" style={sub}>governed by BGOV</text>

        {/* Research + Capital — independent siblings */}
        <rect x="55" y="141" width="150" height="50" rx="8" fill="var(--color-bg-subtle)" stroke="var(--color-border-light)" strokeWidth="1.3" strokeDasharray="5 3" />
        <text x="130" y="163" textAnchor="middle" style={titleMd}>Bittrees Research</text>
        <text x="130" y="180" textAnchor="middle" style={sub}>independent</text>

        <rect x="555" y="141" width="150" height="50" rx="8" fill="var(--color-bg-subtle)" stroke="var(--color-border-light)" strokeWidth="1.3" strokeDasharray="5 3" />
        <text x="630" y="163" textAnchor="middle" style={titleMd}>Bittrees Capital</text>
        <text x="630" y="180" textAnchor="middle" style={sub}>independent</text>

        {/* B.T.C. subDAOs */}
        <rect x="107" y="405" width="136" height="50" rx="8" fill="#ffffff" stroke={line} strokeWidth="1.3" />
        <text x="175" y="427" textAnchor="middle" style={titleMd}>Business</text>
        <text x="175" y="444" textAnchor="middle" style={sub}>subDAO · automate</text>

        <rect x="312" y="405" width="136" height="50" rx="8" fill="#ffffff" stroke={line} strokeWidth="1.3" />
        <text x="380" y="427" textAnchor="middle" style={titleMd}>Technology</text>
        <text x="380" y="444" textAnchor="middle" style={sub}>subDAO · develop</text>

        <rect x="517" y="405" width="136" height="50" rx="8" fill="#ffffff" stroke={line} strokeWidth="1.3" />
        <text x="585" y="427" textAnchor="middle" style={titleMd}>Community</text>
        <text x="585" y="444" textAnchor="middle" style={sub}>subDAO · build</text>

        <text x="380" y="483" textAnchor="middle" style={sub}>⅓ voting power each · ⅔ consensus for major matters</text>
      </svg>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "1rem",
      }}
    >
      {children}
    </div>
  );
}

function EntityCard({ e, text, primary }: { e: BittreesEntity; text?: EnsText; primary?: boolean }) {
  const ensDescription = text?.description?.trim();
  const blurb = (e.ens && ENTITY_BLURBS[e.ens]) || undefined;
  const description = ensDescription || blurb;

  return (
    <div
      className="card"
      style={{
        borderColor: primary ? "var(--color-primary)" : "var(--color-border-light)",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", minWidth: 0 }}>
          {text?.avatar && (
            <img
              src={text.avatar}
              alt=""
              width={28}
              height={28}
              loading="lazy"
              style={{ borderRadius: "999px", objectFit: "cover", flexShrink: 0, border: "1px solid var(--color-border-light)" }}
              onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.95rem", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
            {e.label}
          </p>
        </div>
        {ensDescription && (
          <span
            title="Description read live from the entity's ENS record"
            style={{
              flexShrink: 0,
              fontFamily: "var(--font-sans)",
              fontSize: "0.6rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--color-primary-hover)",
              border: "1px solid var(--color-border-light)",
              borderRadius: "999px",
              padding: "0.1rem 0.4rem",
            }}
          >
            ENS
          </span>
        )}
      </div>

      {e.ens && (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--color-ink-muted)", margin: 0 }}>
          {e.ens}
        </p>
      )}

      {description && (
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.82rem", color: "var(--color-ink-muted)", lineHeight: 1.55, margin: "0.15rem 0 0" }}>
          {description}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.85rem", marginTop: "0.4rem", alignItems: "center" }}>
        <a
          href={etherscanAddress(e.address)}
          target="_blank"
          rel="noreferrer"
          style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--color-ink-dim)", textDecoration: "none" }}
        >
          {shortAddress(e.address)} ↗
        </a>
        {text?.url && (
          <a
            href={text.url}
            target="_blank"
            rel="noreferrer"
            style={{ fontFamily: "var(--font-sans)", fontSize: "0.72rem", color: "var(--color-primary-hover)", textDecoration: "none" }}
          >
            Website ↗
          </a>
        )}
        {text?.twitter && (
          <a
            href={`https://x.com/${text.twitter.replace(/^@/, "")}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontFamily: "var(--font-sans)", fontSize: "0.72rem", color: "var(--color-primary-hover)", textDecoration: "none" }}
          >
            @{text.twitter.replace(/^@/, "")} ↗
          </a>
        )}
      </div>
    </div>
  );
}
