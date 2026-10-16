import {test} from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync} from 'node:crypto';
import {govRoleRoster} from '../gov-role-roster.mjs';import {verifyEcosystemSignature,ecosystemRequestMessage} from '../../shared/ecosystem-authority.mjs';
test('Gov roster proxy signs only verified wallet with dedicated purpose',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ed25519'),env={ROLES_ECOSYSTEM_REQUEST_PRIVATE_KEY:privateKey.export({type:'pkcs8',format:'pem'})},pem=publicKey.export({type:'spki',format:'pem'}),wallet='0x'+'1'.repeat(40);
 const fetcher=async(url,options)=>{assert.equal(url,'https://roles.bittrees.org/api/authority/gov-role-roster');assert.equal(options.redirect,'error');const b=JSON.parse(options.body);assert.deepEqual(b.request.subjects,[wallet]);assert.equal(b.request.authenticatedWallet,wallet);assert.ok(verifyEcosystemSignature(ecosystemRequestMessage(b.request),b.signature,pem));assert.ok(verifyEcosystemSignature('Bittrees Gov role roster v1\n'+ecosystemRequestMessage(b.request),b.rosterSignature,pem));return {ok:true,json:async()=>({project:'gov',roles:[],assignments:[],members:[]})};};
 assert.equal((await govRoleRoster(wallet,{env,fetcher})).project,'gov');await assert.rejects(govRoleRoster('not-wallet',{env,fetcher}),/Verified wallet/);
 await assert.rejects(govRoleRoster(wallet,{env,fetcher:async()=>({ok:false})}),/unavailable/);
});
