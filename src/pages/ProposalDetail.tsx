import { useState } from "react";
import { Link, useParams } from "react-router";
import { useAccount, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQueryClient } from "@tanstack/react-query";
import {
  useProposal,
  useVotingPower,
  castVote,
  winningChoice,
  proposalOutcome,
  useIsAdmin,
  deleteProposal,
  flagProposal,
  type SnapshotProposal,
  type VoteChoice,
} from "../lib/snapshot";
import { StateBadge, OutcomeBadge, ResultBar } from "../components/gov";
import { HistoricalProposalContent } from "../components/ProposalArchive";
import { historicalProposalForId } from "../lib/proposalArchive";
import { fmtNumber, relativeTime, shortAddress, etherscanAddress } from "../lib/links";

export default function ProposalDetail() {
  const { id } = useParams();
  const { data: proposal, isLoading, isError } = useProposal(id);
  const archived = historicalProposalForId(id);

  if (archived) {
    // Use the same reviewed public text before and after the client mounts.
    // Existing actions still require a fresh source record and their own gates.
    if (proposal === null || proposal?.flagged) return <div><Link to="/proposals">← All proposals</Link><p role="status">This proposal is no longer available from Snapshot.</p></div>;
    return <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <HistoricalProposalContent entry={archived} />
      {isError && <p role="status" style={dim}>The live Snapshot record could not be checked. The historical record above shows its recorded source review date.</p>}
      {proposal && <><VotePanel proposal={proposal} /><ModeratePanel proposal={proposal} /></>}
    </div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <Link
        to="/proposals"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.8125rem",
          color: "var(--color-ink-muted)",
          textDecoration: "none",
        }}
      >
        ← All proposals
      </Link>

      {isLoading && <p style={dim}>Loading proposal…</p>}
      {isError && <p role="alert" style={dim}>Couldn't load this proposal.</p>}
      {proposal === null && <p style={dim}>Proposal not found.</p>}

      {proposal && (
        <>
          <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.6rem" }}>
              <StateBadge state={proposal.state} />
              <OutcomeBadge outcome={proposalOutcome(proposal)} />
              <span style={{ fontSize: "0.75rem", color: "var(--color-ink-dim)", fontFamily: "var(--font-sans)" }}>
                {proposal.state === "active"
                  ? `Ends ${relativeTime(proposal.end)}`
                  : `Ended ${relativeTime(proposal.end)}`}
              </span>
            </div>
            <h1 className="text-display" style={{ fontSize: "1.6rem" }}>{proposal.title}</h1>
            <p style={{ fontSize: "0.75rem", color: "var(--color-ink-dim)", fontFamily: "var(--font-sans)", marginTop: "0.5rem" }}>
              by{" "}
              <a href={etherscanAddress(proposal.author)} target="_blank" rel="noreferrer" style={subtleLink}>
                {shortAddress(proposal.author)}
              </a>{" "}
              · {proposal.votes} vote{proposal.votes === 1 ? "" : "s"} · {fmtNumber(proposal.scores_total)} BGOV cast
            </p>
          </header>

          {/* Results */}
          <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <p className="text-label">Results</p>
            {proposal.scores_total > 0 ? (
              <ResultBar
                choices={proposal.choices}
                scores={proposal.scores}
                scoresTotal={proposal.scores_total}
                winning={winningChoice(proposal.scores)}
              />
            ) : (
              <p style={dim}>No votes yet.</p>
            )}
            {proposal.quorum > 0 && (
              <p style={{ ...dim, margin: 0 }}>
                Quorum: {fmtNumber(proposal.scores_total)} / {fmtNumber(proposal.quorum)} BGOV ·{" "}
                {proposal.scores_total >= proposal.quorum ? "met" : "not met"}
              </p>
            )}
          </section>

          {/* Vote (active only) */}
          <VotePanel proposal={proposal} />

          {/* Admin moderation (admins only) */}
          <ModeratePanel proposal={proposal} />

          {/* Body */}
          <section style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <p className="text-label">Proposal</p>
            <LinkifiedBody text={proposal.body || "—"} />
          </section>
        </>
      )}
    </div>
  );
}

