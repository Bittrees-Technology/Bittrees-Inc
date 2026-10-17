// Presentation only. Protected actions still use the current signed decision.
export function currentRegistryRoles(registry,wallet,now=Date.now()){
 if(!registry||registry.project!=='gov'||registry.status!=='current'||registry.wallet!==wallet?.toLowerCase()||!Number.isSafeInteger(registry.checkedAt)||!Number.isSafeInteger(registry.validUntil)||registry.checkedAt>now+1000||registry.validUntil<=now||registry.validUntil-registry.checkedAt>5000)return [];
 return [...(registry.superadmin===true?['Superadmin']:[]),...(registry.admin===true?['Admin']:[])];
}
