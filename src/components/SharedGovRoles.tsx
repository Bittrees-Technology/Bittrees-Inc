import {useAuthorityAccess} from '../lib/authorityAccess';

const accessLabels: Record<string,string> = {
  'community.roles.manage':'Manage Gov community roles',
  'community.moderation.manage':'Moderate Gov content',
  'rooms.manage':'Manage community rooms',
  'rooms.propose':'Propose community rooms',
};

export default function SharedGovRoles({address}:{address?:string}) {
  const access=useAuthorityAccess(address);
  const unavailable=access.isError || (access.data?.expiresAt !== undefined && access.data.expiresAt<=Date.now());
  const current=address && !unavailable && access.data?.configured ? access.data : null;
  // Tier actions include inherited capabilities. Show the highest effective tier
  // without suggesting that the wallet holds three separate appointments.
  const tiers=['Partner','Junior Partner','Associate'];
  const highest=tiers.find(t=>current?.roles?.some(r=>r.label===t));
  const roles=[...new Set((current?.roles||[]).map(r=>r.label))].filter(label=>!tiers.includes(label)||label===highest);
  return <section aria-label="Shared Gov roles" style={{display:'grid',gap:'1rem',fontFamily:'var(--font-sans)'}}>
    <header><h2 className="text-display">Roles</h2><p>Current access comes from Roles. Manage Gov assignments and partner decisions there.</p></header>
    <nav aria-label="Roles site" style={{display:'flex',gap:'1rem',flexWrap:'wrap'}}>
      <a href="https://roles.bittrees.org/role-management?project=gov&view=all">Manage Gov roles</a>
      <a href="https://roles.bittrees.org/partnership">Partner decisions</a>
      <a href="https://roles.bittrees.org/profile">My role profile</a>
    </nav>
    {!address ? <p>Connect your wallet at the top right to see your Gov access.</p> : <>
      <div style={{display:'flex',gap:'1rem',alignItems:'center',flexWrap:'wrap'}}>
        <h3 style={{margin:0}}>Your Gov access</h3>
        <button type="button" onClick={()=>void access.refetch()} disabled={access.isFetching}>{access.isFetching?'Checking…':'Refresh roles'}</button>
      </div>
      <p style={{margin:0,overflowWrap:'anywhere'}}>{address}</p>
      {unavailable ? <p role="alert">Roles could not be verified. Refresh to check again; old role records are not shown as current access.</p>
        : !access.data ? <p role="status">Checking Roles…</p>
        : !access.data.configured ? <p role="status">Shared role authority is not active for Gov. Open Roles to review the project’s setup.</p>
        : <>
          <div style={{overflowX:'auto',border:'1px solid var(--color-border)'}}>
            <table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}>
              <thead><tr><th style={{padding:'0.75rem'}}>Effective roles</th><th style={{padding:'0.75rem'}}>Gov permissions</th></tr></thead>
              <tbody><tr><td style={{padding:'0.75rem',verticalAlign:'top',borderTop:'1px solid var(--color-border)'}}>{roles.length?roles.map(role=><div key={role}>{role}</div>):'No active role returned'}</td>
                <td style={{padding:'0.75rem',verticalAlign:'top',borderTop:'1px solid var(--color-border)'}}>{current?.permissions.length?current.permissions.map(permission=><div key={permission}>{accessLabels[permission]||permission}</div>):'No Gov administration permissions'}</td></tr></tbody>
            </table>
          </div>
          <p style={{margin:0,color:'var(--color-ink-muted)',fontSize:'0.8125rem'}}>Checked {new Date(access.dataUpdatedAt).toLocaleTimeString()}. Refreshes automatically and when you return to Gov. Effective roles include inherited access; appointments and approval history are shown in Roles.</p>
        </>}
    </>}
  </section>;
}
