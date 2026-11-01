import test from 'node:test';import assert from 'node:assert/strict';
import {searchPublicForum,publicSearchArgs,readSearchCursor} from '../server/forum-search.mjs';
import {schema} from '../server/forum-feed.mjs';import {revisionSchema} from '../server/forum-thread.mjs';
const uid=n=>'0x'+n.toString(16).padStart(64,'0'),wallet='0x'+'a'.repeat(40),zero=uid(0);
const encoded=f=>JSON.stringify(Object.entries(f).map(([name,value])=>({name,value:{value}})));
const post=(n=1,f={},r={})=>({id:uid(n),attester:wallet,refUID:zero,schemaId:schema,time:10,expirationTime:0,revocationTime:0,decodedDataJson:encoded({community:'bittrees-inc',title:'Public topic',body:'Public text',...f}),...r});
const edit=(n=100,f={},r={})=>post(n,{version:1,title:'Current title',body:'Current body',...f},{refUID:uid(1),schemaId:revisionSchema,time:20,...r});
function harness({candidates=[post()],parents=[],revisions=[],flags={},finalFlags=flags,paged=false}={}){
 const calls=[];let commands=0;
 const command=async args=>{assert.deepEqual(args,['GET','bittrees:flags']);return {result:JSON.stringify(++commands===1?flags:finalFlags)};};
 const request=async(url,options)=>{assert.equal(url,'https://base.easscan.org/graphql');assert.equal(options.redirect,'error');const {query,variables}=JSON.parse(options.body);calls.push({query,variables});let data;
  if(query.includes('SearchParents'))data={parents};else if(query.includes('SearchRevisions'))data={revisions};else {const ordered=[...candidates].sort((a,b)=>b.time-a.time||b.id.toLowerCase().localeCompare(a.id.toLowerCase()));const selected=paged?ordered.filter(r=>r.time<=variables.asOf&&(variables.afterTime===undefined||r.time<variables.afterTime||r.time===variables.afterTime&&r.id.toLowerCase()<variables.afterId)):ordered;data={candidates:paged?selected.slice(variables.skip,variables.skip+26):selected};}
  return {ok:true,json:async()=>({data})};};
 return {calls,options:{command,request,now:100},commands:()=>commands};
}
test('finds current public post text case-insensitively with bounded excerpts and exact public fields',async()=>{
 const h=harness({candidates:[post(1,{body:'a'.repeat(500)+' Metaverse '+'z'.repeat(500)})]});const r=await searchPublicForum({query:'  METAVERSE  '},h.options);
 assert.equal(r.query,'METAVERSE');assert.equal(r.items.length,1);assert(r.items[0].snippet.includes('Metaverse'));assert(r.items[0].snippet.length<=240);assert.equal(r.items[0].kind,'post');assert.equal(r.items[0].url,'https://gov.bittrees.org/forum/'+uid(1));
 assert.deepEqual(Object.keys(r.items[0]).sort(),['editedAt','id','kind','postId','revisionId','snippet','time','title','url']);assert.equal(JSON.stringify(r).includes(wallet),false);assert.equal(r.completeArchive,false);assert.equal(h.commands(),2);
 for(const c of h.calls)assert.equal(JSON.stringify(c.variables).includes('METAVERSE'),false,'search phrase stays local, not sent to the index');
});
test('only current same-author edits match; removed text and forged/private-community edits do not',async()=>{
 const revisions=[edit(100,{body:'Current talent acquisition'}),edit(101,{body:'forged keyword'},{attester:'0x'+'b'.repeat(40)}),edit(102,{body:'PRIVATE_KEYWORD',community:'bittrees-contributors'})];
 const opts=harness({candidates:[post(1,{body:'outdated keyword'})],revisions}).options;
 assert.equal((await searchPublicForum({query:'talent'},opts)).items[0].revisionId,uid(100));
 for(const query of ['outdated','forged','PRIVATE_KEYWORD'])assert.deepEqual((await searchPublicForum({query},harness({candidates:[post(1,{body:'outdated keyword'})],revisions}).options)).items,[]);
});
test('reply hits require a public root and use current root title as context without matching unrelated parent words',async()=>{
 const reply=post(2,{title:'',body:'Need artists for metaverse'},{refUID:uid(1)}),h=harness({candidates:[reply],parents:[post()],revisions:[edit(100,{title:'New project title',body:'parent-only-word'})]});
 const r=await searchPublicForum({query:'ARTISTS'},h.options);assert.equal(r.items[0].kind,'reply');assert.equal(r.items[0].postId,uid(1));assert.equal(r.items[0].title,'New project title');assert.equal(h.calls.length,3);
 assert.deepEqual((await searchPublicForum({query:'parent-only-word'},h.options)).items,[]);
});
test('hidden/removed roots and current revisions suppress reply hits; private or non-root parents are excluded',async()=>{
 const reply=post(2,{title:'',body:'artists'},{refUID:uid(1)});
 for(const options of [{parents:[post()],flags:{[uid(1)]:{mod:'removed'}}},{parents:[post()],flags:{[uid(1)]:{by:['a','b']}}},{parents:[post()],revisions:[edit()],finalFlags:{[uid(100)]:{mod:'removed'}}},{parents:[post(1,{community:'bittrees-contributors',body:'PRIVATE'})]},{parents:[post(1,{title:'',body:'artists'},{refUID:uid(3)})]}]){
  const h=harness({candidates:[reply],...options});assert.deepEqual((await searchPublicForum({query:'artists'},h.options)).items,[]);
 }
});
test('source schema, community, revocation, expiry and fresh moderation all gate matches',async()=>{
 const invalid=[post(1,{body:'SECRET',community:'bittrees-contributors'}),post(2,{body:'SECRET'},{schemaId:uid(999)}),post(3,{body:'SECRET'},{revocationTime:1}),post(4,{body:'SECRET'},{expirationTime:99})];
 const h=harness({candidates:[...invalid,post(6,{body:'SECRET'})],finalFlags:{[uid(6)]:{mod:'removed'}}});assert.deepEqual((await searchPublicForum({query:'SECRET'},h.options)).items,[]);
});
test('literal searches do not interpret regular expressions and support Unicode text',async()=>{
 const h=harness({candidates:[post(1,{body:'literal .* and CAFÉ'})]});assert.equal((await searchPublicForum({query:'.*'},h.options)).items.length,1);assert.equal((await searchPublicForum({query:'café'},h.options)).items.length,1);
 assert.deepEqual((await searchPublicForum({query:'.*'},harness({candidates:[post(1,{body:'ordinary unrelated text'})]}).options)).items,[]);
});
test('cursor stops at the hit limit without dropping remaining candidate matches',async()=>{
 const candidates=Array.from({length:30},(_,i)=>post(i+1,{body:'artists'})),h=harness({candidates,paged:true});const first=await searchPublicForum({query:'artists',limit:2},h.options);assert.equal(first.nextOffset,2);assert.equal(first.scanned,2);
 const next=await searchPublicForum({query:'artists',limit:2,offset:first.nextOffset},h.options);assert.deepEqual(next.items.map(x=>x.id),[uid(28),uid(27)]);assert.equal(next.nextOffset,4);
});
test('empty pages advance and full-history cursors continue beyond the legacy offset window',async()=>{
 const h=harness({candidates:Array.from({length:26},(_,i)=>post(i+1,{community:'bittrees-contributors',body:'PRIVATE'}))});const r=await searchPublicForum({query:'absent'},h.options);assert.deepEqual(r.items,[]);assert.equal(r.scanned,25);assert.equal(r.nextOffset,25);assert.equal(h.calls.length,1);
 const capped=await searchPublicForum({query:'absent',offset:500},h.options);assert.equal(capped.nextOffset,null);assert.equal(capped.completeArchive,false);assert(capped.nextCursor);assert.equal(capped.historyExhausted,false);
});
test('incomplete edit scans and unavailable moderation/index fail closed, within four index requests',async()=>{
 const h=harness({candidates:[post(2,{title:'',body:'artists'},{refUID:uid(1)})],parents:[post()],revisions:Array(50).fill(edit())});await assert.rejects(searchPublicForum({query:'artists'},h.options),/history exceeds/);assert.equal(h.calls.length,4);
 await assert.rejects(searchPublicForum({query:'artists'},{...h.options,command:async()=>({})}),/Moderation/);
 await assert.rejects(searchPublicForum({query:'artists'},{...h.options,request:async()=>({ok:false})}),/index/);
});
test('invalid/extra/private arguments are rejected before any reads',async()=>{
 let reads=0;for(const args of [{},null,[],{query:'x'},{query:'😀'},{query:'   '},{query:'a'.repeat(121)},{query:'a\nb'},{query:'okay',limit:null},{query:'okay',limit:11},{query:'okay',offset:-1},{query:'okay',offset:501},{query:'okay',wallet:wallet},{query:'okay',url:'https://private.invalid'},{query:'okay',regex:true}])await assert.rejects(searchPublicForum(args,{command:async()=>{reads++;throw Error('must not read');}}),/Invalid/);assert.equal(reads,0);assert.deepEqual(publicSearchArgs({query:' okay '}),{query:'okay',limit:5,offset:0});
});

