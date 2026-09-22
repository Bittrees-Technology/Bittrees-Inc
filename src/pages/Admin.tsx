import type { WalletClient } from "viem";
import { usePush, usePushSessionKey } from "../lib/usePush";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { getAddress, parseUnits, isAddress } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useQueryClient } from "@tanstack/react-query";
import { fetchSpaceSettings, updateSpaceSettings } from "../lib/snapshot";
import { useAdminAccess, type AdminLevel } from "../lib/adminAccess";
import { BGOV_ROOMS, SAFE_ROOMS, ROOM_ADMINS, createGatedGroup, gateUrl, gateLabel, type PushRoom, type PushClient, type RoomGate, type RoomRule } from "../lib/push";
import { useRoomRegistry, saveRoomChatId, saveCustomRoom, deleteCustomRoom, approveRoomProposal, rejectRoomProposal, type RoomProposal } from "../lib/rooms";
import { assignRole, unassignRole, createRole, deleteRole, selectableRoles, useCommunity, moderateItem, publishEncKey, TIER_ROLES } from "../lib/community";
import { useTopics, CONTRIB_COMMUNITY, EASSCAN_VIEW } from "../lib/forum";
import { deriveEncKeypair, decryptApplication, pubKeyHex, type Application, type Envelope, type EncKeypair } from "../lib/appcrypto";
import { ROUTES, shortAddress, relativeTime } from "../lib/links";
import { useRoomGate, RoomGateBuilder } from "../components/RoomGateBuilder";
import { AddressName } from "../components/AddressName";
import { getEnsAddress } from "@wagmi/core";
import { normalize } from "viem/ens";
import { mainnet } from "viem/chains";
import { wagmiConfig } from "../lib/chains";

function humanError(e: unknown): string {
  const a = e as { shortMessage?: string; message?: string };
  return a?.shortMessage || a?.message || "Something went wrong";
}

export default function Admin() {
  const { address, isConnected } = useAccount();
  const level = useAdminAccess(address);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: "780px", margin: "0 auto", width: "100%" }}>
      <Link to={ROUTES.proposals} style={{ fontFamily: "var(--font-sans)", fontSize: "0.8125rem", color: "var(--color-ink-muted)", textDecoration: "none" }}>← Governance</Link>
      <header style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "1.25rem" }}>
        <p className="text-label">Admin</p>
        <h1 className="text-display">Admin console</h1>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.9rem", color: "var(--color-ink-muted)", lineHeight: 1.6, marginTop: "0.5rem" }}>
          Space settings, community rooms, and contributor applications — all signed by your wallet.
          For the space's admins only.
        </p>
      </header>

      {!isConnected ? (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <p style={{ ...dim, margin: 0 }}>Connect a wallet.</p>
          <ConnectButton chainStatus="none" showBalance={false} />
        </div>
      ) : level === "none" ? (
        <div className="card">
          <p style={{ ...dim, margin: 0 }}>
            This page is for admins. The connected wallet isn't a space admin and has no admin role.
          </p>
        </div>
      ) : (
        <AdminConsole address={address!} level={level} />
      )}
    </div>
  );
}

/* ── Tabbed admin console — each area managed on its own tab ──────────────── */
const ADMIN_TABS = [
  { key: "settings", label: "Space settings" },
  { key: "rooms", label: "Community rooms" },
  { key: "roles", label: "Roles & tags" },
  { key: "moderation", label: "Moderation" },
  { key: "applications", label: "Contributor applications" },
] as const;
type AdminTabKey = (typeof ADMIN_TABS)[number]["key"];

function AdminConsole({ address, level }: { address: `0x${string}`; level: AdminLevel }) {
  const pushSessionKey = usePushSessionKey();
  // Moderators see only the Moderation tab; full admins see everything.
  const tabs = level === "moderation" ? ADMIN_TABS.filter((t) => t.key === "moderation") : ADMIN_TABS;
  const [tab, setTab] = useState<AdminTabKey>(tabs[0].key);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", gap: "0.15rem", borderBottom: "1px solid var(--color-border)", flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <AdminTabBtn key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</AdminTabBtn>
        ))}
      </div>
      {tab === "settings" && <SpaceSettings address={address} />}
      {tab === "rooms" && <CommunityRoomsAdmin key={pushSessionKey} address={address} />}
      {tab === "roles" && <RolesAdmin address={address} />}
      {tab === "moderation" && <ModerationQueue address={address} />}
      {tab === "applications" && <ContributorApplications />}
    </div>
  );
}

function AdminTabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "0.85rem",
        fontWeight: active ? 600 : 400,
        color: active ? "var(--color-ink)" : "var(--color-ink-muted)",
        background: "none",
        border: "none",
        borderBottom: `2px solid ${active ? "var(--color-primary)" : "transparent"}`,
        padding: "0.5rem 0.8rem",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

/* ── Snapshot space settings ─────────────────────────────────────────────── */
/* eslint-disable @typescript-eslint/no-explicit-any */
function readObj(raw: string): any {
  try { return JSON.parse(raw); } catch { return null; }
}

function SpaceSettings({ address }: { address: `0x${string}` }) {
  const { data: walletClient } = useWalletClient();
  const [raw, setRaw] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;
    fetchSpaceSettings().then((s) => {
      if (!alive) return;
      setRaw(s ? JSON.stringify(s, null, 2) : "");
      setLoaded(true);
    });
    return () => { alive = false; };
  }, []);

  const obj = readObj(raw);
  const valid = obj !== null;

  function setVoting(key: string, value: unknown) {
    const o = readObj(raw);
    if (!o) return;
    o.voting = { ...(o.voting || {}), [key]: value };
    setRaw(JSON.stringify(o, null, 2));
  }
  function setTop(key: string, value: unknown) {
    const o = readObj(raw);
    if (!o) return;
    o[key] = value;
    setRaw(JSON.stringify(o, null, 2));
  }

  async function save() {
    const settings = readObj(raw);
    if (!walletClient || !settings) return;
    setStatus("saving");
    setError(undefined);
    try {
      await updateSpaceSettings({ walletClient, account: address, settings });
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(humanError(e));
    }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <p className="text-label">Space settings</p>
        <p style={{ ...dim, margin: "0.25rem 0 0", lineHeight: 1.55 }}>
          Edits replace the <strong>entire</strong> gov.bittrees.eth config and are submitted to
          Snapshot — review the JSON before signing.
        </p>
      </div>

      {status === "done" ? (
        <div className="card">
          <p style={{ color: "var(--color-secondary)", fontFamily: "var(--font-sans)", fontWeight: 700, margin: 0 }}>Settings submitted ✓</p>
          <p style={{ ...dim, margin: "0.4rem 0 0" }}>Changes propagate on Snapshot shortly. Reload to see the updated config.</p>
        </div>
      ) : !loaded ? (
        <p style={dim}>Loading current settings…</p>
      ) : (
        <>
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <p className="text-label">Quick edits</p>
            <Row label="Encrypted voting (shutter)">
              <select value={String(obj?.voting?.privacy ?? "")} onChange={(e) => setVoting("privacy", e.target.value)} style={inputStyle}>
                <option value="">Off — votes are public (in-app voting works)</option>
                <option value="shutter">Shutter — encrypted until close</option>
              </select>
            </Row>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
              <Row label="Voting period (days)">
                <input type="number" min={0} value={secToDays(obj?.voting?.period)} onChange={(e) => setVoting("period", daysToSec(e.target.value))} style={{ ...inputStyle, width: "110px" }} />
              </Row>
              <Row label="Start delay (days)">
                <input type="number" min={0} value={secToDays(obj?.voting?.delay)} onChange={(e) => setVoting("delay", daysToSec(e.target.value))} style={{ ...inputStyle, width: "110px" }} />
              </Row>
              <Row label="Quorum (BGOV)">
                <input type="number" min={0} value={Number(obj?.voting?.quorum ?? 0)} onChange={(e) => setVoting("quorum", Number(e.target.value) || 0)} style={{ ...inputStyle, width: "130px" }} />
              </Row>
            </div>
            <Row label="Space name">
              <input value={String(obj?.name ?? "")} onChange={(e) => setTop("name", e.target.value)} style={inputStyle} />
            </Row>
            <Row label="About">
              <textarea value={String(obj?.about ?? "")} onChange={(e) => setTop("about", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </Row>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <p className="text-label">Full settings JSON (this is what gets submitted)</p>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={14}
              spellCheck={false}
              style={{ ...inputStyle, fontFamily: "var(--font-mono)", fontSize: "0.78rem", lineHeight: 1.5, resize: "vertical", color: valid ? "var(--color-ink)" : "#9a2a2a" }}
            />
            {!valid && <p role="alert" style={{ ...dim, color: "#9a2a2a", margin: 0 }}>Invalid JSON — fix before submitting.</p>}
            <p style={{ ...dim, fontSize: "0.76rem", margin: 0 }}>
              Changing the <strong>admins</strong> list requires the gov.bittrees.eth ENS owner (a Snapshot
              rule) — an admin signature alone can't alter it.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <button className="btn-primary" disabled={!valid || status === "saving"} onClick={save} style={{ opacity: !valid || status === "saving" ? 0.55 : 1 }}>
              {status === "saving" ? "Confirm in wallet…" : "Submit settings"}
            </button>
            {status === "error" && error && <span role="alert" style={{ ...dim, color: "var(--color-ink)" }}>{error}</span>}
          </div>
        </>
      )}
    </section>
  );
}

/* ── Community rooms — one-click creation per tier + ENS subname ──────────── */
function CommunityRoomsAdmin({ address }: { address: `0x${string}` }) {
  const push = usePush();
  const walletClient = push.wallet;
  const pushClient = push.client;
  const status = push.status;
  const { data: registry } = useRoomRegistry();
  const qc = useQueryClient();
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [busyKey, setBusyKey] = useState<string>();

  // Registry (runtime, Vercel KV) chatIds win over env (build-time) fallbacks.
  const rooms = [...BGOV_ROOMS, ...SAFE_ROOMS].map((r) => ({ ...r, chatId: registry?.chatIds?.[r.key] ?? r.chatId }));

  async function enable() { setError(undefined); await push.enable(); }

  async function create(room: PushRoom) {
    if (!pushClient) return;
    setBusyKey(room.key);
    setError(undefined);
    try {
      const chatId = await createGatedGroup(pushClient, room, address);
      // Publish to the registry (Vercel KV) → live instantly, no redeploy. If the
      // registry isn't configured, fall back to the manual env-var instructions.
      let published = false;
      if (walletClient) {
        try {
          await saveRoomChatId({ walletClient, account: address, roomKey: room.key, chatId });
          setSaved((s) => ({ ...s, [room.key]: true }));
          qc.invalidateQueries({ queryKey: ["room-registry"] });
          published = true;
        } catch {
          /* registry not configured / save failed → env fallback below */
        }
      }
      if (!published) setCreated((c) => ({ ...c, [room.key]: chatId }));
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusyKey(undefined);
    }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <p className="text-label">Community rooms</p>
        <p style={{ ...dim, margin: "0.25rem 0 0", lineHeight: 1.55 }}>
          Create a gated Push group for each BGOV tier and each bittrees.eth subname (gated to its
          Safe's signers &amp; proposers). Creating a room publishes it to the registry and it goes live
          in <Link to={ROUTES.messenger} style={{ color: "var(--color-primary-hover)" }}>Chat</Link>{" "}
          immediately — no redeploy. (If the registry isn't configured, you'll get an env-var line to set instead.)
          Every room is created with{" "}
          {ROOM_ADMINS.map((a, i) => (
            <span key={a}>
              {i > 0 ? ", " : ""}
              <code style={mono}>{shortAddress(a)}</code>
            </span>
          ))}{" "}
          as a standing admin (manages members &amp; roles).
        </p>
      </div>

      {status !== "ready" ? (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <p style={{ ...dim, margin: 0 }}>Enabling recovers your room keys for this wallet session (no gas). Reloading or changing wallets requires enabling again. Actions already sent may finish; check the registry before retrying.</p>
          <button className="btn-primary" disabled={status === "enabling"} onClick={enable} style={{ opacity: status === "enabling" ? 0.6 : 1 }}>
            {status === "enabling" ? "Confirm in wallet…" : "Enable room creation"}
          </button>
          {status === "error" && (error || push.error) && <span role="alert" style={{ ...dim, color: "var(--color-ink)" }}>{error || push.error}</span>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {rooms.map((room) => {
            const newId = created[room.key];
            const justSaved = saved[room.key];
            const live = !!room.chatId || justSaved;
            return (
              <div key={room.key} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <p style={{ fontFamily: "var(--font-serif)", fontSize: "0.95rem", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>{room.name}</p>
                    <p style={{ ...dim, margin: "0.15rem 0 0" }}>Gate: {gateLabel(room.gate)}</p>
                  </div>
                  {live ? (
                    <span style={{ ...dim, color: "var(--color-secondary)" }}>{justSaved ? "Live ✓ (published)" : "Live"}</span>
                  ) : (
                    <button onClick={() => create(room)} disabled={!!busyKey} style={createBtn}>
                      {busyKey === room.key ? "Creating…" : "Create room"}
                    </button>
                  )}
                </div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-ink-dim)", margin: 0, wordBreak: "break-all" }}>
                  {gateUrl(room)}
                </p>
                {newId && (
                  <div style={{ background: "var(--color-bg-subtle)", borderRadius: "4px", padding: "0.5rem 0.65rem" }}>
                    <p style={{ ...dim, margin: 0 }}>Created ✓ — registry not configured, so set this env var and redeploy:</p>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--color-ink)", margin: "0.25rem 0 0", wordBreak: "break-all" }}>
                      {room.envKey}={newId}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          {error && <p role="alert" style={{ ...dim, color: "var(--color-ink)" }}>{error}</p>}
        </div>
      )}
      {status === "ready" && pushClient && <ProposalReview push={pushClient} address={address} walletClient={walletClient} />}
      {status === "ready" && pushClient && <CustomRoomManager push={pushClient} address={address} walletClient={walletClient} />}
    </section>
  );
}

/* ── Pending room proposals — review queue for role-holder submissions ─────── */
function ProposalReview({ push, address, walletClient }: { push: PushClient; address: `0x${string}`; walletClient?: WalletClient }) {
  const { data: registry } = useRoomRegistry();
  const qc = useQueryClient();
  const proposals: RoomProposal[] = registry?.proposals ?? [];
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  async function approve(p: RoomProposal) {
    if (!walletClient) return;
    setBusyId(p.id);
    setError(undefined);
    try {
      const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "room";
      const key = `custom-${slug}-${Math.random().toString(36).slice(2, 7)}`;
      const room: PushRoom = { key, name: p.name.slice(0, 80), blurb: p.blurb || gateLabel(p.gate), gate: p.gate };
      const chatId = await createGatedGroup(push, room, address);
      await approveRoomProposal({ walletClient, account: address, proposalId: p.id, room: { ...room, chatId } });
      qc.invalidateQueries({ queryKey: ["room-registry"] });
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusyId(undefined);
    }
  }
  async function reject(p: RoomProposal) {
    if (!walletClient) return;
    setBusyId(p.id);
    setError(undefined);
    try {
      await rejectRoomProposal({ walletClient, account: address, proposalId: p.id });
      qc.invalidateQueries({ queryKey: ["room-registry"] });
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusyId(undefined);
    }
  }

  if (proposals.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", borderTop: "1px solid var(--color-border)", paddingTop: "1.1rem" }}>
      <p className="text-label">Pending room proposals ({proposals.length})</p>
      {proposals.map((p) => (
        <div key={p.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "0.95rem", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>{p.name}</p>
            <p style={{ ...dim, margin: "0.15rem 0 0" }}>{gateLabel(p.gate)} · proposed by {shortAddress(p.by)}</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn-primary" disabled={!!busyId} onClick={() => approve(p)} style={{ opacity: busyId ? 0.6 : 1 }}>{busyId === p.id ? "Approving…" : "Approve"}</button>
            <button data-insights="reject" onClick={() => reject(p)} disabled={!!busyId} style={{ ...createBtn, color: "#9a2a2a", borderColor: "#e2b8b8" }}>Reject</button>
          </div>
        </div>
      ))}
      {error && <p role="alert" style={{ ...dim, color: "var(--color-ink)", margin: 0 }}>{error}</p>}
    </div>
  );
}

/* ── Custom rooms — admin-defined, with custom gatekeeping ────────────────── */
function CustomRoomManager({ push, address, walletClient }: { push: PushClient; address: `0x${string}`; walletClient?: WalletClient }) {
  const { data: registry } = useRoomRegistry();
  const { data: community } = useCommunity();
  const qc = useQueryClient();
  const custom = registry?.custom ?? [];
  const roleOptions = selectableRoles(community?.roledefs);

  const gb = useRoomGate();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const canCreate = name.trim().length > 0 && gb.valid;

  async function create() {
    if (!walletClient || !canCreate) { setError("Add a room name and at least one valid rule."); return; }
    setBusy(true);
    setError(undefined);
    try {
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "room";
      const key = `custom-${slug}-${Math.random().toString(36).slice(2, 7)}`;
      const room: PushRoom = { key, name: name.trim().slice(0, 80), blurb: gateLabel(gb.gate), gate: gb.gate };
      const chatId = await createGatedGroup(push, room, address);
      await saveCustomRoom({ walletClient, account: address, room: { ...room, chatId } });
      qc.invalidateQueries({ queryKey: ["room-registry"] });
      setName("");
      gb.reset();
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(key: string) {
    if (!walletClient) return;
    setBusy(true);
    setError(undefined);
    try {
      await deleteCustomRoom({ walletClient, account: address, key });
      qc.invalidateQueries({ queryKey: ["room-registry"] });
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderTop: "1px solid var(--color-border)", paddingTop: "1.1rem" }}>
      <p className="text-label">Create a custom room</p>
      <p style={{ ...dim, margin: 0, lineHeight: 1.55 }}>
        Add any number of rooms with their own gate. Combine multiple rules — token / NFT holdings, a
        Safe's signers, an ENS name, or a BGOV threshold — with <strong>any</strong> (admit if any
        match) or <strong>all</strong> (must match every rule). Publishes to the registry and goes
        live in Chat immediately.
      </p>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Room name" maxLength={80} style={inputStyle} />

        <RoomGateBuilder gate={gb} roleOptions={roleOptions} />

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn-primary" disabled={!canCreate || busy} onClick={create} style={{ opacity: !canCreate || busy ? 0.55 : 1 }}>
            {busy ? "Creating…" : "Create & publish"}
          </button>
        </div>
        {error && <p role="alert" style={{ ...dim, color: "var(--color-ink)", margin: 0 }}>{error}</p>}
      </div>

      {custom.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {custom.map((r) => (
            <div key={r.key} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: "0.95rem", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>{r.name}</p>
                <p style={{ ...dim, margin: "0.15rem 0 0" }}>{r.blurb}</p>
              </div>
              <button data-insights="remove" onClick={() => remove(r.key)} disabled={busy} style={{ ...createBtn, color: "#9a2a2a", borderColor: "#e2b8b8" }}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Roles & tags — create a role catalog, then assign from a dropdown ──────── */
const roleBadge = (label: string, color?: string) => ({
  fontFamily: "var(--font-sans)", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase" as const,
  letterSpacing: "0.06em", color: color || "var(--color-secondary)",
  border: `1px solid ${color || "var(--color-secondary)"}`, borderRadius: "999px", padding: "0.05rem 0.4rem",
});

function RolesAdmin({ address }: { address: `0x${string}` }) {
  const { data: walletClient } = useWalletClient();
  const { data: community } = useCommunity();
  const roles = community?.roles;
  const roledefs = community?.roledefs;
  const qc = useQueryClient();

  // assign-an-existing-role
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState(""); // the selected role's label
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // create-a-new-role
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#3A923A");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();

  const options = selectableRoles(roledefs);
  const selected = options.find((o) => o.label === label);
  const canAssign = (isAddress(target.trim()) || target.trim().includes(".")) && !!selected;

  async function assign() {
    if (!walletClient || !selected) { setError("Pick a role and enter an address or ENS name."); return; }
    setBusy(true);
    setError(undefined);
    try {
      let t = target.trim();
      if (t.includes(".")) {
        const resolved = await getEnsAddress(wagmiConfig, { name: normalize(t), chainId: mainnet.id });
        if (!resolved) throw new Error("That ENS name doesn't resolve to an address.");
        t = resolved;
      }
      if (!isAddress(t)) throw new Error("Enter a valid 0x address or ENS name.");
      await assignRole({ walletClient, account: address, target: getAddress(t), label: selected.label, color: selected.color });
      qc.invalidateQueries({ queryKey: ["community"] });
      setTarget("");
      setLabel("");
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(addr: string, lbl: string) {
    if (!walletClient) return;
    setBusy(true);
    setError(undefined);
    try {
      await unassignRole({ walletClient, account: address, target: addr, label: lbl });
      qc.invalidateQueries({ queryKey: ["community"] });
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (!walletClient || newLabel.trim().length === 0) { setCreateError("Enter a role name."); return; }
    if (options.some((o) => o.label.toLowerCase() === newLabel.trim().toLowerCase())) { setCreateError(`Role "${newLabel.trim()}" already exists.`); return; }
    setCreating(true);
    setCreateError(undefined);
    try {
      await createRole({ walletClient, account: address, label: newLabel.trim(), color: newColor, description: newDesc.trim() });
      qc.invalidateQueries({ queryKey: ["community"] });
      setNewLabel("");
      setNewDesc("");
      setNewColor("#3A923A");
    } catch (e) {
      setCreateError(humanError(e));
    } finally {
      setCreating(false);
    }
  }
  async function destroy(lbl: string) {
    if (!walletClient) return;
    setCreating(true);
    setCreateError(undefined);
    try {
      await deleteRole({ walletClient, account: address, label: lbl });
      qc.invalidateQueries({ queryKey: ["community"] });
    } catch (e) {
      setCreateError(humanError(e));
    } finally {
      setCreating(false);
    }
  }

  const entries = Object.entries(roles ?? {});

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <p className="text-label">Roles &amp; tags</p>
        <p style={{ ...dim, margin: "0.25rem 0 0", lineHeight: 1.55 }}>
          First <strong>create a role</strong> (a reusable label + colour), then <strong>assign</strong> it to an
          address — it shows as a badge next to their posts in the forum and messages in chat, alongside the
          one automatic tier (Shareholder, ≥1 BGOV). Needs the registry (Vercel KV) connected.
        </p>
      </div>

      {/* 1 ─ Create a role (the catalog) */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <p className="text-label" style={{ margin: 0 }}>Create a role</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
          <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Role name (e.g. Core, Treasury)" maxLength={32} style={{ ...inputStyle, width: "210px" }} />
          <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} title="Badge colour" style={{ width: "40px", height: "34px", border: "1px solid var(--color-border)", borderRadius: "2px", background: "#fff", cursor: "pointer", padding: 0 }} />
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What it's for (optional)" maxLength={200} style={{ ...inputStyle, flex: 1, minWidth: "200px" }} />
          <button className="btn-primary" disabled={creating || newLabel.trim().length === 0} onClick={create} style={{ opacity: creating || newLabel.trim().length === 0 ? 0.55 : 1 }}>
            {creating ? "Saving…" : "Create role"}
          </button>
        </div>
        {createError && <p role="alert" style={{ ...dim, color: "var(--color-ink)", margin: 0 }}>{createError}</p>}

        {/* the catalog — built-ins (locked) + created roles */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.2rem" }}>
          {options.map((o) => (
            <div key={o.label} style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <span style={roleBadge(o.label, o.color)}>{o.label}</span>
              {o.description && <span style={{ ...dim, margin: 0 }}>{o.description}</span>}
              {o.locked
                ? <span style={{ ...dim, margin: 0, fontStyle: "italic" }}>built-in</span>
                : <button data-insights="delete" onClick={() => destroy(o.label)} disabled={creating} aria-label={`Delete role ${o.label}`} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a2a2a", fontSize: "0.78rem", padding: 0 }}>Delete</button>}
            </div>
          ))}
        </div>
        <p style={{ ...dim, margin: 0 }}>Deleting a role also removes it from everyone it was assigned to. <code style={mono}>Operations</code> + <code style={mono}>Moderator</code> are built in and carry powers.</p>
      </div>

      {/* 2 ─ Assign a role (dropdown of created + built-in roles) */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <p className="text-label" style={{ margin: 0 }}>Assign a role</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0x address or name.eth" style={{ ...inputStyle, flex: 1, minWidth: "220px", fontSize: "0.8rem" }} />
          <select value={label} onChange={(e) => setLabel(e.target.value)} style={{ ...inputStyle, width: "210px" }}>
            <option value="">Select a role…</option>
            {options.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
          </select>
          <span aria-hidden style={{ width: "34px", height: "34px", borderRadius: "2px", border: "1px solid var(--color-border)", background: selected?.color || "transparent" }} title={selected ? `${selected.label} colour` : "role colour"} />
          <button className="btn-primary" disabled={!canAssign || busy} onClick={assign} style={{ opacity: !canAssign || busy ? 0.55 : 1 }}>
            {busy ? "Saving…" : "Assign"}
          </button>
        </div>
        {options.length === 0 && <p style={{ ...dim, margin: 0 }}>No roles yet — create one above first.</p>}
        {error && <p role="alert" style={{ ...dim, color: "var(--color-ink)", margin: 0 }}>{error}</p>}
      </div>

      {/* 3 ─ Reference: the one automatic tier + the manual tier roles */}
      <div className="card" style={{ background: "var(--color-bg-subtle)", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <p className="text-label" style={{ margin: 0 }}>Tiers</p>
        <p style={{ ...dim, margin: 0, lineHeight: 1.55 }}>
          <strong>Shareholder</strong> (≥1 BGOV) is automatic — no assignment needed.
        </p>
        <p style={{ ...dim, margin: 0, lineHeight: 1.55 }}>
          <strong>{TIER_ROLES.map((t) => t.label).join(", ")}</strong> are assigned per user (above) —
          their rooms admit only wallets you've assigned the role. BGOV holdings don't grant access.
        </p>
      </div>

      {entries.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {entries.map(([addr, list]) => (
            <div key={addr} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <AddressName address={addr} avatar />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                {list.map((r) => (
                  <span key={r.label} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                    <span style={{ fontFamily: "var(--font-sans)", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: r.color || "var(--color-secondary)", border: `1px solid ${r.color || "var(--color-secondary)"}`, borderRadius: "999px", padding: "0.05rem 0.4rem" }}>{r.label}</span>
                    <button onClick={() => remove(addr, r.label)} disabled={busy} aria-label={`Remove ${r.label}`} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a2a2a", fontSize: "0.9rem", lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── Moderation queue — community-flagged posts/messages ──────────────────── */
function ModerationQueue({ address }: { address: `0x${string}` }) {
  const { data: walletClient } = useWalletClient();
  const { data: community } = useCommunity();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const flags = community?.flags ?? {};
  const threshold = community?.threshold ?? 2;
  const entries = Object.entries(flags);

  async function act(id: string, action: "approve" | "remove" | "clear") {
    if (!walletClient) return;
    setBusy(id + action);
    setError(undefined);
    try {
      await moderateItem({ walletClient, account: address, id, action });
      qc.invalidateQueries({ queryKey: ["community"] });
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <p className="text-label">Moderation</p>
        <p style={{ ...dim, margin: "0.25rem 0 0", lineHeight: 1.55 }}>
          Posts and messages flagged by shareholders. Content auto-hides once {threshold} distinct
          shareholders flag it — approve to restore it, remove to keep it hidden, or clear the flags.
        </p>
      </div>
      {entries.length === 0 ? (
        <div className="card"><p style={{ ...dim, margin: 0 }}>Nothing flagged.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {entries.map(([id, rec]) => {
            const hidden = rec.mod === "removed" || (rec.mod !== "approved" && rec.by.length >= threshold);
            const status = rec.mod === "approved" ? "approved" : rec.mod === "removed" ? "removed" : hidden ? "hidden" : "flagged";
            return (
              <div key={id} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                  <span style={{ ...dim }}>
                    {rec.surface || "item"} · {rec.by.length} flag{rec.by.length === 1 ? "" : "s"} ·{" "}
                    <strong style={{ color: hidden ? "#9a2a2a" : "var(--color-ink-muted)" }}>{status}</strong>
                  </span>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button data-insights="approve" onClick={() => act(id, "approve")} disabled={!!busy} style={createBtn}>Approve</button>
                    <button data-insights="remove" onClick={() => act(id, "remove")} disabled={!!busy} style={{ ...createBtn, color: "#9a2a2a", borderColor: "#e2b8b8" }}>Remove</button>
                    <button data-insights="clear" onClick={() => act(id, "clear")} disabled={!!busy} style={{ ...createBtn, color: "var(--color-ink-dim)", borderColor: "var(--color-border)" }}>Clear</button>
                  </div>
                </div>
                {rec.preview && (
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.82rem", color: "var(--color-ink-muted)", lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap" }}>{rec.preview}</p>
                )}
                {rec.surface === "forum" && (
                  <a href={`${EASSCAN_VIEW}${id}`} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-sans)", fontSize: "0.72rem", color: "var(--color-primary-hover)", textDecoration: "none" }}>
                    View full post ↗
                  </a>
                )}
              </div>
            );
          })}
          {error && <p role="alert" style={{ ...dim, color: "var(--color-ink)" }}>{error}</p>}
        </div>
      )}
    </section>
  );
}

/* ── Contributor applications (on-chain, EAS on Base) ─────────────────────── */
function ContributorApplications() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { data: posts, isLoading, isError } = useTopics(CONTRIB_COMMUNITY);
  const [kp, setKp] = useState<EncKeypair | null>(null);
  const [status, setStatus] = useState<"idle" | "enabling">("idle");
  const [error, setError] = useState<string>();

  async function enable() {
    if (!walletClient || !address) return;
    setStatus("enabling");
    setError(undefined);
    try {
      const keypair = await deriveEncKeypair(walletClient, address);
      await publishEncKey({ walletClient, account: address, pubkey: pubKeyHex(keypair.publicKey) });
      setKp(keypair);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setStatus("idle");
    }
  }

  const decoded = (posts ?? []).map((p) => {
    let app: Application | null = null;
    if (kp && address) {
      try {
        const json = decryptApplication(JSON.parse(p.body) as Envelope, address, kp.secretKey);
        app = json ? (JSON.parse(json) as Application) : null;
      } catch { app = null; }
    }
    return { id: p.id, time: p.time, attester: p.attester, app };
  });

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <p className="text-label">Contributor applications</p>
        <p style={{ ...dim, margin: "0.25rem 0 0", lineHeight: 1.55 }}>
          Applications from <Link to={ROUTES.contribute} style={{ color: "var(--color-primary-hover)" }}>Become a contributor</Link>{" "}
          are <strong>on-chain (Base) but encrypted</strong>. Enable decryption to derive your key (and
          publish it so new applicants encrypt to you), then read the ones you're a recipient of —
          requires the <code style={mono}>Operations</code> role.
        </p>
      </div>
      <div>
        <button className="btn-primary" onClick={enable} disabled={status === "enabling"} style={{ opacity: status === "enabling" ? 0.6 : 1 }}>
          {status === "enabling" ? "Confirm in wallet…" : kp ? "Re-publish decryption key" : "Enable decryption"}
        </button>
        {error && <span role="alert" style={{ ...dim, color: "var(--color-ink)", marginLeft: "0.85rem" }}>{error}</span>}
      </div>

      {isLoading ? (
        <p style={dim}>Loading applications…</p>
      ) : isError ? (
        <p style={dim}>Couldn't reach the on-chain indexer right now.</p>
      ) : decoded.length === 0 ? (
        <div className="card"><p style={{ ...dim, margin: 0 }}>No applications yet.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {decoded.map((d) => (
            <div key={d.id} className="card" style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: "0.95rem", fontWeight: 700, color: "var(--color-ink)", margin: 0 }}>
                  {d.app ? `${d.app.name || "Applicant"}${d.app.expertise?.length ? ` · ${d.app.expertise.join(", ")}` : ""}` : "🔒 Encrypted"}
                </p>
                <span style={{ ...dim, fontSize: "0.72rem" }}>{relativeTime(d.time)}</span>
              </div>
              {d.app ? (
                <>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: "0.82rem", color: "var(--color-ink-muted)", lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap" }}>{d.app.specialty}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.85rem", fontFamily: "var(--font-sans)", fontSize: "0.72rem", color: "var(--color-ink-dim)" }}>
                    {d.app.region?.length ? <span>Region: {d.app.region.join(", ")}</span> : null}
                    {d.app.languages?.length ? <span>Languages: {d.app.languages.join(", ")}</span> : null}
                    {d.app.email ? <span>Email: {d.app.email}</span> : null}
                    {d.app.twitter ? <span>X: {d.app.twitter}</span> : null}
                    {d.app.telegram ? <span>TG: {d.app.telegram}</span> : null}
                    {d.app.heardFrom ? <span>Heard via: {d.app.heardFrom}</span> : null}
                    {d.app.referrer ? <span>Referred by: {d.app.referrer}</span> : null}
                    {d.app.wallet ? <span style={{ fontFamily: "var(--font-mono)" }}>BTREE: {shortAddress(d.app.wallet)}</span> : null}
                  </div>
                </>
              ) : (
                <p style={{ ...dim, margin: 0 }}>{kp ? "You're not a recipient (submitted before you enabled decryption)." : "Enable decryption to read this."}</p>
              )}
              <a href={`${EASSCAN_VIEW}${d.id}`} target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--color-ink-dim)", textDecoration: "none" }}>
                {shortAddress(d.attester)} · on-chain ↗
              </a>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ── shared ──────────────────────────────────────────────────────────────── */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <span className="text-label" style={{ margin: 0 }}>{label}</span>
      {children}
    </label>
  );
}

function secToDays(sec: unknown): number {
  const n = Number(sec ?? 0);
  return Number.isFinite(n) ? Math.round((n / 86400) * 100) / 100 : 0;
}
function daysToSec(days: string): number {
  return Math.round((Number(days) || 0) * 86400);
}

const inputStyle = {
  width: "100%",
  padding: "0.5rem 0.65rem",
  fontFamily: "var(--font-sans)",
  fontSize: "0.875rem",
  color: "var(--color-ink)",
  background: "#ffffff",
  border: "1px solid var(--color-border)",
  borderRadius: "2px",
  boxSizing: "border-box" as const,
};
const createBtn = {
  padding: "0.4rem 0.9rem",
  fontFamily: "var(--font-sans)",
  fontSize: "0.82rem",
  fontWeight: 600,
  color: "var(--color-ink)",
  background: "#ffffff",
  border: "1px solid var(--color-primary)",
  borderRadius: "2px",
  cursor: "pointer",
} as const;
const mono = { fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--color-ink-muted)" } as const;
const dim = { fontFamily: "var(--font-sans)", fontSize: "0.85rem", color: "var(--color-ink-dim)" } as const;
