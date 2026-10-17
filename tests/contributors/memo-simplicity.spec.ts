import {test,expect} from '@playwright/test';
for(const stage of ['unsigned','signed','pending','issued'])test(`memo ${stage} shows one next step and keeps maintenance collapsed`,async({page})=>{
 const wallet='0x'+'1'.repeat(40),memo={version:2,status:stage==='issued'?'issued':'draft',wallet,scope:'Lead metaverse strategy and recruit contributors.',level:'Full Time',rank:'Lead contributor',start:'2026-10-17',end:null,consent:stage==='unsigned'?null:{},allocationWeight:{label:'1'},allocationNotice:'Monthly allocation follows the approved policy.',hash:'a'.repeat(64)};
 const app={id:'memo',identity:'owner',name:'Example contributor',project:'Bittrees Governance',state:'approved',version:5,wallet,walletVerification:'verified',specialty:'Strategy',memos:[memo],reviews:[],proposals:[],validations:[],memoEdits:[],credential:stage==='issued'?{standing:'active',tokenId:'1'}:null,chainOperation:stage==='pending'?{status:'prepared',kind:'issue'}:null};
 await page.route('https://insights.bittrees.org/consent.js',r=>r.abort());
 await page.route('**/api/contributors',r=>r.fulfill({json:r.request().method()==='GET'?{session:{wallet,csrf:'test'}}:{today:'2026-10-17',applications:[app],persona:{id:'owner',canReview:true,canIssue:true,canChangeStatus:true}}}));
 await page.route('**/graphql',r=>r.fulfill({json:{data:{attestations:[]}}}));
 await page.goto('/admin/contributors');await page.getByRole('button',{name:'Memoranda & issuance',exact:true}).click();await page.getByRole('button',{name:'Open Example contributor',exact:true}).click();
 const queue=page.getByRole('region',{name:'Memorandum queue'});await expect(queue).toHaveCount(0);await expect(page.getByRole('list',{name:'Memorandum progress'})).toBeVisible();await expect(page.getByRole('button',{name:'← All memoranda'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Renew memorandum signature',exact:true})).not.toBeVisible();
 await expect(page.getByRole('combobox',{name:'New standing',exact:true})).not.toBeVisible();
 if(stage==='signed'){await expect(page.getByRole('button',{name:'Prepare credential transaction'})).toBeVisible();await page.getByText('Renew signed acknowledgment',{exact:true}).click();await expect(page.getByRole('button',{name:'Renew memorandum signature'})).toBeVisible();await page.getByText('Renew signed acknowledgment',{exact:true}).click();}
 else await expect(page.getByRole('button',{name:'Prepare credential transaction'})).toHaveCount(0);
 if(stage==='pending')await expect(page.getByRole('heading',{name:'Transaction awaiting confirmation'})).toBeVisible();
 if(stage==='issued'){await page.getByText('Change credential standing',{exact:true}).click();await expect(page.getByRole('combobox',{name:'New standing'})).toBeVisible();await page.getByText('Change credential standing',{exact:true}).click();}
 if(stage==='unsigned')await expect(page.getByRole('button',{name:'Sign memorandum with wallet'})).toBeVisible();
 await page.screenshot({path:`artifacts/memo-simple-${stage}.png`,fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByRole('button',{name:'← All memoranda'}).click();await expect(queue.getByRole('columnheader')).toHaveCount(5);
});

test('memo refreshes do not duplicate the change request form',async({page})=>{
 const wallet='0x'+'1'.repeat(40);let version=2;
 const memo=()=>({version,status:'draft',wallet,scope:'Steward Bittrees.',level:'Full Time',rank:'Lead contributor',start:'2026-10-17',end:null,hash:'a'.repeat(64)});
 await page.route('https://insights.bittrees.org/consent.js',r=>r.abort());
 await page.route('**/graphql',r=>r.fulfill({json:{data:{attestations:[]}}}));
 await page.route('**/api/contributors',r=>{
  if(r.request().method()==='GET')return r.fulfill({json:{session:{wallet,csrf:'test'}}});
  if(r.request().postDataJSON().action==='review')version++;
  return r.fulfill({json:{today:'2026-10-17',persona:{id:'owner',canReview:true,canIssue:true},applications:[{id:'memo',identity:'owner',name:'Example',project:'Gov',state:'approved',version,wallet,walletVerification:'verified',memos:[memo()],memoEdits:[],reviews:[],proposals:[],validations:[]}]}});
 });
 await page.goto('/admin/contributors');await page.getByRole('button',{name:'Memoranda & issuance',exact:true}).click();await page.getByRole('button',{name:'Open Example',exact:true}).click();
 for(let i=0;i<4;i++){
  await expect(page.getByText('Propose changes to this memorandum',{exact:true})).toHaveCount(1);
  await page.getByText('Manage memorandum & history',{exact:true}).click();
  await page.getByText('Prepare a revised memorandum',{exact:true}).click();
  await page.getByRole('button',{name:'Prepare for acknowledgment'}).click();
  await expect(page.getByText(`Version ${i+3} · Ready for contributor review`,{exact:true})).toBeVisible();
  await page.getByText('Manage memorandum & history',{exact:true}).click();
 }
 await expect(page.getByText('Propose changes to this memorandum',{exact:true})).toHaveCount(1);
});
