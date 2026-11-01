import test from 'node:test';
import assert from 'node:assert/strict';
import {createForumMcpHandler,FORUM_TOOL} from '../server/forum-mcp.mjs';
import {forumFeed,schema} from '../server/forum-feed.mjs';
const id='0x'+'a'.repeat(64);
const headers={'content-type':'application/json',accept:'application/json, text/event-stream','mcp-protocol-version':'2025-06-18'};
async function call(body,{feed=async()=>[],method='POST',extra={},...options}={}){
 const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},status(s){this.statusCode=s;return this;},json(b){this.body=b;return this;},end(){return this;}};
 await createForumMcpHandler({feed,now:()=>200000,...options})({method,headers:{...headers,...extra},body},res);return res;
}
const rpc=(method,params={})=>({jsonrpc:'2.0',id:1,method,params});
const tool=args=>rpc('tools/call',{name:'gov.list_public_forum_posts',arguments:args});
test('stateless initialization, discovery, ping and initialization notification need no wallet',async()=>{
 const init=await call(rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}}));
 assert.equal(init.body.result.protocolVersion,'2025-06-18');assert.deepEqual(init.body.result.capabilities,{tools:{listChanged:false}});assert.equal(init.headers['mcp-session-id'],undefined);
 assert.deepEqual((await call(rpc('tools/list'))).body.result.tools,[FORUM_TOOL]);
 assert.deepEqual((await call(rpc('ping'))).body.result,{});
 assert.equal((await call({jsonrpc:'2.0',method:'notifications/initialized'})).statusCode,202);
 assert.equal((await call(rpc('initialize',{protocolVersion:'future',capabilities:{},clientInfo:{name:'test',version:'1'}}))).body.result.protocolVersion,'2025-06-18');
});
test('public result projects exactly title/time/link/id; no caller credentials or arbitrary URL reaches feed',async()=>{
 let received;
 const r=await call(tool({limit:2,offset:0}),{extra:{cookie:'private-session',authorization:'Bearer not-forwarded'},feed:async args=>{received=args;return [{id,title:'Notice',time:100,url:'https://attacker.test',email:'private@example.com',body:'private body',wallet:'private'}];}});
 assert.deepEqual(received,{limit:3,since:0,now:200,maxPages:3});
 assert.deepEqual(r.body.result.structuredContent.items,[{id,title:'Notice',time:100,url:`https://gov.bittrees.org/forum/${id}`}]);
 assert.equal(r.body.result.isError,false);assert.equal(r.headers['cache-control'],'no-store');assert.equal(JSON.stringify(r.body).includes('private@example'),false);
});
test('invalid and unknown tools, methods and fields never invoke data sources',async()=>{
 let reads=0;const opts={feed:async()=>{reads++;throw Error('must not read');}};
 for(const args of [{limit:0},{limit:26},{limit:1.2},{limit:'2'},{offset:-1},{offset:101},{offset:1.5},{since:10},{url:'https://attacker.test'},null,[],{wallet:id},{applicationId:'secret'},{action:'issue'}]){
  assert.equal((await call(tool(args),opts)).body.error.code,-32602);
 }
 for(const name of ['review','chain_execute_prepare','gov_roles','list','forum_post','contributors'])assert.equal((await call(rpc('tools/call',{name,arguments:{}}),opts)).body.error.code,-32602);
 assert.equal((await call(rpc('resources/read',{uri:'private'}),opts)).body.error.code,-32601);
 assert.equal((await call(rpc('tools/list',{cursor:'invented'}),opts)).body.error.code,-32602);
 assert.equal(reads,0);
});
test('transport rejects invalid origin, methods, versions, oversized and malformed messages',async()=>{
 const forbidden=await call(rpc('ping'),{extra:{origin:'https://attacker.test'}});assert.equal(forbidden.statusCode,403);
 assert.equal((await call(rpc('ping'),{extra:{origin:'null'}})).statusCode,403);
 assert.equal((await call(rpc('ping'),{extra:{origin:'https://mcp.bittrees.org'}})).statusCode,200);
 for(const method of ['GET','DELETE','PUT'])assert.equal((await call({}, {method})).statusCode,405);
 assert.equal((await call(rpc('ping'),{extra:{'mcp-protocol-version':'bad'}})).statusCode,400);
 assert.equal((await call(rpc('ping'),{extra:{'content-type':'text/plain'}})).statusCode,415);
 assert.equal((await call(rpc('ping'),{extra:{accept:'text/html'}})).statusCode,406);
 assert.equal((await call('{')).body.error.code,-32700);
 assert.equal((await call('x'.repeat(4097))).statusCode,413);
 for(const body of [[],null,{jsonrpc:'1.0',id:1,method:'ping'},{jsonrpc:'2.0',id:null,method:'ping'},rpc('ping',[])])assert.equal((await call(body)).statusCode,400);
});
test('source and moderation failure return an error without secrets or fallback results',async()=>{
 const r=await call(tool({}),{feed:async()=>{throw Error('private backend details and credentials');}});
 assert.equal(r.body.result.isError,true);assert.equal(JSON.stringify(r.body).includes('backend details'),false);assert.equal(r.body.result.structuredContent,undefined);
 for(const row of [{id:'bad',title:'Title',time:100},{id,title:'Title',time:300}])assert.equal((await call(tool({}),{feed:async()=>[row]})).body.result.isError,true);
});
test('shared feed enforces bounded pages and current moderation without writes',async()=>{
 const row={id,schemaId:schema,refUID:'0x'+'0'.repeat(64),time:100,expirationTime:0,revocationTime:0,decodedDataJson:JSON.stringify([{name:'community',value:{value:'bittrees-inc'}},{name:'title',value:{value:'Public'}}])};
 let reads=0;const command=async args=>{assert.deepEqual(args,['GET','bittrees:flags']);return {result:JSON.stringify({[id]:{mod:'removed'}})};};
 const request=async()=>{reads++;return {ok:true,json:async()=>({data:{attestations:Array(100).fill(row)}})};};
 await assert.rejects(forumFeed({command,request,limit:10,now:200,maxPages:3}),/too large/);assert.equal(reads,3);
 const rows=await forumFeed({command,request:async()=>({ok:true,json:async()=>({data:{attestations:[row]}})}),now:200,maxPages:3});assert.deepEqual(rows,[]);
});

