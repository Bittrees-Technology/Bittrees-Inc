import { createPublicClient, http, getAddress, parseUnits } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

/**
 * Stateless token-gate for the Push Chat community rooms. No keys, no DB.
 *
 * Push Chat GETs this endpoint when a wallet tries to join a gated group, and
 * admits it on HTTP 200 (denies otherwise). Two room kinds:
 *
 *  - BGOV tier:  GET /api/gate/<tier>/<address>/checkAccess
 *      `<tier>` is the minimum BGOV (1/69/210/420). BGOV is a many-id ERC-1155,
 *      so the holder's total is read from Snapshot's `vp` (the space's
 *      erc1155-all-balances-of strategy) rather than a single balanceOf.
 *
 *  - ENS-subname Safe:  GET /api/gate/safe/<safeAddress>/<address>/checkAccess
 *      Admits the Safe's signers (on-chain `getOwners`) and proposers (delegates
 *      from the public Safe Transaction Service).
 */

const SNAPSHOT_SPACE = "gov.bittrees.eth";
// Server-side RPC. Do NOT fall back to VITE_MAINNET_RPC_URL — that's the browser
// key and is usually domain-allowlisted, so it 403s from a serverless function
// (which has no browser origin), breaking Safe-owner / token / ENS reads. Set
// MAINNET_RPC_URL (no domain restriction) for a dedicated node; else a public one.
const RPC = process.env.MAINNET_RPC_URL || "https://ethereum-rpc.publicnode.com";
// Safe Transaction Service moved to the unified, redirecting api.safe.global host.
const SAFE_TX_SERVICE = "https://api.safe.global/tx-service/eth";

// Role gating reads the same admin-assigned roles registry as /api/community.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ROLES_KEY = "bittrees:roles"; // { <addrLower>: [{ label, color }] }

/** The admin-assigned roles map from KV ({} if KV isn't configured). */
async function readRoles() {
  if (!KV_URL || !KV_TOKEN) return {};
  try {
    const r = await fetch(KV_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(["GET", ROLES_KEY]),
    });
    const j = await r.json();
    return j?.result ? JSON.parse(j.result) : {};
  } catch {
    return {};
  }
}

// Tier roles cascade downward: a higher tier satisfies a lower room's requirement
// (Partner ⊇ Junior Partner ⊇ Associate). All other roles match exactly.
const TIER_RANK = { partner: 3, "junior partner": 2, associate: 1 };

/**
 * Whether `user` satisfies a room's required `role`. Case-insensitive. For the
 * tier roles, a holder of an equal-or-higher tier passes (so a Partner can enter
 * the Junior Partner & Associate rooms, a Junior Partner the Associate room, etc.).
 */
function hasAssignedRole(roles, user, role) {
  const list = (roles && roles[String(user).toLowerCase()]) || [];
  const want = String(role || "").trim().toLowerCase();
  const wantRank = TIER_RANK[want];
  if (wantRank) {
    return list.some((r) => {
      const rank = TIER_RANK[String(r?.label || "").trim().toLowerCase()];
      return rank ? rank >= wantRank : false;
    });
  }
  return list.some((r) => String(r?.label || "").trim().toLowerCase() === want);
}

const SAFE_ABI = [
  { name: "getOwners", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] },
];
const client = createPublicClient({ chain: mainnet, transport: http(RPC) });

async function bgovVotingPower(address) {
  const r = await fetch("https://hub.snapshot.org/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: "query($v:String!,$s:String!){ vp(voter:$v, space:$s){ vp } }",
      variables: { v: address, s: SNAPSHOT_SPACE },
    }),
  });
  const j = await r.json().catch(() => ({}));
  return Number(j?.data?.vp?.vp ?? 0);
}

async function safeOwners(safe) {
  try {
    const owners = await client.readContract({ address: safe, abi: SAFE_ABI, functionName: "getOwners" });
    return owners.map((o) => o.toLowerCase());
  } catch {
    return [];
  }
}

