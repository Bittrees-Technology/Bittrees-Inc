export const CHAT_URL = "https://chat.bittrees.org";

/** Family + governance links and small formatting helpers for the gov app. */

/** The Bittrees family of sites — surfaced in the header + footer. */
export const FAMILY = [
  { label: "bittrees.org", href: "https://bittrees.org" },
  { label: "Research", href: "https://research.bittrees.org" },
  { label: "Capital", href: "https://capital.bittrees.org" },
  { label: "Index", href: "https://index.bittrees.org" },
] as const;

/**
 * Governance + community resources. Snapshot, the Inc forum, X, and Telegram are
 * confirmed from the legacy gov site; the wiki/handbook is carried over and
 * marked for confirmation.
 */
export const GOV_LINKS = {
  snapshot: "https://snapshot.org/#/gov.bittrees.eth",
  forum: "https://metaforo.io/g/bittreesinc",
  twitter: "https://x.com/bittrees_",
  telegram: "https://t.me/BittreesCommunity",
  wiki: "https://bittrees.eth.limo/binc/", // TODO(confirm): canonical wiki/handbook URL
} as const;

/** Bittrees, Inc. metaverse headquarters — a parcel in the Voxels world. */
export const METAVERSE_HQ = {
  world: "Voxels",
  coords: "429W, 182S",
  url: "https://www.voxels.com/play?coords=W@429W,182S",
} as const;

/**
 * Internal route paths — single source of truth for nav + cross-links.
 * `forum` and `contribute` are wired in the next wave (pending the persistence
 * + messenger decisions).
 */
export const ROUTES = {
  overview: "/",
  proposals: "/proposals",
  newProposal: "/proposals/new",
  admin: "/admin",
  structure: "/structure",
  mint: "/mint",
  forum: "/forum",
  messenger: "/messenger",
  contribute: "/contribute",
  vision: "/vision",
  codeOfConduct: "/code-of-conduct",
  metaverse: "/hq",
  chirpy: "/chirpy",
} as const;

export function etherscanAddress(addr: string): string {
  return `https://etherscan.io/address/${addr}`;
}

export function shortAddress(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/** Compact number formatting for voting power / scores. */
export function fmtNumber(n: number | undefined, maxFrac = 2): string {
  if (n === undefined || !isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
}

/** "in 3 days" / "5 days ago" from a unix-seconds timestamp. */
export function relativeTime(unixSeconds: number): string {
  const diff = unixSeconds * 1000 - Date.now();
  const abs = Math.abs(diff);
  const day = 86_400_000;
  const hour = 3_600_000;
  const fmt = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  let phrase: string;
  if (abs >= day) phrase = fmt(Math.round(abs / day), "day");
  else if (abs >= hour) phrase = fmt(Math.round(abs / hour), "hour");
  else phrase = fmt(Math.max(1, Math.round(abs / 60_000)), "min");
  return diff >= 0 ? `in ${phrase}` : `${phrase} ago`;
}
