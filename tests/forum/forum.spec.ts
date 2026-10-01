import {test,expect} from '@playwright/test';
import {encodeAbiParameters,decodeFunctionData,decodeAbiParameters,encodeEventTopics} from 'viem';
import {EAS_ABI,SCHEMA_UID,REVISION_SCHEMA_UID,EAS_ADDRESS,ZERO32,REGISTRY_ABI,SCHEMA_REGISTRY,REVISION_SCHEMA_STRING} from '../../src/lib/forum';
const owner='0x1111111111111111111111111111111111111111',other='0x2222222222222222222222222222222222222222';
const uid='0x'+'1'.repeat(64),revisionUid='0x'+'2'.repeat(64),hash='0x'+'a'.repeat(64),registerHash='0x'+'c'.repeat(64);
const originalBody='# Original heading\n\n**Bold** and [safe link](https://example.org)\n\n- List item\n\n| Name | Value |\n| --- | --- |\n| A | B |\n\n```js\nconst x = 1;\n```\n\n<script>window.pwned=true</script>\n\n[unsafe](javascript:alert(1))\n\n![tracking image](https://tracker.invalid/pixel)';
const decoded=(title:string,body:string,revision=false)=>JSON.stringify([...(revision?[{name:'version',value:{value:'1'}}]:[]),...Object.entries({community:'bittrees-inc',title,body}).map(([name,value])=>({name,value:{value}}))]);
async function fixture(page:any,baseURL:string,actor=owner,schemaReady=true){
 let revision:any=null,writes=0,registrations=0,registryReady=schemaReady;
 const original={id:uid,attester:owner,refUID:ZERO32,schemaId:SCHEMA_UID,revocationTime:0,expirationTime:0,time:100,decodedDataJson:decoded('Original title',originalBody)};
 await page.context().exposeFunction('__forumSend',async(params:any[])=>{
  const tx=params[0];
  if(tx.to.toLowerCase()===SCHEMA_REGISTRY.toLowerCase()){
   const call=decodeFunctionData({abi:REGISTRY_ABI,data:tx.data});expect(call.functionName).toBe('register');expect(call.args?.[0]).toBe(REVISION_SCHEMA_STRING);registryReady=true;registrations++;return registerHash;
  }
  expect(tx.to.toLowerCase()).toBe(EAS_ADDRESS.toLowerCase());expect(tx.from.toLowerCase()).toBe(owner);
  const call=decodeFunctionData({abi:EAS_ABI,data:tx.data});expect(call.functionName).toBe('attest');const request=(call.args as any)[0];
  expect(request.schema).toBe(REVISION_SCHEMA_UID);expect(request.data.refUID).toBe(uid);
  const [version,community,title,body]=decodeAbiParameters([{type:'uint8'},{type:'string'},{type:'string'},{type:'string'}],request.data.data);
  expect(version).toBe(1);expect(community).toBe('bittrees-inc');
  revision={...original,id:revisionUid,refUID:uid,schemaId:REVISION_SCHEMA_UID,time:200,decodedDataJson:decoded(title,body,true)};writes++;return hash;
 });
 await page.addInitScript(({actor})=>{
  let connected=false;const events=new Map();
  (window as any).ethereum={isMetaMask:true,on:(n:any,f:any)=>events.set(n,f),removeListener:(n:any)=>events.delete(n),request:async({method,params}:any)=>{
   if(method==='eth_accounts')return connected?[actor]:[];
   if(method==='eth_requestAccounts'){connected=true;return[actor];}
   if(method==='eth_chainId')return '0x2105';
   if(method==='eth_sendTransaction'){if((window as any).rejectForum)throw Object.assign(Error('User rejected request'),{code:4001});return (window as any).__forumSend(params);}
   throw Error('Test wallet rejects '+method);
  }};
 },{actor});
 await page.route('**/*',async(route:any)=>{
  const req=route.request(),url=req.url();
  if(url.startsWith(baseURL)){
   if(url.includes('/api/community'))return route.fulfill({json:{roles:{},roledefs:[],flags:{},enckeys:{},threshold:2}});
   return route.continue();
  }
  if(url.includes('base.easscan.org/graphql')){
   const q=req.postDataJSON().query;
   return route.fulfill({json:{data:q.includes('query Revisions')?{attestations:revision?[revision]:[]}:q.includes('query Thread')?{root:original,replies:[]}:{attestations:[original]}}});
  }
  if(req.method()==='POST'){
   let data:any;try{data=req.postDataJSON();}catch{return route.abort();}
   const handle=(rpc:any)=>{
    let result:any=null;
    if(rpc.method==='eth_chainId')result='0x2105';
    if(rpc.method==='eth_blockNumber')result='0x10';
    if(rpc.method==='eth_call'){
     const call=rpc.params[0];
     if(call.to.toLowerCase()===EAS_ADDRESS.toLowerCase())result=encodeAbiParameters([{type:'tuple',components:[{name:'uid',type:'bytes32'},{name:'schema',type:'bytes32'},{name:'time',type:'uint64'},{name:'expirationTime',type:'uint64'},{name:'revocationTime',type:'uint64'},{name:'refUID',type:'bytes32'},{name:'recipient',type:'address'},{name:'attester',type:'address'},{name:'revocable',type:'bool'},{name:'data',type:'bytes'}]}],[{uid:uid as any,schema:SCHEMA_UID,time:100n,expirationTime:0n,revocationTime:0n,refUID:ZERO32,recipient:'0x'+'0'.repeat(40) as any,attester:owner,revocable:true,data:encodeAbiParameters([{type:'string'},{type:'string'},{type:'string'}],['bittrees-inc','Original title',originalBody])}]);
     else result=encodeAbiParameters([{type:'tuple',components:[{name:'uid',type:'bytes32'},{name:'resolver',type:'address'},{name:'revocable',type:'bool'},{name:'schema',type:'string'}]}],[{uid:registryReady?REVISION_SCHEMA_UID:ZERO32,resolver:'0x'+'0'.repeat(40) as any,revocable:true,schema:'uint8 version,string community,string title,string body'}]);
    }
    if(rpc.method==='eth_getTransactionByHash')result={hash:rpc.params[0],from:owner,to:EAS_ADDRESS,blockNumber:'0x10',blockHash:'0x'+'b'.repeat(64),transactionIndex:'0x0',nonce:'0x0',gas:'0x10000',value:'0x0',input:'0x',type:'0x2',chainId:'0x2105',gasPrice:'0x1'};
    if(rpc.method==='eth_getTransactionReceipt')result={transactionHash:rpc.params[0],transactionIndex:'0x0',blockHash:'0x'+'b'.repeat(64),blockNumber:'0x10',from:owner,to:EAS_ADDRESS,cumulativeGasUsed:'0x100',gasUsed:'0x100',effectiveGasPrice:'0x1',contractAddress:null,logsBloom:'0x'+'0'.repeat(512),status:'0x1',type:'0x2',logs:rpc.params[0]===registerHash?[]:[{address:EAS_ADDRESS,topics:encodeEventTopics({abi:EAS_ABI,eventName:'Attested',args:{recipient:'0x'+'0'.repeat(40) as any,attester:owner,schemaUID:REVISION_SCHEMA_UID}}),data:encodeAbiParameters([{type:'bytes32'}],[revisionUid as any]),transactionHash:hash,blockHash:'0x'+'b'.repeat(64),blockNumber:'0x10',transactionIndex:'0x0',logIndex:'0x0',removed:false}]};
    return {jsonrpc:'2.0',id:rpc.id,result};
   };
   return route.fulfill({json:Array.isArray(data)?data.map(handle):handle(data)});
  }
  return route.abort();
 });
 return {writes:()=>writes,registrations:()=>registrations,setRevision:(r:any)=>revision=r,original};
}
test('Markdown is safe and author edits preserve original history after reload',async({page,baseURL})=>{
 const state=await fixture(page,baseURL!);
 await page.goto('/forum/'+uid);
 await expect(page.getByRole('heading',{name:'Original heading'})).toBeVisible();
 await expect(page.locator('strong').filter({hasText:'Bold'})).toBeVisible();
 await expect(page.locator('.forum-markdown table')).toBeVisible();
 await expect(page.locator('.forum-markdown pre')).toContainText('const x = 1');
 await expect(page.locator('.forum-markdown img')).toHaveCount(0);
 await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
 expect(await page.evaluate(()=>(window as any).pwned)).toBeUndefined();
 await expect(page.getByRole('button',{name:'Edit post',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().click();await page.getByRole('button',{name:/^MetaMask(?:\s|$)/}).click();
 await page.getByRole('button',{name:'Edit post',exact:true}).click();
 const editor=page.getByRole('region',{name:'Edit post'});
 await editor.getByLabel('Title',{exact:true}).fill('Updated title');await editor.getByLabel('Post text',{exact:true}).fill('## Updated heading\n\n**Edited content**');
 await editor.getByText('Preview Markdown',{exact:true}).click();await expect(editor.getByRole('heading',{name:'Updated heading'})).toBeVisible();
 await page.evaluate(()=>(window as any).rejectForum=true);
 await editor.getByRole('button',{name:'Save edit',exact:true}).click();await expect(editor.getByRole('alert')).toBeVisible();expect(state.writes()).toBe(0);
 await page.evaluate(()=>(window as any).rejectForum=false);
 await editor.getByRole('button',{name:'Save edit',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Updated title',exact:true})).toBeVisible();expect(state.writes()).toBe(1);
 await page.locator('summary').filter({hasText:'Version history'}).click();await expect(page.getByRole('heading',{name:'Original heading'})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'Updated title',exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('another wallet cannot edit and foreign revisions are ignored',async({page,baseURL})=>{
 const state=await fixture(page,baseURL!,other);state.setRevision({...state.original,id:revisionUid,refUID:uid,schemaId:REVISION_SCHEMA_UID,attester:other,time:200,decodedDataJson:decoded('Forged title','Forged body',true)});
 await page.goto('/forum/'+uid);await expect(page.getByRole('heading',{name:'Original title',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().click();await page.getByRole('button',{name:/^MetaMask(?:\s|$)/}).click();
 await expect(page.getByRole('button',{name:'Edit post',exact:true})).toHaveCount(0);await expect(page.getByText('Forged body')).toHaveCount(0);expect(state.writes()).toBe(0);
});

test('the first edit registers the revision schema before submitting the author revision',async({page,baseURL})=>{
 const state=await fixture(page,baseURL!,owner,false);
 await page.goto('/forum/'+uid);
 await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().click();await page.getByRole('button',{name:/^MetaMask(?:\s|$)/}).click();
 await page.getByRole('button',{name:'Edit post',exact:true}).click();
 const editor=page.getByRole('region',{name:'Edit post'});
 await editor.getByLabel('Post text',{exact:true}).fill('First registered edit');
 await editor.getByRole('button',{name:'Save edit',exact:true}).click();
 await expect(editor).not.toBeVisible();
 await expect(page.locator('p').filter({hasText:/^First registered edit$/}).first()).toBeVisible();
 expect(state.registrations()).toBe(1);expect(state.writes()).toBe(1);
});
