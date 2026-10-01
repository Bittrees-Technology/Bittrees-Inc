import { ForumMarkdown, MarkdownField } from "./ForumMarkdown";
import { ForumPostActions } from "./ForumEdit";
import { useState } from "react";
import { Link } from "react-router";
import { useAccount, useChainId, useSwitchChain, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQueryClient } from "@tanstack/react-query";
import { base, wagmiConfig } from "../lib/chains";
import { getWalletClient } from "@wagmi/core";
import { publishPost, useSchemaRegistered, EASSCAN_VIEW, type ForumPost } from "../lib/forum";
import { useVotingPowerNow } from "../lib/snapshot";
import { relativeTime, fmtNumber, ROUTES } from "../lib/links";
import { UserBadges } from "./badges";
import { AddressName } from "./AddressName";
import { FlagButton, HiddenNotice } from "./moderation";
import { useItemModeration } from "../lib/community";

function humanError(e: unknown): string {
  const a = e as { shortMessage?: string; message?: string };
  return a?.shortMessage || a?.message || "Transaction failed";
}

/** Associate tier — minimum BGOV (common stock) required to START a discussion. */
const ASSOCIATE_MIN = 69;

/** Markdown rendering preserves ordinary plain-text paragraphs. */
export const LinkifiedText = ForumMarkdown;

export function PostCard({ post, linkToThread, replyCount }: { post: ForumPost; linkToThread?: boolean; replyCount?: number }) {
  const { address } = useAccount();
  const mod = useItemModeration(post.id, address);
  const inner = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
        {post.title && (
          <span style={{ fontFamily: "var(--font-serif)", fontSize: "1.02rem", fontWeight: 700, color: "var(--color-ink)" }}>
            {post.title}
          </span>
        )}
        <UserBadges address={post.attester} />
        {replyCount !== undefined && (
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.72rem", color: "var(--color-ink-dim)" }}>
            {replyCount} {replyCount === 1 ? "reply" : "replies"}
          </span>
        )}
      </div>
      <div style={{ marginTop: post.title ? "0.4rem" : 0 }}>
        {mod.hidden ? <HiddenNotice /> : post.body ? <LinkifiedText text={post.body} /> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", margin: "0.6rem 0 0", flexWrap: "wrap" }}>
        <a href={`${EASSCAN_VIEW}${post.id}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "var(--color-ink-dim)", textDecoration: "none", fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>
          <AddressName address={post.attester} />
        </a>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.72rem", color: "var(--color-ink-dim)" }}>{relativeTime(post.time)}</span>
        <FlagButton id={post.id} surface="forum" preview={post.title || post.body} />
      </div>
    </>
  );

  if (linkToThread) {
    return (
      <article className="card">{inner}<Link to={`${ROUTES.forum}/${post.id}`} style={{display:"inline-block",marginTop:12}}>Open discussion</Link>{post.editedAt && <span style={{marginLeft:12,fontSize:".75rem"}}>Edited</span>}</article>
    );
  }
  return <article className="card">{inner}{!mod.hidden && <ForumPostActions post={post}/>}</article>;
}

/**
 * Wallet-signed composer. Any connected wallet may post (Base network);
 * BGOV holders get the shareholder chip. `refUID` set → reply mode (body only).
 */
export function Composer({
  refUID,
  community,
  onPosted,
}: {
  refUID?: `0x${string}`;
  community?: string;
  onPosted?: () => void;
}) {
  const isReply = !!refUID;
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const { data: schemaReady } = useSchemaRegistered();
  const { data: vp, isLoading: vpLoading } = useVotingPowerNow(address);
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "posting" | "error">("idle");
  const [error, setError] = useState<string>();

  const canPost = body.trim().length > 0 && (isReply || title.trim().length > 0);

  async function submit() {
    if (!walletClient || !address || !canPost) return;
    setStatus("posting");
    setError(undefined);
    try {
      // Switch to Base only now (at submit), then use a fresh client for that chain.
      let wc = walletClient;
      if (chainId !== base.id) {
        await switchChainAsync({ chainId: base.id });
        wc = (await getWalletClient(wagmiConfig, { chainId: base.id })) ?? walletClient;
      }
      await publishPost({
        walletClient: wc,
        account: address,
        title: isReply ? "" : title.trim(),
        body: body.trim(),
        refUID,
        community,
      });
      setTitle("");
      setBody("");
      setStatus("idle");
      if (isReply) qc.invalidateQueries({ queryKey: ["forum-thread", refUID] });
      else qc.invalidateQueries({ queryKey: ["forum-topics"] });
      qc.invalidateQueries({ queryKey: ["forum-schema-registered"] });
      onPosted?.();
    } catch (e) {
      setStatus("error");
      setError(humanError(e));
    }
  }

  if (!isConnected) {
    return (
      <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <p style={{ ...dim, margin: 0 }}>{isReply ? "Connect a wallet to reply." : "Connect a wallet to start a discussion."}</p>
        <ConnectButton chainStatus="none" showBalance={false} />
      </div>
    );
  }

  // Only Associates (≥69 BGOV) may START a discussion; replies stay open to any wallet.
  if (!isReply && !vpLoading && (vp ?? 0) < ASSOCIATE_MIN) {
    return (
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <p className="text-label" style={{ margin: 0 }}>New discussion</p>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--color-ink-muted)", lineHeight: 1.6, margin: 0 }}>
          Starting a discussion requires at least <strong>69 BGOV</strong> (the Associate tier). You
          hold {fmtNumber(vp ?? 0)} BGOV — you can still reply to existing discussions.{" "}
          <Link to={ROUTES.mint} style={{ color: "var(--color-primary-hover)" }}>Mint BGOV →</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <p className="text-label" style={{ margin: 0 }}>{isReply ? "Reply" : "New discussion"}</p>
        <UserBadges address={address} />
      </div>
      {!isReply && (
        <input
          aria-label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          maxLength={120}
          style={inputStyle}
        />
      )}
      <MarkdownField value={body} onChange={setBody} label={isReply ? "Reply text" : "Post text"} rows={isReply ? 3 : 5} />
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flexWrap: "wrap" }}>
        <button
          className="btn-primary"
          disabled={!canPost || status === "posting"}
          onClick={submit}
          style={{ opacity: !canPost || status === "posting" ? 0.55 : 1 }}
        >
          {status === "posting" ? "Confirm in wallet…" : isReply ? "Post reply" : "Post discussion"}
        </button>
        <span style={dim}>
          Signed by your wallet · on-chain on Base{schemaReady === false ? " · first post also registers the forum (one-time)" : ""}
        </span>
      </div>
      {status === "error" && (
        <p role="alert" style={{ fontFamily: "var(--font-sans)", fontSize: "0.78rem", color: "var(--color-ink)", margin: 0 }}>{error}</p>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  fontFamily: "var(--font-sans)",
  fontSize: "0.9rem",
  color: "var(--color-ink)",
  background: "#ffffff",
  border: "1px solid var(--color-border)",
  borderRadius: "2px",
  boxSizing: "border-box" as const,
};
const dim = { fontFamily: "var(--font-sans)", fontSize: "0.76rem", color: "var(--color-ink-dim)" } as const;