test('bounded offset pages return only requested notices and an explicit next offset',async()=>{
 const rows=Array.from({length:8},(_,i)=>({id:'0x'+String(i).repeat(64),title:String(i),time:100}));
 const r=await call(tool({limit:2,offset:2}),{feed:async args=>{assert.equal(args.limit,5);return rows.slice(0,args.limit);}});
 assert.deepEqual(r.body.result.structuredContent.items.map(x=>x.title),['2','3']);assert.equal(r.body.result.structuredContent.nextOffset,4);
 const last=await call(tool({limit:25,offset:100}),{feed:async()=>Array(126).fill(rows[0])});assert.equal(last.body.result.structuredContent.nextOffset,null);assert.equal(last.body.result.structuredContent.items.length,25);
});

test('source and public descriptors declare only the tested read-only route',async()=>{
 const {readFile}=await import('node:fs/promises');
 const root=await readFile(new URL('../bittrees.tools.json',import.meta.url),'utf8');
 assert.equal(await readFile(new URL('../public/.well-known/bittrees-tools.json',import.meta.url),'utf8'),root);
 const manifest=JSON.parse(root);assert.equal(manifest.projectId,'bittrees-gov');assert.equal(manifest.connections.length,1);
 const c=manifest.connections[0];assert.equal(c.endpoint,'https://gov.bittrees.org/api/public-mcp');assert.equal(c.transport,'mcp');assert.deepEqual(c.operations,{read:[FORUM_TOOL.name]});assert.deepEqual(c.setup,{authentication:'none'});
});