async function safeDelegates(safe) {
  try {
    const r = await fetch(`${SAFE_TX_SERVICE}/api/v2/delegates/?safe=${safe}`, { headers: { accept: "application/json" } });
    if (!r.ok) return [];
    const j = await r.json();
    return (j?.results ?? []).map((d) => String(d.delegate || "").toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

const ERC_BAL_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
];
// ERC-20 and ERC-721 both expose balanceOf(address) → uint256 (token count / raw units).
async function tokenBalance(token, user) {
  try {
    return await client.readContract({ address: token, abi: ERC_BAL_ABI, functionName: "balanceOf", args: [user] });
  } catch {
    return 0n;
  }
}

const ERC20_DECIMALS_ABI = [
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
];
// Read an ERC-20's decimals on-chain (so the room's `min` can be a human amount); 18 on failure.
async function tokenDecimals(token) {
  try {
    return Number(await client.readContract({ address: token, abi: ERC20_DECIMALS_ABI, functionName: "decimals" }));
  } catch {
    return 18;
  }
}

const ERC1155_BAL_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "uint256" }] },
];
// ERC-1155 balanceOf(account, id) → the holder's balance of one token id.
async function tokenBalance1155(token, user, id) {
  try {
    return await client.readContract({ address: token, abi: ERC1155_BAL_ABI, functionName: "balanceOf", args: [user, id] });
  } catch {
    return 0n;
  }
}

const ERC1155_BATCH_ABI = [
  { name: "balanceOfBatch", type: "function", stateMutability: "view", inputs: [{ type: "address[]" }, { type: "uint256[]" }], outputs: [{ type: "uint256[]" }] },
];
const ERC1155_ANY_MAX_ID = 256; // "any token id" scans ids 0..255 in one balanceOfBatch call
// Total ERC-1155 balance a holder has across ids 0..ERC1155_ANY_MAX_ID-1 — the "any id"
// check. Covers sequential-id collections (POAP/membership/game items); a holding under
// a sparse/higher id than the cap isn't seen (use a specific-id rule for those).
async function tokenBalance1155Any(token, user) {
  try {
    const ids = Array.from({ length: ERC1155_ANY_MAX_ID }, (_, i) => BigInt(i));
    const accounts = ids.map(() => user);
    const bals = await client.readContract({ address: token, abi: ERC1155_BATCH_ABI, functionName: "balanceOfBatch", args: [accounts, ids] });
    return (bals || []).reduce((s, b) => s + BigInt(b), 0n);
  } catch {
    return 0n;
  }
}

// Push CustomEndpoint substitutes its chain-agnostic DID, not a bare address.
// Accept only the observed EVM format; never strip arbitrary namespaces/chains.
function pushAddress(value) {
  return /^eip155:0x[a-fA-F0-9]{40}$/.test(value) ? value.slice(7) : value;
}
const isAddr = (s) => /^0x[a-fA-F0-9]{40}$/.test(s);

/** Decode a base64url gate object from the URL. */
function decodeGate(b64) {
  const s = String(b64 || "").replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(s, "base64").toString("utf8"));
}

/** Address an ENS name resolves to (or null). */
async function ensResolve(name) {
  try {
    return await client.getEnsAddress({ name: normalize(String(name)) });
  } catch {
    return null;
  }
}

/** Evaluate a single access rule for `user` (checksummed). `roles` = the registry map. */
async function evalRule(rule, user, roles) {
  const u = user.toLowerCase();
  try {
    if (rule.kind === "role") return hasAssignedRole(roles || {}, u, rule.role);
    if (rule.kind === "bgov") return (await bgovVotingPower(u)) >= Number(rule.tier || 0);
    if (rule.kind === "safe") {
      if (!isAddr(rule.safe)) return false;
      const safe = getAddress(rule.safe);
      const [owners, delegates] = await Promise.all([safeOwners(safe), safeDelegates(safe)]);
      return owners.includes(u) || delegates.includes(u);
    }
    if (rule.kind === "token") {
      if (!isAddr(rule.token)) return false;
      const token = getAddress(rule.token);
      if (rule.standard === "erc1155") {
        let min; try { min = BigInt(rule.min || "1"); } catch { min = 1n; }
        if (rule.tokenId === undefined || rule.tokenId === "") {
          return (await tokenBalance1155Any(token, user)) >= min; // any token id
        }
        let id; try { id = BigInt(rule.tokenId); } catch { id = 0n; }
        return (await tokenBalance1155(token, user, id)) >= min;
      }
      if (rule.standard === "erc20") {
        // `min` is a human amount → scale by the token's on-chain decimals.
        let min; try { min = parseUnits(String(rule.min || "0"), await tokenDecimals(token)); } catch { min = 0n; }
        return (await tokenBalance(token, user)) >= min;
      }
      // erc721 (or legacy) → `min` is a raw token count.
      let min; try { min = BigInt(rule.min || "1"); } catch { min = 1n; }
      return (await tokenBalance(token, user)) >= min;
    }
    if (rule.kind === "ens") {
      if (rule.name) {
        const addr = await ensResolve(rule.name);
        return !!addr && addr.toLowerCase() === u;
      }
      // No name → admit anyone who has a primary (reverse) ENS name set.
      try { return !!(await client.getEnsName({ address: user })); } catch { return false; }
    }
  } catch {
    return false;
  }
  return false;
}

