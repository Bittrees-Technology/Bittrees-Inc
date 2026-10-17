import {test,expect} from '@playwright/test';
test('same-wallet refresh preserves open forms and input; denied refresh removes private records',async({page})=>{
 const wallet='0x'+'1'.repeat(40);let lists=0,release:any,deny=false;
 const app={id:'mine',identity:'owner',name:'Jonathan',project:'Gov',state:'submitted',version:1,wallet,walletVerification:'verified',specialty:'Original interests',expertise:['Business'],region:['EMEA'],languages:['English'],heardFrom:'Community',memos:[],reviews:[],proposals:[],validations:[]};
 await page.clock.install();
 await page.route('https://insights.bittrees.org/consent.js',r=>r.abort());await page.route('**/graphql',r=>r.fulfill({json:{data:{attestations:[]}}}));
 await page.route('**/api/contributors',async r=>{
  if(r.request().method()==='GET')return r.fulfill({json:{session:{wallet,csrf:'test'}}});
  lists++;if(lists>1)await new Promise(resolve=>{release=resolve;});
  return r.fulfill(deny?{status:403,json:{error:'Access expired'}}:{json:{applications:[app],persona:{id:'owner',canReview:false}}});
 });
 await page.goto('/admin/contributors');await page.getByRole('button',{name:'My application',exact:true}).click();await page.getByText('Edit my application',{exact:true}).click();
 const input=page.getByRole('textbox',{name:'Contribution interests',exact:true});await input.fill('Unsaved work');
 const focus=async()=>{await page.clock.fastForward(31000);await page.evaluate(()=>window.dispatchEvent(new Event('visibilitychange')));};
 await focus();await expect.poll(()=>lists).toBe(2);await expect(input).toHaveValue('Unsaved work');const refreshed=page.waitForResponse(r=>r.url().endsWith('/api/contributors')&&r.request().method()==='POST');release();await refreshed;await expect(input).toHaveValue('Unsaved work');
 deny=true;await focus();await expect.poll(()=>lists).toBe(3);release();await expect(page.locator('main').getByRole('alert')).toContainText('Access expired');await expect(input).toHaveCount(0);
});
