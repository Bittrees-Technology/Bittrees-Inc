/**
 * Snapshot governance layer for the Bittrees, Inc. space (gov.bittrees.eth).
 *
 * Reads come from Snapshot's free public GraphQL hub (no API key). Voting power
 * is computed server-side by Snapshot from the space's `erc1155-all-balances-of`
 * strategy — i.e. a holder's BGOV (common stock) balance — so the browser never
 * has to read BGOV on-chain for it.
 *
 * Casting a vote signs Snapshot's EIP-712 vote envelope with the connected wallet
 * (viem `signTypedData`) and POSTs it to the Snapshot sequencer — no SDK / Buffer
 * polyfills needed. NOTE: the envelope below targets single-choice proposals
 * (For/Against/Abstain — what this space uses); other proposal types would need a
 * different `choice` shape. Verify end-to-end once an open proposal exists.
 */

import { useQuery } from "@tanstack/react-query";
import { getAddress, createPublicClient, http, type WalletClient } from "viem";
import { mainnet } from "viem/chains";

export const SNAPSHOT_SPACE = "gov.bittrees.eth";

const HUB = "https://hub.snapshot.org/graphql";
const SEQ = "https://seq.snapshot.org/";
/** Fixed EIP-712 domain for ALL Snapshot envelopes (no chainId / verifyingContract). */
const SNAP_DOMAIN = { name: "snapshot", version: "0.1.4" } as const;
const STALE = 60_000;

// Snapshot's own RPC ("brovider") — the block its scorers resolve a proposal against.
const snapBrovider = createPublicClient({ chain: mainnet, transport: http("https://rpc.snapshot.org/1") });

// ── Types ────────────────────────────────────────────────────────────────
export interface SnapshotSpace {
  id: string;
  name: string;
  about: string;
  symbol: string;
  followersCount: number;
  proposalsCount: number;
  admins: string[];
  moderators: string[];
  members: string[];
  validation?: { name: string; params: Record<string, unknown> };
  voting?: { type?: string; period?: number; delay?: number; quorum?: number; privacy?: string };
  strategies?: { name: string; network: string; params: Record<string, unknown> }[];
}

export interface SnapshotProposal {
  id: string;
  flagged?: boolean;
  title: string;
  body: string;
  choices: string[];
  start: number;
  end: number;
  state: "active" | "closed" | "pending";
  scores: number[];
  scores_total: number;
  votes: number;
  author: string;
  created: number;
  quorum: number;
  type: string;
}

// ── GraphQL ──────────────────────────────────────────────────────────────
async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(HUB, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Snapshot HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0]?.message ?? "Snapshot GraphQL error");
  return json.data as T;
}

const PROPOSAL_FIELDS = `id title body choices start end state scores scores_total votes author created quorum type flagged`;

// ── Hooks ────────────────────────────────────────────────────────────────
export function useSpace() {
  return useQuery({
    queryKey: ["snapshot-space", SNAPSHOT_SPACE],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const d = await gql<{ space: SnapshotSpace }>(
        `query($id:String!){ space(id:$id){ id name about symbol followersCount proposalsCount admins moderators members validation{name params} voting{type period delay quorum privacy} strategies{name network params} } }`,
        { id: SNAPSHOT_SPACE }
      );
      return d.space;
    },
  });
}

export function useProposals(limit = 20) {
  return useQuery({
    queryKey: ["snapshot-proposals", SNAPSHOT_SPACE, limit],
    staleTime: STALE,
    queryFn: async () => {
      const d = await gql<{ proposals: SnapshotProposal[] }>(
        `query($space:String!,$first:Int!){ proposals(first:$first, where:{space:$space}, orderBy:"created", orderDirection:desc){ ${PROPOSAL_FIELDS} } }`,
        { space: SNAPSHOT_SPACE, first: limit }
      );
      return d.proposals ?? [];
    },
  });
}

