// Reproduce the reviewed CREATE2 deployment on a disposable, unforked local chain.
import {readFileSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {createPublicClient,http,keccak256} from 'viem';
const release=process.argv[2];if(!release)throw Error('Supply release directory');
const d=JSON.parse(readFileSync(release+'/review/deployment.json','utf8'));
const runtime=JSON.parse(execFileSync('alchemy',['--json','--no-interactive','evm','rpc','eth_getCode',d.createCall,'latest','-n','eth-mainnet'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
if(keccak256(runtime)!==d.createCallCodeHash)throw Error('CreateCall changed');
const port=18549,server=spawn('anvil',['--host','127.0.0.1','--port',String(port),'--chain-id','1','--silent'],{stdio:'ignore'});
const client=createPublicClient({transport:http('http://127.0.0.1:'+port,{retryCount:0})});
try{
 await new Promise((resolve,reject)=>{server.once('error',reject);setTimeout(resolve,500)});
 await client.request({method:'anvil_setCode',params:[d.root,runtime]});
 await client.request({method:'anvil_impersonateAccount',params:[d.owner]});
 await client.request({method:'anvil_setBalance',params:[d.owner,'0xde0b6b3a7640000']});
 const hash=await client.request({method:'eth_sendTransaction',params:[{from:d.owner,to:d.root,data:d.safeTransaction.data,gas:'0x989680'}]});
 const receipt=await client.waitForTransactionReceipt({hash});if(receipt.status!=='success')throw Error('Local deployment reverted');
 const code=await client.getCode({address:d.contract});if(!code||keccak256(code)!==d.codeHash)throw Error('Actual deployed runtime differs from reviewed hash');
 console.log(JSON.stringify({contract:d.contract,codeHash:d.codeHash,localRuntimeVerified:true,mainnetTransactionSent:false}));
}finally{server.kill('SIGTERM');}
