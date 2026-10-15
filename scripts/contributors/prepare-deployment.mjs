// Read-only mainnet preparation. Never signs or broadcasts a transaction.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {parseEnv} from 'node:util';
import {encodeAbiParameters,encodeDeployData,encodeFunctionData,parseAbi,keccak256,toHex,getCreate2Address,getAddress} from 'viem';import {privateKeyToAccount} from 'viem/accounts';import {execFileSync} from 'node:child_process';
const output=process.argv[2];if(!output)throw Error('Supply a private release directory');
const root='0x1B6c450FaDB7c77191f152473FC2f79dC515FA77',owner='0xE5350D96FC3161BF5c385843ec5ee24E8B465B2f';
const signer=privateKeyToAccount(parseEnv(readFileSync(output+'/roles.signer.env','utf8')).CONTRIBUTOR_AUTHORITY_PRIVATE_KEY).address;
const artifact=JSON.parse(readFileSync('contributor-review/contracts/out/ContributorCredential.sol/ContributorCredential.json','utf8'));
const create=JSON.parse(readFileSync(output+'/create_call.json','utf8')),library=create.deployments[create.networkAddresses['1']];
const rpc=(method,...params)=>JSON.parse(execFileSync('alchemy',['--json','--no-interactive','evm','rpc',method,...params.map(p=>typeof p==='string'?p:JSON.stringify(p)),'-n','eth-mainnet'],{encoding:'utf8',maxBuffer:3000000,stdio:['ignore','pipe','pipe']}));
if(keccak256(rpc('eth_getCode',library.address,'latest'))!==library.codeHash)throw Error('Safe CreateCall code mismatch');
const initCode=encodeDeployData({abi:artifact.abi,bytecode:artifact.bytecode.object,args:[root,signer]});
const salt=keccak256(toHex('Bittrees Contributor Credential v1 / '+keccak256(initCode))),contract=getCreate2Address({from:root,salt,bytecode:initCode});
if(rpc('eth_getCode',contract,'latest')!=='0x')throw Error('Address is already deployed; verify existing deployment instead');
const data=encodeFunctionData({abi:create.abi,functionName:'performCreate2',args:[0n,initCode,salt]});
const safeAbi=parseAbi(['function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) payable returns(bool success)']);
// Threshold-one prevalidated owner signature is valid only when that owner sends the transaction.
const signature='0x'+owner.slice(2).toLowerCase().padStart(64,'0')+'0'.repeat(64)+'01',zero='0x'+'0'.repeat(40);
const safeData=encodeFunctionData({abi:safeAbi,functionName:'execTransaction',args:[library.address,0n,data,1,0n,0n,0n,zero,zero,signature]});
const gas=rpc('eth_estimateGas',{from:owner,to:root,data:safeData,value:'0x0'});
// Resolve immutable slots by compiler AST names, including EIP-712 caches.
const names={};const walk=x=>{if(!x||typeof x!=='object')return;if(x.nodeType==='VariableDeclaration'&&x.mutability==='immutable')names[x.id]=x.name;for(const v of Object.values(x))if(typeof v==='object')Array.isArray(v)?v.forEach(walk):walk(v);};
walk(artifact.ast);walk(JSON.parse(readFileSync('contributor-review/contracts/out/EIP712.sol/EIP712.json','utf8')).ast);
const name='Bittrees Contributor Credential',version='1',pad=x=>x.slice(2).padStart(64,'0');
const short=x=>toHex(x).slice(2).padEnd(62,'0')+x.length.toString(16).padStart(2,'0');
const separator=keccak256(encodeAbiParameters([{type:'bytes32'},{type:'bytes32'},{type:'bytes32'},{type:'uint256'},{type:'address'}],[keccak256(toHex('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),keccak256(toHex(name)),keccak256(toHex(version)),1n,contract]));
const values={rootAuthority:pad(root),_cachedThis:pad(contract),_cachedChainId:pad('0x01'),_cachedDomainSeparator:separator.slice(2),_hashedName:keccak256(toHex(name)).slice(2),_hashedVersion:keccak256(toHex(version)).slice(2),_name:short(name),_version:short(version)};
let runtime=artifact.deployedBytecode.object.slice(2);
for(const [id,refs] of Object.entries(artifact.deployedBytecode.immutableReferences)){const value=values[names[id]];if(!value||value.length!==64)throw Error('Unknown immutable: '+id+' / '+names[id]+'. Build with forge build --ast.');for(const {start,length} of refs){if(length!==32)throw Error('Unexpected immutable size');runtime=runtime.slice(0,start*2)+value+runtime.slice((start+length)*2);}}
const codeHash=keccak256('0x'+runtime);
const result={version:1,chainId:1,preparedAt:new Date().toISOString(),root,owner,rolesSigner:signer,contract,codeHash,initCodeHash:keccak256(initCode),createCall:library.address,createCallCodeHash:library.codeHash,salt,estimatedGas:parseInt(gas,16),transaction:{from:owner,to:root,data:safeData,value:'0x0',chainId:'0x1'},safeTransaction:{to:library.address,value:'0',data,operation:1},firstContributor:{ens:'raging.eth',wallet:owner,level:'Full Time',rank:'Lead contributor',term:'ongoing',requiresSignedMemorandum:true},status:'unsigned'};
mkdirSync(output+'/review',{recursive:true});writeFileSync(output+'/review/runtime.hex','0x'+runtime);writeFileSync(output+'/review/deployment.json',JSON.stringify(result,null,2));
writeFileSync(output+'/contract.configuration.env',`CONTRIBUTOR_CONTRACT_ADDRESS=${contract}\nCONTRIBUTOR_CONTRACT_CODE_HASH=${codeHash}\n`,{mode:0o600});
console.log(JSON.stringify({contract,root,rolesSigner:signer,estimatedGas:result.estimatedGas,codeHash,status:'Prepared and gas-simulated; not signed or broadcast'}));
