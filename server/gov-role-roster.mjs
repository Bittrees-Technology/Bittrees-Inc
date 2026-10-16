import {randomUUID,sign} from 'node:crypto';
import {ECOSYSTEM_ENDPOINT,ecosystemRequestMessage} from '../shared/ecosystem-authority.mjs';
export async function govRoleRoster(wallet,{env=process.env,fetcher=fetch}={}){
 if(!/^0x[a-f0-9]{40}$/.test(wallet||'')||!env.ROLES_ECOSYSTEM_REQUEST_PRIVATE_KEY)throw Object.assign(Error('Verified wallet and Roles connection required'),{status:503});
 const request={version:1,project:'gov',source:'gov.bittrees.org',audience:ECOSYSTEM_ENDPOINT,subjects:[wallet],authenticatedWallet:wallet,verifiedEmails:[],issuedAt:Date.now(),requestId:randomUUID()};
 const signature=message=>sign(null,Buffer.from(message),env.ROLES_ECOSYSTEM_REQUEST_PRIVATE_KEY).toString('base64');
 const message=ecosystemRequestMessage(request);
 const r=await fetcher('https://roles.bittrees.org/api/authority/gov-role-roster',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({request,signature:signature(message),rosterSignature:signature('Bittrees Gov role roster v1\n'+message)}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Object.assign(Error('Gov role records are unavailable. Retry shortly.'),{status:503});
 const data=await r.json();if(data.project!=='gov'||!Array.isArray(data.roles)||!Array.isArray(data.assignments)||!Array.isArray(data.members))throw Object.assign(Error('Invalid Gov role response'),{status:503});return data;
}