export function useProposal(id: string | undefined) {
  return useQuery({
    queryKey: ["snapshot-proposal", id],
    enabled: !!id,
    staleTime: STALE,
    queryFn: async () => {
      const d = await gql<{ proposal: SnapshotProposal | null }>(
        `query($id:String!){ proposal(id:$id){ ${PROPOSAL_FIELDS} } }`,
        { id }
      );
      return d.proposal;
    },
  });
}

/** Connected wallet's voting power for a proposal (BGOV-derived, via Snapshot). */
export function useVotingPower(voter: string | undefined, proposalId: string | undefined) {
  return useQuery({
    queryKey: ["snapshot-vp", voter, proposalId],
    enabled: !!voter && !!proposalId,
    staleTime: STALE,
    queryFn: async () => {
      const d = await gql<{ vp: { vp: number } | null }>(
        `query($voter:String!,$space:String!,$proposal:String!){ vp(voter:$voter, space:$space, proposal:$proposal){ vp } }`,
        { voter, space: SNAPSHOT_SPACE, proposal: proposalId }
      );
      return d.vp?.vp ?? 0;
    },
  });
}

/**
 * Connected wallet's CURRENT voting power in the space (its BGOV balance),
 * computed by Snapshot without a specific proposal. Used for the forum's
 * "shareholder" badge (vp > 0 ⇒ holds BGOV common stock).
 */
export function useVotingPowerNow(voter: string | undefined) {
  return useQuery({
    queryKey: ["snapshot-vp-now", voter],
    enabled: !!voter,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const d = await gql<{ vp: { vp: number } | null }>(
        `query($voter:String!,$space:String!){ vp(voter:$voter, space:$space){ vp } }`,
        { voter, space: SNAPSHOT_SPACE }
      );
      return d.vp?.vp ?? 0;
    },
  });
}

/** BGOV voting power for many addresses at once (Snapshot vp per voter, cached). */
export function useVotingPowers(voters: string[]) {
  const sorted = [...voters.map((v) => v.toLowerCase())].sort();
  return useQuery({
    queryKey: ["snapshot-vps", sorted],
    enabled: sorted.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const out: Record<string, number> = {};
      await Promise.all(
        sorted.map(async (v) => {
          try {
            const d = await gql<{ vp: { vp: number } | null }>(
              `query($voter:String!,$space:String!){ vp(voter:$voter, space:$space){ vp } }`,
              { voter: v, space: SNAPSHOT_SPACE }
            );
            out[v] = d.vp?.vp ?? 0;
          } catch {
            out[v] = 0;
          }
        })
      );
      return out;
    },
  });
}

// ── Cast a vote (Snapshot EIP-712 envelope, all proposal types) ──────────
/**
 * A vote `choice`, shaped per the proposal's voting type:
 *  - basic / single-choice → a 1-based index (number)
 *  - approval / ranked-choice → 1-based indices (number[]; ranked = in order)
 *  - weighted / quadratic → a 1-based-index → weight map (Record<string, number>)
 */
export type VoteChoice = number | number[] | Record<string, number>;

export const VOTE_TYPES = [
  { id: "basic", label: "Basic (For / Against / Abstain)" },
  { id: "single-choice", label: "Single choice" },
  { id: "approval", label: "Approval (pick several)" },
  { id: "quadratic", label: "Quadratic (regressive — curbs whale dominance)" },
  { id: "weighted", label: "Weighted (split your power)" },
  { id: "ranked-choice", label: "Ranked choice" },
] as const;

/**
 * EIP-712 `Vote` types for a proposal type — only the `choice` field shape
 * varies (byte-exact per snapshot.js src/sign/types.ts). The sequencer hashes
 * the `types` object to route the action, so field order + types must match.
 */
