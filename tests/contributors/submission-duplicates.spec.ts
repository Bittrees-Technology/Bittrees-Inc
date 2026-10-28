import {test,expect} from '@playwright/test';
test('an existing verified applicant is directed to their record before requesting another transaction',async({page})=>{
 const wallet='0x'+'1'.repeat(40);let checked=0;
 await page.addInitScript(({wallet})=>{
  let connected=false;const listeners=new Map();(window as any).__transactionRequests=0;(window as any).__signatureRequests=0;
  (window as any).ethereum={isMetaMask:true,on(e:string,f:any){if(!listeners.has(e))listeners.set(e,new Set());listeners.get(e).add(f);},removeListener(e:string,f:any){listeners.get(e)?.delete(f);},async request({method}:any){if(method==='eth_accounts')return connected?[wallet]:[];if(method==='eth_requestAccounts'){connected=true;return[wallet];}if(method==='eth_chainId')return '0x1';if(method==='personal_sign')(window as any).__signatureRequests++;if(method==='eth_sendTransaction')(window as any).__transactionRequests++;throw Error('Test refuses '+method);}};
 },{wallet});
 await page.route('https://insights.bittrees.org/consent.js',r=>r.abort());
 await page.route('**/graphql',r=>r.fulfill({json:{data:{attestations:[]}}}));
 await page.route('**/api/contributors',r=>{
  if(r.request().method()==='GET')return r.fulfill({json:{session:{wallet,csrf:'test'}}});
  const b=r.request().postDataJSON();expect(b.action).toBe('list');checked++;
  return r.fulfill({json:{applications:[{wallet,walletVerification:'verified',state:'approved'}],intakes:[]}});
 });
 await page.goto('/contributors/apply');await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().click();await page.getByRole('button',{name:/^MetaMask(?:\s|$)/}).click();
 await page.getByRole('textbox',{name:/Name or handle/}).fill('Existing applicant');await page.getByRole('button').filter({hasText:/^Business$/}).click();await page.getByRole('textbox',{name:/What would you like to contribute/}).fill('Continue documentation.');await page.getByRole('button').filter({hasText:/^EMEA$/}).click();await page.getByRole('textbox',{name:/How did you learn/}).fill('Website');
 await page.getByRole('button',{name:'Submit application',exact:true}).click();await expect(page.locator('.contributor-application [role=alert]')).toContainText('You already have an application');expect(checked).toBe(1);expect(await page.evaluate(()=>(window as any).__signatureRequests)).toBe(0);expect(await page.evaluate(()=>(window as any).__transactionRequests)).toBe(0);
});
