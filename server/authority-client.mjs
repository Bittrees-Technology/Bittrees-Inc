import {govPermissions} from '../shared/gov-permissions.mjs';
import {ecosystemAccess} from './ecosystem-client.mjs';
export async function authorityDecision(actor,action,{access=ecosystemAccess}={}){
 const shared=await access('gov',[actor.toLowerCase()],{authenticatedWallet:actor.toLowerCase()});
 if(!shared.enrolled)throw Object.assign(Error('Gov authority is unavailable. No legacy permissions were used.'),{status:503});
 const allowed=govPermissions(shared).includes(action);
 return {allowed,configured:true,centralized:true,expiresAt:new Date(shared.expiresAt).toISOString(),reason:allowed?'Approved by Roles':'A current contributor credential and an approved Gov role are required',actions:shared.actions};
}