function voteTypes(proposalType: string) {
  let choiceType = "uint32"; // basic, single-choice
  if (proposalType === "approval" || proposalType === "ranked-choice") choiceType = "uint32[]";
  else if (proposalType === "weighted" || proposalType === "quadratic") choiceType = "string";
  return {
    Vote: [
      { name: "from", type: "string" },
      { name: "space", type: "string" },
      { name: "timestamp", type: "uint64" },
      { name: "proposal", type: "string" },
      { name: "choice", type: choiceType },
      { name: "reason", type: "string" },
      { name: "app", type: "string" },
      { name: "metadata", type: "string" },
    ],
  };
}

export async function castVote(opts: {
  walletClient: WalletClient;
  account: `0x${string}`;
  proposal: string;
  /** Proposal voting type — defaults to basic/single-choice (uint32 choice). */
  type?: string;
  /** Shape must match `type` — see VoteChoice. */
  choice: VoteChoice;
  reason?: string;
}): Promise<{ id?: string }> {
  const { walletClient, account, proposal, type = "basic", choice, reason = "" } = opts;

  const types = voteTypes(type);
  // weighted/quadratic sign the weight map as a JSON string; others sign as-is.
  const isWeighted = type === "weighted" || type === "quadratic";
  const choiceValue: VoteChoice | string = isWeighted ? JSON.stringify(choice) : choice;

  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const message = {
    from: account,
    space: SNAPSHOT_SPACE,
    timestamp,
    proposal,
    choice: choiceValue,
    reason,
    app: "bittrees-gov",
    metadata: "{}",
  };

  const sig = await walletClient.signTypedData({
    account,
    domain: SNAP_DOMAIN,
    types,
    primaryType: "Vote",
    message,
  } as Parameters<WalletClient["signTypedData"]>[0]);

  const res = await fetch(SEQ, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      address: account,
      sig,
      // The sequencer wants a JSON-safe message (timestamp as a number).
      data: { domain: SNAP_DOMAIN, types, message: { ...message, timestamp: Number(timestamp) } },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error_description || json?.error || `Snapshot sequencer HTTP ${res.status}`);
  }
  return json;
}

/** Winning choice index (0-based) by score, or -1 if no votes. */
export function winningChoice(scores: number[]): number {
  if (!scores.length) return -1;
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
  return scores[best] > 0 ? best : -1;
}

export type ProposalOutcome = "passed" | "failed" | "no-quorum" | null;

/**
 * Outcome of a CLOSED proposal — active/pending return null. Quorum is checked
 * first (total BGOV cast vs the space quorum). For basic / single-choice,
 * "passed" = the first choice ("For") outpolls the second ("Against"); for other
 * voting types, "passed" = the leading choice is the first option.
 */
export function proposalOutcome(p: SnapshotProposal): ProposalOutcome {
  if (p.state !== "closed") return null;
  if (p.quorum > 0 && p.scores_total < p.quorum) return "no-quorum";
  if (p.scores_total <= 0) return "failed";
  if ((p.type === "basic" || p.type === "single-choice") && p.scores.length >= 2) {
    return (p.scores[0] ?? 0) > (p.scores[1] ?? 0) ? "passed" : "failed";
  }
  return winningChoice(p.scores) === 0 ? "passed" : "failed";
}

// ── Governance writes (create / moderate / settings — all in-app) ─────────
// Types are byte-exact per snapshot.js src/sign/types.ts; the sequencer hashes
// the `types` object to route the action, so field order + types must match.

const proposalTypes = {
  Proposal: [
    { name: "from", type: "string" },
    { name: "space", type: "string" },
    { name: "timestamp", type: "uint64" },
    { name: "type", type: "string" },
    { name: "title", type: "string" },
    { name: "body", type: "string" },
    { name: "discussion", type: "string" },
    { name: "choices", type: "string[]" },
    { name: "labels", type: "string[]" },
    { name: "start", type: "uint64" },
    { name: "end", type: "uint64" },
    { name: "snapshot", type: "uint64" },
    { name: "plugins", type: "string" },
    { name: "privacy", type: "string" },
    { name: "app", type: "string" },
  ],
} as const;

