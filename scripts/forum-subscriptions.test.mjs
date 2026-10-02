import test from 'node:test';import assert from 'node:assert/strict';import {spawn,execFileSync} from 'node:child_process';
import {createSubscriptions,cronAuthorized} from '../server/forum-subscriptions.mjs';
import {forumFeed,schema} from '../server/forum-feed.mjs';
const zero='0x'+'0'.repeat(64),id='0x'+'1'.repeat(64);
test('feed validates schema/community/status and filters moderated posts; outages fail closed',async()=>{
 const row={id,schemaId:schema,refUID:zero,time:100,expirationTime:0,revocationTime:0,decodedDataJson:JSON.stringify([{name:'community',value:{value:'bittrees-inc'}},{name:'title',value:{value:'Hello'}}])};
 const request=async()=>({ok:true,json:async()=>({data:{attestations:[row,{...row,id:'0x'+'2'.repeat(64),schemaId:zero}]}})});
 assert.equal((await forumFeed({request,now:200,command:async()=>({result:null})})).length,1);
 assert.deepEqual(await forumFeed({request,now:200,command:async()=>({result:JSON.stringify({[id]:{mod:'removed'}})})}),[]);
 assert.deepEqual(await forumFeed({request,now:200,command:async()=>({result:JSON.stringify({[id]:{by:['a','b']}})})}),[]);
 await assert.rejects(forumFeed({request,command:async()=>{throw Error('offline')}}));
 await assert.rejects(forumFeed({request:async()=>({ok:false,json:async()=>({errors:['unavailable']})}),command:async()=>({result:null})}));
});
test('Redis-backed confirmation, idempotent retry, uncertain-delivery cutoff and unsubscribe',async()=>{
 const port=22000+Math.floor(Math.random()*1000),server=spawn('redis-server',['--bind','127.0.0.1','--port',String(port),'--save','','--appendonly','no'],{stdio:['ignore','pipe','pipe']});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Redis timeout')),5000);server.stdout.on('data',b=>{if(b.toString().includes('Ready to accept connections')){clearTimeout(timer);resolve();}});server.on('error',reject);});
  const command=async args=>({result:JSON.parse(execFileSync('redis-cli',['-p',String(port),'--json',...args.map(String)],{encoding:'utf8'}))});
  let now=1700000000000,fail=false,posts=[],calls=[];
  const service=createSubscriptions({command,now:()=>now,ready:()=>true,feed:async()=>posts,request:async(_url,opts)=>{calls.push({key:opts.headers['Idempotency-Key'],body:JSON.parse(opts.body)});if(fail)throw Error('ack lost');return {ok:true,json:async()=>({id:'provider-id'})};}});
  await service.subscribe('reader@example.com','test-ip');assert.equal(calls.length,1);
  const secret=calls[0].body.text.match(/forum-email=([a-f0-9]{64})/)[1];
  assert.deepEqual(await service.deliver(),{sent:0,blocked:0});
  await service.manage(secret,'confirm');await service.manage(secret,'confirm');
  posts=[{id,title:'New discussion',url:'https://gov.bittrees.org/forum/'+id,time:now/1000+10}];now+=100000;
  fail=true;await assert.rejects(service.deliver());const attempt=calls.at(-1);
  fail=false;assert.equal((await service.deliver()).sent,1);assert.deepEqual(calls.at(-1),attempt,'retry preserves exact payload and idempotency key');
  posts=[{...posts[0],id:'0x'+'3'.repeat(64)}];fail=true;now+=86400000;await assert.rejects(service.deliver());const before=calls.length;
  now+=24*3600000;assert.equal((await service.deliver()).blocked,1);assert.equal(calls.length,before,'uncertain send never retries outside provider dedup window');
  await service.manage(secret,'unsubscribe');assert.equal((await service.deliver()).sent,0);
  await assert.rejects(service.manage('bad','confirm'));
 }finally{server.kill('SIGTERM');}
});
test('cron rejects missing, wrong and unicode credentials',()=>{
 const old=process.env.CRON_SECRET;process.env.CRON_SECRET='test-secret';try{assert.equal(cronAuthorized(undefined),false);assert.equal(cronAuthorized('Bearer test-secret'),true);assert.equal(cronAuthorized('Bearer test-secreé'),false);}finally{if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old;}
});
