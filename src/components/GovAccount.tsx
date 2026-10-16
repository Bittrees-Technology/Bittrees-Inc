import {ConnectButton} from '@rainbow-me/rainbowkit';
import {useAccount,useDisconnect,useSignMessage} from 'wagmi';
import {useEffect,useRef,useState} from 'react';
import {getAccount} from '@wagmi/core';
import {wagmiConfig} from '../lib/chains';
import {contributorRequest,useContributorSession} from '../lib/contributorSession';
import './gov-account.css';

export default function GovAccount(){
 const auth=useContributorSession(),{address,status}=useAccount(),{disconnectAsync}=useDisconnect(),{signMessageAsync}=useSignMessage();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const previous=useRef<string|undefined>(undefined),menu=useRef<HTMLDetailsElement>(null),working=useRef(false);
 useEffect(()=>{const restore=()=>{void auth.refetch();};window.addEventListener('focus',restore);return()=>window.removeEventListener('focus',restore);},[auth.refetch]);
 useEffect(()=>{const close=(event:Event)=>{if(menu.current&&!menu.current.contains(event.target as Node))menu.current.open=false;};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&menu.current)menu.current.open=false;};document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};},[]);
 const verified=!!auth.session?.wallet&&auth.session.wallet===address?.toLowerCase();
 async function signOut(disconnect=true){
  if(working.current)return;working.current=true;setBusy(true);setError('');
  try{if(auth.session)await contributorRequest({action:'sign_out'},auth.session.csrf);await auth.clear();if(disconnect)await disconnectAsync();if(menu.current)menu.current.open=false;}
  catch(e){setError((e as Error).message);if(menu.current)menu.current.open=true;}
  finally{working.current=false;setBusy(false);}
 }
 useEffect(()=>{
  if(status==='connected'&&address)previous.current=address;
  else if(status==='disconnected'&&previous.current&&!working.current){previous.current=undefined;void signOut(false);}
 },[address,status,busy]);
 async function verify(){
  if(!address||working.current)return;const wallet=address;working.current=true;setBusy(true);setError('');
  try{
   const challenge=await contributorRequest({action:'wallet_login_start',address:wallet});
   if(getAccount(wagmiConfig).address!==wallet)throw Error('Wallet changed. Please try again.');
   const signature=await signMessageAsync({account:wallet,message:challenge.message});
   if(getAccount(wagmiConfig).address!==wallet)throw Error('Wallet changed. Please try again.');
   await contributorRequest({action:'wallet_login_finish',challenge:challenge.challenge,signature});
   const refreshed=await auth.refetch();if(refreshed.error)throw refreshed.error;
   if(getAccount(wagmiConfig).address!==wallet){if(refreshed.data?.session)await contributorRequest({action:'sign_out'},refreshed.data.session.csrf);await auth.clear();throw Error('Wallet changed. Please verify the connected wallet.');}
   if(menu.current)menu.current.open=false;
  }catch(e){setError((e as Error).message);}finally{working.current=false;setBusy(false);}
 }
 return <ConnectButton.Custom>{({account,chain,mounted,openAccountModal,openChainModal,openConnectModal})=>{
  const label=account?.displayName||(auth.session?.wallet?`${auth.session.wallet.slice(0,6)}…${auth.session.wallet.slice(-4)}`:'Account');
  return <div className="gov-account" data-insights-ignore="true">
   {!account&&!auth.session&&<ConnectButton chainStatus="icon" showBalance={false} accountStatus="avatar"/>}
   {mounted&&(account||auth.session)&&<>
    {account&&chain&&<button type="button" className="gov-chain" onClick={openChainModal} aria-label="Change network">{chain.hasIcon&&chain.iconUrl?<img src={chain.iconUrl} alt=""/>:chain.name}<span aria-hidden="true">⌄</span></button>}
    <details ref={menu} className="gov-account-menu"><summary aria-label="Account menu">{account?.ensAvatar&&<img src={account.ensAvatar} alt=""/>}<span className="gov-account-label">{label}</span><span aria-hidden="true">⌄</span></summary>
     <div className="gov-account-panel">
      {verified?<p>Wallet verified</p>:address?<><p>Verify this wallet to access private contributor records.</p><button className="btn-primary" disabled={busy} onClick={verify}>{busy?'Waiting for wallet…':'Verify wallet and continue'}</button></>:<p>Connect your wallet to sign or issue a memorandum.</p>}
      {account?<button disabled={busy} onClick={openAccountModal}>Wallet settings</button>:<button disabled={busy} onClick={openConnectModal}>Connect Wallet</button>}
      <a href="https://roles.bittrees.org/profile">View Roles profile</a>
      <button disabled={busy} onClick={()=>signOut()}>Sign out</button>
      {error&&<p role="alert">{error}</p>}
     </div>
    </details>
   </>}
  </div>;
 }}</ConnectButton.Custom>;
}
