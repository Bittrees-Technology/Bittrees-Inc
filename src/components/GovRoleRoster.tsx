import {useQuery} from '@tanstack/react-query';
import {useContributorSession,contributorRequest} from '../lib/contributorSession';
import {useCommunity} from '../lib/community';
import {useState} from 'react';
const names:Record<string,string>={'bittrees.partner':'Partner','bittrees.junior-partner':'Junior Partner','bittrees.associate':'Associate','project.admin':'Project administrator'};
const cell={padding:'0.65rem',borderBottom:'1px solid var(--color-border)',verticalAlign:'top'};
function Sheet({head,rows}:{head:string[];rows:any[][]}){return <div style={{overflowX:'auto',border:'1px solid var(--color-border)'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left',fontSize:'0.85rem'}}><thead><tr>{head.map(h=><th key={h} style={cell}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j} style={{...cell,overflowWrap:'anywhere'}}>{v||'—'}</td>)}</tr>)}</tbody></table></div>;}
export default function GovRoleRoster({address}:{address?:string}){
 const auth=useContributorSession(),{data:community}=useCommunity();const [search,setSearch]=useState('');
 const verified=!!address&&auth.session?.wallet?.toLowerCase()===address.toLowerCase();
 const query=useQuery({queryKey:['gov-role-roster',address?.toLowerCase(),auth.session?.csrf],enabled:verified,retry:false,staleTime:0,refetchInterval:30000,refetchOnWindowFocus:true,queryFn:()=>contributorRequest({action:'gov_roles'},auth.session.csrf)});
 if(!verified)return <p>Use the top-right account menu to verify your wallet and view the Gov role catalog and assignments.</p>;
 const data=query.isError?null:query.data;
 const match=(...values:any[])=>values.join(' ').toLowerCase().includes(search.toLowerCase());
 const roleNames=new Map<string,string>((data?.roles||[]).map((r:any)=>[r.id,r.name]));for(const d of data?.definitions||[])roleNames.set(d.id,d.name);
 const roles=(data?.roles||[]).filter((r:any)=>match(r.name,r.description,r.scope));
 const assignments=(data?.assignments||[]).filter((a:any)=>match(a.principal,roleNames.get(a.definitionId)||roleNames.get(a.roleId),a.status));
 const members=(data?.members||[]).filter((m:any)=>match(m.principal,names[m.role]||m.role,m.status));
 const sourceRows=Object.entries(community?.roles||{}).flatMap(([wallet,entries])=>entries.filter(r=>match(wallet,r.label)).map(r=>[r.label,wallet,'Historical source label — no current authority']));
 return <section aria-label="Gov role catalog and assignments" style={{display:'grid',gap:'1rem'}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap'}}><h3 style={{margin:0}}>Gov role catalog and assignments</h3><button disabled={query.isFetching} onClick={()=>void query.refetch()}>{query.isFetching?'Syncing…':'Sync roles'}</button></div>
  {query.isError?<p role="alert">Unable to load the current Gov roster from Roles. Retry with Sync roles.</p>:!data?<p role="status">Loading Gov roles from Roles…</p>:<>
   <label>Search roles or wallets<input value={search} onChange={e=>setSearch(e.target.value)} style={{display:'block',width:'100%',marginTop:'0.5rem'}} /></label>
   <p style={{margin:0,color:'var(--color-ink-muted)',fontSize:'0.8125rem'}}>From roles.bittrees.org · revision {data.revision} · checked {new Date(data.checkedAt).toLocaleTimeString()}. Assignments follow the same visibility rules as Roles. Updates refresh every 30 seconds and when you return.</p>
   <h4 style={{margin:0}}>Gov roles</h4>
   <Sheet head={['Role','Purpose','Scope']} rows={roles.map((r:any)=>[r.name,r.description,r.scope])}/>
   {!!data.definitions?.length&&<><h4 style={{margin:0}}>Custom roles</h4><Sheet head={['Role','Purpose','Status']} rows={data.definitions.filter((d:any)=>match(d.name,d.description)).map((d:any)=>[d.name,d.description,d.archivedAt?'Archived':'Available'])}/></>}
   <h4 style={{margin:0}}>Role assignments</h4>
   {assignments.length?<Sheet head={['Role','Wallet / identity','Status','Expires']} rows={assignments.map((a:any)=>[roleNames.get(a.definitionId)||roleNames.get(a.roleId)||a.roleId,a.principal,a.current?'Current':a.status||'Not currently effective',a.expiresAt?new Date(a.expiresAt).toLocaleDateString():'Ongoing'])}/>:<p>No matching Gov assignments are visible to this wallet.</p>}
   <h4 style={{margin:0}}>Organization membership (separate from Gov access)</h4>
   <p style={{margin:0}}>Partner, Junior Partner and Associate appointments apply across Bittrees. Their BGOV requirements and approvals remain managed in Roles.</p>
   {members.length?<Sheet head={['Role','Wallet','Status','BGOV minimum']} rows={members.map((m:any)=>[names[m.role]||m.role,m.principal,m.status==='active'&&m.minimumBGOV&&!m.tokenEligible?'BGOV eligibility not met':m.status,m.minimumBGOV||'None'])}/>:<p>{data.partnershipActive?'No matching memberships are visible to this wallet.':'Partner membership is currently unavailable.'}</p>}
   {!!(sourceRows.length||community?.roledefs?.length)&&<details><summary>Historical Gov labels and tags</summary><p>These historical records are retained for audit. They are not current Gov assignments and do not establish shared permissions.</p><Sheet head={['Role / tag','Wallet','Authority']} rows={sourceRows}/><Sheet head={['Source role definition','Description']} rows={(community?.roledefs||[]).filter(r=>match(r.label,r.description)).map(r=>[r.label,r.description])}/></details>}
  </>}
 </section>;
}
