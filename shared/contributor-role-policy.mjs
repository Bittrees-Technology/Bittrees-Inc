// Roles signs this eligibility result with the authority decision. An NFT is
// a prerequisite, never a role grant. Root recovery still requires root authority.
export const ROOT_AUTHORITY='0x1b6c450fadb7c77191f152473fc2f79dc515fa77';
export function contributorRoleEligible(decision,wallet){
 const eligibility=decision?.contributorEligibility;
 if(!eligibility||eligibility.required!==true)return false;
 if(eligibility.rootOverride===true)return wallet?.toLowerCase()===ROOT_AUTHORITY;
 return eligibility.eligible===true;
}
export function requireContributorRoleProof(decision,request){
 if(request.project!=='gov')return decision;
 const e=decision.contributorEligibility;
 if(!e||e.required!==true||typeof e.eligible!=='boolean'||typeof e.rootOverride!=='boolean')throw Error('Contributor credential eligibility unavailable');
 const wallet=request.authenticatedWallet||(request.subjects.length===1?request.subjects[0]:null);
 if(e.rootOverride&&wallet?.toLowerCase()!==ROOT_AUTHORITY)throw Error('Invalid root recovery authority');
 if(!contributorRoleEligible(decision,wallet)&&decision.actions.length)throw Error('Contributor credential required for Gov authority');
 return decision;
}
