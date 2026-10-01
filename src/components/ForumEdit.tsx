import { useEffect, useState } from 'react';
import { useAccount, useChainId, useSwitchChain, useWalletClient } from 'wagmi';
import { getWalletClient } from '@wagmi/core';
import { useQueryClient } from '@tanstack/react-query';
import { base, wagmiConfig } from '../lib/chains';
import { EASSCAN_VIEW, publishRevision, ZERO32, type ForumPost } from '../lib/forum';
import { ForumMarkdown, MarkdownField } from './ForumMarkdown';

export function ForumPostActions({post}:{post:ForumPost}) {
  const {address}=useAccount();
  const qc=useQueryClient();
  const [editing,setEditing]=useState<ForumPost|null>(null);
  const [pending,setPending]=useState<{hash:string;uid?:string}|null>(null);
  const indexed=!!pending?.uid && post.revisions?.some(r=>r.id.toLowerCase()===pending.uid?.toLowerCase());
  useEffect(()=>{
    if(!pending || indexed)return;
    const timer=setInterval(()=>{
      qc.invalidateQueries({queryKey:['forum-topics']});
      qc.invalidateQueries({queryKey:['forum-thread']});
    },5000);
    const stop=setTimeout(()=>clearInterval(timer),90000);
    return ()=>{clearInterval(timer);clearTimeout(stop);};
  },[pending,indexed,qc]);
  return <div style={{marginTop:12,fontFamily:'var(--font-sans)',fontSize:'.82rem'}}>
    {post.editedAt && <p>Edited · {new Date(post.editedAt*1000).toLocaleString()}</p>}
    {post.revisions?.length ? <details><summary style={{cursor:'pointer'}}>Version history ({post.revisions.length+1})</summary>
      <section style={{padding:'12px 0'}}><a href={`${EASSCAN_VIEW}${post.id}`} target="_blank" rel="noreferrer">Original · {new Date(post.time*1000).toLocaleString()}</a>
        {post.originalTitle && <h3>{post.originalTitle}</h3>}<ForumMarkdown text={post.originalBody??post.body}/></section>
      {post.revisions.map(r=><section key={r.id} style={{padding:'12px 0',borderTop:'1px solid var(--color-border)'}}><a href={`${EASSCAN_VIEW}${r.id}`} target="_blank" rel="noreferrer">Revision · {new Date(r.time*1000).toLocaleString()}{r.id===post.revisionId?' · current':''}</a>{r.title && <h3>{r.title}</h3>}<ForumMarkdown text={r.body}/></section>)}
    </details>:null}
    {pending && <p role="status">{indexed?'Your edit is now visible.':'Edit confirmed on Base. Waiting for the indexer; your previous version may remain visible briefly.'} <a href={`https://basescan.org/tx/${pending.hash}`} target="_blank" rel="noreferrer">View transaction</a></p>}
    {address?.toLowerCase()===post.attester.toLowerCase() && post.community==='bittrees-inc' && !editing &&
      <button type="button" className="btn-secondary" disabled={!!pending&&!indexed} onClick={()=>setEditing({...post})} style={{marginTop:8}}>Edit post</button>}
    {editing && address?.toLowerCase()===post.attester.toLowerCase() && <RevisionEditor post={editing} cancel={()=>setEditing(null)} saved={result=>{
      setPending(result);setEditing(null);
      qc.invalidateQueries({queryKey:['forum-topics']});qc.invalidateQueries({queryKey:['forum-thread']});
    }}/>}
  </div>;
}
function RevisionEditor({post,cancel,saved}:{post:ForumPost;cancel:()=>void;saved:(result:{hash:string;uid?:string})=>void}) {
  const {address}=useAccount();const chainId=useChainId();const {switchChainAsync}=useSwitchChain();const {data:walletClient}=useWalletClient();
  const [title,setTitle]=useState(post.title),[body,setBody]=useState(post.body),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const isReply=post.refUID!==ZERO32;
  async function save(){
    if(!walletClient||!address)return;
    setBusy(true);setError('');
    try{
      let client=walletClient;
      if(chainId!==base.id){await switchChainAsync({chainId:base.id});client=(await getWalletClient(wagmiConfig,{chainId:base.id}))??walletClient;}
      saved(await publishRevision({walletClient:client,account:address,post,title:isReply?'':title.trim(),body:body.trim(),expectedRevisionId:post.revisionId??post.id}));
    }catch(e){setError((e as {shortMessage?:string;message?:string}).shortMessage||(e as Error).message||'Unable to save edit.');}
    finally{setBusy(false);}
  }
  return <section aria-label="Edit post" style={{padding:16,marginTop:12,border:'1px solid var(--color-border)'}}>
    <h3>Edit post</h3>
    <p>This saves a new public version on Base. The original remains on-chain. Your wallet confirms the transaction and gas fee. The first edit in this forum may also require a schema-registration transaction.</p>
    <fieldset disabled={busy} style={{border:0,padding:0,minWidth:0}}>
      {!isReply&&<label>Title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={120} style={{display:'block',width:'100%',padding:8}}/></label>}
      <MarkdownField value={body} onChange={setBody}/>
      <div style={{display:'flex',gap:12,marginTop:12}}><button className="btn-primary" onClick={save} disabled={!body.trim()||(!isReply&&!title.trim())||(body===post.body&&title===post.title)}>{busy?'Confirm in wallet…':'Save edit'}</button><button className="btn-secondary" onClick={cancel}>Cancel</button></div>
    </fieldset>
    {error&&<p role="alert">{error}</p>}
  </section>;
}