export default async function handler(req, res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("cache-control", "no-store");
  try {
    // Path segments after /api/gate/. vercel.json rewrites /api/gate/(.*) →
    // /api/gate?p=$1, so read them from the query param (fall back to the raw URL).
    const p = req.query ? req.query.p : undefined;
    let parts;
    if (p != null && p !== "") {
      parts = String(Array.isArray(p) ? p.join("/") : p).split("/").filter(Boolean);
    } else {
      const raw = (req.url || "").split("?")[0].split("/").filter(Boolean);
      const i = raw.indexOf("gate");
      parts = i >= 0 ? raw.slice(i + 1) : raw;
    }
    const gi = -1; // `parts` already starts at the segment after "gate"

    // ENS-subname Safe room: /api/gate/safe/<safeAddress>/<userAddress>/checkAccess
    if (parts[gi + 1] === "safe") {
      const safeRaw = parts[gi + 2] || "";
      const userRaw = pushAddress(parts[gi + 3] || "");
      if (!isAddr(safeRaw) || !isAddr(userRaw)) {
        res.status(400).json({ error: "invalid address" });
        return;
      }
      const safe = getAddress(safeRaw);
      const user = userRaw.toLowerCase();
      const [owners, delegates] = await Promise.all([safeOwners(safe), safeDelegates(safe)]);
      const role = owners.includes(user) ? "signer" : delegates.includes(user) ? "proposer" : null;
      res.status(role ? 200 : 403).json({ access: !!role, role, safe });
      return;
    }

    // Multi-rule room: /api/gate/multi/<base64 gate>/<userAddress>/checkAccess
    if (parts[gi + 1] === "multi") {
      const userRaw = pushAddress(parts[gi + 3] || "");
      if (!isAddr(userRaw)) { res.status(400).json({ error: "invalid address" }); return; }
      let gate;
      try { gate = decodeGate(parts[gi + 2]); } catch { res.status(400).json({ error: "bad gate" }); return; }
      const user = getAddress(userRaw);
      const rules = Array.isArray(gate?.rules) ? gate.rules : [];
      const combine = gate?.combine === "all" ? "all" : "any";
      if (rules.length === 0) { res.status(403).json({ access: false }); return; }
      // Load the roles registry once if any rule is role-gated.
      const roles = rules.some((r) => r?.kind === "role") ? await readRoles() : {};
      const results = await Promise.all(rules.map((r) => evalRule(r, user, roles)));
      const ok = combine === "all" ? results.every(Boolean) : results.some(Boolean);
      res.status(ok ? 200 : 403).json({ access: ok, combine, rules: rules.length });
      return;
    }

    // Token-gated room: /api/gate/token/<standard>/<tokenAddr>/<min>/<userAddress>/checkAccess
    if (parts[gi + 1] === "token") {
      const tokenRaw = parts[gi + 3] || "";
      const min = parts[gi + 4] || "1";
      const userRaw = pushAddress(parts[gi + 5] || "");
      if (!isAddr(tokenRaw) || !isAddr(userRaw)) {
        res.status(400).json({ error: "invalid address" });
        return;
      }
      let minBig;
      try { minBig = BigInt(min); } catch { minBig = 1n; }
      const bal = await tokenBalance(getAddress(tokenRaw), getAddress(userRaw));
      const ok = bal >= minBig;
      res.status(ok ? 200 : 403).json({ access: ok, balance: bal.toString(), min });
      return;
    }

    // BGOV-tier room: /api/gate/<tier>/<address>/checkAccess
    const tier = Number(parts[gi + 1]) || 1;
    const addrRaw = pushAddress(parts[gi + 2] || "");
    if (!isAddr(addrRaw)) {
      res.status(400).json({ error: "invalid address" });
      return;
    }
    const address = addrRaw.toLowerCase();
    const vp = await bgovVotingPower(address);
    const ok = vp >= tier;
    res.status(ok ? 200 : 403).json({ access: ok, bgov: vp, tier });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
