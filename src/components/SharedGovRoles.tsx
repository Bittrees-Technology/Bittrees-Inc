import GovRoleRoster from './GovRoleRoster';
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
    <header><h2 className="text-display">Roles</h2><p>Gov’s role catalog and assignments are synchronized from Roles. Manage changes and approvals there.</p></header>
    <nav aria-label="Roles site" style={{display:'flex',gap:'1rem',flexWrap:'wrap'}}>
      <a href="https://roles.bittrees.org/role-management?project=gov&view=all">Manage Gov roles</a>
      <a href="https://roles.bittrees.org/partnership">Partner decisions</a>
      <a href="https://roles.bittrees.org/profile">My role profile</a>
    </nav>
    <section aria-label="Gov role structure" className="card">
      <h3>Membership and site administration</h3>
      <p>Partner, Junior Partner and Associate are Bittrees memberships. A Partner is eligible for a separate Gov Superadmin appointment; membership alone does not grant site administration.</p>
      <details><summary>Administration and Superadmin eligibility</summary>
        <ul><li>Superadmin: appointed through Partner approval, with root Safe control; manages Gov Admins and approved operational roles.</li>
        <li>Admin: manages designated operational roles, not Admin or Superadmin appointments.</li>
        <li>Moderator and Operations: retain their specific Gov duties.</li></ul>
        <p>Superadmin appointments require a verified wallet with an issued, current and active memorandum of contribution NFT. The credential must remain valid to retain Superadmin access. This continuing requirement applies to project and ecosystem Superadmins. Gov Partner, Junior Partner, Associate, Admin and operational roles also require a valid contributor credential at assignment and throughout their access.</p>
        <p>bittrees.eth retains override and recovery authority. An invalid contributor credential pauses affected role access without deleting the appointment history. Existing BGOV and approval requirements still apply.</p>
        <p>The credential rule takes effect through the approved Roles rollout. Review its activation status in Roles; publishing this rule does not execute a contract upgrade.</p>
        <a href="https://roles.bittrees.org/activity/rules">Review Roles rules and implementation status</a>
      </details>
    </section>
    <GovRoleRoster address={address} />
    <details><summary>Your effective Gov access</summary>
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
    </details>
  </section>;
}
