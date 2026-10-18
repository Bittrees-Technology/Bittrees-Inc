import {test,expect} from '@playwright/test';

test('navigation avoids idle polling while protected controls refresh and deny expired or unavailable authority',async({page})=>{
 test.setTimeout(60000);
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 const wallet='0x1111111111111111111111111111111111111111';let mode='grant',reads=0;
 await page.route('https://insights.bittrees.org/**',r=>r.abort());
 await page.route('**/graphql',r=>r.fulfill({json:{data:{attestations:[],space:{admins:[]}}}}));
 await page.route('**/api/community',r=>r.fulfill({json:{roles:{},roledefs:[],flags:{},enckeys:{}}}));
 await page.route('**/api/contributors',r=>r.fulfill({json:{session:null,applications:[],persona:{}}}));
 await page.route('**/api/authority-access?*',r=>{
  reads++;if(mode==='failure')return r.fulfill({status:503,json:{error:'Test unavailable'}});
  return r.fulfill({json:{configured:true,permissions:['denied','expired'].includes(mode)?[]:['community.moderation.manage'],roles:[],expiresAt:Date.now()+(mode==='expired'?-1000:30000)}});
 });
 await page.addInitScript(({wallet})=>{let connected=false;(window as any).ethereum={isMetaMask:true,on(){},removeListener(){},async request({method}:any){if(method==='eth_accounts')return connected?[wallet]:[];if(method==='eth_requestAccounts'){connected=true;return[wallet];}if(method==='eth_chainId')return '0x1';throw Error('Unexpected wallet operation');}};},{wallet});
 await page.goto('/');
 await page.getByRole('button',{name:'Connect Wallet',exact:true}).click();await page.getByRole('button',{name:/^MetaMask(?:\s|$)/}).click();
 const admin=page.locator('.gov-header-inner').getByRole('link',{name:'Admin',exact:true});
 await expect(admin).toBeVisible();const idleReads=reads;
 await page.waitForTimeout(11000);expect(reads).toBe(idleReads);
 mode='expired';await admin.click();
 await expect.poll(()=>reads).toBeGreaterThan(idleReads);
 await expect(page.getByRole('button',{name:'Moderation',exact:true})).toHaveCount(0);
 await expect(admin).toBeVisible();
 mode='grant';await expect(page.getByRole('button',{name:'Moderation',exact:true})).toBeVisible({timeout:10000});
 mode='failure';await expect(page.getByRole('button',{name:'Moderation',exact:true})).toHaveCount(0,{timeout:10000});
 await expect(admin).toBeVisible();
 mode='denied';await expect(admin).toHaveCount(0,{timeout:10000});
});
