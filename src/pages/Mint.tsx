import { useState, useEffect } from "react";
import { Link } from "react-router";
import { useAccount, useChainId, useSwitchChain, useWalletClient, usePublicClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatUnits, type Hash } from "viem";
import { mainnet } from "../lib/chains";
import { ERC20_ABI } from "../lib/abis";
import {
  BGOV_ADDRESS,
  BTREE_ADDRESS,
  BTREE_DECIMALS,
  BGOV_MINT_ABI,
  BGOV_TOKEN_TYPE,
  useMintInfo,
  useBtreeState,
} from "../lib/mint";
import { etherscanAddress, shortAddress, ROUTES } from "../lib/links";

type Phase = "idle" | "approving" | "minting" | "done" | "error";

function fmtToken(v: bigint | undefined): string {
  if (v === undefined) return "…";
  return Number(formatUnits(v, BTREE_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 4 });
}
function humanError(e: unknown): string {
  const anyE = e as { shortMessage?: string; message?: string };
  return anyE?.shortMessage || anyE?.message || "Transaction failed";
}

export default function Mint() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const info = useMintInfo();
  const btree = useBtreeState(address);

  const [countStr, setCountStr] = useState("1");
  const [ack, setAck] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string>();
  const [txHash, setTxHash] = useState<Hash>();

  // Landing on the BGOV page with a connected wallet on the wrong network: nudge
  // it to Ethereum mainnet (where BGOV lives), so mint + balances read correctly.
  useEffect(() => {
    if (isConnected && chainId !== mainnet.id) {
      switchChain?.({ chainId: mainnet.id });
    }
  }, [isConnected, chainId, switchChain]);

  const count = Math.max(0, Math.floor(Number(countStr) || 0));
  const price = info.pricePerShare;
  const total = price !== undefined && count > 0 ? price * BigInt(count) : 0n;
  const onMainnet = chainId === mainnet.id;
  const busy = phase === "approving" || phase === "minting";
  const needsApproval = btree.allowance !== undefined && total > 0n && btree.allowance < total;
  const insufficient = btree.balance !== undefined && total > 0n && btree.balance < total;

  async function approve() {
    if (!walletClient || !publicClient || !address || total <= 0n) return;
    setPhase("approving");
    setError(undefined);
    try {
      const hash = await walletClient.writeContract({
        address: BTREE_ADDRESS,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [BGOV_ADDRESS, total],
        account: address,
        chain: mainnet,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      btree.refetch();
      setPhase("idle");
    } catch (e) {
      setPhase("error");
      setError(humanError(e));
    }
  }

  async function mint() {
    if (!walletClient || !publicClient || !address || count <= 0) return;
    setPhase("minting");
    setError(undefined);
    try {
      const hash = await walletClient.writeContract({
        address: BGOV_ADDRESS,
        abi: BGOV_MINT_ABI,
        functionName: "mint",
        args: [BGOV_TOKEN_TYPE, address, BigInt(count)],
        account: address,
        chain: mainnet,
      });
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      btree.refetch();
      setPhase("done");
    } catch (e) {
      setPhase("error");
      setError(humanError(e));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem", maxWidth: "680px", margin: "0 auto", width: "100%" }}>
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.5rem" }}>
        <p className="text-label">Bittrees, Inc.</p>
        <h1 className="text-display">Mint BGOV</h1>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.9375rem",
            color: "var(--color-ink-muted)",
            lineHeight: 1.6,
            marginTop: "0.5rem",
          }}
        >
          BGOV is the common stock of Bittrees, Inc. — minting it acquires an equity interest that
          carries the governance (voting) rights used across this site.
        </p>
      </header>

      {/* BGOV stock certificate */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <img
          src="/bgov-cert.png"
          alt="BGOV Certificate of Stock"
          width={2000}
          height={1133}
          style={{ width: "100%", maxWidth: "440px", height: "auto", borderRadius: "4px", border: "1px solid var(--color-border-light)" }}
        />
      </div>

      {/* Economics */}
      <section style={{ display: "flex", flexWrap: "wrap", gap: "2.5rem" }}>
        <Stat label="Price / share" value={`${fmtToken(price)} BTREE`} />
        <Stat
          label="Proceeds to"
          value="Capital treasury"
          sub={
            <a href={etherscanAddress(info.treasury)} target="_blank" rel="noreferrer" style={subtleLink}>
              {shortAddress(info.treasury)} ↗
            </a>
          }
        />
        {isConnected && (
          <Stat label="Your BTREE" value={btree.isLoading ? "…" : `${fmtToken(btree.balance)}`} />
        )}
      </section>

      {/* Disclosure */}
      <section
        className="card"
        style={{ background: "var(--color-bg-subtle)", display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        <p className="text-label">Disclaimer</p>
        <p style={disclosure}>
          BGOV tokens are a form of equity in Bittrees, Inc. and represent ownership in the
          organization. As a result, owning BGOV tokens gives the holder certain rights and
          privileges, such as voting on important company decisions and receiving a portion of
          profits through dividends. However, please note that owning BGOV tokens also involves
          certain risks, and that the value of the tokens may fluctuate based on a variety of
          factors, including market conditions and the performance of the company. It is important to
          carefully consider these risks before minting BGOV tokens.
        </p>
        <p style={disclosure}>
          Additionally, BGOV tokens are subject to different holding levels for different levels of
          ownership, influence, and rewards in the company. To become a Partner of Bittrees, Inc., a
          holder must own at least 420 BGOV tokens, which represents a significant ownership stake in
          the organization. Junior Partners must hold at least 210 BGOV tokens, and Associates must
          hold at least 69 BGOV tokens. These holding levels are not subject to change and are
          designed to ensure that ownership and influence in the company are distributed fairly among
          stakeholders.
        </p>
        <p style={disclosure}>
          Please note that Bittrees, Inc. does not provide investment advice and is not responsible
          for any investment decisions made by individuals. It is recommended that potential investors
          conduct thorough research and seek professional advice before investing in BGOV tokens.
        </p>
        <label style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", cursor: "pointer", marginTop: "0.25rem" }}>
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            style={{ marginTop: "0.2rem", accentColor: "var(--color-primary)" }}
          />
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.82rem", color: "var(--color-ink)" }}>
            I have read and understand this disclosure, and I am eligible to acquire BGOV in my
            jurisdiction.
          </span>
        </label>
      </section>

      {/* Mint panel */}
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <p className="text-label">Mint</p>

        {phase === "done" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <p style={{ color: "var(--color-secondary)", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.95rem", margin: 0 }}>
              Minted {count} BGOV share{count === 1 ? "" : "s"} ✓
            </p>
            {txHash && (
              <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" style={subtleLink}>
                View transaction ↗
              </a>
            )}
            <div>
              <button data-insights="mint-more" className="btn-primary" onClick={() => { setPhase("idle"); setTxHash(undefined); }}>
                Mint more
              </button>
            </div>
          </div>
        ) : !isConnected ? (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <p style={{ ...dim, margin: 0 }}>Connect a wallet to mint BGOV.</p>
            <ConnectButton chainStatus="none" showBalance={false} />
          </div>
        ) : !onMainnet ? (
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <p style={{ ...dim, margin: 0 }}>BGOV is on Ethereum mainnet.</p>
            <button data-insights="switch-to-ethereum" className="btn-primary" onClick={() => switchChain({ chainId: mainnet.id })}>
              Switch to Ethereum
            </button>
          </div>
        ) : (
          <>
            {/* Quantity + total */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "1.25rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <span className="text-label" style={{ margin: 0 }}>Shares</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={countStr}
                  onChange={(e) => setCountStr(e.target.value)}
                  style={{
                    width: "120px",
                    padding: "0.5rem 0.65rem",
                    fontFamily: "var(--font-mono)",
                    fontSize: "1rem",
                    color: "var(--color-ink)",
                    background: "#ffffff",
                    border: "1px solid var(--color-border)",
                    borderRadius: "2px",
                  }}
                />
              </label>
              <div>
                <p className="text-label" style={{ margin: "0 0 0.3rem" }}>Total</p>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.35rem", fontWeight: 700, color: "var(--color-ink)", margin: 0, lineHeight: 1.1 }}>
                  {fmtToken(total)} <span style={{ fontSize: "0.9rem", fontWeight: 400, color: "var(--color-ink-muted)" }}>BTREE</span>
                </p>
              </div>
            </div>

            {insufficient && (
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.82rem", color: "var(--color-ink)", margin: 0 }}>
                Not enough BTREE — you hold {fmtToken(btree.balance)}.{" "}
                <a data-insights="navigate-capitalbittreesorg/" href="https://capital.bittrees.org" target="_blank" rel="noreferrer" style={{ color: "var(--color-primary-hover)" }}>
                  Get BTREE on Bittrees Capital ↗
                </a>
              </p>
            )}

            {/* Action */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flexWrap: "wrap" }}>
              {needsApproval ? (
                <button
                  className="btn-primary"
                  disabled={!ack || busy || insufficient || count <= 0}
                  onClick={approve}
                  style={{ opacity: !ack || busy || insufficient || count <= 0 ? 0.55 : 1 }}
                >
                  {phase === "approving" ? "Confirm approval…" : `Approve ${fmtToken(total)} BTREE`}
                </button>
              ) : (
                <button
                  className="btn-primary"
                  disabled={!ack || busy || insufficient || count <= 0 || total <= 0n}
                  onClick={mint}
                  style={{ opacity: !ack || busy || insufficient || count <= 0 || total <= 0n ? 0.55 : 1 }}
                >
                  {phase === "minting" ? "Confirm in wallet…" : `Mint ${count || ""} BGOV`}
                </button>
              )}
              {needsApproval && !busy && ack && !insufficient && (
                <span style={{ ...dim }}>Step 1 of 2 — approve, then mint.</span>
              )}
            </div>

            {!ack && (
              <p style={{ ...dim, margin: 0 }}>Acknowledge the disclosure above to enable minting.</p>
            )}

            {phase === "error" && (
              <p role="alert" style={{ fontFamily: "var(--font-sans)", fontSize: "0.8rem", color: "var(--color-ink)", margin: 0 }}>
                {error}
              </p>
            )}
          </>
        )}
      </section>

      <p style={{ ...dim, lineHeight: 1.6 }}>
        Your BGOV balance is your voting power across Bittrees governance. After minting, your shares
        appear in the next <Link to={ROUTES.proposals} style={{ color: "var(--color-primary-hover)" }}>proposal</Link>{" "}
        you vote on. Issued shares are tracked on{" "}
        <a data-insights="navigate-capitalbittreesorg/" href="https://capital.bittrees.org" target="_blank" rel="noreferrer" style={{ color: "var(--color-primary-hover)" }}>
          Bittrees Capital
        </a>
        .
      </p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div>
      <p className="text-label" style={{ marginBottom: "0.2rem" }}>{label}</p>
      <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", fontWeight: 700, color: "var(--color-ink)", margin: 0, lineHeight: 1.1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", margin: "0.2rem 0 0" }}>{sub}</p>}
    </div>
  );
}

const dim = { fontFamily: "var(--font-sans)", fontSize: "0.82rem", color: "var(--color-ink-dim)" } as const;
const disclosure = { fontFamily: "var(--font-sans)", fontSize: "0.82rem", color: "var(--color-ink-muted)", lineHeight: 1.6, margin: 0 } as const;
const subtleLink = { color: "var(--color-ink-muted)", textDecoration: "none", fontFamily: "var(--font-mono)" } as const;
