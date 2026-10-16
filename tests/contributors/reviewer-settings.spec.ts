import {test,expect} from '@playwright/test';
for(const role of ['Partner','Junior Partner','Associate'])test(`${role} setup lives in settings and disappears when registered`,async({page})=>{
 const wallet='0x1111111111111111111111111111111111111111';let registered=false;
 await page.addLocatorHandler(page.getByRole('region',{name:'Analytics preferences'}),async()=>{await page.getByRole('button',{name:'Decline',exact:true}).click();});
 await page.addInitScript(({wallet})=>{let connected=false;const listeners=new Map();(window as any).ethereum={isMetaMask:true,on(e:string,f:any){if(!listeners.has(e))listeners.set(e,new Set());listeners.get(e).add(f);},removeListener(e:string,f:any){listeners.get(e)?.delete(f);},async request({method}:any){if(method==='eth_accounts')return connected?[wallet]:[];if(method==='eth_requestAccounts'){connected=true;return[wallet];}if(method==='eth_chainId')return '0x1';throw Error('No wallet signatures allowed in this test');}};},{wallet});
 await page.route('**/api/authority-access?*',r=>r.fulfill({json:{configured:true,permissions:[],roles:[{label:role}],expiresAt:Date.now()+30000}}));
 await page.route('**/api/community',r=>r.fulfill({json:{roles:{},flags:{},roledefs:[],enckeys:registered?{[wallet]:'a'.repeat(64)}:{},reviewerAuthority:{mode:'roles',ready:true,reviewers:registered?[wallet]:[],expiresAt:Date.now()+30000}}}));
 await page.route('**/graphql',r=>r.fulfill({json:{data:{attestations:[]}}}));
 await page.route('**/api/contributors',r=>r.fulfill({json:r.request().method()==='GET'?{session:{wallet,csrf:'test'}}:{applications:[],persona:{id:'staff',canReview:true}}}));
 await page.goto('/admin');if(!await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().isVisible())await page.locator('.gov-account-menu summary').click();await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().click();await page.getByRole('button',{name:/^MetaMask(?:\s|$)/}).click();
 await expect(page.getByText('Encryption access for future applications')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Enable application access'})).toHaveCount(0);
 await page.getByRole('button',{name:'Admin settings',exact:true}).click();await expect(page.getByRole('button',{name:'Enable application access',exact:true})).toBeVisible();
 registered=true;await page.getByRole('button',{name:'Contributor applications',exact:true}).click();await page.getByRole('button',{name:'Admin settings',exact:true}).click();
 await expect(page.getByText('Application access enabled.',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Enable application access',exact:true})).toHaveCount(0);
});
