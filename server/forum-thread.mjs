import {encodePacked,keccak256} from 'viem';
import {schema,readForumFlags,forumHidden} from './forum-feed.mjs';
import {redisCommand} from './signed-registry.mjs';
export const revisionSchema=keccak256(encodePacked(['string','address','bool'],['uint8 version,string community,string title,string body','0x0000000000000000000000000000000000000000',true]));
const ZERO='0x'+'0'.repeat(64),UID=/^0x[\da-f]{64}$/i,ADDRESS=/^0x[\da-f]{40}$/i;
const FIELDS='id attester refUID schemaId revocationTime expirationTime time decodedDataJson';
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function active(row,expected,now){return object(row)&&UID.test(row.id)&&UID.test(row.refUID)&&ADDRESS.test(row.attester)&&same(row.schemaId,expected)&&row.revocationTime===0&&Number.isSafeInteger(row.expirationTime)&&row.expirationTime>=0&&(row.expirationTime===0||row.expirationTime>now)&&Number.isSafeInteger(row.time)&&row.time>=0&&row.time<=now;}
function fields(row){
 try{
  if(typeof row.decodedDataJson!=='string'||Buffer.byteLength(row.decodedDataJson)>200000)return null;
  const data=JSON.parse(row.decodedDataJson);if(!Array.isArray(data)||data.length>8)return null;
  const out={};for(const field of data){if(!object(field)||typeof field.name!=='string'||!['community','title','body','version'].includes(field.name)||Object.hasOwn(out,field.name))return null;out[field.name]=field.value?.value;}
  return out;
 }catch{return null;}
}
function textValid(f,reply){return f&&f.community==='bittrees-inc'&&typeof f.title==='string'&&f.title.length<=120&&(reply?f.title==='':!!f.title.trim())&&typeof f.body==='string'&&!!f.body.trim()&&f.body.length<=20000;}
function original(row,reply,now){if(!active(row,schema,now))return null;const f=fields(row);if(!textValid(f,reply))return null;return {...row,id:row.id.toLowerCase(),attester:row.attester.toLowerCase(),refUID:row.refUID.toLowerCase(),title:f.title,body:f.body};}
function current(post,revisions,flags,now){
 let latest=null;
 for(const r of revisions){
  if(!active(r,revisionSchema,now)||!same(r.refUID,post.id)||!same(r.attester,post.attester)||r.time<post.time)continue;
  const f=fields(r);if(!textValid(f,post.refUID!==ZERO)||!(f.version===1||f.version==='1'))continue;
  if(!latest||r.time>latest.time||r.time===latest.time&&r.id.toLowerCase()>latest.id.toLowerCase())latest={...r,...f};
 }
 if(forumHidden(flags,post.id)||latest&&forumHidden(flags,latest.id))return null;
 return {id:post.id,title:latest?.title??post.title,body:latest?.body??post.body,time:post.time,revisionId:latest?.id.toLowerCase()??post.id,editedAt:latest?.time??null};
}
// Fixed public index only. Bound the response before decoding; never follow user-supplied URLs.
async function indexRead(query,variables,request){
 const response=await request('https://base.easscan.org/graphql',{method:'POST',headers:{'content-type':'application/json'},redirect:'error',signal:AbortSignal.timeout(6000),body:JSON.stringify({query,variables})});
 if(!response.ok)throw Error('Forum index unavailable');
 let data;
 if(response.body?.getReader){
  const reader=response.body.getReader();const parts=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8*1024*1024){await reader.cancel();throw Error('Forum response limit');}parts.push(Buffer.from(value));}data=JSON.parse(Buffer.concat(parts).toString('utf8'));}finally{reader.releaseLock();}
 }else{data=await response.json();if(Buffer.byteLength(JSON.stringify(data))>8*1024*1024)throw Error('Forum response limit');}
 if(!object(data)||data.errors!==undefined&&(!Array.isArray(data.errors)||data.errors.length>0)||!object(data.data))throw Error('Forum index unavailable');return data.data;
}
export async function publicForumThread({postId,replyLimit=5,replyOffset=0},{request=fetch,command=redisCommand,now=Math.floor(Date.now()/1000)}={}){
 if(typeof postId!=='string'||!UID.test(postId)||same(postId,ZERO)||!Number.isInteger(replyLimit)||replyLimit<1||replyLimit>10||!Number.isInteger(replyOffset)||replyOffset<0||replyOffset>100)throw Error('Invalid public thread request');
 postId=postId.toLowerCase();
 const flags=await readForumFlags(command);
 if(forumHidden(flags,postId))throw Error('Public thread unavailable');
 const data=await indexRead(`query PublicThread($id:String!,$schema:String!,$now:Int!,$take:Int!,$skip:Int!){root:attestation(where:{id:$id}){${FIELDS}} replies:attestations(where:{schemaId:{equals:$schema},refUID:{equals:$id},revocationTime:{equals:0},time:{lte:$now}},orderBy:[{time:asc},{id:asc}],take:$take,skip:$skip){${FIELDS}}}`,{id:postId,schema,now,take:replyLimit+1,skip:replyOffset},request);
 if(!Array.isArray(data.replies)||data.replies.length>replyLimit+1)throw Error('Invalid public reply page');
 const root=original(data.root,false,now);
 if(!root||root.id!==postId||root.refUID!==ZERO)throw Error('Public thread unavailable');
 const candidates=data.replies.slice(0,replyLimit),seen=new Set([postId]);
 const replies=candidates.map(r=>original(r,true,now)).filter(r=>{if(!r||r.refUID!==postId||seen.has(r.id)||forumHidden(flags,r.id))return false;seen.add(r.id);return true;});
 const posts=[root,...replies],ids=posts.map(p=>p.id),authors=[...new Set(posts.map(p=>p.attester))],revisions=[];
 let complete=false;
 for(let skip=0;skip<150;skip+=50){
  const page=await indexRead(`query PublicThreadRevisions($schema:String!,$ids:[String!]!,$authors:[String!]!,$now:Int!,$skip:Int!){revisions:attestations(where:{schemaId:{equals:$schema},refUID:{in:$ids},attester:{in:$authors},revocationTime:{equals:0},time:{lte:$now}},orderBy:[{time:asc},{id:asc}],take:50,skip:$skip){${FIELDS}}}`,{schema:revisionSchema,ids,authors,now,skip},request);
  if(!Array.isArray(page.revisions)||page.revisions.length>50)throw Error('Invalid public edit history');
  revisions.push(...page.revisions);if(page.revisions.length<50){complete=true;break;}
 }
 if(!complete)throw Error('Public edit history exceeds read limit');
 const latestFlags=await readForumFlags(command);
 const project=p=>({...p,url:`https://gov.bittrees.org/forum/${postId}`});
 const resolvedRoot=current(root,revisions,latestFlags,now);if(!resolvedRoot)throw Error('Public thread unavailable');
 const result={root:project(resolvedRoot),replies:replies.map(r=>current(r,revisions,latestFlags,now)).filter(Boolean).map(project),replyOffset,nextReplyOffset:data.replies.length>replyLimit&&replyOffset+replyLimit<=100?replyOffset+replyLimit:null,completeThread:false,contentFormat:'markdown',scope:'public-forum-thread'};
 if(Buffer.byteLength(JSON.stringify(result))>1024*1024)throw Error('Public thread response limit');
 return result;
}
