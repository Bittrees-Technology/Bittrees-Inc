import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeAbiParameters,type WalletClient} from 'viem';
import {publishRevision,fetchRevisions,SCHEMA_UID,REVISION_SCHEMA_UID,ZERO32,type ForumPost} from './forum.ts';
const owner='0x'+'1'.repeat(40),id='0x'+'a'.repeat(64);
const post:ForumPost={id:id as `0x${string}`,attester:owner as `0x${string}`,refUID:ZERO32,time:100,community:'bittrees-inc',title:'Original',body:'Original text'};
const components=[{name:'uid',type:'bytes32'},{name:'schema',type:'bytes32'},{name:'time',type:'uint64'},{name:'expirationTime',type:'uint64'},{name:'revocationTime',type:'uint64'},{name:'refUID',type:'bytes32'},{name:'recipient',type:'address'},{name:'attester',type:'address'},{name:'revocable',type:'bool'},{name:'data',type:'bytes'}] as const;
const original={uid:post.id,schema:SCHEMA_UID,time:100n,expirationTime:0n,revocationTime:0n,refUID:ZERO32,recipient:'0x'+'0'.repeat(40) as `0x${string}`,attester:post.attester,revocable:true,data:encodeAbiParameters([{type:'string'},{type:'string'},{type:'string'}],[post.community,post.title,post.body])};
test('write path checks authoritative original, not a forged UI owner, and rejects stale edits before signing',async()=>{
 const real=globalThis.fetch;let writes=0;const walletClient={writeContract:async()=>{writes++;throw Error('Unexpected transaction');}} as unknown as WalletClient;
 try{
  for(const change of [{attester:'0x'+'2'.repeat(40)},{schema:REVISION_SCHEMA_UID},{uid:ZERO32},{revocationTime:1n},{expirationTime:1n},{}]){
   globalThis.fetch=async(input,init)=>{
    if(String(input).includes('easscan'))return new Response(JSON.stringify({data:{attestations:[]}}),{status:200});
    const rpc=JSON.parse(init!.body as string);
    return new Response(JSON.stringify({jsonrpc:'2.0',id:rpc.id,result:encodeAbiParameters([{type:'tuple',components}],[{...original,...change} as typeof original])}),{status:200});
   };
   await assert.rejects(()=>publishRevision({walletClient,account:post.attester,post,title:'Updated',body:'Changed',expectedRevisionId:ZERO32}),/original author|post changed/);
  }
  assert.equal(writes,0);
 }finally{globalThis.fetch=real;}
});
test('revision reader paginates and surfaces outages rather than silently dropping edits',async()=>{
 const real=globalThis.fetch;const skips:number[]=[];
 try{
  globalThis.fetch=async(_input,init)=>{
   const query=JSON.parse(init!.body as string);skips.push(query.variables.skip);
   assert.equal(query.variables.schemaId,REVISION_SCHEMA_UID);assert.deepEqual(query.variables.ids,[id]);assert.deepEqual(query.variables.authors,[owner]);
   return new Response(JSON.stringify({data:{attestations:query.variables.skip===0?Array(200).fill({decodedDataJson:'invalid'}):[]}}),{status:200});
  };
  assert.deepEqual(await fetchRevisions([post]),[]);assert.deepEqual(skips,[0,200]);
  globalThis.fetch=async()=>new Response('outage',{status:503});await assert.rejects(()=>fetchRevisions([post]),/503/);
 }finally{globalThis.fetch=real;}
});