function VotePanel({ proposal }: { proposal: SnapshotProposal }) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { data: vp, isLoading: vpLoading } = useVotingPower(address, proposal.id);
  const qc = useQueryClient();

  const type = proposal.type || "basic";
  const isWeighted = type === "weighted" || type === "quadratic";
  const isMulti = type === "approval" || type === "ranked-choice";

  const [single, setSingle] = useState<number | null>(null); // 1-based
  const [multi, setMulti] = useState<number[]>([]); // 1-based, ordered (approval/ranked)
  const [weights, setWeights] = useState<Record<number, number>>({}); // 1-based → weight
  const [status, setStatus] = useState<"idle" | "signing" | "done" | "error">("idle");
  const [error, setError] = useState<string | undefined>();

  if (proposal.state !== "active") return null; // closed → read-only

  const weightTotal = Object.values(weights).reduce((a, b) => a + (Number(b) || 0), 0);
  const hasChoice = isWeighted ? weightTotal > 0 : isMulti ? multi.length > 0 : single != null;

  function toggleMulti(idx: number) {
    setMulti((cur) => (cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx]));
  }

  async function submit() {
    if (!walletClient || !address || !hasChoice) return;
    setStatus("signing");
    setError(undefined);
    try {
      let choice: VoteChoice;
      if (isWeighted) {
        choice = Object.fromEntries(
          Object.entries(weights).filter(([, w]) => Number(w) > 0).map(([k, w]) => [k, Number(w)])
        );
      } else if (isMulti) {
        choice = multi;
      } else {
        choice = single as number;
      }
      await castVote({ walletClient, account: address, proposal: proposal.id, type, choice });
      setStatus("done");
      qc.invalidateQueries({ queryKey: ["snapshot-proposal", proposal.id] });
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Vote failed");
    }
  }

  const power = vp ?? 0;
  const hint =
    type === "ranked-choice" ? "Click choices in your order of preference."
    : type === "approval" ? "Select every choice you approve of."
    : isWeighted ? "Split your voting power — set a weight for each choice."
    : undefined;

  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <p className="text-label">Cast your vote</p>

      {!isConnected ? (
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <p style={{ ...dim, margin: 0 }}>Connect a wallet to see your voting power and vote.</p>
          <ConnectButton chainStatus="none" showBalance={false} />
        </div>
      ) : status === "done" ? (
        <p role="status" style={{ color: "var(--color-secondary)", fontFamily: "var(--font-sans)", fontSize: "0.9rem", fontWeight: 600, margin: 0 }}>
          Vote submitted ✓ — it'll appear in the tally shortly.
        </p>
      ) : (
        <>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--color-ink-muted)", margin: 0 }}>
            Your voting power:{" "}
            <strong style={{ color: "var(--color-ink)", fontVariantNumeric: "tabular-nums" }}>
              {vpLoading ? "…" : `${fmtNumber(power)} BGOV`}
            </strong>
          </p>

          {!vpLoading && power === 0 ? (
            <p style={{ ...dim, margin: 0 }}>
              You hold no BGOV common stock, so you have no voting power in this space.
            </p>
          ) : (
            <>
              {hint && <p style={{ ...dim, margin: 0 }}>{hint}</p>}

              {isWeighted ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {proposal.choices.map((c, i) => {
                    const idx = i + 1;
                    const w = Number(weights[idx] || 0);
                    const pct = weightTotal > 0 ? Math.round((w / weightTotal) * 100) : 0;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <span style={{ flex: 1, fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--color-ink)" }}>{c}</span>
                        <input
                          type="number"
                          min={0}
                          value={weights[idx] ?? ""}
                          onChange={(e) => setWeights((cur) => ({ ...cur, [idx]: Math.max(0, Number(e.target.value) || 0) }))}
                          aria-label={`Weight for ${c}`}
                          style={{ width: "80px", padding: "0.35rem 0.5rem", fontFamily: "var(--font-mono)", fontSize: "0.85rem", border: "1px solid var(--color-border)", borderRadius: "2px", background: "#ffffff", color: "var(--color-ink)" }}
                        />
                        <span style={{ width: "44px", textAlign: "right", ...dim }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {proposal.choices.map((c, i) => {
                    const idx = i + 1;
                    const sel = isMulti ? multi.includes(idx) : single === idx;
                    const rank = type === "ranked-choice" ? multi.indexOf(idx) + 1 : 0;
                    return (
                      <button
                        key={i}
                        onClick={() => (isMulti ? toggleMulti(idx) : setSingle(idx))}
                        aria-pressed={sel}
                        style={{
                          padding: "0.45rem 1rem",
                          fontFamily: "var(--font-sans)",
                          fontSize: "0.85rem",
                          fontWeight: sel ? 700 : 400,
                          color: sel ? "var(--color-ink)" : "var(--color-ink-muted)",
                          background: sel ? "var(--color-bg-subtle)" : "#ffffff",
                          border: `1px solid ${sel ? "var(--color-primary)" : "var(--color-border)"}`,
                          borderRadius: "2px",
                          cursor: "pointer",
                        }}
                      >
                        {rank > 0 ? `${rank}. ` : ""}{c}
                      </button>
                    );
                  })}
                </div>
              )}

              <div>
                <button
                  className="btn-primary"
                  disabled={!hasChoice || status === "signing"}
                  onClick={submit}
                  style={{ opacity: !hasChoice || status === "signing" ? 0.6 : 1 }}
                >
                  {status === "signing" ? "Confirm in wallet…" : "Vote"}
                </button>
              </div>
              {status === "error" && (
                <p role="alert" style={{ color: "var(--color-ink)", fontFamily: "var(--font-sans)", fontSize: "0.78rem", margin: 0 }}>
                  {error}
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function modError(e: unknown): string {
  const a = e as { shortMessage?: string; message?: string };
  return a?.shortMessage || a?.message || "Action failed";
}

/** Admin-only moderation: flag (hide) or delete a proposal via signed envelopes. */
function ModeratePanel({ proposal }: { proposal: SnapshotProposal }) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const isAdmin = useIsAdmin(address);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"flag" | "delete" | null>(null);
  const [done, setDone] = useState<string>();
  const [error, setError] = useState<string>();

  if (!isAdmin) return null;

  async function run(action: "flag" | "delete") {
    if (!walletClient || !address) return;
    if (action === "delete" && !window.confirm("Delete this proposal? It will be removed from the space.")) return;
    setBusy(action);
    setError(undefined);
    try {
      if (action === "delete") await deleteProposal({ walletClient, account: address, proposal: proposal.id });
      else await flagProposal({ walletClient, account: address, proposal: proposal.id });
      setDone(action === "delete" ? "Proposal deleted." : "Proposal flagged (hidden).");
      qc.invalidateQueries({ queryKey: ["snapshot-proposal", proposal.id] });
      qc.invalidateQueries({ queryKey: ["snapshot-proposals"] });
    } catch (e) {
      setError(modError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card" style={{ display: "flex", flexDirection: "column", gap: "0.6rem", borderColor: "var(--color-border-light)" }}>
      <p className="text-label">Admin · moderation</p>
      {done ? (
        <p style={{ ...dim, color: "var(--color-secondary)", fontWeight: 600, margin: 0 }}>{done}</p>
      ) : (
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button onClick={() => run("flag")} disabled={!!busy} style={modBtn}>
            {busy === "flag" ? "Confirm in wallet…" : "Flag (hide)"}
          </button>
          <button onClick={() => run("delete")} disabled={!!busy} style={{ ...modBtn, color: "#9a2a2a", borderColor: "#e2b8b8" }}>
            {busy === "delete" ? "Confirm in wallet…" : "Delete"}
          </button>
        </div>
      )}
      {error && <p role="alert" style={{ ...dim, color: "var(--color-ink)", margin: 0 }}>{error}</p>}
    </section>
  );
}

const modBtn = {
  padding: "0.4rem 0.9rem",
  fontFamily: "var(--font-sans)",
  fontSize: "0.82rem",
  fontWeight: 600,
  color: "var(--color-ink-muted)",
  background: "#ffffff",
  border: "1px solid var(--color-border)",
  borderRadius: "2px",
  cursor: "pointer",
} as const;

/** Render plain/markdown text safely: preserve line breaks + linkify URLs. */
function LinkifiedBody({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <div
      style={{
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        fontFamily: "var(--font-sans)",
        fontSize: "0.9rem",
        lineHeight: 1.7,
        color: "var(--color-ink-muted)",
      }}
    >
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary-hover)" }}>
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </div>
  );
}

const dim = {
  fontFamily: "var(--font-sans)",
  fontSize: "0.875rem",
  color: "var(--color-ink-dim)",
} as const;

const subtleLink = { color: "var(--color-ink-muted)", textDecoration: "none" } as const;
