import { useIsAdmin } from "./snapshot";
import { useCommunity, useUserRoles } from "./community";

/**
 * Admin-console access tiers.
 *  - "full"       — every tab + write access: Snapshot space admins, the standing
 *                   super-admin address, or a Partner / Junior Partner / Associate role.
 *  - "moderation" — only the Moderation tab: holders of the Moderator role.
 *  - "none"       — no admin access.
 *
 * The same tiers are enforced server-side in api/community.js + api/rooms.js (and
 * read live from the roles registry), so the UI gating matches what actually saves.
 * NOTE: Snapshot Space-settings writes still require a real Snapshot space admin —
 * that's enforced by Snapshot's sequencer, outside this app.
 */
export const SUPER_ADMIN = "0xe5350d96fc3161bf5c385843ec5ee24e8b465b2f"; // always full access
const FULL_ROLE_RE = /^(partner|junior partner|associate)$/i;
const MOD_ROLE_RE = /^(moderator|mod)$/i;

export type AdminLevel = "full" | "moderation" | "none";

export function useAdminAccess(address?: string): AdminLevel {
  const isSpaceAdmin = useIsAdmin(address);
  const roles = useUserRoles(address);
  const { data: authority } = useCommunity();
  if (!address) return "none";
  if (authority?.authorizationMode === "root-policy") return address.toLowerCase() === "0x1b6c450fadb7c77191f152473fc2f79dc515fa77" ? "full" : "none";
  if (isSpaceAdmin || address.toLowerCase() === SUPER_ADMIN || roles.some((r) => FULL_ROLE_RE.test(r.label))) return "full";
  if (roles.some((r) => MOD_ROLE_RE.test(r.label))) return "moderation";
  return "none";
}

/** Roles allowed to PROPOSE a room (pending admin approval): Operations + the tier roles. */
const PROPOSE_ROLE_RE = /^(operations|partner|junior partner|associate)$/i;

/** Whether `address` may propose a community room (a proposer role, or a full admin). */
export function useCanProposeRoom(address?: string): boolean {
  const level = useAdminAccess(address);
  const roles = useUserRoles(address);
  if (!address) return false;
  if (level === "full") return true;
  return roles.some((r) => PROPOSE_ROLE_RE.test(r.label));
}
