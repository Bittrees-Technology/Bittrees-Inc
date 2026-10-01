import { ForumPostActions } from "../components/ForumEdit";
import { Link, useParams } from "react-router";
import { useThread } from "../lib/forum";
import { Composer, PostCard, LinkifiedText } from "../components/forum";
import { UserBadges } from "../components/badges";
import { AddressName } from "../components/AddressName";
import { EASSCAN_VIEW } from "../lib/forum";
import { relativeTime, ROUTES } from "../lib/links";
import { useAccount } from "wagmi";
import { FlagButton, HiddenNotice } from "../components/moderation";
import { useItemModeration } from "../lib/community";

export default function ForumThread() {
  const { id } = useParams();
  const { address } = useAccount();
  const { data, isLoading, isError } = useThread(id);
  const root = data?.root;
  const replies = data?.replies ?? [];
  const rootMod = useItemModeration(root?.id, address);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "760px" }}>
      <Link to={ROUTES.forum} style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-ink-muted)", textDecoration: "none" }}>
        ← Forum
      </Link>

      {isLoading && <p style={dim}>Loading discussion…</p>}
      {isError && <p style={dim}>Couldn't reach the EASSCAN indexer. Try again shortly.</p>}
      {data && !root && <p style={dim}>Discussion not found (it may still be indexing).</p>}

      {root && (
        <>
          <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
              <h1 className="text-display" style={{ fontSize: "1.5rem", margin: 0 }}>{root.title || "Discussion"}</h1>
              <UserBadges address={root.attester} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flexWrap: "wrap", fontFamily: "var(--font-sans)", fontSize: "0.72rem", color: "var(--color-ink-dim)" }}>
              <a href={`${EASSCAN_VIEW}${root.id}`} target="_blank" rel="noreferrer" style={{ color: "var(--color-ink-dim)", textDecoration: "none", fontFamily: "var(--font-mono)" }}>
                <AddressName address={root.attester} />
              </a>
              <span>{relativeTime(root.time)}</span>
              <FlagButton id={root.id} surface="forum" preview={root.title || root.body} />
            </div>
          </header>

          {rootMod.hidden ? <HiddenNotice /> : root.body && <LinkifiedText text={root.body} />}

          {!rootMod.hidden && <ForumPostActions post={root}/>}

          <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <p className="text-label">{replies.length} {replies.length === 1 ? "reply" : "replies"}</p>
            {replies.map((r) => (
              <PostCard key={r.id} post={r} />
            ))}
          </section>

          <Composer refUID={root.id} onPosted={() => { /* query invalidated by composer */ }} />
        </>
      )}
    </div>
  );
}

const dim = { fontFamily: "var(--font-sans)", fontSize: "0.875rem", color: "var(--color-ink-dim)" } as const;