const cancelProposalTypes = {
  CancelProposal: [
    { name: "from", type: "string" },
    { name: "space", type: "string" },
    { name: "timestamp", type: "uint64" },
    { name: "proposal", type: "string" },
  ],
} as const;

const flagProposalTypes = {
  FlagProposal: [
    { name: "from", type: "string" },
    { name: "space", type: "string" },
    { name: "proposal", type: "string" },
    { name: "timestamp", type: "uint64" },
  ],
} as const;

const spaceSettingsTypes = {
  Space: [
    { name: "from", type: "address" },
    { name: "space", type: "string" },
    { name: "timestamp", type: "uint64" },
    { name: "settings", type: "string" },
  ],
} as const;

/** POST a signed envelope to the sequencer (bigints → numbers on the wire). */
async function postEnvelope(
  account: `0x${string}`,
  sig: string,
  types: unknown,
  message: Record<string, unknown>
) {
  const wireMessage = Object.fromEntries(
    Object.entries(message).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v])
  );
  const res = await fetch(SEQ, {
    method: "POST",
    headers: { Accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ address: account, sig, data: { domain: SNAP_DOMAIN, types, message: wireMessage } }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error_description || json?.error || `Snapshot sequencer HTTP ${res.status}`);
  }
  return json as { id?: string; ipfs?: string };
}

/** Latest block on Snapshot's brovider, used as a proposal's `snapshot`. */
export async function getSnapshotBlock(): Promise<bigint> {
  const head = await snapBrovider.getBlockNumber();
  return head > 5n ? head - 5n : head;
}

export interface CreateProposalArgs {
  walletClient: WalletClient;
  account: `0x${string}`;
  title: string;
  body: string;
  choices?: string[]; // defaults to For/Against/Abstain (basic)
  type?: string; // defaults to "basic"
  discussion?: string;
  delaySec?: number; // gap before voting opens (space default)
  periodSec?: number; // voting duration (space default)
}

export async function createProposal(args: CreateProposalArgs): Promise<{ id?: string }> {
  const {
    walletClient, account, title, body,
    choices = ["For", "Against", "Abstain"],
    type = "basic", discussion = "",
    delaySec = 0, periodSec = 7 * 86400,
  } = args;
  const from = getAddress(account);
  const now = Math.floor(Date.now() / 1000);
  const start = now + (delaySec || 0);
  const end = start + (periodSec || 7 * 86400);
  const snapshotBlock = await getSnapshotBlock();

  const message = {
    from,
    space: SNAPSHOT_SPACE,
    timestamp: BigInt(now),
    type,
    title,
    body,
    discussion,
    choices,
    labels: [] as string[],
    start: BigInt(start),
    end: BigInt(end),
    snapshot: snapshotBlock,
    plugins: "{}",
    privacy: "", // plain (non-shutter) so votes can be cast in-app
    app: "bittrees-gov",
  };
  const sig = await walletClient.signTypedData({
    account, domain: SNAP_DOMAIN, types: proposalTypes, primaryType: "Proposal", message,
  });
  return postEnvelope(from, sig, proposalTypes, message);
}

/** Delete (archive) a proposal — admin, moderator, or the proposal's author. */
export async function deleteProposal(opts: { walletClient: WalletClient; account: `0x${string}`; proposal: string }) {
  const from = getAddress(opts.account);
  const message = { from, space: SNAPSHOT_SPACE, timestamp: BigInt(Math.floor(Date.now() / 1000)), proposal: opts.proposal };
  const sig = await opts.walletClient.signTypedData({ account: from, domain: SNAP_DOMAIN, types: cancelProposalTypes, primaryType: "CancelProposal", message });
  return postEnvelope(from, sig, cancelProposalTypes, message);
}

/** Flag (hide) a proposal — admin or moderator only. */
export async function flagProposal(opts: { walletClient: WalletClient; account: `0x${string}`; proposal: string }) {
  const from = getAddress(opts.account);
  const message = { from, space: SNAPSHOT_SPACE, proposal: opts.proposal, timestamp: BigInt(Math.floor(Date.now() / 1000)) };
  const sig = await opts.walletClient.signTypedData({ account: from, domain: SNAP_DOMAIN, types: flagProposalTypes, primaryType: "FlagProposal", message });
  return postEnvelope(from, sig, flagProposalTypes, message);
}

