import archiveData from "../data/public-proposals.json" with { type: "json" };

export const PUBLIC_PROPOSAL_SPACE = "gov.bittrees.eth";
export const SNAPSHOT_ARCHIVE_ENDPOINT = "https://hub.snapshot.org/graphql";
export const SNAPSHOT_ARCHIVE_FIELDS = "id title body choices start end state scores scores_total votes created quorum type space{id} flagged scores_state ipfs privacy";

export interface PublicSnapshotRecord {
  id: string;
  title: string;
  body: string;
  choices: string[];
  start: number;
  end: number;
  state: string;
  scores: number[];
  scores_total: number;
  votes: number;
  created: number;
  quorum: number;
  type: string;
  space: { id: string };
  flagged: boolean;
  scores_state: string;
  ipfs: string;
  privacy: string;
}

export interface HistoricalProposal {
  publication: "historical-public";
  summary: string;
  sourceUrl: string;
  sourceCheckedAt: string;
  snapshot: PublicSnapshotRecord;
}

export const proposalPath = (id: string) => "/proposals/" + id;
export const snapshotProposalUrl = (id: string) => "https://snapshot.org/#/" + PUBLIC_PROPOSAL_SPACE + "/proposal/" + id;

// This deliberately accepts only completed, publicly readable source records.
// Shutter encrypted votes are eligible only after Snapshot reports final scores.
export function assertPublicSnapshot(value: unknown, expectedId?: string, now = Date.now()): asserts value is PublicSnapshotRecord {
  const p = value as PublicSnapshotRecord | null;
  const fail = (reason: string): never => { throw new Error("Proposal archive: " + reason); };
  if (!p || typeof p !== "object") fail("source record is missing");
  if (!/^0x[a-f0-9]{64}$/.test(p!.id) || (expectedId && p!.id !== expectedId)) fail("unexpected immutable ID");
  if (p!.space?.id !== PUBLIC_PROPOSAL_SPACE) fail("foreign Snapshot space");
  if (p!.flagged !== false) fail("flagged or unverified visibility");
  if (p!.state !== "closed" || p!.scores_state !== "final") fail("voting is not closed and final");
  for (const key of ["created", "start", "end"] as const) {
    if (!Number.isSafeInteger(p![key]) || p![key] <= 0) fail("invalid source date");
  }
  if (!(p!.created <= p!.start && p!.start < p!.end && p!.end * 1000 <= now)) fail("inconsistent voting dates");
  for (const key of ["title", "body", "type", "ipfs"] as const) {
    if (typeof p![key] !== "string" || !p![key].trim()) fail("missing substantive source field " + key);
  }
  if (typeof p!.privacy !== "string") fail("missing vote privacy provenance");
  if (!Array.isArray(p!.choices) || p!.choices.length < 2 || p!.choices.some(c => typeof c !== "string" || !c.trim())) fail("invalid choices");
  if (!Array.isArray(p!.scores) || p!.scores.length !== p!.choices.length || p!.scores.some(s => !Number.isFinite(s) || s < 0)) fail("invalid scores");
  if (!Number.isFinite(p!.scores_total) || p!.scores_total < 0 || Math.abs(p!.scores.reduce((a, b) => a + b, 0) - p!.scores_total) > 0.000001) fail("inconsistent score total");
  if (!Number.isSafeInteger(p!.votes) || p!.votes < 0 || !Number.isFinite(p!.quorum) || p!.quorum < 0) fail("invalid recorded totals");
}

export function validateProposalArchive(value: unknown, now = Date.now()): HistoricalProposal[] {
  if (!Array.isArray(value)) throw new Error("Proposal archive must be an explicit reviewed cohort");
  const ids = new Set<string>();
  for (const entry of value as HistoricalProposal[]) {
    if (entry.publication !== "historical-public") throw new Error("Proposal archive entry is not approved public history");
    assertPublicSnapshot(entry.snapshot, undefined, now);
    if (ids.has(entry.snapshot.id)) throw new Error("Duplicate proposal archive ID");
    ids.add(entry.snapshot.id);
    if (entry.sourceUrl !== snapshotProposalUrl(entry.snapshot.id)) throw new Error("Proposal source URL does not match its ID and space");
    if (typeof entry.summary !== "string" || !entry.summary.trim()) throw new Error("Proposal archive needs its reviewed historical summary");
    const checked = Date.parse(entry.sourceCheckedAt);
    if (!Number.isFinite(checked) || checked > now || checked < entry.snapshot.end * 1000) throw new Error("Invalid proposal source review date");
  }
  return value as HistoricalProposal[];
}

// Preserve a stable field order for source comparison; no arbitrary API data is
// copied into the public artifact by the freshness command.
export function sourceRecord(value: PublicSnapshotRecord): PublicSnapshotRecord {
  const { id, title, body, choices, start, end, state, scores, scores_total, votes, created, quorum, type, space, flagged, scores_state, ipfs, privacy } = value;
  return { id, title, body, choices, start, end, state, scores, scores_total, votes, created, quorum, type, space: { id: space.id }, flagged, scores_state, ipfs, privacy };
}

export function assertArchiveSourceMatches(entry: HistoricalProposal, live: unknown, now = Date.now()): void {
  assertPublicSnapshot(live, entry.snapshot.id, now);
  if (JSON.stringify(sourceRecord(live)) !== JSON.stringify(sourceRecord(entry.snapshot))) {
    throw new Error("Proposal source changed: " + entry.snapshot.id + ". Review the record before publishing; do not refresh it automatically.");
  }
}

export const historicalProposals = validateProposalArchive(archiveData);
export function historicalProposalForId(id: string | undefined): HistoricalProposal | undefined {
  return historicalProposals.find(entry => entry.snapshot.id === id);
}
export function historicalProposalForPath(path: string): HistoricalProposal | undefined {
  return historicalProposals.find(entry => proposalPath(entry.snapshot.id) === path);
}
