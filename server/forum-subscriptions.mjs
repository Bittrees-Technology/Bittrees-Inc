import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {redisCommand} from './signed-registry.mjs';
import {forumFeed} from './forum-feed.mjs';
const prefix='bittrees:forum-email:v1:';
const hash=s=>createHash('sha256').update(s).digest('hex');
const token=()=>randomBytes(32).toString('hex');
export const emailReady=()=>!!(process.env.FORUM_RESEND_API_KEY&&process.env.FORUM_EMAIL_FROM&&process.env.CRON_SECRET);
export const cronAuthorized=value=>{const expected=`Bearer ${process.env.CRON_SECRET||''}`;return !!process.env.CRON_SECRET && typeof value==='string' && Buffer.byteLength(value)===Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(value),Buffer.from(expected));};
export function createSubscriptions({command=redisCommand, request=fetch, now=()=>Date.now(), feed=forumFeed, ready=emailReady}={}){
 const get=async key=>{const v=(await command(['GET',prefix+key])).result;return v?JSON.parse(v):null;};
 const set=async(key,v,ttl)=>command(['SET',prefix+key,JSON.stringify(v),...(ttl?['EX',ttl]:[])]);
 async function limit(key,count,ttl){const n=(await command(['EVAL',"local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end;return n",1,prefix+'rate:'+key,ttl])).result;return n<=count;}
 async function send(to,subject,text,id){
  const r=await request('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${process.env.FORUM_RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify({from:process.env.FORUM_EMAIL_FROM,to:[to],subject,text})});
  const result=await r.json();if(!r.ok||!result.id)throw Error('Email delivery unavailable');return result.id;
 }
 async function subscribe(email,ip){
  if(!ready())throw Error('Email subscriptions are not configured yet.');
  if(typeof email!=='string'||email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email)||/[\r\n]/.test(email))throw Object.assign(Error('Enter a valid email address.'),{status:400});
  email=email.trim().toLowerCase();const id=hash(email);
  if(!await limit('ip:'+hash(ip),3,3600)||!await limit('address:'+id,1,3600)||!await limit('global',100,86400))return;
  // Generic response avoids disclosing whether an address is already subscribed.
  if(await get('subscriber:'+id))return;
  const secret=token(),digest=hash(secret),created=now();
  await set('token:'+digest,{id,email,created},172800);
  const link=`https://gov.bittrees.org/forum#forum-email=${secret}`;
  await send(email,'Confirm your Bittrees Forum subscription',`Confirm your subscription to a daily email digest of new Governance discussions:\n\n${link}\n\nOpen the link and select Confirm subscription. The link expires in 24 hours. If you did not request this, ignore this email.`, 'forum-confirm/'+digest);
 }
 async function manage(secret,action){
  if(!/^[\da-f]{64}$/.test(secret||''))throw Object.assign(Error('Invalid subscription link.'),{status:400});
  const digest=hash(secret),record=await get('token:'+digest);
  if(!record)throw Object.assign(Error('This link has expired. Request a new subscription from the forum.'),{status:400});
  if(action==='unsubscribe'){
    // Unsubscribe is authoritative even if a send worker has already acquired its lock.
    await command(['EVAL',`redis.call('DEL',KEYS[1],KEYS[2]);redis.call('SREM',KEYS[3],ARGV[1]);redis.call('SET',KEYS[4],ARGV[2],'EX',86400);return 1`,4,prefix+'subscriber:'+record.id,prefix+'job:'+record.id,prefix+'subscribers',prefix+'token:'+digest,record.id,JSON.stringify({id:record.id,unsubscribed:true})]);
    return {status:'unsubscribed'};
  }
  if(action!=='confirm')throw Object.assign(Error('Invalid action.'),{status:400});
  if(record.unsubscribed||now()-record.created>86400000)throw Object.assign(Error('Confirmation link expired. Please subscribe again.'),{status:400});
  const active={email:record.email,cursor:Math.floor(now()/1000),token:secret,created:now()};
  // A stale token cannot replace an active subscriber or rewind their delivery cursor.
  await command(['EVAL',`if redis.call('EXISTS',KEYS[1])==0 then redis.call('SET',KEYS[1],ARGV[1]);redis.call('SADD',KEYS[2],ARGV[2]);end;redis.call('PERSIST',KEYS[3]);return 1`,3,prefix+'subscriber:'+record.id,prefix+'subscribers',prefix+'token:'+digest,JSON.stringify(active),record.id]);
  return {status:'subscribed'};
 }
 async function deliver(){
  if(!ready())throw Error('Email subscriptions are not configured yet.');
  const lock=token();if((await command(['SET',prefix+'worker',lock,'NX','EX',300])).result!=='OK')return {busy:true};
  let sent=0,blocked=0;const started=now();
  try{
   const ids=(await command(['SMEMBERS',prefix+'subscribers'])).result||[];
   const until=Math.floor(now()/1000)-60;
   for(const id of ids){
    if(sent>=30||now()-started>240000)break;
    const sub=await get('subscriber:'+id);if(!sub||sub.nextCheck>now())continue;
    let job=await get('job:'+id);
    if(job&&job.owner!==sub.token){await command(['DEL',prefix+'job:'+id]);job=null;}
    if(!job){
     const seen=new Set((sub.delivered||[]).map(p=>p.id));
     const items=(await feed({since:Math.max(Math.floor(sub.created/1000),sub.cursor-86400),now:until,limit:0,command,request})).filter(p=>!seen.has(p.id));
     if(!items.length){await command(['EVAL',`local s=redis.call('GET',KEYS[1]);if s and cjson.decode(s).token==ARGV[1] then local v=cjson.decode(s);v.cursor=math.max(v.cursor,tonumber(ARGV[2]));v.nextCheck=tonumber(ARGV[3]);redis.call('SET',KEYS[1],cjson.encode(v));end;return 1`,1,prefix+'subscriber:'+id,sub.token,until,now()+86400000]);continue;}
     const links=items.map(p=>`${p.title}\n${p.url}`).join('\n\n');
     job={owner:sub.token,created:now(),cursor:until,items:items.map(p=>p.id),delivered:[...(sub.delivered||[]),...items.map(p=>({id:p.id,time:p.time}))].filter(p=>p.time>=until-86400),id:token(),text:`New discussions in Bittrees Governance\n\n${links}\n\nRead the latest versions and replies on the forum.\n\nUnsubscribe: https://gov.bittrees.org/forum#forum-email=${sub.token}`};
     const claimed=(await command(['EVAL',`if redis.call('GET',KEYS[2])~=ARGV[1] then return false end;local j=redis.call('GET',KEYS[1]);if j then return j end;redis.call('SET',KEYS[1],ARGV[2]);return ARGV[2]`,2,prefix+'job:'+id,prefix+'worker',lock,JSON.stringify(job)])).result;
     if(!claimed)throw Error('Delivery lease expired');job=JSON.parse(claimed);
    }
    // Never retry an uncertain send beyond Resend's 24-hour deduplication window.
    if(now()-job.created>23*3600000){blocked++;continue;}
    if((await get('subscriber:'+id))?.token!==job.owner)continue;
    const flagRaw=(await command(['GET','bittrees:flags'])).result;const flags=flagRaw?JSON.parse(flagRaw):{};
    if(!flags||typeof flags!=='object'||Array.isArray(flags))throw Error('Moderation unavailable');
    if((job.items||[]).some(id=>flags[id]?.mod==='removed'||(flags[id]?.mod!=='approved'&&new Set(flags[id]?.by||[]).size>=2))){blocked++;continue;}
    if((await command(['GET',prefix+'worker'])).result!==lock)throw Error('Delivery lease expired');
    await send(sub.email,'New discussions · Bittrees Forum',job.text,'forum-digest/'+job.id);
    await command(['EVAL',`local s=redis.call('GET',KEYS[1]);if s and cjson.decode(s).token==ARGV[1] then local v=cjson.decode(s);v.cursor=tonumber(ARGV[2]);v.nextCheck=tonumber(ARGV[3]);v.delivered=cjson.decode(ARGV[4]);redis.call('SET',KEYS[1],cjson.encode(v));end;redis.call('DEL',KEYS[2]);return 1`,2,prefix+'subscriber:'+id,prefix+'job:'+id,job.owner,job.cursor,now()+86400000,JSON.stringify(job.delivered)]);
    sent++;
   }
   return {sent,blocked};
  }finally{await command(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0",1,prefix+'worker',lock]);}
 }
 return {subscribe,manage,deliver};
}
