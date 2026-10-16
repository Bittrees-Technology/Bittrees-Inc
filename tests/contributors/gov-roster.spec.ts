import {test,expect} from '@playwright/test';
test('Gov displays shared catalog, other wallets and refreshed assignments',async({page})=>{
 const wallet='0x1111111111111111111111111111111111111111',other='0x2222222222222222222222222222222222222222';let current=true,fail=false;
 await page.route('https://insights.bittrees.org/consent.js',r=>r.abort());
 await page.addInitScript(({wallet})=>{let connected=false;(window as any).ethereum={isMetaMask:true,on(){},removeListener(){},async request({method}:any){if(method==='eth_accounts')return connected?[wallet]:[];if(method==='eth_requestAccounts'){connected=true;return[wallet];}if(method==='eth_chainId')return '0x1';throw Error('Unexpected signature');}};},{wallet});
 await page.route('**/api/authority-access?*',r=>r.fulfill({json:{configured:true,permissions:[],roles:[]}}));
 await page.route('**/api/community',r=>r.fulfill({json:{roles:{},roledefs:[],flags:{},enckeys:{}}}));await page.route('**/graphql',r=>r.fulfill({json:{data:{attestations:[]}}}));
 await page.route('**/api/contributors',r=>{
  if(r.request().method()==='GET')return r.fulfill({json:{session:{wallet,csrf:'roster-test'}}});
  if(r.request().postDataJSON().action!=='gov_roles')return r.fulfill({json:{applications:[],persona:{}}});
  expect(r.request().headers()['x-contributor-csrf']).toBe('roster-test');
  return fail?r.fulfill({status:503,json:{error:'Unavailable'}}):r.fulfill({json:{project:'gov',revision:3,checkedAt:Date.now(),roles:[{id:'gov.mod',name:'Gov Moderator',description:'Moderates Gov',scope:'project:gov'}],definitions:[],assignments:[{id:'a',roleId:'gov.mod',principal:other,current,status:current?'active':'revoked'}],members:[{principal:wallet,role:'bittrees.partner',status:'active',minimumBGOV:420,tokenEligible:true}],partnershipActive:true}});
 });
 await page.goto('/admin');await expect(page.locator('.gov-account-menu summary')).toBeVisible();await page.locator('.gov-account-menu summary').click();await page.getByRole('button',{name:'Connect Wallet',exact:true}).click();await page.getByRole('button',{name:/^MetaMask(?:\s|$)/}).click();await page.getByRole('button',{name:'Roles',exact:true}).click();
 const panel=page.getByRole('region',{name:'Gov role catalog and assignments'});
 await expect(panel.getByRole('cell',{name:other,exact:true})).toBeVisible();await expect(panel.getByRole('cell',{name:'Current',exact:true})).toBeVisible();
 current=false;await panel.getByRole('button',{name:'Sync roles'}).click();await expect(panel.getByRole('cell',{name:'revoked',exact:true})).toBeVisible();
 fail=true;await panel.getByRole('button',{name:'Sync roles'}).click();await expect(panel.getByRole('alert')).toBeVisible();await expect(panel.getByRole('table')).toHaveCount(0);
});
