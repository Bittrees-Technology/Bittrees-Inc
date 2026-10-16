import {test,expect} from '@playwright/test';
for(const end of ['sign-out','disconnect'])test(`header owns contributor verification and ${end}`,async({page})=>{
 const wallet='0x1111111111111111111111111111111111111111',other='0x2222222222222222222222222222222222222222';let session:any=null,signOuts=0;
 await page.addLocatorHandler(page.getByRole('region',{name:'Analytics preferences'}),async()=>{await page.getByRole('button',{name:'Decline',exact:true}).click();});
 await page.addInitScript(({wallet})=>{
  let connected=false,address=wallet;const listeners=new Map();(window as any).__proofs=0;
  const emit=(event:string,value:any)=>listeners.get(event)?.forEach((fn:any)=>fn(value));
  (window as any).__changeContributorWallet=(value:string|null)=>{connected=!!value;if(value)address=value;emit('accountsChanged',value?[value]:[]);if(!value)emit('disconnect',{code:4900,message:'Test disconnect'});};
  (window as any).ethereum={isMetaMask:true,on(e:string,f:any){if(!listeners.has(e))listeners.set(e,new Set());listeners.get(e).add(f);},removeListener(e:string,f:any){listeners.get(e)?.delete(f);},async request({method}:any){if(method==='eth_accounts')return connected?[address]:[];if(method==='eth_requestAccounts'){connected=true;return[address];}if(method==='eth_chainId')return '0x1';if(method==='personal_sign'){(window as any).__proofs++;return '0x'+'1'.repeat(130);}if(method==='wallet_revokePermissions')return null;throw Error('Unexpected wallet request: '+method);}};
 },{wallet});
 await page.route('**/api/authority-access?*',r=>r.fulfill({json:{configured:true,permissions:[],roles:[]}}));
 await page.route('**/graphql',r=>r.fulfill({json:{data:{attestations:[]}}}));
 await page.route('**/api/contributors',r=>{
  if(r.request().method()==='GET')return r.fulfill({json:{configured:true,session}});
  const body=r.request().postDataJSON();
  if(body.action==='wallet_login_start')return r.fulfill({json:{challenge:'test-challenge',message:'Test contributor verification'}});
  if(body.action==='wallet_login_finish'){session={wallet,csrf:'test-csrf'};return r.fulfill({json:{ok:true}});}
  if(body.action==='sign_out'){expect(r.request().headers()['x-contributor-csrf']).toBe('test-csrf');session=null;signOuts++;return r.fulfill({json:{ok:true}});}
  expect(body.action).toBe('list');return r.fulfill({json:{applications:[{id:'private',name:'Private applicant',identity:'owner',state:'submitted',specialty:'Private interests',wallet,memos:[],reviews:[],proposals:[],validations:[]}],persona:{id:'reviewer',canReview:true}}});
 });
 await page.goto('/admin/contributors');await page.getByRole('button',{name:'Connect Wallet',exact:true}).click();await page.getByRole('button',{name:/^MetaMask(?:\s|$)/}).click();
 await expect(page.locator('main').getByRole('button',{name:'Connect Wallet',exact:true})).toHaveCount(0);await page.locator('.gov-account-menu summary').click();await page.getByRole('button',{name:'Verify wallet and continue',exact:true}).click();
 await expect(page.getByRole('button',{name:'Open Private applicant',exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as any).__proofs)).toBe(1);
 await expect(page.locator('main').getByText('Wallet settings',{exact:true})).toHaveCount(0);await expect(page.locator('main').getByText('End contributor session',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Directory',exact:true}).click();await page.getByRole('button',{name:'Applications',exact:true}).click();expect(await page.evaluate(()=>(window as any).__proofs)).toBe(1);
 if(end==='sign-out'){await page.locator('.gov-account-menu summary').click();await expect(page.getByText('Wallet verified',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Sign out',exact:true}).click();}
 else{await page.evaluate(other=>(window as any).__changeContributorWallet(other),other);await expect(page.getByRole('button',{name:'Open Private applicant',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>(window as any).__proofs)).toBe(1);await page.evaluate(()=>(window as any).__changeContributorWallet(null));}
 await expect.poll(()=>signOuts).toBe(1);await expect(page.getByRole('button',{name:'Open Private applicant',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Connect your wallet',exact:true})).toBeVisible();
});
