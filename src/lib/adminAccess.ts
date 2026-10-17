import {useAuthorityAccess} from './authorityAccess';
import { useIsAdmin } from "./snapshot";
import { useUserRoles } from "./community";

/** Current signed permissions determine UI access after authority cutover.
 * Legacy fallbacks apply only when the server explicitly reports no shared policy.
 * Partner membership never appoints a site administrator under shared authority.
 * Snapshot retains its own authorization for space-settings writes.
 */
export const SUPER_ADMIN = "0xe5350d96fc3161bf5c385843ec5ee24e8b465b2f"; // always full access
const FULL_ROLE_RE = /^(partner|junior partner|associate)$/i;
const MOD_ROLE_RE = /^(moderator|mod)$/i;

export type AdminLevel = "full" | "moderation" | "none";

export function useAdminAccess(address?: string): AdminLevel {
  const isSpaceAdmin = useIsAdmin(address);
  const roles = useUserRoles(address);
  const policy=useAuthorityAccess(address);
  if (!address) return "none";
  {
    if(policy.isError || !policy.data || (policy.data.expiresAt !== undefined && policy.data.expiresAt <= Date.now()))return "none";
    if(policy.data.configured)return policy.data.permissions.includes('community.roles.manage')||policy.data.permissions.includes('rooms.manage')?'full':policy.data.permissions.includes('community.moderation.manage')?'moderation':'none';
  }
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
  const policy=useAuthorityAccess(address);
  if (!address) return false;
  if(policy.isError || !policy.data || (policy.data.expiresAt !== undefined && policy.data.expiresAt <= Date.now()))return false;
  if(policy.data.configured)return policy.data.permissions.includes("rooms.propose");
  if(policy.isError)return false;
  if (level === "full") return true;
  return roles.some((r) => PROPOSE_ROLE_RE.test(r.label));
}
