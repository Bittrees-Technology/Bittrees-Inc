import {useContributorSession,contributorRequest} from '../lib/contributorSession';
import './contributor-application.css';
import { Link } from "react-router";
import { useState, useRef, useEffect } from "react";
import { useAccount, useChainId, useSwitchChain, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { base, wagmiConfig } from "../lib/chains";
import { getWalletClient } from "@wagmi/core";
import { publishPost, CONTRIB_COMMUNITY, useSchemaRegistered } from "../lib/forum";
import { fetchCommunity, currentReviewers } from "../lib/community";
import { deriveEncKeypair, encryptApplication, applicationContentKey, pubKeyFromHex, type Application } from "../lib/appcrypto";
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
  const auth=useContributorSession();
  const currentWallet=useRef(address);currentWallet.current=address;
  const pending=useRef<{uid:string;contentKey:string;wallet:string}|null>(null);
  const [intakeStatus,setIntakeStatus]=useState('');
  useEffect(()=>{pending.current=null;setIntakeStatus('');setStatus('idle');setTxHash(undefined);return()=>{pending.current=null;};},[address]);
  async function saveIntake(csrf?:string){
    const intake=pending.current;if(!intake||currentWallet.current?.toLowerCase()!==intake.wallet) return;
    await contributorRequest({action:'stage_base',uid:intake.uid,contentKey:intake.contentKey},csrf);
    pending.current=null;setIntakeStatus('Your application will enter review automatically after Base finality. You can follow its progress on My contribution.');
  }
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
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
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
      let session=auth.session;
      if(session?.wallet?.toLowerCase()!==address.toLowerCase()){
        const challenge=await contributorRequest({action:'wallet_login_start',address});
        const signature=await walletClient.signMessage({account:address,message:challenge.message});
        await contributorRequest({action:'wallet_login_finish',challenge:challenge.challenge,signature});
        session=(await auth.refetch()).data?.session;
      }
      if(!session?.csrf)throw Error('Verify your wallet before submitting.');
      if(currentWallet.current?.toLowerCase()!==address.toLowerCase())throw Error('Your wallet changed. Review the application before submitting.');
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
        email: "",
        twitter: twitter.trim(),
        telegram: telegram.trim(),
        wallet: address,
        referrer: referrer.trim(),
      };
      // Derive my key (also a recipient) and gather the reviewers' published keys.
      const community = await fetchCommunity();
      const reviewers = currentReviewers(community)
        .map((a) => ({ addr: a, hex: community.enckeys[a] }))
        .filter((r) => /^[0-9a-f]{64}$/.test(r.hex || ""))
        .map((r) => ({ addr: r.addr, pub: pubKeyFromHex(r.hex) }));
      const keypair=await deriveEncKeypair(wc,address);
      let envelope,contentKey:string;
      try{
        envelope=encryptApplication(JSON.stringify(app),[{addr:address.toLowerCase(),pub:keypair.publicKey},...reviewers]);
        contentKey=applicationContentKey(envelope,address,keypair.secretKey);
      }finally{keypair.secretKey.fill(0);}
      if(currentWallet.current?.toLowerCase()!==address.toLowerCase())throw Error('Your wallet changed. Submit again with the intended wallet.');
      const hash = await publishPost({
        walletClient: wc,
        account: address,
        title: "Contributor application",
        body: JSON.stringify(envelope),
        community: CONTRIB_COMMUNITY,
        onAttested:uid=>{if(currentWallet.current?.toLowerCase()===address.toLowerCase())pending.current={uid,contentKey,wallet:address.toLowerCase()};},
      });
      setTxHash(hash);
      setStatus("done");
      try{await saveIntake(session.csrf);}catch{setIntakeStatus('Your Base submission succeeded. Finish private intake below, or unlock the existing submission from My contribution. Do not submit another application.');}
    } catch (e) {
      setStatus("error");
      setError(humanError(e));
    }
  }

  return (
    <div className="contributor-application" style={{display:"flex",flexDirection:"column",gap:"1.5rem"}}>
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.5rem" }}>
        <p><Link to="/admin/contributors">My contribution</Link></p>
        <p className="text-label">Bittrees, Inc.</p>
        <h1 className="text-display">Become a contributor</h1>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.9375rem", color: "var(--color-ink-muted)", lineHeight: 1.6, marginTop: "0.5rem" }}>
          Tell us what you would like to contribute. Submit with your wallet on Base, then follow review, your memorandum and credential from My contribution.
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
          <p role="status">{intakeStatus||'Your application is recorded on Base. Open My contribution to continue from this submission.'}</p>
          {pending.current&&<button className="btn-primary" onClick={async()=>{try{await saveIntake(auth.session?.csrf);}catch{setIntakeStatus('Private intake could not be saved. Open My contribution and unlock your existing submission; no new transaction is needed.');}}}>Finish private intake</button>}
          <Link to="/admin/contributors">View My contribution</Link>
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
        <div className="application-form"><p className="application-wallet">Applying with {address?.slice(0,6)}…{address?.slice(-4)}. This wallet will own your application.</p><h3>Your contribution</h3>
          <Field label="Name or handle" required>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or handle" maxLength={120} style={inputStyle} />
          </Field>

          <Field label="Areas of expertise" required>
            <ChipMultiSelect options={EXPERTISE} value={expertise} onChange={setExpertise} />
          </Field>

          <Field label="What would you like to contribute?" required>
            <textarea value={specialty} onChange={(e) => setSpecialty(e.target.value)} rows={5} placeholder="A few sentences on your specialty and what you'd contribute." style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
          </Field>

          <h3>Your background</h3><Field label="Regions" required>
            <ChipMultiSelect options={REGIONS} value={region} onChange={setRegion} />
          </Field>

          <Field label="Languages you speak">
            <SearchMultiSelect options={LANGUAGES} value={languages} onChange={setLanguages} placeholder="Search languages, or type your own…" />
          </Field>

          <Field label="How did you learn about Bittrees, Inc?" required>
            <input value={heardFrom} onChange={(e) => setHeardFrom(e.target.value)} placeholder="X, a friend, an event, search…" maxLength={160} style={inputStyle} />
          </Field>

          <details><summary>Optional contact and referral details</summary><div className="application-contact">
            <Field label="Twitter / X">
              <input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="@handle" maxLength={80} style={inputStyle} />
            </Field>
            <Field label="Telegram">
              <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@handle" maxLength={80} style={inputStyle} />
            </Field>
            <Field label="If someone referred you, their name">
              <input value={referrer} onChange={(e) => setReferrer(e.target.value)} placeholder="Referrer (optional)" maxLength={120} style={inputStyle} />
            </Field>
          </div></details>



          <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.72rem", color: "var(--color-ink-dim)", lineHeight: 1.55, margin: 0 }}>
            Submitting signs once to derive your encryption key (no gas), then records the encrypted
            application on Base. A per-application key is held in the encrypted private workspace until finalized intake; your wallet decryption key is never saved. Fields marked <span style={{ color: "var(--color-primary-hover)" }}>*</span> are required.
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