test('full-history cursors reach older posts and replies beyond the former 500-record ceiling',async()=>{
 const records=Array.from({length:560},(_,i)=>post(i+10,{body:'Unrelated recent text'},{time:i+100}));records.push(post(1,{body:'Ancient target'},{time:1}),post(2,{title:'',body:'Ancient reply target'},{time:2,refUID:uid(1)}));
 const h=harness({candidates:records,parents:[post(1,{body:'Ancient target'},{time:1})],paged:true});h.options.now=1000;let cursor,scanned=0,pages=0,hits=[],last;
 do{last=await searchPublicForum({query:'ancient',limit:10,...(cursor?{cursor}:{})},h.options);hits.push(...last.items);scanned+=last.scanned;cursor=last.nextCursor;pages++;assert(pages<30);}while(cursor);
 assert(scanned>500);assert.equal(scanned,562);assert.deepEqual(hits.map(x=>x.kind),['reply','post']);assert.equal(last.historyExhausted,true);assert.equal(last.coverage,'full-public-history');assert.equal(last.nextCursor,null);
 for(const c of h.calls.filter(c=>c.query.includes('SearchCandidates')))assert.equal(c.variables.skip,0,'history continuation never grows the numeric offset');
});
test('same-timestamp keyset pages preserve every match without duplicates and ignore newly created records',async()=>{
 const candidates=Array.from({length:40},(_,i)=>post(i+1,{body:'Match text'},{time:10})),h=harness({candidates,paged:true});
 let page=await searchPublicForum({query:'match',limit:3},h.options),ids=page.items.map(x=>x.id),cursor=page.nextCursor;const fence=page.asOf;candidates.push(post(1000,{body:'Match new'},{time:101}));
 while(cursor){page=await searchPublicForum({query:'MATCH',limit:7,cursor},{...h.options,now:200});assert.equal(page.asOf,fence);ids.push(...page.items.map(x=>x.id));cursor=page.nextCursor;assert(ids.length<=40);}
 assert.equal(ids.length,40);assert.equal(new Set(ids).size,40);assert.equal(ids.includes(uid(1000)),false);assert.equal(page.historyExhausted,true);
});
test('continuation always resolves current edits and moderation, never text frozen by the creation fence',async()=>{
 const candidates=[post(2,{body:'Keyword first'},{time:20}),post(1,{body:'Old keyword'},{time:10})];const first=await searchPublicForum({query:'keyword',limit:1},harness({candidates,paged:true}).options);
 const h=harness({candidates,paged:true,revisions:[edit(100,{body:'Current keyword text'},{time:150})]});const next=await searchPublicForum({query:'keyword',cursor:first.nextCursor},{...h.options,now:200});assert.equal(next.items[0].revisionId,uid(100));assert(next.items[0].snippet.includes('Current'));assert.equal(h.calls[0].variables.asOf,100);assert.equal(h.calls.find(c=>c.query.includes('SearchRevisions')).variables.now,200);
 const hidden=await searchPublicForum({query:'keyword',cursor:first.nextCursor},{...harness({candidates,paged:true,finalFlags:{[uid(1)]:{mod:'removed'}}}).options,now:200});assert.deepEqual(hidden.items,[]);
});
test('invalid or mismatched cursor positions fail before reading; cursors never contain bodies or author credentials',async()=>{
 const h=harness({candidates:[post(2,{body:'Keyword'},{time:20}),post(1,{body:'Keyword'},{time:10})],paged:true});const first=await searchPublicForum({query:'keyword',limit:1},h.options);const payload=readSearchCursor(first.nextCursor,'keyword',100);assert.deepEqual(Object.keys(payload).sort(),['asOf','id','q','time','v']);assert.equal(JSON.stringify(payload).includes(wallet),false);
 const token=v=>Buffer.from(JSON.stringify(v)).toString('base64url');let reads=0;for(const cursor of ['bad','x'.repeat(513),first.nextCursor+'=',token({...payload,asOf:101}),token({...payload,time:101}),token({...payload,id:'bad'}),token({...payload,privateKey:'NO'})])await assert.rejects(searchPublicForum({query:'keyword',cursor},{command:async()=>{reads++;throw Error('must not read');},now:100}),/cursor/);
 await assert.rejects(searchPublicForum({query:'different',cursor:first.nextCursor},{command:async()=>{reads++;throw Error('must not read');},now:100}),/cursor/);assert.equal(reads,0);
 assert.throws(()=>publicSearchArgs({query:'keyword',cursor:first.nextCursor,offset:1}),/Invalid/);
});
test('malformed or repeated source positions cannot produce a looping or skipping continuation',async()=>{
 const repeated=harness({candidates:[post(),post()]});await assert.rejects(searchPublicForum({query:'public'},repeated.options),/ordering/);
 await assert.rejects(searchPublicForum({query:'public'},harness({candidates:[post(1,{}, {time:101})]}).options),/ordering/);
});
