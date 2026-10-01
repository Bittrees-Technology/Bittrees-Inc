import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveRevisions,validatePostText,type Revision} from './forumRevisions.ts';
const uid=(n:string)=>'0x'+n.repeat(64),wallet='0x'+'a'.repeat(40),schema=uid('f');
const original={id:uid('1'),attester:wallet,community:'bittrees-inc',title:'Original',body:'First text',refUID:uid('0'),time:10};
const revision:Revision={id:uid('2'),attester:wallet,refUID:original.id,schemaId:schema,time:20,revocationTime:0,expirationTime:0,version:1,community:'bittrees-inc',title:'Edited',body:'**Updated**'};
test('only same-author, active, correctly scoped revision data is displayed',()=>{
 for(const wrong of [{attester:'0x'+'b'.repeat(40)},{refUID:uid('8')},{schemaId:uid('e')},{community:'bittrees-contributors'},{revocationTime:21},{expirationTime:25},{time:5},{time:999},{version:2},{body:''},{title:'x'.repeat(121)}]){
  const resolved=resolveRevisions(original,[{...revision,...wrong}],schema,30);assert.equal(resolved.body,original.body);assert.equal(resolved.revisions.length,0);
 }
 const good=resolveRevisions(original,[revision],schema,30);assert.equal(good.id,original.id);assert.equal(good.attester,original.attester);assert.equal(good.body,revision.body);assert.equal(good.originalBody,original.body);assert.equal(good.revisionId,revision.id);
});
test('reordered and duplicate history selects one deterministic version without moving the thread',()=>{
 const later={...revision,id:uid('3'),time:21,body:'Newest'};
 for(const records of [[later,revision,revision],[revision,later]]){const p=resolveRevisions(original,records,schema,30);assert.equal(p.body,'Newest');assert.equal(p.revisions.length,2);assert.equal(p.refUID,uid('0'));}
 const sameTime={...revision,id:uid('4'),body:'Tie winner'};assert.equal(resolveRevisions(original,[sameTime,revision],schema,30).body,'Tie winner');
});
test('replies keep their root reference and cannot replace the discussion title',()=>{
 const reply={...original,refUID:uid('9'),title:''};
 assert.equal(resolveRevisions(reply,[revision],schema,30).revisions.length,0);
 const resolved=resolveRevisions(reply,[{...revision,title:''}],schema,30);assert.equal(resolved.body,revision.body);assert.equal(resolved.refUID,uid('9'));
});
test('writer text limits reject empty or oversized content',()=>{
 assert.throws(()=>validatePostText('','Text',false));assert.throws(()=>validatePostText('Title',' '.repeat(5),false));assert.throws(()=>validatePostText('','x'.repeat(20001),true));assert.throws(()=>validatePostText('Changed topic','Text',true));validatePostText('','Reply',true);
});
