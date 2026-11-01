import test from 'node:test';
import assert from 'node:assert/strict';
import {publicForumThread,revisionSchema} from '../server/forum-thread.mjs';
import {schema} from '../server/forum-feed.mjs';
import {resolveRevisions} from '../src/lib/forumRevisions.ts';
const uid=c=>'0x'+c.repeat(64),wallet='0x'+'a'.repeat(40),zero=uid('0');
const encoded=f=>JSON.stringify(Object.entries(f).map(([name,value])=>({name,value:{value}})));
const post=(c='1',f={},r={})=>({id:uid(c),attester:wallet,refUID:zero,schemaId:schema,time:10,expirationTime:0,revocationTime:0,decodedDataJson:encoded({community:'bittrees-inc',title:'Public title',body:'**Public body**',...f}),...r});
const reply=post('2',{title:'',body:'Public reply'},{refUID:uid('1'),time:11});
const edit=(c='3',f={},r={})=>post(c,{version:1,title:'Current title',body:'Current **Markdown**',...f},{schemaId:revisionSchema,refUID:uid('1'),time:20,...r});
function harness({root=post(),replies=[reply],revisions=[],flags={},finalFlags=flags}={}){
 const calls=[];let commands=0;
 const command=async args=>{assert.deepEqual(args,['GET','bittrees:flags']);return {result:JSON.stringify(++commands===1?flags:finalFlags)};};
 const request=async(url,options)=>{assert.equal(url,'https://base.easscan.org/graphql');const {query,variables}=JSON.parse(options.body);calls.push({query,variables});return {ok:true,json:async()=>({data:query.includes('PublicThreadRevisions')?{revisions}:{root,replies}})};};
 return {calls,options:{request,command,now:100},commandCount:()=>commands};
}
test('returns full public bodies and same-author edits without exposing wallets or arbitrary decoded fields',async()=>{
 const h=harness({revisions:[edit(),edit('4',{title:'',body:'Edited reply'},{refUID:reply.id,attester:reply.attester,time:21})]});
 const result=await publicForumThread({postId:uid('1')},h.options);
 assert.equal(result.root.body,'Current **Markdown**');assert.equal(result.root.revisionId,uid('3'));assert.equal(result.replies[0].body,'Edited reply');
 assert.deepEqual(Object.keys(result.root).sort(),['body','editedAt','id','revisionId','time','title','url']);assert.equal(JSON.stringify(result).includes(wallet),false);assert.equal(result.contentFormat,'markdown');assert.equal(h.commandCount(),2);assert.equal(h.calls.length,2);
});
test('edit resolution matches existing forum rules for wrong author/schema/community/version and stable timestamp ties',async()=>{
 const valid=edit(),bad=[edit('5',{}, {attester:'0x'+'b'.repeat(40)}),edit('6',{community:'bittrees-contributors'}),edit('7',{version:2}),edit('8',{}, {revocationTime:30}),edit('9',{}, {expirationTime:50})],tie=edit('a',{body:'Tie winner'});
 const h=harness({revisions:[valid,...bad,tie]});const actual=await publicForumThread({postId:uid('1')},h.options);
 const target={id:uid('1'),attester:wallet,refUID:zero,time:10,community:'bittrees-inc',title:'Public title',body:'**Public body**'};
 const candidates=[valid,...bad,tie].map(r=>({...r,...Object.fromEntries(JSON.parse(r.decodedDataJson).map(f=>[f.name,f.value.value]))}));
 const expected=resolveRevisions(target,candidates,revisionSchema,100);assert.equal(actual.root.body,expected.body);assert.equal(actual.root.revisionId,expected.revisionId);
});
test('hidden root, invalid root schema and contributor application communities never expose a thread',async()=>{
 for(const root of [post('1',{community:'bittrees-contributors',body:'PRIVATE_APPLICATION'}),post('1',{}, {schemaId:uid('f')}),post('1',{}, {refUID:uid('e')}),post('1',{}, {revocationTime:1}),post('1',{}, {expirationTime:99}),post('1',{}, {time:101}),null]){
  await assert.rejects(publicForumThread({postId:uid('1')},harness({root}).options),/unavailable/);
 }
 const h=harness({flags:{[uid('1')]:{mod:'removed'}}});await assert.rejects(publicForumThread({postId:uid('1')},h.options));assert.equal(h.calls.length,0);
});
test('hidden replies, wrong thread/community, revoked and forged edits are excluded; approved flag override matches Gov',async()=>{
 const replies=[reply,post('4',{title:'',body:'hidden'},{refUID:uid('1')}),post('5',{title:'',body:'wrong thread'},{refUID:uid('a')}),post('6',{title:'',body:'PRIVATE_APPLICATION',community:'bittrees-contributors'},{refUID:uid('1')}),post('7',{title:'',body:'revoked'},{refUID:uid('1'),revocationTime:1})];
 const h=harness({replies,flags:{[reply.id]:{by:['a','b'],mod:'approved'},[uid('4')]:{by:['a','b']}}});const result=await publicForumThread({postId:uid('1'),replyLimit:5},h.options);assert.equal(result.replies.length,1);assert.equal(result.replies[0].id,reply.id);
});
test('fresh moderation before response suppresses newly hidden content, including latest edit without reverting old text',async()=>{
 const h=harness({finalFlags:{[reply.id]:{mod:'removed'}}});assert.equal((await publicForumThread({postId:uid('1')},h.options)).replies.length,0);
 for(const flags of [{[uid('1')]:{mod:'removed'}},{[uid('3')]:{mod:'removed'}}])await assert.rejects(publicForumThread({postId:uid('1')},harness({revisions:[edit()],finalFlags:flags}).options),/unavailable/);
});
test('reply pagination is bounded and advances across a filtered page',async()=>{
 const h=harness({replies:[reply,post('3',{title:'',body:'next'},{refUID:uid('1')})],flags:{[reply.id]:{mod:'removed'}}});const result=await publicForumThread({postId:uid('1'),replyLimit:1,replyOffset:7},h.options);assert.deepEqual(result.replies,[]);assert.equal(result.nextReplyOffset,8);assert.equal(h.calls[0].variables.take,2);assert.equal(h.calls[0].variables.skip,7);assert.equal(result.completeThread,false);
 for(const args of [{postId:'bad'},{postId:zero},{postId:uid('1'),replyLimit:11},{postId:uid('1'),replyOffset:101}])await assert.rejects(publicForumThread(args,h.options),/Invalid/);
});
test('index/moderation failures and incomplete bounded revision history fail closed',async()=>{
 const h=harness({revisions:Array(50).fill(edit())});await assert.rejects(publicForumThread({postId:uid('1')},h.options),/history exceeds/);assert.equal(h.calls.length,4);
 await assert.rejects(publicForumThread({postId:uid('1')},{...h.options,command:async()=>({})}),/Moderation/);
 await assert.rejects(publicForumThread({postId:uid('1')},{...h.options,request:async()=>({ok:false})}),/index/);
 await assert.rejects(publicForumThread({postId:uid('1')},{...h.options,request:async()=>({ok:true,json:async()=>({errors:['unavailable'],data:{}})})}),/index/);
});
test('full valid body is not truncated; oversized text is never returned',async()=>{
 const h=harness({root:post('1',{body:'x'.repeat(20000)}),replies:[]});assert.equal((await publicForumThread({postId:uid('1')},h.options)).root.body.length,20000);
 await assert.rejects(publicForumThread({postId:uid('1')},harness({root:post('1',{body:'x'.repeat(20001)})}).options));
});
test('upstream byte cap stops oversized streamed responses before JSON decoding',async()=>{
 let cancelled=false;const h=harness();
 await assert.rejects(publicForumThread({postId:uid('1')},{...h.options,request:async()=>({ok:true,body:new ReadableStream({start(c){c.enqueue(new Uint8Array(8*1024*1024+1));},cancel(){cancelled=true;}})})}),/response limit/);assert.equal(cancelled,true);
});