/** Best-effort fetch of the space's current settings JSON, for the admin editor. */
export async function fetchSpaceSettings(): Promise<Record<string, unknown> | null> {
  try {
    const d = await gql<{ space: Record<string, unknown> }>(
      `query($id:String!){ space(id:$id){
        name about network symbol avatar terms website twitter github coingecko private categories
        admins moderators members
        validation{ name params }
        voting{ delay period type quorum privacy hideAbstain }
        strategies{ name network params }
        filters{ minScore onlyMembers }
        treasuries{ name address network }
        plugins
      } }`,
      { id: SNAPSHOT_SPACE }
    );
    if (!d.space) return null;
    // Drop GraphQL __typename noise and null-only keys to keep the JSON clean.
    return JSON.parse(JSON.stringify(d.space, (k, v) => (k === "__typename" ? undefined : v)));
  } catch {
    return null;
  }
}

/**
 * Snapshot's space schema rejects `null` (and blank URL/handle fields), which is
 * the usual cause of a "wrong space format" error when re-submitting settings
 * read back from the hub. Deep-strip null/undefined and clear empty optional
 * metadata fields before signing.
 */
export function sanitizeSpaceSettings(input: Record<string, unknown>): Record<string, unknown> {
  const prune = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(prune).filter((x) => x !== undefined);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        const pv = prune(val);
        if (pv !== undefined) out[k] = pv;
      }
      return out;
    }
    return v === null ? undefined : v;
  };
  const cleaned = (prune(input) as Record<string, unknown>) ?? {};
  // These must be a valid URL/handle when present — drop them if blank.
  for (const k of ["avatar", "website", "terms", "twitter", "github", "coingecko"]) {
    if (cleaned[k] === "") delete cleaned[k];
  }
  return cleaned;
}

/** Edit space settings (full settings object) — admin or the ENS controller. */
export async function updateSpaceSettings(opts: { walletClient: WalletClient; account: `0x${string}`; settings: Record<string, unknown> }) {
  const from = getAddress(opts.account);
  const settings = sanitizeSpaceSettings(opts.settings);
  const message = { from, space: SNAPSHOT_SPACE, timestamp: BigInt(Math.floor(Date.now() / 1000)), settings: JSON.stringify(settings) };
  const sig = await opts.walletClient.signTypedData({ account: from, domain: SNAP_DOMAIN, types: spaceSettingsTypes, primaryType: "Space", message });
  return postEnvelope(from, sig, spaceSettingsTypes, message);
}

// ── Eligibility hooks ────────────────────────────────────────────────────
const lc = (s: string | undefined) => (s ?? "").toLowerCase();

/** True when `address` is a space admin (can moderate + edit settings). */
export function useIsAdmin(address: string | undefined): boolean {
  const { data: space } = useSpace();
  if (!address || !space) return false;
  return (space.admins ?? []).map(lc).includes(lc(address));
}

/** Whether `address` may create a proposal (privileged, or vp ≥ validation threshold). */
export function useCanPropose(address: string | undefined) {
  const { data: space } = useSpace();
  const { data: vp, isLoading } = useVotingPowerNow(address);
  const threshold = Number((space?.validation?.params as { minScore?: number } | undefined)?.minScore ?? 0);
  if (!address || !space) return { canPropose: false, threshold, vp: vp ?? 0, isLoading };
  const a = lc(address);
  const privileged =
    (space.admins ?? []).map(lc).includes(a) ||
    (space.moderators ?? []).map(lc).includes(a) ||
    (space.members ?? []).map(lc).includes(a);
  return { canPropose: privileged || (vp ?? 0) >= threshold, threshold, vp: vp ?? 0, isLoading };
}
