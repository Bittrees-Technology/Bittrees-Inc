import { ForumIntroduction } from "../components/PublicIntroductions";
import { ForumSubscriptions } from "../components/ForumSubscriptions";
import { useTopics } from "../lib/forum";
import { Composer, PostCard } from "../components/forum";

export default function Forum() {
  const { data: topics, isLoading, isError } = useTopics();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: "760px" }}>
      <ForumIntroduction />

      <ForumSubscriptions />
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
