import { useState } from "react";
import { Link } from "react-router";
import { useAccount, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useSpace, useCanPropose, createProposal, VOTE_TYPES } from "../lib/snapshot";
import { fmtNumber, ROUTES } from "../lib/links";

function humanError(e: unknown): string {
  const a = e as { shortMessage?: string; message?: string };
  return a?.shortMessage || a?.message || "Couldn't create the proposal";
}

export default function NewProposal() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { data: space } = useSpace();
  const { canPropose, threshold, vp, isLoading } = useCanPropose(address);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [discussion, setDiscussion] = useState("");
  const [type, setType] = useState<string>("basic");
  const [choices, setChoices] = useState<string[]>(["", ""]);
  const [status, setStatus] = useState<"idle" | "posting" | "done" | "error">("idle");
  const [error, setError] = useState<string>();
  const [newId, setNewId] = useState<string>();

  const delayDays = Math.round((space?.voting?.delay ?? 0) / 86400);
  const periodDays = Math.round((space?.voting?.period ?? 7 * 86400) / 86400);
  const trimmedChoices = choices.map((c) => c.trim()).filter(Boolean);
  const choicesOk = type === "basic" || trimmedChoices.length >= 2;
  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && choicesOk;

  async function submit() {
    if (!walletClient || !address || !canSubmit) return;
    setStatus("posting");
    setError(undefined);
    try {
      const res = await createProposal({
        walletClient,
        account: address,
        title: title.trim(),
        body: body.trim(),
        discussion: discussion.trim(),
        type,
        choices: type === "basic" ? undefined : trimmedChoices,
        delaySec: space?.voting?.delay ?? 0,
        periodSec: space?.voting?.period ?? 7 * 86400,
      });
      setNewId(res.id);
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(humanError(e));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "720px", margin: "0 auto", width: "100%" }}>
      <Link to={ROUTES.proposals} style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-ink-muted)", textDecoration: "none" }}>
        ← Proposals
      </Link>
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.25rem" }}>
        <p className="text-label">Bittrees, Inc.</p>
        <h1 className="text-display">New proposal</h1>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.9rem", color: "var(--color-ink-muted)", lineHeight: 1.6, marginTop: "0.5rem" }}>
          Submitted to Snapshot (gov.bittrees.eth) and signed by your wallet — no link-out. Pick a
          voting method below{delayDays > 0 ? `; opens in ${delayDays} day${delayDays === 1 ? "" : "s"}` : ""}, and runs {periodDays} day{periodDays === 1 ? "" : "s"}.
        </p>
      </header>

      {status === "done" ? (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <p style={{ color: "var(--color-secondary)", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.95rem", margin: 0 }}>Proposal created ✓</p>
          {newId ? (
            <Link to={`${ROUTES.proposals}/${newId}`} style={{ color: "var(--color-primary-hover)", fontFamily: "var(--font-sans)", fontSize: "0.875rem" }}>
              View your proposal →
            </Link>
          ) : (
            <Link to={ROUTES.proposals} style={{ color: "var(--color-primary-hover)", fontFamily: "var(--font-sans)", fontSize: "0.875rem" }}>Back to proposals →</Link>
          )}
        </div>
      ) : !isConnected ? (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <p style={{ ...dim, margin: 0 }}>Connect a wallet to create a proposal.</p>
          <ConnectButton chainStatus="none" showBalance={false} />
        </div>
      ) : !isLoading && !canPropose ? (
        <div className="card">
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.9rem", color: "var(--color-ink-muted)", lineHeight: 1.6, margin: 0 }}>
            Creating a proposal requires at least <strong>{fmtNumber(threshold)} BGOV</strong> voting
            power (or being a space admin/member). You hold <strong>{fmtNumber(vp)} BGOV</strong>.{" "}
            <Link to={ROUTES.mint} style={{ color: "var(--color-primary-hover)" }}>Mint BGOV →</Link>
          </p>
        </div>
      ) : (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. BIP-2: …" maxLength={256} style={inputStyle} />
          </Field>
          <Field label="Body (Markdown supported)">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} placeholder="Describe the proposal, rationale, and what a For vote enacts." style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
          </Field>
          <Field label="Discussion link (optional)">
            <input value={discussion} onChange={(e) => setDiscussion(e.target.value)} placeholder="https://…" maxLength={256} style={inputStyle} />
          </Field>

          <Field label="Voting method">
            <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
              {VOTE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </Field>

          {type !== "basic" && (
            <Field label="Choices">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {choices.map((c, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      value={c}
                      onChange={(e) => setChoices((cur) => cur.map((x, j) => (j === i ? e.target.value : x)))}
                      placeholder={`Choice ${i + 1}`}
                      maxLength={120}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    {choices.length > 2 && (
                      <button type="button" onClick={() => setChoices((cur) => cur.filter((_, j) => j !== i))} style={pillBtn} aria-label={`Remove choice ${i + 1}`}>×</button>
                    )}
                  </div>
                ))}
                <div>
                  <button data-insights="add-choice" type="button" onClick={() => setChoices((cur) => [...cur, ""])} style={pillBtn}>+ Add choice</button>
                </div>
              </div>
            </Field>
          )}

          <div>
            <button className="btn-primary" disabled={!canSubmit || status === "posting"} onClick={submit} style={{ opacity: !canSubmit || status === "posting" ? 0.55 : 1 }}>
              {status === "posting" ? "Confirm in wallet…" : "Create proposal"}
            </button>
          </div>
          {status === "error" && (
            <p role="alert" style={{ fontFamily: "var(--font-sans)", fontSize: "0.8rem", color: "var(--color-ink)", margin: 0 }}>{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <span className="text-label" style={{ margin: 0 }}>{label}</span>
      {children}
    </label>
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
const dim = { fontFamily: "var(--font-sans)", fontSize: "0.875rem", color: "var(--color-ink-dim)" } as const;
const pillBtn = {
  padding: "0.4rem 0.8rem",
  fontFamily: "var(--font-sans)",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--color-ink-muted)",
  background: "#ffffff",
  border: "1px solid var(--color-border)",
  borderRadius: "2px",
  cursor: "pointer",
} as const;
