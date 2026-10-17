import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOT_AUTHORITY,contributorRoleEligible,requireContributorRoleProof} from '../shared/contributor-role-policy.mjs';
import {authorityDecision} from '../server/authority-client.mjs';
const wallet='0x'+'1'.repeat(40);
const request={project:'gov',subjects:[wallet],authenticatedWallet:wallet};
const proof=(eligible,actions=[])=>({actions,contributorEligibility:{required:true,eligible,rootOverride:false}});
test('active credential is a prerequisite, not a grant',()=>{
 const d=proof(true);assert.equal(requireContributorRoleProof(d,request),d);assert.equal(contributorRoleEligible(d,wallet),true);assert.deepEqual(d.actions,[]);
});
test('missing proof and inactive credentials fail closed for every role action',()=>{
 for(const action of ['tier.partner','tier.junior-partner','tier.associate','project.admin','role.moderator','role.operations']){
  assert.throws(()=>requireContributorRoleProof({actions:[action]},request),/eligibility unavailable/);
  assert.throws(()=>requireContributorRoleProof(proof(false,[action]),request),/credential required/);
 }
 assert.doesNotThrow(()=>requireContributorRoleProof(proof(false),request));
});
test('root override cannot be asserted for a different wallet',()=>{
 const d=proof(false,['project.admin']);d.contributorEligibility.rootOverride=true;
 assert.throws(()=>requireContributorRoleProof(d,request),/root recovery/);
 assert.equal(requireContributorRoleProof(d,{...request,subjects:[ROOT_AUTHORITY],authenticatedWallet:ROOT_AUTHORITY}),d);
 assert.equal(contributorRoleEligible(d,wallet),false);
 assert.throws(()=>requireContributorRoleProof(d,{...request,subjects:[ROOT_AUTHORITY],authenticatedWallet:null}),/root recovery/);
});
test('unenrolled authority never falls back to legacy grants',async()=>{
 await assert.rejects(authorityDecision(wallet,'rooms.manage',{access:async()=>({enrolled:false})}),/No legacy permissions/);
});

test('Gov checks the eligibility inside the signed Roles decision',async()=>{
 const {generateKeyPairSync,sign}=await import('node:crypto');
 const {ecosystemAccess}=await import('../server/ecosystem-client.mjs');
 const {ecosystemDecisionMessage}=await import('../shared/ecosystem-authority.mjs');
 const keys=generateKeyPairSync('ed25519');
 const env={ROLES_ECOSYSTEM_REQUEST_PRIVATE_KEY:keys.privateKey.export({type:'pkcs8',format:'pem'}),ROLES_ECOSYSTEM_DECISION_PUBLIC_KEY:keys.publicKey.export({type:'spki',format:'pem'})};
 let eligibility={required:true,eligible:true,rootOverride:false},actions=['tier.partner'],tamper=false;
 const fetcher=async(_url,options)=>{
  const {request}=JSON.parse(options.body),now=Date.now();
  const decision={version:1,issuer:'https://roles.bittrees.org',audience:request.source,request,checkedAt:now,expiresAt:now+5000,requiresPrivateOwnership:true,authoritative:true,enrolled:true,actions,...(eligibility?{contributorEligibility:eligibility}:{})};
  const signature=sign(null,Buffer.from(ecosystemDecisionMessage(decision)),keys.privateKey).toString('base64');
  if(tamper)decision.contributorEligibility={required:true,eligible:true,rootOverride:false};
  return {ok:true,json:async()=>({decision,signature})};
 };
 const get=()=>ecosystemAccess('gov',[wallet],{env,fetcher,authenticatedWallet:wallet});
 assert.deepEqual((await get()).actions,['tier.partner']);
 eligibility={required:true,eligible:false,rootOverride:false};
 await assert.rejects(get(),/credential required/);
 tamper=true;await assert.rejects(get(),/decision rejected/);tamper=false;
 actions=[];assert.deepEqual((await get()).actions,[]);
 eligibility=null;await assert.rejects(get(),/eligibility unavailable/);
});
