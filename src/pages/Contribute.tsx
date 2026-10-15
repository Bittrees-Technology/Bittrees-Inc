import { Link } from "react-router";
import { useState } from "react";
import { useAccount, useChainId, useSwitchChain, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { base, wagmiConfig } from "../lib/chains";
import { getWalletClient } from "@wagmi/core";
import { publishPost, CONTRIB_COMMUNITY, useSchemaRegistered } from "../lib/forum";
import { fetchCommunity, currentReviewers } from "../lib/community";
import { deriveEncKeypair, encryptApplication, pubKeyFromHex, type Application } from "../lib/appcrypto";
import { shortAddress } from "../lib/links";
import { ChipMultiSelect, SearchMultiSelect } from "../components/multiselect";
import type { Hash } from "viem";

/**
 * Contributor application — recorded ON-CHAIN (EAS on Base) but ENCRYPTED. The
 * data is readable only by the submitter and the reviewers who hold the
 * application-access ("operations") role and have published a decryption key.
 */

const EXPERTISE = ["Business", "Technology", "Community", "Research"] as const;
const REGIONS = ["EMEA", "APAC", "LATAM", "NORAM"] as const;
const LANGUAGES = [
  "English", "Mandarin Chinese", "Hindi", "Spanish", "French", "Standard Arabic", "Bengali",
  "Portuguese", "Russian", "Japanese", "German", "Korean", "Turkish", "Vietnamese", "Italian",
  "Thai", "Indonesian", "Polish", "Ukrainian", "Dutch", "Tagalog", "Persian", "Swahili", "Romanian",
  "Greek", "Czech", "Hungarian", "Hebrew", "Swedish", "Malay", "Tamil", "Urdu", "Punjabi", "Yoruba",
  "Igbo", "Hausa", "Zulu", "Amharic", "Finnish", "Norwegian", "Danish", "Cantonese", "Serbian", "Croatian",
] as const;

function humanError(e: unknown): string {
  const a = e as { shortMessage?: string; message?: string };
  return a?.shortMessage || a?.message || "Submission failed";
}

export default function Contribute() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const { data: schemaReady } = useSchemaRegistered();

  const [name, setName] = useState(""); // required
  const [expertise, setExpertise] = useState<string[]>([]); // required ≥1
  const [specialty, setSpecialty] = useState(""); // required
  const [region, setRegion] = useState<string[]>([]); // required ≥1
  const [languages, setLanguages] = useState<string[]>([]);
  const [heardFrom, setHeardFrom] = useState(""); // required
  const [email, setEmail] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [wallet, setWallet] = useState("");
  const [referrer, setReferrer] = useState("");

  const [status, setStatus] = useState<"idle" | "posting" | "done" | "error">("idle");
  const [error, setError] = useState<string>();
  const [txHash, setTxHash] = useState<Hash>();

  const canSubmit =
    name.trim().length > 0 &&
    expertise.length > 0 &&
    specialty.trim().length > 0 &&
    region.length > 0 &&
    heardFrom.trim().length > 0;

  async function submit() {
    if (!walletClient || !address || !canSubmit) return;
    setStatus("posting");
    setError(undefined);
    try {
      // Switch to Base only now (at submit), then use a fresh client for that chain.
      let wc = walletClient;
      if (chainId !== base.id) {
        await switchChainAsync({ chainId: base.id });
        wc = (await getWalletClient(wagmiConfig, { chainId: base.id })) ?? walletClient;
      }
      const app: Application = {
        name: name.trim(),
        expertise,
        region,
        languages,
        specialty: specialty.trim(),
        heardFrom: heardFrom.trim(),
        email: email.trim(),
        twitter: twitter.trim(),
        telegram: telegram.trim(),
        wallet: wallet.trim() || address,
        referrer: referrer.trim(),
      };
      // Derive my key (also a recipient) and gather the reviewers' published keys.
      const { publicKey } = await deriveEncKeypair(wc, address);
      const community = await fetchCommunity();
      const reviewers = currentReviewers(community)
        .map((a) => ({ addr: a, hex: community.enckeys[a] }))
        .filter((r) => /^[0-9a-f]{64}$/.test(r.hex || ""))
        .map((r) => ({ addr: r.addr, pub: pubKeyFromHex(r.hex) }));
      const recipients = [{ addr: address.toLowerCase(), pub: publicKey }, ...reviewers];
      const envelope = encryptApplication(JSON.stringify(app), recipients);
      const hash = await publishPost({
        walletClient: wc,
        account: address,
        title: "Contributor application",
        body: JSON.stringify(envelope),
        community: CONTRIB_COMMUNITY,
      });
      setTxHash(hash);
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(humanError(e));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: "680px", margin: "0 auto", width: "100%" }}>
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.5rem" }}>
        <p><Link to="/contributors/apply">Apply with email in the new contributor portal</Link></p>
        <p className="text-label">Bittrees, Inc.</p>
        <h1 className="text-display">Become a contributor</h1>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.9375rem", color: "var(--color-ink-muted)", lineHeight: 1.6, marginTop: "0.5rem" }}>
          Our selected Bittrees Contributors are at the heart of our ever-changing world. We welcome
          applicants from a wide variety of professional specialties and backgrounds. Your application
          is recorded <strong>on-chain (Base) but encrypted</strong> — only you and the Bittrees
          reviewers can read it.
        </p>
      </header>

      {status === "done" ? (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <p style={{ color: "var(--color-secondary)", fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.95rem", margin: 0 }}>
            Application submitted ✓
          </p>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--color-ink-muted)", margin: 0 }}>
            Encrypted and recorded on-chain. Only you and the Bittrees reviewers can decrypt it.
          </p>
          {txHash && (
            <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-ink-muted)", textDecoration: "none" }}>
              View on BaseScan ↗
            </a>
          )}
        </div>
      ) : !isConnected ? (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <p style={{ ...dim, margin: 0 }}>Connect a wallet to apply.</p>
          <ConnectButton chainStatus="none" showBalance={false} />
        </div>
      ) : (
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <Field label="Your name (what should we call you)" required>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or handle" maxLength={120} style={inputStyle} />
          </Field>

          <Field label="Area(s) of expertise — select all that apply" required>
            <ChipMultiSelect options={EXPERTISE} value={expertise} onChange={setExpertise} />
          </Field>

          <Field label="Briefly describe your specialty and/or topic(s) you're interested in contributing to Bittrees" required>
            <textarea value={specialty} onChange={(e) => setSpecialty(e.target.value)} rows={5} placeholder="A few sentences on your specialty and what you'd contribute." style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
          </Field>

          <Field label="Region(s) — select all that apply" required>
            <ChipMultiSelect options={REGIONS} value={region} onChange={setRegion} />
          </Field>

          <Field label="Languages you speak">
            <SearchMultiSelect options={LANGUAGES} value={languages} onChange={setLanguages} placeholder="Search languages, or type your own…" />
          </Field>

          <Field label="How did you learn about Bittrees, Inc?" required>
            <input value={heardFrom} onChange={(e) => setHeardFrom(e.target.value)} placeholder="X, a friend, an event, search…" maxLength={160} style={inputStyle} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.1rem" }}>
            <Field label="Email">
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" maxLength={160} style={inputStyle} />
            </Field>
            <Field label="Twitter / X">
              <input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" maxLength={80} style={inputStyle} />
            </Field>
            <Field label="Telegram">
              <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@handle" maxLength={80} style={inputStyle} />
            </Field>
            <Field label="If someone referred you, their name">
              <input value={referrer} onChange={(e) => setReferrer(e.target.value)} placeholder="Referrer (optional)" maxLength={120} style={inputStyle} />
            </Field>
          </div>

          <Field label="Preferred ETH wallet to receive BTREE">
            <input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder={address ? `Defaults to ${shortAddress(address)}` : "0x…"} maxLength={64} style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: "0.82rem" }} />
          </Field>

          <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.72rem", color: "var(--color-ink-dim)", lineHeight: 1.55, margin: 0 }}>
            Submitting signs once to derive your encryption key (no gas), then records the encrypted
            application on Base. Fields marked <span style={{ color: "var(--color-primary-hover)" }}>*</span> are required.
          </p>

          <div>
            <button className="btn-primary" disabled={!canSubmit || status === "posting"} onClick={submit} style={{ opacity: !canSubmit || status === "posting" ? 0.55 : 1 }}>
              {status === "posting" ? "Confirm in wallet…" : "Submit application"}
            </button>
            {schemaReady === false && (
              <span style={{ ...dim, marginLeft: "0.85rem" }}>First submission also registers the schema (one-time).</span>
            )}
          </div>

          {status === "error" && (
            <p role="alert" style={{ fontFamily: "var(--font-sans)", fontSize: "0.78rem", color: "var(--color-ink)", margin: 0 }}>{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <span className="text-label" style={{ margin: 0 }}>
        {label}
        {required && <span style={{ color: "var(--color-primary-hover)" }}> *</span>}
      </span>
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
const dim = { fontFamily: "var(--font-sans)", fontSize: "0.76rem", color: "var(--color-ink-dim)" } as const;
