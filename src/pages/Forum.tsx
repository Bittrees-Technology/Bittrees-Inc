import { useTopics } from "../lib/forum";
import { Composer, PostCard } from "../components/forum";

export default function Forum() {
  const { data: topics, isLoading, isError } = useTopics();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: "760px" }}>
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

      <Composer />

      <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <p className="text-label">Discussions</p>
        {isLoading && <p style={dim}>Loading discussions…</p>}
        {isError && (
          <p style={dim}>
            Couldn't reach the EASSCAN indexer. Posts are safe on-chain — try again shortly.
          </p>
        )}
        {topics && topics.length === 0 && (
          <div className="card">
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "1rem", color: "var(--color-ink)", margin: 0 }}>
              No discussions yet.
            </p>
            <p style={{ ...dim, margin: "0.4rem 0 0" }}>
              Be the first — start one above. It's recorded on Base and visible to everyone.
            </p>
          </div>
        )}
        {topics?.map((p) => (
          <PostCard key={p.id} post={p} linkToThread />
        ))}
      </section>
    </div>
  );
}

const dim = { fontFamily: "var(--font-sans)", fontSize: "0.875rem", color: "var(--color-ink-dim)" } as const;
