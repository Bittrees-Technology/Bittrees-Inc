import {useEffect,useState} from 'react';
export function ForumSubscriptions(){
 const [email,setEmail]=useState(''),[ready,setReady]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [token]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).get('forum-email')||'');
 useEffect(()=>{if(token)window.history.replaceState(null,'',window.location.pathname+window.location.search);},[token]);
 useEffect(()=>{fetch('/api/forum-subscriptions').then(r=>r.ok?r.json():Promise.reject()).then(v=>setReady(v.emailReady===true)).catch(()=>setReady(false));},[]);
 async function submit(action:string){setBusy(true);setMessage('');try{const r=await fetch('/api/forum-subscriptions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,email:email.trim(),token})});const data=await r.json();if(!r.ok)throw Error(data.error||'Unable to update subscription.');setMessage(data.message||(data.status==='subscribed'?'Subscribed. You’ll receive a daily digest when there are new discussions.':'Unsubscribed. You will not receive future digests; an email already being sent may still arrive.'));}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <section className="card" aria-label="Forum subscriptions" data-insights-ignore="true">
  <h2 style={{fontSize:'1.1rem'}}>Follow the forum</h2>
  <p>Receive a daily email digest of new discussions, or follow updates in Bittrees Chat.</p>
  {token ? <div><p>Manage your email subscription. Confirm only if you requested these updates.</p><button className="btn-primary" disabled={busy} onClick={()=>submit('confirm')}>Confirm subscription</button>{' '}<button className="btn-secondary" disabled={busy} onClick={()=>submit('unsubscribe')}>Unsubscribe</button></div>:
   <form onSubmit={e=>{e.preventDefault();void submit('subscribe');}} style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end'}}>
    <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={!ready||busy} style={{display:'block',padding:10,maxWidth:'100%',boxSizing:'border-box'}}/></label>
    <button className="btn-primary" disabled={!ready||busy}>{busy?'Sending…':'Subscribe by email'}</button>
   </form>}
  {!token&&ready===false&&<p>Email subscriptions are not available yet. You can follow updates in Chat.</p>}
  {message&&<p role="status">{message}</p>}
  <p><a href="https://chat.bittrees.org/?forum=governance" target="_blank" rel="noreferrer">Follow in Bittrees Chat →</a></p>
  <p style={{fontSize:'.8rem'}}>Email requires confirmation. Chat updates refresh while the app is open. You can unsubscribe at any time.</p>
 </section>;
}
