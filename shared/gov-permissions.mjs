// Project-local projection of current signed Roles decisions. Role labels never
// appoint an administrator; new hierarchy appointments require approved policy.
export const GOV_ACTIONS=Object.freeze(['community.roles.manage','community.moderation.manage','rooms.manage','rooms.propose']);
export function govPermissions(decision,now=Date.now()) {
 if(!decision?.authoritative || !Number.isFinite(decision.expiresAt) || decision.expiresAt<=now)return [];
 const actions=new Set(decision.actions||[]),permissions=new Set(GOV_ACTIONS.filter(a=>actions.has(a)));
 const admin=['project.admin','role.admin'].some(a=>actions.has(a));
 if(admin)for(const a of GOV_ACTIONS)permissions.add(a);
 if(actions.has('role.moderator'))permissions.add('community.moderation.manage');
 if(['role.operations','role.steward','tier.partner','tier.junior-partner','tier.associate'].some(a=>actions.has(a)))permissions.add('rooms.propose');
 return GOV_ACTIONS.filter(a=>permissions.has(a));
}
export function govRoleLabels(actions=[]) {
 const names={'tier.partner':'Partner','tier.junior-partner':'Junior Partner','tier.associate':'Associate','project.admin':'Project administrator (existing)','role.admin':'Admin','role.moderator':'Moderator','role.operations':'Operations'};
 return [...new Set(actions.filter(a=>Object.hasOwn(names,a)).map(a=>names[a]))].map(label=>({label}));
}
