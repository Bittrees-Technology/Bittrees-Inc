import { ProposalsIntroduction } from "../components/PublicIntroductions";
import { ProposalArchiveList } from "../components/ProposalArchive";
import { historicalProposals, historicalProposalForId } from "../lib/proposalArchive";
import { Link } from "react-router";
import { useProposals, winningChoice, proposalOutcome } from "../lib/snapshot";
import { StateBadge, OutcomeBadge, ResultBar } from "../components/gov";
import { fmtNumber, relativeTime, ROUTES } from "../lib/links";

export default function Proposals() {
  const { data: proposals, isLoading, isError } = useProposals(30);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <ProposalsIntroduction />
      <ProposalArchiveList />

      {isLoading && <p style={{ color: "var(--color-ink-dim)", fontFamily: "var(--font-sans)", fontSize: "0.875rem" }}>Loading proposals…</p>}
      {isError && (
        <p role="alert" style={{ color: "var(--color-ink-muted)", fontFamily: "var(--font-sans)", fontSize: "0.875rem" }}>
          Couldn't load proposals from Snapshot just now — please try again shortly.
        </p>
      )}
      {proposals && proposals.length === 0 && historicalProposals.length === 0 && (
        <p style={{ color: "var(--color-ink-dim)", fontFamily: "var(--font-sans)", fontSize: "0.875rem" }}>No proposals yet.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {proposals?.filter(p => !historicalProposalForId(p.id)).map((p) => {
          const win = winningChoice(p.scores);
          return (
            <Link
              key={p.id}
              to={`/proposals/${p.id}`}
              className="card"
              style={{ textDecoration: "none", display: "block", color: "inherit" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "1rem",
                  marginBottom: "0.9rem",
                }}
              >
                <h2
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "1.15rem",
                    fontWeight: 700,
                    color: "var(--color-ink)",
                    lineHeight: 1.3,
                    margin: 0,
                  }}
                >
                  {p.title}
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
                  <StateBadge state={p.state} />
                  <OutcomeBadge outcome={proposalOutcome(p)} />
                </div>
              </div>

              {p.scores_total > 0 ? (
                <ResultBar choices={p.choices} scores={p.scores} scoresTotal={p.scores_total} winning={win} />
              ) : (
                <p style={{ color: "var(--color-ink-dim)", fontFamily: "var(--font-sans)", fontSize: "0.8125rem", margin: 0 }}>
                  No votes yet.
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "1.25rem",
                  marginTop: "0.9rem",
                  fontSize: "0.75rem",
                  color: "var(--color-ink-dim)",
                  fontFamily: "var(--font-sans)",
                }}
              >
                <span>{p.votes} vote{p.votes === 1 ? "" : "s"}</span>
                <span>{fmtNumber(p.scores_total)} BGOV cast</span>
                <span>{p.state === "active" ? `Ends ${relativeTime(p.end)}` : `Ended ${relativeTime(p.end)}`}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
