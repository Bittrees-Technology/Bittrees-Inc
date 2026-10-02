import {encodePacked, keccak256} from 'viem';
import {redisCommand} from './signed-registry.mjs';
export const schema = keccak256(encodePacked(['string','address','bool'],['string community,string title,string body','0x0000000000000000000000000000000000000000',true]));
const zero='0x'+'0'.repeat(64);
export async function forumFeed({since=0, request=fetch, command=redisCommand, now=Math.floor(Date.now()/1000), limit=100}={}) {
  // Fail closed if moderation cannot be read; never mail hidden content on a storage outage.
  const raw=(await command(['GET','bittrees:flags'])).result;
  const flags=raw?JSON.parse(raw):{};
  if(!flags || typeof flags!=='object' || Array.isArray(flags))throw Error('Moderation unavailable');
  const items=[];
  let complete=false;
  for(let skip=0;skip<5000;skip+=100){
    const response=await request('https://base.easscan.org/graphql',{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(10000),body:JSON.stringify({query:`query ForumUpdates($schema:String!,$zero:String!,$since:Int!,$until:Int!,$skip:Int!){attestations(where:{schemaId:{equals:$schema},refUID:{equals:$zero},revocationTime:{equals:0},time:{gte:$since,lte:$until}},orderBy:[{time:desc},{id:desc}],take:100,skip:$skip){id schemaId refUID attester time expirationTime revocationTime decodedDataJson}}`,variables:{schema,zero,since,until:now,skip}})});
    const data=await response.json();
    if(!response.ok || data.errors || !Array.isArray(data.data?.attestations))throw Error('Forum unavailable');
    for(const row of data.data.attestations){
      if(row.schemaId!==schema || row.refUID!==zero || row.revocationTime!==0 || (row.expirationTime!==0&&row.expirationTime<=now) || !/^0x[\da-f]{64}$/i.test(row.id) || !Number.isSafeInteger(row.time) || row.time<since || row.time>now)continue;
      const mod=flags[row.id];
      if(mod?.mod==='removed' || (mod?.mod!=='approved'&&new Set(mod?.by||[]).size>=2))continue;
      let fields;try{fields=Object.fromEntries(JSON.parse(row.decodedDataJson).map(f=>[f.name,f.value.value]));}catch{continue;}
      if(fields.community!=='bittrees-inc' || typeof fields.title!=='string' || !fields.title.trim())continue;
      // Link-only notices avoid copying immutable or subsequently edited post bodies into mail.
      items.push({id:row.id,title:fields.title.slice(0,120),time:row.time,url:`https://gov.bittrees.org/forum/${row.id}`});
    }
    if(data.data.attestations.length<100){complete=true;break;}
    if(limit && items.length>=limit){complete=true;break;}
  }
  if(!complete)throw Error('Forum update range is too large');
  return items.sort((a,b)=>b.time-a.time||b.id.localeCompare(a.id)).slice(0,limit||undefined);
}
