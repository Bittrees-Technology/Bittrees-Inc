import {createHash} from 'node:crypto';
import {schema,readForumFlags,forumHidden} from './forum-feed.mjs';
import {revisionSchema,FORUM_ZERO,FORUM_FIELDS,readPublicOriginal,resolvePublicText,readForumIndex} from './forum-thread.mjs';
import {redisCommand} from './signed-registry.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function publicSearchArgs(args){
 if(!object(args)||Object.keys(args).some(k=>!['query','limit','offset','cursor','from','to','kind'].includes(k))||typeof args.query!=='string')throw Error('Invalid public forum search');
 const query=args.query.trim(),limit=args.limit===undefined?5:args.limit,offset=args.offset===undefined?0:args.offset;
 if(Array.from(query).length<2||args.query.length>120||/[\u0000-\u001f\u007f]/.test(args.query)||!Number.isInteger(limit)||limit<1||limit>10||!Number.isInteger(offset)||offset<0||offset>500)throw Error('Invalid public forum search');
 if(args.cursor!==undefined&&(typeof args.cursor!=='string'||!args.cursor||args.cursor.length>512||offset!==0))throw Error('Invalid public search cursor');
 if(args.kind!==undefined&&!['all','post','reply'].includes(args.kind))throw Error('Invalid public search kind');
 for(const key of ['from','to'])if(args[key]!==undefined)dateSeconds(args[key]);
 if(args.from!==undefined&&args.to!==undefined&&args.from>args.to)throw Error('Invalid public search date range');
 return {query,limit,offset,...Object.fromEntries(['from','to','kind'].filter(k=>args[k]!==undefined).map(k=>[k,args[k]])),...(args.cursor!==undefined?{cursor:args.cursor}:{})};
}
export function dateSeconds(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Invalid public search date');
 const time=Date.parse(value+'T00:00:00.000Z');
 if(!Number.isFinite(time)||time<0||new Date(time).toISOString().slice(0,10)!==value)throw Error('Invalid public search date');
 return time/1000;
}
export const searchFilters=options=>({from:options.from??null,to:options.to??null,kind:options.kind??'all'});
const UID=/^0x[0-9a-f]{64}$/;
const queryHash=(query,options={})=>{const filters=searchFilters(options);return createHash('sha256').update(query.toLowerCase()+(filters.from||filters.to||filters.kind!=='all'?'\n'+JSON.stringify(filters):'')).digest('hex');};
export function readSearchCursor(cursor,query,now,options={}){
 if(typeof cursor!=='string'||cursor.length>512||!/^[A-Za-z0-9_-]+$/.test(cursor))throw Error('Invalid public search cursor');
 let value;try{const bytes=Buffer.from(cursor,'base64url');if(bytes.toString('base64url')!==cursor)throw Error();value=JSON.parse(bytes.toString('utf8'));}catch{throw Error('Invalid public search cursor');}
 if(!object(value)||Object.keys(value).sort().join(',')!=='asOf,id,q,time,v'||value.v!==1||value.q!==queryHash(query,options)||!Number.isSafeInteger(value.asOf)||value.asOf<0||value.asOf>now||!Number.isSafeInteger(value.time)||value.time<0||value.time>value.asOf||typeof value.id!=='string'||!UID.test(value.id)||value.id==='0x'+'0'.repeat(64))throw Error('Invalid public search cursor');
 return value;
}
function nextSearchCursor(row,query,asOf,options){return Buffer.from(JSON.stringify({v:1,q:queryHash(query,options),asOf,time:row.time,id:row.id.toLowerCase()})).toString('base64url');}
const older=(a,b)=>a.time<b.time||a.time===b.time&&a.id.toLowerCase()<b.id.toLowerCase();
function snippet(text,position){const start=Math.max(0,position-70),end=Math.min(text.length,start+236);return (start?'…':'')+text.slice(start,end)+(end<text.length?'…':'');}
export async function searchPublicForum(args,{request=fetch,command=redisCommand,now=Math.floor(Date.now()/1000)}={}){
 const options=publicSearchArgs(args),{query,limit,offset}=options,position=options.cursor?readSearchCursor(options.cursor,query,now,options):null,asOf=position?.asOf??now,needle=query.toLowerCase(),flags=await readForumFlags(command);
 // UTC end day is exclusive next midnight; clamp future bounds to the creation fence.
 const filters=searchFilters(options),from=options.from===undefined?0:Math.min(asOf+1,dateSeconds(options.from)),before=options.to===undefined?asOf+1:Math.min(asOf+1,dateSeconds(options.to)+86400);
 const after=position?',OR:[{time:{lt:$afterTime}},{time:{equals:$afterTime},id:{lt:$afterId}}]':'';
 const data=await readForumIndex(`query PublicForumSearchCandidates($schema:String!,$asOf:Int!,$from:Int!,$before:Int!,$skip:Int!${position?',$afterTime:Int!,$afterId:String!':''}){candidates:attestations(where:{schemaId:{equals:$schema},revocationTime:{equals:0},time:{gte:$from,lte:$asOf,lt:$before}${after}},orderBy:[{time:desc},{id:desc}],take:26,skip:$skip){${FORUM_FIELDS}}}`,{schema,asOf,from,before,skip:position?0:offset,...(position?{afterTime:position.time,afterId:position.id}:{})},request);
 if(!Array.isArray(data.candidates)||data.candidates.length>26)throw Error('Invalid public candidate page');
 let previous=position;
 for(const row of data.candidates){
  if(!object(row)||typeof row.id!=='string'||!UID.test(row.id.toLowerCase())||row.id.toLowerCase()==='0x'+'0'.repeat(64)||!Number.isSafeInteger(row.time)||row.time<0||row.time>asOf||previous&&!older(row,previous))throw Error('Invalid public history ordering');
  previous=row;
 }
 const page=data.candidates.slice(0,25),seen=new Set(),candidates=[];
 for(const raw of page){
  const reply=raw?.refUID?.toLowerCase()!==FORUM_ZERO,p=readPublicOriginal(raw,reply,now);
  if(!p||p.time<from||p.time>=before||filters.kind==='post'&&reply||filters.kind==='reply'&&!reply||seen.has(p.id)||forumHidden(flags,p.id))continue;seen.add(p.id);candidates.push(p);
 }
 const roots=new Map(candidates.filter(p=>p.refUID===FORUM_ZERO).map(p=>[p.id,p]));
 const parentIds=[...new Set(candidates.filter(p=>p.refUID!==FORUM_ZERO).map(p=>p.refUID))].filter(id=>!roots.has(id));
 if(parentIds.length){
  const parents=await readForumIndex(`query PublicForumSearchParents($ids:[String!]!,$schema:String!,$zero:String!,$now:Int!){parents:attestations(where:{id:{in:$ids},schemaId:{equals:$schema},refUID:{equals:$zero},revocationTime:{equals:0},time:{lte:$now}},take:25){${FORUM_FIELDS}}}`,{ids:parentIds,schema,zero:FORUM_ZERO,now},request);
  if(!Array.isArray(parents.parents)||parents.parents.length>parentIds.length)throw Error('Invalid public parent page');
  for(const raw of parents.parents){const p=readPublicOriginal(raw,false,now);if(p&&p.refUID===FORUM_ZERO&&parentIds.includes(p.id)&&!forumHidden(flags,p.id))roots.set(p.id,p);}
 }
 const eligible=candidates.filter(p=>roots.has(p.refUID===FORUM_ZERO?p.id:p.refUID));
 const ids=[...new Set([...eligible.map(p=>p.id),...roots.keys()])],revisions=[];
 if(ids.length){
  let complete=false;
  for(let skip=0;skip<100;skip+=50){
   const edits=await readForumIndex(`query PublicForumSearchRevisions($schema:String!,$ids:[String!]!,$now:Int!,$skip:Int!){revisions:attestations(where:{schemaId:{equals:$schema},refUID:{in:$ids},revocationTime:{equals:0},time:{lte:$now}},orderBy:[{time:asc},{id:asc}],take:50,skip:$skip){${FORUM_FIELDS}}}`,{schema:revisionSchema,ids,now,skip},request);
   if(!Array.isArray(edits.revisions)||edits.revisions.length>50)throw Error('Invalid public edit history');
   revisions.push(...edits.revisions);if(edits.revisions.length<50){complete=true;break;}
  }
  if(!complete)throw Error('Public search edit history exceeds read limit');
 }
 const latestFlags=await readForumFlags(command),currentRoots=new Map([...roots].map(([id,p])=>[id,resolvePublicText(p,revisions,latestFlags,now)]));
 const eligibleById=new Map(eligible.map(p=>[p.id,p])),items=[];let scanned=0;
 for(const raw of page){
  scanned++;const p=eligibleById.get(typeof raw?.id==='string'?raw.id.toLowerCase():'');if(!p)continue;eligibleById.delete(p.id);
  const postId=p.refUID===FORUM_ZERO?p.id:p.refUID,root=currentRoots.get(postId);if(!root)continue;
  const visible=p.refUID===FORUM_ZERO?root:resolvePublicText(p,revisions,latestFlags,now);if(!visible)continue;
  const text=(visible.title?visible.title+'\n':'')+visible.body,position=text.toLowerCase().indexOf(needle);if(position<0)continue;
  items.push({id:p.id,postId,kind:p.refUID===FORUM_ZERO?'post':'reply',title:root.title,snippet:snippet(text,position),time:visible.time,revisionId:visible.revisionId,editedAt:visible.editedAt,url:`https://gov.bittrees.org/forum/${postId}`});
  if(items.length>=limit)break;
 }
 const next=offset+scanned,more=scanned<page.length||data.candidates.length>25;
 const nextCursor=more&&scanned?nextSearchCursor(page[scanned-1],query,asOf,options):null;
 const result={query,filters,items,offset:position?null:offset,scanned,nextOffset:!position&&more&&next<=500?next:null,nextCursor,asOf,historyExhausted:!more,coverage:'full-public-history',completeArchive:false,scope:'public-forum-search'};
 if(Buffer.byteLength(JSON.stringify(result))>256*1024)throw Error('Public search response limit');
 return result;
}
