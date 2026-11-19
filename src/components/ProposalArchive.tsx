import { Link } from "react-router";
import { historicalProposals, proposalPath, type HistoricalProposal } from "../lib/proposalArchive";

const text = { fontFamily: "var(--font-sans)", color: "var(--color-ink-muted)", lineHeight: 1.7 } as const;
const date = (seconds: number) => new Date(seconds * 1000).toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC";
const number = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 6 });

function SourceTime({ seconds }: { seconds: number }) {
  return <time dateTime={new Date(seconds * 1000).toISOString()}>{date(seconds)}</time>;
}

export function ProposalArchiveList() {
  return (
    <section aria-labelledby="proposal-archive-heading" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h2 id="proposal-archive-heading" style={{ fontFamily: "var(--font-serif)", fontSize: "1.4rem", margin: 0 }}>Historical proposals</h2>
      <p style={{ ...text, margin: 0 }}>Read the original public proposals and recorded voting results from 2024. These records describe proposals at the time; they do not establish implementation or current policy.</p>
      {historicalProposals.map(entry => (
        <article className="card" key={entry.snapshot.id} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.15rem", lineHeight: 1.4, margin: 0 }}>
            <Link to={proposalPath(entry.snapshot.id)} style={{ color: "var(--color-ink)", textDecoration: "none" }}>{entry.snapshot.title.trim()}</Link>
          </h3>
          <p style={{ ...text, margin: 0 }}>{entry.summary}</p>
          <p style={{ ...text, fontSize: "0.8rem", margin: 0 }}>Voting closed <SourceTime seconds={entry.snapshot.end} /> · {entry.snapshot.votes} votes</p>
        </article>
      ))}
    </section>
  );
}

export function HistoricalProposalContent({ entry }: { entry: HistoricalProposal }) {
  const p = entry.snapshot;
  return (
    <article style={{ maxWidth: "800px", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <Link to="/proposals" style={{ ...text, fontSize: "0.85rem" }}>← All proposals</Link>
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.25rem" }}>
        <p className="text-label">Historical proposal · voting closed</p>
        <h1 className="text-display" style={{ fontSize: "1.7rem", lineHeight: 1.3, overflowWrap: "anywhere" }}>{p.title.trim()}</h1>
        <p style={text}>{entry.summary}</p>
        <p style={{ ...text, fontSize: "0.9rem" }}>This page records a 2024 proposal and its Snapshot voting results. It does not establish that the proposal was implemented or that its terms are current policy.</p>
      </header>
      <dl style={{ ...text, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "0.75rem 1.5rem", margin: 0, fontSize: "0.85rem" }}>
        <div><dt style={{ fontWeight: 700 }}>Published</dt><dd style={{ margin: 0 }}><SourceTime seconds={p.created} /></dd></div>
        <div><dt style={{ fontWeight: 700 }}>Voting opened</dt><dd style={{ margin: 0 }}><SourceTime seconds={p.start} /></dd></div>
        <div><dt style={{ fontWeight: 700 }}>Voting closed</dt><dd style={{ margin: 0 }}><SourceTime seconds={p.end} /></dd></div>
        <div><dt style={{ fontWeight: 700 }}>Snapshot record checked</dt><dd style={{ margin: 0 }}><time dateTime={entry.sourceCheckedAt}>{new Date(entry.sourceCheckedAt).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })}</time></dd></div>
      </dl>
      <section aria-labelledby="recorded-results-heading" style={{ ...text, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <h2 id="recorded-results-heading" style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", margin: 0 }}>Recorded voting results</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead><tr><th scope="col" style={{ textAlign: "left", padding: "0.65rem", borderBottom: "1px solid var(--color-border)" }}>Choice</th><th scope="col" style={{ textAlign: "right", padding: "0.65rem", borderBottom: "1px solid var(--color-border)" }}>BGOV voting weight</th></tr></thead>
          <tbody>{p.choices.map((choice, i) => <tr key={i}><th scope="row" style={{ textAlign: "left", padding: "0.65rem", fontWeight: 400 }}>{choice}</th><td style={{ textAlign: "right", padding: "0.65rem", fontVariantNumeric: "tabular-nums" }}>{number(p.scores[i])}</td></tr>)}</tbody>
        </table>
        <p style={{ margin: 0 }}>{p.votes} votes · {number(p.scores_total)} BGOV voting weight in total · recorded quorum: {number(p.quorum)} BGOV.</p>
        <p style={{ margin: 0, fontSize: "0.85rem" }}>Snapshot reports the scores as final.{p.privacy === "shutter" ? " The source used Shutter vote privacy; these are the public results after voting closed." : " These are the public results after voting closed."}</p>
      </section>
      <section aria-labelledby="proposal-source-heading" style={{ ...text, fontSize: "0.85rem" }}>
        <h2 id="proposal-source-heading" style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem" }}>Source record</h2>
        <p><a href={entry.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary-hover)" }}>View this proposal on Snapshot ↗</a> · gov.bittrees.eth</p>
        <p style={{ overflowWrap: "anywhere" }}>Proposal ID: <code>{p.id}</code><br />Source content identifier: <code>{p.ipfs}</code></p>
      </section>
      <section aria-labelledby="original-proposal-heading">
        <h2 id="original-proposal-heading" style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem" }}>Original proposal text</h2>
        <p style={{ ...text, fontSize: "0.85rem" }}>The original wording and links below are retained as a historical record.</p>
        <div style={{ ...text, fontSize: "0.9rem", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {p.body.split(/(https?:\/\/[^\s)]+)/g).map((part, i) => /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noreferrer" style={{ color: "var(--color-primary-hover)" }}>{part}</a> : <span key={i}>{part}</span>)}
        </div>
      </section>
    </article>
  );
}
